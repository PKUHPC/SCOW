package utils

import (
	"errors"
	"fmt"
	"os"
	"sort"
	"time"

	v1 "k8s.io/api/core/v1"

	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
	"sigs.k8s.io/yaml"

	"scow-adapters/pkg/ai/client"
	"scow-adapters/pkg/ai/db/models"
)

func GetJobNamesByStatus(status []string) ([]string, error) {
	var (
		jobs    []models.JobTable
		jobName []string
	)

	err := client.DB.Where("state IN ?", status).Find(&jobs).Error
	if err != nil {
		return nil, err
	}

	for _, job := range jobs {
		jobName = append(jobName, job.NewJobName)
	}

	return jobName, nil
}

func GetJobsByStatus(status []string) ([]*models.JobTable, error) {
	var jobs []*models.JobTable

	err := client.DB.Where("state in ?", status).Find(&jobs).Error
	if err != nil {
		return nil, err
	}

	return jobs, nil
}

func GetJobsByAccountAndStatus(account string, status []string) ([]*models.JobTable, error) {
	var jobs []*models.JobTable

	err := client.DB.Where("account = ? AND state in ?", account, status).
		Order("FIELD(qos, 'high', 'normal', 'low'), time_submit ASC").
		Find(&jobs).Error
	if err != nil {
		return nil, err
	}

	return jobs, nil
}

func GetJobsByUserAndId(userName string, jobId uint32) (*models.JobTable, error) {
	var job *models.JobTable
	err := client.DB.Where("job_db_inx = ? AND username = ?", jobId, userName).First(&job).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		} else {
			return nil, fmt.Errorf("get job by username and id failed %v", err)
		}
	}
	return job, err
}

func GetJobByName(name string) (job *models.JobTable, err error) {
	err = client.DB.Where("new_job_name = ? ", name).First(&job).Error
	if err != nil {
		logrus.Errorf("[GetJobByName] DB select NewJobName %s error: %v", name, err)
		return nil, err
	}
	return job, nil
}

func GetJobInfoById(jobId uint32) (job *models.JobTable, exits bool, err error) {
	err = client.DB.Where("job_db_inx = ?", jobId).First(&job).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, false, nil
		}
		logrus.Errorf("[GetJobById] DB select Job Id %d error: %v", jobId, err)
		return nil, false, err
	}
	return job, true, nil
}

func DeleteJobById(jobId uint32) error {
	result := client.DB.Where("job_db_inx = ?", jobId).Delete(&models.JobTable{})

	if result.Error != nil {
		logrus.Errorf("[DeleteJobById] DB delete Job Id %d error: %v", jobId, result.Error)
		return result.Error
	}

	// 检查是否成功删除了记录
	if result.RowsAffected == 0 {
		// 没有删除任何记录，说明作业不存在
		return fmt.Errorf("job id %d not found", jobId)
	}

	return nil
}

func SaveJobInfoToFile(jobInfo interface{}, jobName string) {
	yamlBytes, err := yaml.Marshal(jobInfo)
	if err != nil {
		logrus.Warnf("[SaveJobFile] marshal job info err: %s", err)
		return
	}
	// 写入文件
	filePath := "/tmp/yaml"
	fileName := fmt.Sprintf("%s/%s.yaml", filePath, jobName)
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		err := os.MkdirAll(filePath, 0755)
		if err != nil {
			logrus.Errorf("create dir failed: %s", err)
			return
		}
	}
	if err := os.WriteFile(fileName, yamlBytes, 0600); err != nil {
		logrus.Errorf("[SaveJobFile] write file failed, err: %s", err)
	}
}

func GetUnfinishedJobsByAccountName(accountName string) ([]*models.JobTable, error) {
	var unfinishedJobs []*models.JobTable
	err := client.DB.Where("account = ? AND state in ?", accountName, []string{"RUNNING", "PENDING"}).Find(&unfinishedJobs).Error
	if err != nil {
		return nil, err
	}
	return unfinishedJobs, nil
}

func GetUnfinishedJobsByUserAndAccount(userName, account string) ([]*models.JobTable, error) {
	var unfinishedJobs []*models.JobTable
	err := client.DB.Where("username = ? AND account = ? AND state in ?", userName, account, []string{"RUNNING", "PENDING"}).Find(&unfinishedJobs).Error
	if err != nil {
		return nil, err
	}
	return unfinishedJobs, nil
}

func GetUnfinishedJobsByUserName(userName string) ([]*models.JobTable, error) {
	var unfinishedJobs []*models.JobTable
	err := client.DB.Where("username = ? AND state in ?", userName, []string{"RUNNING", "PENDING"}).Find(&unfinishedJobs).Error
	if err != nil {
		return nil, err
	}
	return unfinishedJobs, nil
}

func GetAccountUsedGpuNum(accountName string) (uint32, error) {
	unfinishedJobs, err := GetUnfinishedJobsByAccountName(accountName)
	if err != nil {
		logrus.Errorf("get jobs by account %v failed: %v", accountName, err)
		return 0, err
	}

	gpuReq := 0
	for _, job := range unfinishedJobs {
		gpuReq += int(job.GPUsReq)
	}

	return uint32(gpuReq), nil
}

func MarkQueuedJobPending(jobID uint64) error {
	result := client.DB.Model(&models.JobTable{}).
		Where("job_db_inx = ? AND state = ?", jobID, QueuedStatus).
		Updates(map[string]interface{}{
			"state":    PendingStatus,
			"reason":   "",
			"mod_time": uint64(time.Now().Unix()),
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected > 0 {
		return nil
	}

	// Informer 可能先一步把作业更新为 PENDING 或 RUNNING，此时只清理排队原因，不回退状态。
	result = client.DB.Model(&models.JobTable{}).
		Where("job_db_inx = ? AND state IN ?", jobID, []string{PendingStatus, RunningStatus}).
		Updates(map[string]interface{}{
			"reason":   "",
			"mod_time": uint64(time.Now().Unix()),
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected > 0 {
		return nil
	}

	var job models.JobTable
	if err := client.DB.Select("state").Where("job_db_inx = ?", jobID).First(&job).Error; err != nil {
		return err
	}
	return fmt.Errorf("job %d state is %s, expected %s, %s or %s",
		jobID, job.State, QueuedStatus, PendingStatus, RunningStatus)
}

func UpdateJobStatusByJobName(jobName, state string) error {
	logrus.Tracef("[UpdateJobStatusByJobName] jobName: %s, state: %s", jobName, state)
	job, err := GetJobByName(jobName)
	if err != nil {
		return err
	}
	updates := map[string]interface{}{
		"state":    state,
		"time_end": uint64(time.Now().Unix()),
	}
	// 如果 time_start 为 0，补写当前时间
	if job.TimeStart == 0 {
		updates["time_start"] = uint64(time.Now().Unix())
	}
	return client.DB.Model(&job).Updates(updates).Error
}

func getJobDurationFallback(job *models.JobTable) int64 {
	timeStart := int64(job.TimeStart)
	timeEnd := int64(job.TimeEnd)
	if timeStart <= 0 {
		return 0
	}
	if job.State == RunningStatus {
		return time.Now().Unix() - timeStart
	}
	if timeEnd > timeStart {
		return timeEnd - timeStart
	}
	return 0
}

func GetVCJobDurationByJobName(job *models.JobTable, pods []*models.PodTable) (duration int64) {
	jobName := job.NewJobName
	podCount := int(job.PODsReq)
	if len(pods) == 0 {
		logrus.Warnf("[GetVCJobDurationByJobName] job %s get pods is null", jobName)
		return getJobDurationFallback(job)
	}
	// pod 数量等于 podCount 说明未发生重启，直接用 job 级别时间
	if len(pods) == podCount {
		return getJobDurationFallback(job)
	}

	// 按 pod name 分组累加时长（同名 pod 为同一 worker 多次抢占后的重建）
	podDurations := make(map[string]int64)
	for _, pod := range pods {
		if pod.StartTime == 0 {
			continue
		}
		var d int64
		switch pod.Status {
		case string(v1.PodPending):
			continue
		case string(v1.PodRunning):
			d = time.Now().Unix() - pod.StartTime
		case string(v1.PodFailed), string(v1.PodSucceeded), CanceledStatus, TimeOutStatus:
			if pod.EndTime == 0 {
				logrus.Errorf("[GetVCJobDurationByJobName] jobName: %s, podName: %s, podStatus: %s, endTime: %d", jobName, pod.Name, pod.Status, pod.EndTime)
				continue
			}
			d = pod.EndTime - pod.StartTime
		default:
			logrus.Warnf("[GetVCJobDurationByJobName] jobName: %s, podName: %s, podStatus: %s is not expected", jobName, pod.Name, pod.Status)
			continue
		}
		podDurations[pod.Name] += d
	}

	// 多 pod job 各 worker 同时运行，取最大值作为 job 实际运行时长
	for _, d := range podDurations {
		if d > duration {
			duration = d
		}
	}

	logrus.Infof("[GetVCJobDurationByJobName] jobName: %s, duration: %d", jobName, duration)
	return duration
}

// GetElapsedSecondsByDeployPods 计算 Deployment 类型作业的实际运行时长
// Deployment 重建后 pod 名称会变化，用时间区间合并
// 将所有 pod 的 [StartTime, EndTime] 合并去重后求和，自然排除中间的 pending 时段
// 多副本场景下同批次 pod 时间段重叠，合并后只计一次
func GetElapsedSecondsByDeployPods(job *models.JobTable, pods []*models.PodTable) int64 {
	logrus.Tracef("[GetElapsedSecondsByDeployPods] jobName: %s, jobState: %s, podCount: %d", job.NewJobName, job.State, len(pods))
	jobName := job.NewJobName
	podCount := int(job.PODsReq)
	if len(pods) == 0 {
		logrus.Warnf("[GetElapsedSecondsByDeployPods] job %s has no pods", jobName)
		return getJobDurationFallback(job)
	}
	// pod 数量等于 podCount 说明未发生重启，直接用 job 级别时间
	if len(pods) == podCount {
		return getJobDurationFallback(job)
	}

	type interval struct{ start, end int64 }
	now := time.Now().Unix()
	var intervals []interval

	for _, pod := range pods {
		if pod.StartTime == 0 {
			logrus.Warnf("[GetElapsedSecondsByDeployPods] jobName: %s, podName: %s has no start time", jobName, pod.Name)
			continue // pending pod，跳过
		}
		end := pod.EndTime
		if end == 0 {
			if job.State == RunningStatus {
				end = now
			} else {
				logrus.Warnf("[GetElapsedSecondsByDeployPods] jobName: %s, podName: %s has no end time", jobName, pod.Name)
				continue // 异常数据，跳过
			}
		}
		if end <= pod.StartTime {
			logrus.Warnf("[GetElapsedSecondsByDeployPods] jobName: %s, podName: %s has invalid time, startTime: %d, endTime: %d", jobName, pod.Name, pod.StartTime, pod.EndTime)
			continue
		}
		intervals = append(intervals, interval{pod.StartTime, end})
	}

	if len(intervals) == 0 {
		return getJobDurationFallback(job)
	}

	sort.Slice(intervals, func(i, j int) bool {
		return intervals[i].start < intervals[j].start
	})

	merged := []interval{intervals[0]}
	for _, iv := range intervals[1:] {
		last := &merged[len(merged)-1]
		if iv.start <= last.end {
			if iv.end > last.end {
				last.end = iv.end
			}
		} else {
			merged = append(merged, iv)
		}
	}

	// 合并后求和，多区间说明发生过重启，pending 时段已被排除
	var total int64
	for _, iv := range merged {
		total += iv.end - iv.start
	}
	logrus.Infof("[GetElapsedSecondsByDeployPods] jobName: %s, total: %d", jobName, total)
	return total
}
