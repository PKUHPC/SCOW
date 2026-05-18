package informer

import (
	"sync"
	"time"

	"github.com/sirupsen/logrus"
	"volcano.sh/apis/pkg/apis/batch/v1alpha1"

	"scow-adapters/pkg/ai/client"
	"scow-adapters/pkg/ai/db/models"
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
	modelJob := models.JobTable{
		ModTime: curTime,
	}
	switch jobStatus {
	case v1alpha1.Pending:
		status = utils.PendingStatus
	case v1alpha1.Running:
		var remaining int64
		status = utils.RunningStatus
		//1. 首次进入Runing 的任务，需要设置任务开始时间
		//   被抢占的作业还没有Running，TimeStart 还是 0
		if job.TimeStart == 0 {
			if volcanoJob.Status.State.LastTransitionTime.Time.Unix() > 0 {
				modelJob.TimeStart = uint64(volcanoJob.Status.State.LastTransitionTime.Time.Unix())
			} else {
				modelJob.TimeStart = curTime
			}
		}
		// 2. 任务被抢占并且当前状态是Pending，才需要重启定时器，剩余时间=原始时长-已运行时长；其他情况按照正常的timelimit设置定时器
		if job.Timelimit > 0 && job.State == utils.PendingStatus {
			if job.IsPreempt == 1 {
				jobDuration := utils.GetPreemptJobDurationByJobName(jobName)
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
	}

	modelJob.State = status
	if status == utils.CompletedStatus || status == utils.FailedStatus || status == utils.CanceledStatus {
		if job.TimeStart == 0 {
			modelJob.TimeStart = curTime
			modelJob.TimeEnd = curTime
			logrus.Warnf("jobName %s job TimeStart is 0, set TimeStart and TimeEnd to current time: %d", jobName, curTime)
		} else {
			if volcanoJob.Status.State.LastTransitionTime.Time.Unix() > 0 {
				modelJob.TimeEnd = uint64(volcanoJob.Status.State.LastTransitionTime.Time.Unix())
			} else {
				modelJob.TimeEnd = curTime
			}
		}
		go qw.TryResubmitJob(job.Account)
	}
	err = client.DB.Model(&job).Updates(modelJob).Error
	if err != nil {
		logrus.Errorf("jobName %s DB update failed due to: %s", jobName, err)
		return
	}
	logrus.Infof("update job  %s status %s successful", jobName, status)
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
	modelJob := models.JobTable{
		ModTime: currentTime,
	}

	// 未启动的任务，开始时间和结束时间应保持一致
	if (job.State == utils.PendingStatus || job.State == utils.FailedStatus) && job.TimeStart == 0 {
		modelJob.TimeStart = currentTime
	}
	// 作业Pending或Running时，用户取消作业，状态会变成Canceled，作业结束时间为当前时间；
	if job.State == utils.PendingStatus || job.State == utils.RunningStatus {
		modelJob.TimeEnd = currentTime
		modelJob.State = utils.CanceledStatus
	}
	wg.Wait()
	if err := client.DB.Model(&job).Updates(modelJob).Error; err != nil {
		logrus.Errorf("jobName %s DB update failed due to: %s", jobName, err)
		return
	}
	i.timer.CancelTimer(jobName)
	go qw.TryResubmitJob(job.Account)

	logrus.Infof("informer delete job  %s successful", jobName)
}
