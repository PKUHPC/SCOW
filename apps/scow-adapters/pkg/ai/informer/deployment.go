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
	k8sclient "k8s.io/client-go/kubernetes"

	"scow-adapters/pkg/ai/client"
	"scow-adapters/pkg/ai/db/models"
	"scow-adapters/pkg/ai/inference"
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
	if status != utils.PendingStatus && status != utils.FailedStatus && status != utils.RunningStatus {
		logrus.Warnf("[handleDeploymentUpdate] deploy %s, unknown status %s", jobName, status)
		return
	}
	currentTime := uint64(time.Now().Unix())
	updates := BuildDeploymentStatusUpdates(job, status, startTime, endTime, currentTime)
	if status == utils.RunningStatus {
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
	}
	err = client.DB.Model(&job).Updates(updates).Error
	if err != nil {
		logrus.Errorf("jobName %s DB update failed due to: %s", jobName, err)
		return
	}
	logrus.Infof("update job %s status %s successful", jobName, status)
}

// BuildDeploymentStatusUpdates 根据 Deployment 状态生成作业更新字段。
func BuildDeploymentStatusUpdates(job *models.JobTable, status string, startTime, endTime, currentTime uint64) map[string]interface{} {
	updates := map[string]interface{}{
		"mod_time": currentTime,
		"state":    status,
	}
	switch status {
	case utils.FailedStatus:
		// 已运行作业在适配器重启后的首次同步中可能被识别为失败，
		// 此时必须保留原始开始时间，避免将其刷新为本次状态变更时间。
		if job.TimeStart == 0 {
			updates["time_start"] = startTime
		}
		updates["time_end"] = endTime
	case utils.RunningStatus:
		logrus.Tracef("[BuildDeploymentStatusUpdates] jobName: %s, startTime: %d", job.NewJobName, startTime)
		// 防止 Pod 重新拉取之后更新开始时间。
		if job.TimeStart == 0 {
			updates["time_start"] = startTime
		}
	}
	return updates
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
	if job.JobType == utils.Inference {
		if err := deleteSingleInferenceResources(jobName, job.GpuType, deploy.Namespace, i.clientSet); err != nil {
			logrus.Errorf("delete single inference resources failed, job name: %v, error: %v", jobName, err)
		}
	}
	logrus.Infof("delete deploy  %s successful", jobName)
}

func deleteSingleInferenceResources(jobName, gpuType, namespace string, cli k8sclient.Interface) error {
	job := inference.NewInferenceDeleteJob(jobName, gpuType, namespace, 1, cli, nil)
	return inference.NewSingleInference(job).Delete()
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
	status, startTime, endTime = ParseDeployStatus(deploy)
	if status != utils.PendingStatus {
		return
	}
	// 由pod来判断Pending的原因，再决定最终deploy的状态
	pods, err := i.getDeploymentPods(deploy)
	if err != nil {
		logrus.Errorf("[resolveDeployStatus] get pods for deploy %s error: %v", deploy.Name, err)
		return
	}
	if HasTerminalAbnormalPod(pods) {
		status = utils.FailedStatus
		endTime = uint64(time.Now().Unix())
		startTime = endTime
		logrus.Infof("deployment %s has abnormal pod, mark job as failed", deploy.Name)
	}
	return
}

// ParseDeployStatus 按副本状态和 Conditions 判断 Deployment 状态。
func ParseDeployStatus(deploy *appv1.Deployment) (status string, startTime uint64, endTime uint64) {
	desired := int32(1)
	if deploy.Spec.Replicas != nil {
		desired = *deploy.Spec.Replicas
	}
	creationTime := deployTimeUnix(deploy.CreationTimestamp)
	s := deploy.Status

	// Deployment 可能在超过 progress deadline 后继续恢复，运行状态应优先于历史失败条件。
	if s.ReadyReplicas >= desired && desired > 0 {
		for _, cond := range s.Conditions {
			if cond.Type == appv1.DeploymentAvailable && cond.Status == corev1.ConditionTrue {
				startTime := deployTimeUnix(cond.LastTransitionTime)
				if startTime == 0 {
					startTime = creationTime
				}
				logrus.Tracef("Deployment %s status resolved to %s: desired=%d, ready=%d, Available=True",
					deploy.Name, utils.RunningStatus, desired, s.ReadyReplicas)
				return utils.RunningStatus, startTime, 0
			}
		}
		logrus.Tracef("Deployment %s status resolved to %s: desired=%d, ready=%d",
			deploy.Name, utils.RunningStatus, desired, s.ReadyReplicas)
		return utils.RunningStatus, creationTime, 0
	}

	var replicaFailure, progressDeadlineExceeded *appv1.DeploymentCondition
	for idx := range s.Conditions {
		cond := &s.Conditions[idx]
		switch {
		case cond.Type == appv1.DeploymentReplicaFailure && cond.Status == corev1.ConditionTrue:
			replicaFailure = cond
		case cond.Type == appv1.DeploymentProgressing && cond.Reason == "ProgressDeadlineExceeded":
			progressDeadlineExceeded = cond
		}
	}

	if replicaFailure != nil {
		// 副本创建失败（资源配额不足等）
		failTime := failedDeployTime(deploy, *replicaFailure)
		logrus.Tracef("Deployment %s status resolved to %s: desired=%d, ready=%d, condition=%s, reason=%s",
			deploy.Name, utils.FailedStatus, desired, s.ReadyReplicas, replicaFailure.Type, replicaFailure.Reason)
		return utils.FailedStatus, failTime, failTime
	}

	if progressDeadlineExceeded != nil {
		deadlineSeconds := int32(600)
		if deploy.Spec.ProgressDeadlineSeconds != nil {
			deadlineSeconds = *deploy.Spec.ProgressDeadlineSeconds
		}
		logrus.Infof("Deployment %s made no deployment progress for %s: transitionTime=%d; keep status %s",
			deploy.Name, time.Duration(deadlineSeconds)*time.Second,
			deployTimeUnix(progressDeadlineExceeded.LastTransitionTime), utils.PendingStatus)
		return utils.PendingStatus, 0, 0
	}

	logrus.Tracef("Deployment %s status resolved to %s: desired=%d, updated=%d, ready=%d, available=%d",
		deploy.Name, utils.PendingStatus, desired, s.UpdatedReplicas, s.ReadyReplicas, s.AvailableReplicas)
	return utils.PendingStatus, 0, 0
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

// HasTerminalAbnormalPod 检查不会被 Kubernetes 自动恢复的 Pod 异常。
// 可重启容器的非零退出和 CrashLoopBackOff 由 BackOff 事件计数处理，不能在一次
// Deployment 同步中直接判定作业失败。
func HasTerminalAbnormalPod(pods []*corev1.Pod) bool {
	for _, pod := range pods {
		if pod.Status.Phase == corev1.PodFailed {
			logrus.Warnf("pod %s has terminal phase: %s", pod.Name, pod.Status.Phase)
			return true
		}
		for _, cs := range pod.Status.ContainerStatuses {
			if cs.State.Waiting != nil {
				switch cs.State.Waiting.Reason {
				case "ImagePullBackOff", "ErrImagePull":
					logrus.Warnf("pod %s has abnormal state: %s, reason: %s", pod.Name, "Waiting", cs.State.Waiting.Reason)
					return true
				}
			}
			if pod.Spec.RestartPolicy == corev1.RestartPolicyNever &&
				cs.State.Terminated != nil && cs.State.Terminated.ExitCode != 0 {
				logrus.Warnf("pod %s has abnormal state: %s, exit code: %d", pod.Name, "Terminated", cs.State.Terminated.ExitCode)
				return true
			}
		}
	}
	return false
}
