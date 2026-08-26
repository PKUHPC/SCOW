package timer

import (
	"context"
	"strings"
	"sync"
	"time"

	"scow-adapters/pkg/ai/db/models"
	"scow-adapters/pkg/ai/inference"
	"scow-adapters/pkg/ai/train"
	"scow-adapters/pkg/ai/utils"

	"github.com/sirupsen/logrus"

	k8sclient "k8s.io/client-go/kubernetes"
	volcanoclientset "volcano.sh/apis/pkg/client/clientset/versioned"
)

type Timer struct {
	k8sClient *k8sclient.Clientset
	vcClient  *volcanoclientset.Clientset
	Timers    *sync.Map // 存储活跃的定时器
	rwMu      sync.RWMutex
	stopChan  chan struct{}
}

func NewTimerManager(cli *k8sclient.Clientset, vcCli *volcanoclientset.Clientset) *Timer {
	tm := &Timer{
		k8sClient: cli,
		vcClient:  vcCli,
		Timers:    &sync.Map{}, // 指针类型必须显式初始化
		stopChan:  make(chan struct{}),
	}

	// 程序启动时恢复定时器
	tm.recoverTimersOnStartup()

	return tm
}

// recoverTimersOnStartup 程序启动时恢复未完成的定时器
func (tm *Timer) recoverTimersOnStartup() {
	var elapsed int64
	tm.rwMu.Lock()
	defer tm.rwMu.Unlock()
	// 获取所有运行的作业
	runningJobs, err := utils.GetJobsByStatus([]string{"RUNNING"})
	if err != nil {
		logrus.Errorf("[RecoverTimers] Failed to get jobs info: %v", err)
	}
	logrus.Infof("Recover timers for running jobs on startup, jobs count: %d", len(runningJobs))
	for _, job := range runningJobs {
		// 长期运行的推理任务Timelimit是0，因此不需要启动定时器
		if job.Timelimit == 0 {
			continue
		}
		logrus.Infof("Recover Timers For Job: %v On Startup", job.NewJobName)
		// 计算剩余超时时间
		pods := utils.GetPodsByJobName(job.NewJobName)
		elapsed = utils.GetJobElapsedSeconds(job, pods)
		remaining := int64(job.Timelimit)*60 - elapsed // job的Timelimit是存储的分钟
		if remaining <= 0 {
			// 立即触发超时
			go func(job *models.JobTable) {
				var err error
				err = tm.timeoutDeletion(job)
				if err != nil {
					logrus.Errorf("[recoverTimersOnStartup] delete timeout job %s failed: %s", job.NewJobName, err)
					return
				}
			}(job)
			continue
		}
		// 重新启动定时器
		tm.StartTimer(job, remaining)
	}
}

// StartTimer 启动一个定时器来删除作业
func (tm *Timer) StartTimer(job *models.JobTable, timeout int64) {
	if val, exists := tm.Timers.Load(job.NewJobName); exists {
		logrus.Infof("Timer: %v, value; %v, timer for job %v already exists, skip creation", tm, val, job.NewJobName)
		return
	}
	logrus.Infof("Prepare to create a timer for job: %v, the expiration time is after: %v s", job.NewJobName, timeout)
	ctx, cancel := context.WithCancel(context.Background())
	remainingTime := time.Duration(timeout) * time.Second
	// 存储取消函数
	tm.Timers.Store(job.NewJobName, cancel)
	go func() {
		logrus.Infof("Create a timer for the job: %v to delete the job when it expires, expires time: %v", job.NewJobName, remainingTime)
		timer := time.NewTimer(remainingTime)
		defer timer.Stop()
		select {
		case <-timer.C:
			tm.Timers.Delete(job.NewJobName)
			// 超时后删除作业
			if err := tm.timeoutDeletion(job); err != nil {
				logrus.Errorf("Delete timeout job: %v failed: %v", job.NewJobName, err)
			} else {
				logrus.Infof("Successfully deleted timeout job %v", job.NewJobName)
			}
		case <-ctx.Done():
			// 定时器被取消
			logrus.Infof("Timer for job %v was canceled", job.NewJobName)
			return
		case <-tm.stopChan:
			// 程序停止
			logrus.Info("Timer stopped due to service shutdown")
			return
		}
	}()
}

// timeoutDeletion 删除超时的作业
func (tm *Timer) timeoutDeletion(job *models.JobTable) error {
	tm.rwMu.Lock()
	defer tm.rwMu.Unlock()
	logrus.Infof("The job: %v is expiration and will be deleted", job.NewJobName)
	nowJob, err := utils.GetJobByName(job.NewJobName)
	if err != nil {
		logrus.Errorf("DB select jobName %s error: %v", job.NewJobName, err)
		return err
	}
	// 只删RUNNING的作业
	if !strings.EqualFold(nowJob.State, "RUNNING") {
		return nil
	}
	pods := utils.GetPodsByJobName(nowJob.NewJobName)
	var elapsed int64
	elapsed = utils.GetJobElapsedSeconds(nowJob, pods)
	limit := int64(nowJob.Timelimit) * 60
	if elapsed < limit {
		remaining := limit - elapsed
		logrus.Infof("job %s timer fired but actual elapsed %d < limit %d, restart timer with %d seconds",
			nowJob.NewJobName, elapsed, limit, remaining)
		tm.StartTimer(nowJob, remaining)
		return nil
	}

	jobName := nowJob.NewJobName
	namespace := nowJob.Partition
	if nowJob.JobType == utils.Inference {
		err := inference.DeleteInferenceJob(
			jobName,
			nowJob.GpuType,
			namespace,
			uint32(nowJob.PODsReq),
			tm.k8sClient,
			tm.vcClient,
		)
		if err != nil {
			logrus.Errorf("Delete inference job failed.")
			return err
		}
	} else {
		err := train.DeleteVCJobResources(nowJob, tm.k8sClient, tm.vcClient)
		if err != nil {
			logrus.Errorf("CancelJob failed %v", err)
			return err
		}
	}
	// 更新pod 及 job 状态为TimeOut
	tm.UpdateStatus(jobName)

	return nil
}

// CancelTimer 取消指定作业的定时器
func (tm *Timer) CancelTimer(jobName string) {
	// 原子获取并删除定时器
	cancel, loaded := tm.Timers.LoadAndDelete(jobName)
	if loaded {
		if cancelFn, ok := cancel.(context.CancelFunc); ok {
			cancelFn()
			logrus.Infof("Timer: %v, timer for job %v was canceled", tm, jobName)
		}
	}
}

// Stop 停止所有定时器
func (tm *Timer) Stop() {
	close(tm.stopChan)

	// 取消所有活跃定时器
	tm.Timers.Range(func(key, value interface{}) bool {
		if cancel, ok := value.(context.CancelFunc); ok {
			cancel()
		}
		return true
	})
}

// 更新job及pod 状态

func (tm *Timer) UpdateStatus(jobName string) {
	var err error
	pods := utils.GetPodsByJobName(jobName)
	for _, podInfo := range pods {
		// 取消或失败的pod不需要修改状态状态为timeout
		logrus.Tracef("[UpdateStatus] pod %s status is %s", podInfo.Name, podInfo.Status)
		if podInfo.Status == utils.CanceledStatus || podInfo.Status == utils.FailedStatus {
			continue
		}
		err = utils.UpdatePodStatusByPodName(podInfo.Name, utils.TimeOutStatus)
		if err != nil {
			logrus.Errorf("update pod %s status timeout  failed, err: %v", podInfo.Name, err)
			continue
		}
		logrus.Infof("update pod %s status timeout successfully", podInfo.Name)
	}
	err = utils.UpdateJobStatusByJobName(jobName, utils.TimeOutStatus)
	if err != nil {
		logrus.Errorf("update job %s status timeout  failed, err: %v", jobName, err)
		return
	}
	logrus.Infof("update job %s status timeout successfully", jobName)
}
