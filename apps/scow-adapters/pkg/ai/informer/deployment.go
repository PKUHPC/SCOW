package informer

import (
	"context"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
	appv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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

	status, startTime, endTime := i.resolveDeployStatus(deploy)
	logrus.Infof("jobName %s, old job status %s, now job status: %s", jobName, job.State, status)
	// 状态未改变，不修改数据库
	if job.State == status {
		return
	}
	currentTime := uint64(time.Now().Unix())
	updates := map[string]interface{}{
		"mod_time": currentTime,
		"state":    status,
	}
	switch status {
	case utils.PendingStatus:
		// 只更新状态，不改变 time_start
	case utils.FailedStatus:
		updates["time_start"] = startTime
		updates["time_end"] = endTime
	case utils.RunningStatus:
		logrus.Tracef("[handleDeploymentUpdate] jobName: %s, startTime: %d", jobName, startTime)
		// 防止pod重新拉取之后更新开始时间
		if job.TimeStart == 0 {
			updates["time_start"] = startTime
		}
		// 首次进入 Running 时启动定时器
		if job.State != utils.RunningStatus && job.Timelimit > 0 {
			remaining := int64(job.Timelimit) * 60
			if job.IsPreempt == 1 {
				pods := utils.GetPodsByJobName(job.NewJobName)
				// 新的定时器需要去掉已运行的时间
				jobDuration := utils.GetElapsedSecondsByDeployPods(job, pods)
				remaining = remaining - jobDuration
				if remaining <= 0 {
					logrus.Warnf("jobName %s has exceeded its timelimit, remaining time: %d seconds, set remaining time to 0", jobName, remaining)
					remaining = 0
				}
				logrus.Infof("jobName %s is preempted, jobDuration: %d seconds, remaining time: %d seconds", jobName, jobDuration, remaining)
				i.timer.StartTimer(job, remaining)
			} else {
				// 任务首次进入 Running，创建完整时长定时器
				i.timer.StartTimer(job, remaining)
			}
		}
	default:
		logrus.Warnf("[handleDeploymentUpdate] deploy %s, unknown status %s", jobName, status)
		return
	}
	err = client.DB.Model(&job).Updates(updates).Error
	if err != nil {
		logrus.Errorf("jobName %s DB update failed due to: %s", jobName, err)
		return
	}
	logrus.Infof("update job %s status %s successful", jobName, status)
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
	endTime := currentTime
	if deploy.DeletionTimestamp != nil {
		endTime = uint64(deploy.DeletionTimestamp.Time.Unix())
	}
	updates := map[string]interface{}{
		"mod_time": currentTime,
	}
	if job.State == utils.PendingStatus || job.State == utils.RunningStatus {
		if job.State == utils.PendingStatus {
			updates["time_start"] = endTime
		}
		updates["state"] = utils.CanceledStatus
		updates["time_end"] = endTime
	}
	// deploy 可能存在创建失败的情况，此时deploy状态为failed，但没有start time，需要补上start time和end time
	if job.State == utils.FailedStatus && job.TimeStart == 0 {
		updates["time_start"] = endTime
		updates["time_end"] = endTime
	}
	err = client.DB.Model(&job).Updates(updates).Error
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

func (i *K8sInformer) getDeploymentPods(deployment *appv1.Deployment) ([]*corev1.Pod, error) {
	labelSelector := labels.SelectorFromSet(deployment.Spec.Selector.MatchLabels).String()
	podList, err := i.clientSet.CoreV1().Pods(deployment.Namespace).List(context.Background(), metav1.ListOptions{
		LabelSelector: labelSelector,
	})
	if err != nil {
		return nil, fmt.Errorf("error getting pods: %v", err)
	}
	pods := make([]*corev1.Pod, 0, len(podList.Items))
	for idx := range podList.Items {
		pod := &podList.Items[idx]
		if pod.DeletionTimestamp != nil {
			logrus.Tracef("getDeploymentPods: skip pod %s (being deleted)", pod.Name)
			continue
		}
		logrus.Tracef("GetInferenceJobsInfo inference: %v, pods: %v", deployment.Name, pod.Name)
		pods = append(pods, pod)
	}
	return pods, nil
}

// resolveDeployStatus 综合 deploy.Status 和 Pod 级别状态返回最终状态、开始时间和结束时间。
func (i *K8sInformer) resolveDeployStatus(deploy *appv1.Deployment) (status string, startTime uint64, endTime uint64) {
	status, startTime, endTime = parseDeployStatus(deploy)
	if status != utils.PendingStatus {
		return
	}
	// 由pod来判断Pending的原因，再决定最终deploy的状态
	pods, err := i.getDeploymentPods(deploy)
	if err != nil {
		logrus.Errorf("[resolveDeployStatus] get pods for deploy %s error: %v", deploy.Name, err)
		return
	}
	if hasAbnormalPod(pods) {
		status = utils.FailedStatus
		endTime = uint64(time.Now().Unix())
		startTime = endTime
		logrus.Infof("deployment %s has abnormal pod, mark job as failed", deploy.Name)
	}
	return
}

// parseDeployStatus 从 Deployment.Status.Conditions 和副本数判断状态。
func parseDeployStatus(deploy *appv1.Deployment) (status string, startTime uint64, endTime uint64) {
	desired := int32(1)
	if deploy.Spec.Replicas != nil {
		desired = *deploy.Spec.Replicas
	}
	creationTime := deployTimeUnix(deploy.CreationTimestamp)

	for _, cond := range deploy.Status.Conditions {
		// 副本创建失败（资源配额不足等）
		if cond.Type == appv1.DeploymentReplicaFailure &&
			cond.Status == corev1.ConditionTrue {
			failTime := failedDeployTime(deploy, cond)
			return utils.FailedStatus, failTime, failTime
		}
		// 部署超时
		if cond.Type == appv1.DeploymentProgressing &&
			cond.Reason == "ProgressDeadlineExceeded" {
			failTime := failedDeployTime(deploy, cond)
			return utils.FailedStatus, failTime, failTime
		}
	}

	s := deploy.Status
	logrus.Tracef("Deployment %s status: desired=%d, ready=%d", deploy.Name, desired, s.ReadyReplicas)
	switch {
	case s.ReadyReplicas >= desired:
		for _, cond := range deploy.Status.Conditions {
			if cond.Type == appv1.DeploymentAvailable && cond.Status == corev1.ConditionTrue {
				return utils.RunningStatus, deployTimeUnix(cond.LastTransitionTime), 0
			}
		}
		return utils.RunningStatus, creationTime, 0
	default:
		return utils.PendingStatus, 0, 0
	}
}

func failedDeployTime(deploy *appv1.Deployment, cond appv1.DeploymentCondition) uint64 {
	if failTime := deployTimeUnix(cond.LastTransitionTime); failTime != 0 {
		return failTime
	}
	if creationTime := deployTimeUnix(deploy.CreationTimestamp); creationTime != 0 {
		return creationTime
	}
	return uint64(time.Now().Unix())
}

func deployTimeUnix(t metav1.Time) uint64 {
	if t.IsZero() {
		return 0
	}
	unixTime := t.Time.Unix()
	if unixTime <= 0 {
		return 0
	}
	return uint64(unixTime)
}

// 检查 Pod 容器是否处于异常状态（CrashLoopBackOff、镜像拉取失败、非 0 退出等）。
// 返回 true 表示存在异常，false 表示 Pod 正在正常启动中。
func hasAbnormalPod(pods []*corev1.Pod) bool {
	for _, pod := range pods {
		for _, cs := range pod.Status.ContainerStatuses {
			if cs.State.Waiting != nil {
				switch cs.State.Waiting.Reason {
				case "CrashLoopBackOff", "ImagePullBackOff", "ErrImagePull":
					logrus.Warnf("pod %s has abnormal state: %s, reason: %s", pod.Name, "Waiting", cs.State.Waiting.Reason)
					return true
				}
			}
			if cs.State.Terminated != nil && cs.State.Terminated.ExitCode != 0 {
				logrus.Warnf("pod %s has abnormal state: %s, exit code: %d", pod.Name, "Terminated", cs.State.Terminated.ExitCode)
				return true
			}
		}
	}
	return false
}
