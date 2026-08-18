package informer

import (
	"sync"
	"time"

	"github.com/sirupsen/logrus"
	v1 "k8s.io/api/core/v1"
	"volcano.sh/apis/pkg/apis/batch/v1alpha1"

	"scow-adapters/pkg/ai/client"
	"scow-adapters/pkg/ai/db/models"
	"scow-adapters/pkg/ai/inference"
	qw "scow-adapters/pkg/ai/services/job"
	"scow-adapters/pkg/ai/train"
	"scow-adapters/pkg/ai/utils"
)

func (i *K8sInformer) handleVcJobUpdate(obj interface{}) {
	var (
		status string
		err    error
		job    *models.JobTable
	)
	volcanoJob := obj.(*v1alpha1.Job)
	jobName := volcanoJob.Name
	jobStatus := volcanoJob.Status.State.Phase
	logrus.Tracef("update vcjob: %s", jobName)
	if job, err = utils.GetJobByName(jobName); err != nil {
		logrus.Errorf("DB select jobName %s error: %v", jobName, err)
		return
	}
	logrus.Tracef("jobName %s, old job status %s, now job status: %s", jobName, job.State, jobStatus)
	// todo 判断job状态是否真的发生变化，避免重复更新数据库

	curTime := uint64(time.Now().Unix())
	updates := map[string]interface{}{
		"mod_time": curTime,
	}
	switch jobStatus {
	case v1alpha1.Pending:
		status = utils.PendingStatus
	case v1alpha1.Running:
		var remaining int64
		if vcjobRunningPhaseShouldBePending(volcanoJob) {
			status = utils.PendingStatus
			break
		}
		status = utils.RunningStatus
		// 1. 首次进入 Running 的任务，需要设置任务开始时间
		//    被抢占的作业还没有 Running，TimeStart 还是 0
		if job.TimeStart == 0 {
			if volcanoJob.Status.State.LastTransitionTime.Time.Unix() > 0 {
				updates["time_start"] = uint64(volcanoJob.Status.State.LastTransitionTime.Time.Unix())
			} else {
				updates["time_start"] = curTime
			}
		}
		// 2. 任务被抢占并且当前状态是 Pending，才需要重启定时器；其他情况按照正常的 timelimit 设置定时器
		if job.Timelimit > 0 && job.State == utils.PendingStatus {
			if job.IsPreempt == 1 {
				pods := utils.GetPodsByJobName(job.NewJobName)
				jobDuration := utils.GetVCJobDurationByJobName(job, pods)
				remaining = int64(job.Timelimit)*60 - jobDuration
				if remaining <= 0 {
					logrus.Warnf("jobName %s has exceeded its timelimit, remaining time: %d seconds, set remaining time to 0", jobName, remaining)
					remaining = 0
				}
				logrus.Infof("jobName %s is preempted, jobDuration: %d seconds, remaining time: %d seconds", jobName, jobDuration, remaining)
				i.timer.StartTimer(job, remaining)
			} else {
				// 任务首次进入 Running，创建完整时长定时器
				remaining = int64(job.Timelimit) * 60
				i.timer.StartTimer(job, remaining)
			}
		}
	case v1alpha1.Completed, v1alpha1.Completing:
		status = utils.CompletedStatus
	case v1alpha1.Aborted, v1alpha1.Aborting:
		status = utils.FailedStatus
	case v1alpha1.Failed:
		status = utils.FailedStatus
	case v1alpha1.Terminated, v1alpha1.Terminating:
		status = utils.CanceledStatus
	default:
		logrus.Warnf("jobName %s has unknown status: %s", jobName, jobStatus)
		return
	}

	updates["state"] = status
	if status == utils.CompletedStatus || status == utils.FailedStatus || status == utils.CanceledStatus {
		endTime := curTime
		if volcanoJob.Status.State.LastTransitionTime.Time.Unix() > 0 {
			endTime = uint64(volcanoJob.Status.State.LastTransitionTime.Time.Unix())
		}
		if job.TimeStart == 0 {
			updates["time_start"] = endTime
			updates["time_end"] = endTime
			logrus.Warnf("jobName %s job TimeStart is 0 (Running state was skipped), set TimeStart and TimeEnd to LastTransitionTime: %d", jobName, endTime)
		} else {
			updates["time_end"] = endTime
		}
		go qw.TryResubmitJob(job.Account)
	}
	err = client.DB.Model(&job).Updates(updates).Error
	if err != nil {
		logrus.Errorf("jobName %s DB update failed due to: %s", jobName, err)
		return
	}
	logrus.Infof("update job  %s status %s successful", jobName, status)
}

func vcjobRunningPhaseShouldBePending(volcanoJob *v1alpha1.Job) bool {
	if volcanoJob.Status.Running > 0 {
		return false
	}
	if volcanoJob.Status.Pending > 0 || volcanoJob.Status.Unknown > 0 {
		logrus.Infof("vcjob %s phase is Running but pod count has no running pods, map status to Pending", volcanoJob.Name)
		return true
	}

	hasRunningTask := false
	hasWaitingTask := false
	for _, taskStatus := range volcanoJob.Status.TaskStatusCount {
		if taskStatus.Phase[v1.PodRunning] > 0 {
			hasRunningTask = true
			break
		}
		if taskStatus.Phase[v1.PodPending] > 0 || taskStatus.Phase[v1.PodUnknown] > 0 {
			hasWaitingTask = true
		}
	}
	if hasRunningTask || !hasWaitingTask {
		return false
	}
	logrus.Infof("vcjob %s phase is Running but has no running tasks, map status to Pending", volcanoJob.Name)
	return true
}

func (i *K8sInformer) handleVcJobDelete(obj interface{}) {
	var (
		err error
		job *models.JobTable
	)
	volcanoJob := obj.(*v1alpha1.Job)
	jobName := volcanoJob.Name
	logrus.Infof("delete vcjob: %s", jobName)
	if job, err = utils.GetJobByName(jobName); err != nil {
		logrus.Errorf("DB select jobName %s error: %v", jobName, err)
		return
	}
	logrus.Tracef("[handleVcJobDelete] job State: %s, job type:%s", job.State, job.JobType)

	wg := sync.WaitGroup{}
	wg.Add(1)
	go func() { // 删除依赖资源
		defer wg.Done()
		if job.JobType == utils.Inference {
			if err := inference.DeleteInferenceJob(
				job.NewJobName,
				job.GpuType,
				job.Partition,
				uint32(job.PODsReq),
				i.clientSet,
				i.VcClientSet,
			); err != nil {
				logrus.Errorf("jobName %s delete inference vcjob resources failed due to: %s", jobName, err)
			}
			return
		}
		vcjob := train.NewVCJob(
			train.WithJobName(job.NewJobName),
			train.WithUserName(job.UserName),
			train.WithNamespace(job.Partition),
			train.WithAccelerator(job.GpuType),
			train.WithJobType(job.JobType),
			train.WithTensorboardLog(job.TensorboardLogPath),
		)
		if job.JupyterLabProxyPath != "" {
			vcjob.SetJupyterLabInfo(train.JupyterLabInfo{
				ProxyPath: job.JupyterLabProxyPath,
			})
		}
		if job.VscodeBinPath != "" {
			vcjob.SetVsCodeInfo(train.VsCodeInfo{
				BinPath: job.VscodeBinPath,
			})
		}
		if err := vcjob.SetArgs(); err != nil {
			logrus.Errorf("jobName %s set args failed due to: %s", jobName, err)
		}
		if err := vcjob.Delete(); err != nil {
			logrus.Errorf("jobName %s delete vcjob failed due to: %s", jobName, err)
		}
	}()
	currentTime := uint64(time.Now().Unix())
	updates := map[string]interface{}{
		"mod_time": currentTime,
	}

	// 未启动的任务，开始时间和结束时间应保持一致
	if (job.State == utils.PendingStatus || job.State == utils.FailedStatus) && job.TimeStart == 0 {
		updates["time_start"] = currentTime
	}
	// 作业 Pending 或 Running 时，用户取消作业，状态变成 Canceled，结束时间为当前时间
	if job.State == utils.PendingStatus || job.State == utils.RunningStatus {
		updates["time_end"] = currentTime
		updates["state"] = utils.CanceledStatus
	}
	wg.Wait()
	if err := client.DB.Model(&job).Updates(updates).Error; err != nil {
		logrus.Errorf("jobName %s DB update failed due to: %s", jobName, err)
		return
	}
	i.timer.CancelTimer(jobName)
	go qw.TryResubmitJob(job.Account)

	logrus.Infof("informer delete job  %s successful", jobName)
}
