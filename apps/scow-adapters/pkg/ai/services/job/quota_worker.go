package job

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"

	"github.com/sirupsen/logrus"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/client"
	"scow-adapters/pkg/ai/db/models"
	"scow-adapters/pkg/ai/inference"
	"scow-adapters/pkg/ai/utils"
)

// 账户锁对象 + 引用计数
type accountLock struct {
	mu  sync.Mutex
	ref int32 // 引用计数
}

// 全局锁
var (
	lockMap = make(map[string]*accountLock)
	mapMu   sync.RWMutex
)

type SubmitJobReq struct {
	OriginTrainIn *pb.SubmitJobRequest      `json:"origin_train_in,omitempty"`
	OriginInferIn *pb.SubmitInferJobRequest `json:"origin_infer_in,omitempty"`
	OriginDevIn   *pb.CreateDevHostRequest  `json:"origin_dev_in,omitempty"`
	NewJobName    string                    `json:"new_job_name"`
	WorkDir       string                    `json:"work_dir"`
}

func CreateJobWithGpuQuotaCheck(jobTable *models.JobTable, submitJobInfo *SubmitJobReq) (bool, error) {
	if jobTable == nil || submitJobInfo == nil {
		return false, fmt.Errorf("job table and submit job info must not be nil")
	}

	al := getAccountLock(jobTable.Account)
	al.mu.Lock()
	defer func() {
		al.mu.Unlock()
		putAccountLock(jobTable.Account)
	}()

	account, err := utils.GetAccountByName(jobTable.Account)
	if err != nil {
		return false, fmt.Errorf("get account %s: %w", jobTable.Account, err)
	}

	usedGpuNum, err := utils.GetAccountUsedGpuNum(jobTable.Account)
	if err != nil {
		return false, fmt.Errorf("get account %s used gpu num: %w", jobTable.Account, err)
	}

	requestedGpuNum := uint64(jobTable.GPUsReq)
	queued := account.GpuQuota > 0 && requestedGpuNum > 0 &&
		uint64(usedGpuNum)+requestedGpuNum > uint64(account.GpuQuota)
	if queued {
		logrus.Infof("Account %v gpu request %v has exceeded its quota %v (used: %v)",
			jobTable.Account, requestedGpuNum, account.GpuQuota, usedGpuNum)
		jobTable.State = utils.QueuedStatus
		jobTable.Reason = fmt.Sprintf("The account %v gpu quota: %v, used: %v, req %v will exceed the quota. "+
			"job will be queued and submit automatically after the gpu meets the quota",
			account.Name, account.GpuQuota, usedGpuNum, requestedGpuNum)
	}

	if err := client.DB.Create(jobTable).Error; err != nil {
		return false, fmt.Errorf("create job: %w", err)
	}
	if !queued {
		return false, nil
	}

	submitJobInfo.NewJobName = jobTable.NewJobName
	submitJobInfo.WorkDir = jobTable.WorkDir
	if err := SaveJobSubmitInfoToFile(submitJobInfo); err != nil {
		deleteErr := client.DB.Where("job_db_inx = ?", jobTable.JobDBInx).Delete(&models.JobTable{}).Error
		logrus.Infof("delete DB jobname %s, err: %v", jobTable.NewJobName, deleteErr)
		return false, fmt.Errorf("save queued job submit info: %w", err)
	}

	return true, nil
}

// getAccountLock 获取或创建锁，引用计数 +1
func getAccountLock(account string) *accountLock {
	mapMu.Lock()
	defer mapMu.Unlock()

	al, ok := lockMap[account]
	if !ok {
		al = &accountLock{}
		lockMap[account] = al
	}
	atomic.AddInt32(&al.ref, 1)
	return al
}

// putAccountLock 引用计数 -1，归零时删除锁
func putAccountLock(account string) {
	mapMu.Lock()
	defer mapMu.Unlock()

	al := lockMap[account]
	if al == nil {
		return
	}
	if atomic.AddInt32(&al.ref, -1) == 0 {
		delete(lockMap, account)
	}
}

func TryResubmitJob(accountName string) {
	logrus.Infof("have job deleted or account quota update, try to resubmit the queued job")

	al := getAccountLock(accountName)
	al.mu.Lock()
	defer func() {
		al.mu.Unlock()
		putAccountLock(accountName) // 自动清理
	}()

	account, err := utils.GetAccountByName(accountName)
	if err != nil {
		logrus.Errorf("Resubmit Job, get account failed %v", err)
		return
	}

	queuedJobs, err := utils.GetJobsByAccountAndStatus(accountName, []string{"QUEUED"})
	if err != nil {
		logrus.Errorf("Resubmit Job, get jobs by account %v failed: %v", account, err)
		return
	}

	usedGpuNum, err := utils.GetAccountUsedGpuNum(accountName)
	if err != nil {
		logrus.Errorf("Resubmit Job, get account used gpu num failed %v", err)
		return
	}

	if account.GpuQuota != 0 && uint(usedGpuNum) >= uint(account.GpuQuota) {
		logrus.Errorf("account used gpu %d exceed quota %d", usedGpuNum, account.GpuQuota)
		return
	}

	for _, queuedJob := range queuedJobs {
		if account.GpuQuota != 0 && uint(usedGpuNum)+queuedJob.GPUsReq > uint(account.GpuQuota) {
			logrus.Errorf("the job %v gpu request %d add account used gpu %d exceed "+
				"quota %d, try next job", queuedJob.NewJobName, queuedJob.GPUsReq, usedGpuNum, account.GpuQuota)
			continue
		}

		submitted, err := tryResubmitJob(queuedJob)
		if submitted {
			// Kubernetes 资源已创建，即使后续数据库状态同步失败，本轮配额计算也必须计入该作业。
			usedGpuNum += uint32(queuedJob.GPUsReq)
		}
		if err != nil {
			logrus.Errorf("SubmitJob, try resubmit job failed %v", err)
			continue
		}
	}
}

func tryResubmitJob(job *models.JobTable) (bool, error) {
	logrus.Infof("The gpu quota of the account %v is met, and the job %v is now automatically submitted", job.Account, job.NewJobName)
	submitJobInfo, err := LoadJobSubmitInfoFromFile(job.NewJobName)
	if err != nil {
		logrus.Errorf("Resubmit queued job, info file create failed: %v", err)
		return false, err
	}

	switch job.JobType {
	case utils.InferJob:
		_, err = inference.SubmitInference(submitJobInfo.OriginInferIn, submitJobInfo.NewJobName, submitJobInfo.WorkDir)
		if err != nil {
			logrus.Errorf("Resubmit queued job failed: %v", err)
			return false, err
		}
		logrus.Infof("Resubmit queued job %v success", job.NewJobName)
	case utils.DevHost:
		if err = DevHostVCJob(submitJobInfo.OriginDevIn, submitJobInfo.NewJobName, submitJobInfo.WorkDir); err != nil {
			return false, err
		}
		logrus.Infof("Resubmit queued dev host %v success", job.NewJobName)
	default:
		if submitJobInfo.OriginTrainIn.ExtraOptions[0] == utils.Train {
			if err = TrainVCJob(submitJobInfo.OriginTrainIn, submitJobInfo.NewJobName, submitJobInfo.WorkDir); err != nil {
				return false, err
			}
			logrus.Infof("Resubmit queued job %v success", job.NewJobName)
		} else {
			if err = AppVCJob(submitJobInfo.OriginTrainIn, submitJobInfo.NewJobName, submitJobInfo.WorkDir); err != nil {
				return false, err
			}
			logrus.Infof("Resubmit queued job %v success", job.NewJobName)
		}
	}

	statusErr := utils.MarkQueuedJobPending(job.JobDBInx)
	if deleteErr := DeleteJobSubmitInfoFile(job.NewJobName); deleteErr != nil {
		logrus.Errorf("Resubmit queued job, delete submit info file failed: %v", deleteErr)
	}
	if statusErr != nil {
		return true, fmt.Errorf("mark resubmitted job %d pending: %w", job.JobDBInx, statusErr)
	}
	return true, nil
}

// SaveJobSubmitInfoToFile 将请求序列化为 JSON 并写入 /adapter/queued/<newJobName>
func SaveJobSubmitInfoToFile(req *SubmitJobReq) error {
	if req == nil {
		return fmt.Errorf("submit job info is nil")
	}
	if req.NewJobName == "" {
		return fmt.Errorf("newJobName is empty")
	}

	// 确保目录存在
	if err := os.MkdirAll(utils.QueuedJobPath, 0755); err != nil {
		return fmt.Errorf("mkdir %s: %w", utils.QueuedJobPath, err)
	}

	// 生成绝对路径：/adapter/queued/<newJobName>
	path := filepath.Join(utils.QueuedJobPath, req.NewJobName)
	f, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("create file %s: %w", path, err)
	}
	defer f.Close()

	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	if err := enc.Encode(req); err != nil {
		return fmt.Errorf("encode json: %w", err)
	}
	return nil
}

// LoadJobSubmitInfoFromFile 从 /adapter/queued/<newJobName> 读取 JSON 并还原为 SubmitJobReq
func LoadJobSubmitInfoFromFile(newJobName string) (*SubmitJobReq, error) {
	if newJobName == "" {
		return nil, fmt.Errorf("newJobName is empty")
	}

	path := filepath.Join(utils.QueuedJobPath, newJobName)
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read file %s: %w", path, err)
	}

	req := &SubmitJobReq{}
	if err := json.Unmarshal(data, req); err != nil {
		return nil, fmt.Errorf("unmarshal json: %w", err)
	}

	return req, nil
}

// DeleteJobSubmitInfoFile 根据作业名删除对应文件
func DeleteJobSubmitInfoFile(newJobName string) error {
	if newJobName == "" {
		return fmt.Errorf("newJobName is empty")
	}

	path := filepath.Join(utils.QueuedJobPath, newJobName)
	if err := os.Remove(path); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return fmt.Errorf("delete file %s: %w", path, err)
	}
	return nil
}
