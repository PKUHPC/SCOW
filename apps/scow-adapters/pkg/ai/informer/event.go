package informer

import (
	"errors"
	"strconv"
	"strings"
	"sync"

	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
	corev1 "k8s.io/api/core/v1"

	"scow-adapters/pkg/ai/client"
	"scow-adapters/pkg/ai/db/models"
	"scow-adapters/pkg/ai/inference"
	"scow-adapters/pkg/ai/train"
	"scow-adapters/pkg/ai/utils"
)

const (
	ImagePullError = "Image Pull Error"
	MountError     = "Mount Error"
	RestartError   = "Restart Error"
	ImagePulling   = "Image Pulling"
	ResourceError  = "Insufficient Resources"
	Evict          = "Evict"
	preempt        = "preempt"
	BackOff        = "BackOff"
	Failed         = "Failed"
	FailedMount    = "FailedMount"
)

var UpdateReasonMux = &sync.Mutex{}

func (i *K8sInformer) handleEventChanged(obj interface{}) {
	var (
		jobTable *models.JobTable
		err      error
	)
	event := obj.(*corev1.Event)
	name := strings.Split(event.GetName(), ".")[0]
	if len(name) == 0 {
		logrus.Errorf("[handleEventChanged] get name is null")
		return
	}
	// 过滤非queue命名空间的events
	if !i.IsQueue(event.Namespace) {
		return
	}
	eventDoc := models.EventTable{
		Name:               name,
		ObjName:            event.InvolvedObject.Name,
		ObjNamespace:       event.Namespace,
		ObjKind:            event.InvolvedObject.Kind,
		Type:               event.Type,
		Message:            event.Message,
		Reason:             event.Reason,
		ReportingComponent: event.ReportingController,
		Count:              event.Count,
		Created:            event.CreationTimestamp.Unix(),
		Updated:            event.LastTimestamp.Unix(),
	}
	logrus.Infof("[handleEventChanged] name=%s, namespace=%s, kind=%s, type=%s, reason=%s, message=%s, count=%d",
		name, event.Namespace, event.InvolvedObject.Kind, event.Type, event.Reason, event.Message, event.Count)
	switch event.InvolvedObject.Kind {
	case "Pod":
		podUid := event.InvolvedObject.UID
		PodTable := models.PodTable{}
		logrus.Tracef("[handleEventChanged] pod uid: %s, pod name: %s", podUid, name)
		// 先找uid匹配，找不到再找name匹配，避免因为pod重启导致uid变化而无法关联到pod记录
		err = client.DB.Where("uid = ?", podUid).Order("created DESC").First(&PodTable).Error
		if err != nil {
			err := client.DB.Where("name = ?", name).Order("created DESC").First(&PodTable).Error
			if err != nil {
				logrus.Errorf("[handleEventChanged] DB select pod name %s error: %v", name, err)
				return
			}
		}
		logrus.Tracef("[handleEventChanged] pod name=%s, status=%s", name, PodTable.Status)

		// 镜像拉取失败、pod持续重启、挂载失败，都需要取消资源占用
		go func() {
			if event.Count < 3 || !eventReasonError(event.Reason) {
				return
			}
			if containsImagePullError(event.Message) || containsRestartError(event.Message) || containsMountError(event.Message) {
				i.DeleteResource(name, event.Namespace)
				return
			}
			logrus.Tracef("[handleEventChanged] event does not require resource cleanup: name=%s, reason=%s, count=%d",
				name, event.Reason, event.Count)
		}()

		// 写入pod reason
		go func(PodTable models.PodTable) {
			reason := ClassifyEventError(event)
			if reason == "" {
				return
			}
			UpdateReasonMux.Lock()
			defer UpdateReasonMux.Unlock()
			result := client.DB.Model(&models.PodTable{}).
				Where("uid = ? AND status IN ?", PodTable.Uid, []string{
					string(corev1.PodPending),
					string(corev1.PodFailed),
					utils.ContainerCreatingStatus,
					utils.FailedStatus}).Update("reason", reason)
			if result.Error != nil {
				logrus.Errorf("pod name %s DB update reason failed due to: %s", name, result.Error)
			}
		}(PodTable)

		// 检测pod 是否被抢占
		go func() {
			if !containsPreemptError(event.Reason, event.Message) {
				return
			}
			// 1.记录任务被抢占
			jobTable, err := utils.GetJobByName(PodTable.JobName)
			if err != nil {
				logrus.Errorf("[handleEventChanged] DB select jobName %s error: %v", PodTable.JobName, err)
				return
			}
			updates := map[string]interface{}{"is_preempt": 1}
			if err := client.DB.Model(jobTable).Updates(updates).Error; err != nil {
				logrus.Errorf("job %s DB update is_preempt failed due to: %s", name, err)
			}
			//2. 取消定时器
			i.timer.CancelTimer(PodTable.JobName)
		}()

		if EventExists(eventDoc.Name, event.Message, utils.Pod, PodTable.Uid) {
			logrus.Tracef("[handleEventChanged] event record already exists: name=%s, kind=%s, reason=%s, count=%d",
				name, event.InvolvedObject.Kind, event.Reason, event.Count)
			return
		}
		eventDoc.PodUid = PodTable.Uid
	case utils.PodGroup, utils.Job:
		if event.InvolvedObject.Kind == utils.PodGroup {
			// PodGroup 需要去掉后缀段才能关联到 Job
			allItems := strings.Split(event.InvolvedObject.Name, "-")
			allItemsNum := len(allItems)
			logrus.Infof("[handleEventChanged] pod group len: %d", allItemsNum)
			if allItemsNum < 6 {
				return
			}
			nameItems := allItems[:allItemsNum-5]
			eventDoc.Name = strings.Join(nameItems, "-")
		}
		if jobTable, err = utils.GetJobByName(eventDoc.Name); err != nil {
			logrus.Errorf("[handleEventChanged] DB select jobName %s error: %v", eventDoc.Name, err)
			return
		}
		if EventExists(eventDoc.Name, event.Message, utils.Job, strconv.FormatUint(jobTable.JobDBInx, 10)) {
			logrus.Tracef("[handleEventChanged] event record already exists: name=%s, kind=%s, reason=%s, count=%d",
				name, event.InvolvedObject.Kind, event.Reason, event.Count)
			return
		}
		eventDoc.JobId = jobTable.JobDBInx
	case "Deployment":
		return
	default:
		logrus.Errorf("[handleEvent] event failed, name: %s, ObjKind: %s, event: %v ", name, event.InvolvedObject.Kind, eventDoc)
		return
	}
	err = client.DB.Create(&eventDoc).Error
	if err != nil {
		logrus.Errorf("event name %s DB create failed due to: %s", name, err)
		return
	}
}

func EventExists(name, msg, resource, resourceID string) bool {
	result := &gorm.DB{}
	if resource == utils.Pod {
		result = client.DB.Where("name = ? AND message = ? AND pod_uid = ?", name, msg, resourceID).First(&models.EventTable{})
	} else {
		result = client.DB.Where("name = ? AND message = ? AND job_id = ?", name, msg, resourceID).First(&models.EventTable{})
	}
	if result.Error == nil {
		return true
	}
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		logrus.Infof("event not exists, name: %s, msg: %s", name, msg)
		return false
	}
	logrus.Errorf("EventExists query error: %v", result.Error)
	return false
}

func (i *K8sInformer) DeleteResource(podName, namespace string) {
	job, err := utils.GetJobInfoByPodName(podName)
	if err != nil {
		logrus.Errorf("[DeleteResource] get job info by pod name %s error: %v", podName, err)
		return
	}
	// 多个 Pod 可能同时触发 BackOff 事件。作业已经进入终态并记录结束时间后，
	// 后续事件无需重复更新状态或再次删除同一组 Kubernetes 资源。
	if job.TimeEnd != 0 && (job.State == utils.FailedStatus ||
		job.State == utils.CompletedStatus || job.State == utils.CanceledStatus ||
		job.State == utils.TimeOutStatus) {
		logrus.Infof("[DeleteResource] job %s is already terminal, skip duplicate cleanup", job.NewJobName)
		return
	}
	// 更新 job 及其所有关联 pod 状态为 Failed
	if err := utils.UpdateJobStatusByJobName(job.NewJobName, utils.FailedStatus); err != nil {
		logrus.Errorf("[DeleteResource] update job %s status error: %v", job.NewJobName, err)
	}
	if err := utils.UpdatePodStatusByJobName(job.NewJobName, utils.FailedStatus); err != nil {
		logrus.Errorf("[DeleteResource] update pods for job %s status error: %v", job.NewJobName, err)
	}
	// 删除k8s相关资源
	if job.JobType == utils.Inference {
		err = inference.DeleteInferenceJob(
			job.NewJobName,
			job.GpuType,
			namespace,
			uint32(job.PODsReq),
			i.clientSet,
			i.VcClientSet,
		)
	} else {
		err = train.DeleteVCJobResources(job, i.clientSet, i.VcClientSet)
	}
	if err != nil {
		logrus.Errorf("[DeleteResource] delete job %s error: %v", job.NewJobName, err)
		return
	}
	logrus.Infof("[DeleteResource] delete job %s successful", job.NewJobName)
}

func containsImagePullError(message string) bool {
	msg := strings.ToLower(message)
	return strings.Contains(msg, "imagepullbackoff") ||
		strings.Contains(msg, "back-off pulling image") ||
		strings.Contains(msg, "errimagepull") ||
		strings.Contains(msg, "failed to pull image") ||
		strings.Contains(msg, "failed to pull and unpack image") ||
		strings.Contains(msg, "failed to resolve image")
}

func containsRestartError(message string) bool {
	msg := strings.ToLower(message)
	return strings.Contains(msg, "restarting failed")
}

func containsMountError(message string) bool {
	msg := strings.ToLower(message)
	return strings.Contains(msg, "mountvolume.setup failed") ||
		strings.Contains(msg, "unable to mount volumes") ||
		strings.Contains(msg, "attachvolume.mount failed")
}

func eventReasonError(reason string) bool {
	return reason == BackOff || reason == Failed || reason == FailedMount
}

// containsPreemptError 检测 pod 是否因抢占被驱逐
func containsPreemptError(reason, msg string) bool {
	return reason == Evict && strings.Contains(msg, preempt)
}

// ClassifyEventError classifies a Kubernetes event into a user-facing error.
func ClassifyEventError(e *corev1.Event) string {
	reason := strings.ToLower(e.Reason)
	msg := strings.ToLower(e.Message)

	// Kubernetes 的 Reason 精确描述镜像状态时，优先以它为准。
	switch reason {
	case "errimagepull", "imagepullbackoff":
		return ImagePullError
	case "pulling":
		return ImagePulling
	case "failedmount":
		return MountError
	case "failedscheduling", "unschedulable":
		if strings.Contains(msg, "insufficient") ||
			strings.Contains(msg, "too many pods") ||
			strings.Contains(msg, "nodes are unavailable") ||
			strings.Contains(msg, "pod group is not ready") {
			return ResourceError
		}
	}

	// 部分事件的 Reason 不够具体，使用消息兜底。拉取中只匹配消息前缀，
	// 避免将 "Back-off pulling image" 这类失败消息误判为拉取中。
	if containsImagePullError(msg) {
		return ImagePullError
	}
	if strings.HasPrefix(msg, "pulling image") {
		return ImagePulling
	}

	// 重启相关错误
	if strings.Contains(msg, "restarting failed") ||
		strings.Contains(msg, "back-off restarting failed container") {
		return RestartError
	}

	// 挂载相关错误
	if strings.Contains(msg, "mountvolume.setup failed") ||
		strings.Contains(msg, "unable to mount volumes") ||
		strings.Contains(msg, "attachvolume.mount failed") {
		return MountError
	}
	return ""
}
