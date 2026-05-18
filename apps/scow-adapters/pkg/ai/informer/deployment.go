package informer

import (
	"context"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
	appv1 "k8s.io/api/apps/v1"
	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"

	"scow-adapters/pkg/ai/client"
	"scow-adapters/pkg/ai/db/models"
	qw "scow-adapters/pkg/ai/services/job"
	"scow-adapters/pkg/ai/utils"
)

func (i *K8sInformer) handleDeploymentUpdate(obj interface{}) {
	var (
		err error
		job *models.JobTable
	)
	deploy := obj.(*appv1.Deployment)
	if !i.IsQueue(deploy.Namespace) {
		return
	}
	jobName := deploy.Name
	logrus.Tracef("handle deployment: %v", deploy)
	if job, err = utils.GetJobByName(jobName); err != nil {
		logrus.Errorf("DB select jobName %s error: %v", jobName, err)
		return
	}

	pods, err := i.getDeploymentPods(deploy)
	if err != nil {
		logrus.Errorf("Get deployment pods error: %v", err)
		return
	}
	deployState := utils.GetDeploymentStatus(pods, i.clientSet)
	logrus.Infof("jobName %s, old job status %s, now job status: %s", jobName, job.State, deployState)

	modelJob := models.JobTable{}
	currentTime := time.Now().Unix()
	switch deployState.Status {
	case "Pending":
		modelJob.ModTime = uint64(currentTime)
		modelJob.State = utils.PendingStatus
	case "Failed":
		modelJob.ModTime = uint64(currentTime)
		modelJob.State = utils.FailedStatus
		modelJob.TimeStart = uint64(deployState.StartTime.Unix())
		modelJob.Reason = deployState.Log
		logrus.Infof("inference job run failed: %s", deployState.Log)
	case "Running":
		modelJob.ModTime = uint64(currentTime)
		modelJob.State = utils.RunningStatus
		modelJob.TimeStart = uint64(deployState.StartTime.Unix())
		// 启动定时器, 到期删除作业
		if job.Timelimit > 0 {
			remaining := int64(job.Timelimit) * 60
			i.timer.StartTimer(job, remaining)
		}
	case "Succeeded":
		modelJob.ModTime = uint64(currentTime)
		modelJob.State = utils.CompletedStatus
		modelJob.TimeStart = uint64(deployState.StartTime.Unix())
	default:
		modelJob.ModTime = uint64(currentTime)
	}
	err = client.DB.Model(&job).Updates(modelJob).Error
	if err != nil {
		logrus.Errorf("jobName %s DB update failed due to: %s", jobName, err)
		return
	}
	logrus.Infof("update job  %s status %s successful", jobName, modelJob.State)
}

func (i *K8sInformer) handleDeploymentDelete(obj interface{}) {
	var (
		err error
		job *models.JobTable
	)
	deploy := obj.(*appv1.Deployment)
	if !i.IsQueue(deploy.Namespace) {
		return
	}
	jobName := deploy.Name
	logrus.Infof("update deployment: %s", jobName)
	if job, err = utils.GetJobByName(jobName); err != nil {
		logrus.Errorf("DB select jobName %s error: %v", jobName, err)
		return
	}
	currentTime := uint64(time.Now().Unix())
	modelJob := models.JobTable{
		ModTime: currentTime,
	}
	if job.State == utils.PendingStatus || job.State == utils.RunningStatus {
		if job.State == utils.PendingStatus {
			modelJob.TimeStart = currentTime
		}
		modelJob.State = utils.CanceledStatus
		modelJob.TimeEnd = currentTime
	}
	// deploy 可能存在创建失败的情况，此时deploy状态为failed，但没有start time，需要补上start time和end time
	if job.State == utils.FailedStatus && job.TimeStart == 0 {
		modelJob.TimeStart = currentTime
		modelJob.TimeEnd = currentTime
	}
	err = client.DB.Model(&job).Updates(modelJob).Error
	if err != nil {
		logrus.Errorf("jobName %s DB update failed due to: %s", jobName, err)
		return
	}

	go qw.TryResubmitJob(job.Account)

	if cancel, ok := i.timer.Timers.Load(jobName); ok {
		cancel.(context.CancelFunc)()
		i.timer.Timers.Delete(jobName)
	}
	logrus.Infof("delete deploy  %s successful", jobName)
}

func (i *K8sInformer) getDeploymentPods(deployment *appv1.Deployment) ([]*v1.Pod, error) {
	// 获取 Deployment 的标签选择器
	podLabelSelector := labels.SelectorFromSet(deployment.Spec.Selector.MatchLabels)

	// 获取 Pod 列表
	pods, err := i.PodLister.Pods(deployment.Namespace).List(podLabelSelector)
	if err != nil {
		return nil, fmt.Errorf("error getting pods: %v", err)
	}

	for _, pod := range pods {
		logrus.Tracef("GetInferenceJobsInfo inference: %v, pods: %v", deployment.Name, pod.Name)
	}
	return pods, nil
}
