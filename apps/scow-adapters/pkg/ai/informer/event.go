package informer

import (
	"context"
	"errors"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"strconv"
	"strings"
	"sync"

	"scow-adapters/pkg/ai/client"
	"scow-adapters/pkg/ai/db/models"
	"scow-adapters/pkg/ai/utils"
)

const (
	ImagePullError  = "Image Pull Error"
	MountError      = "Mount Error"
	RestartError    = "Restart Error"
	SchedulingError = "Scheduling Error"
	ImagePulling    = "Image Pulling"
	ResourceError   = "Insufficient Resources"
	Evict           = "Evict"
	preempt         = "preempt"
	BackOff         = "BackOff"
	Failed          = "Failed"
	FailedMount     = "FailedMount"
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
	logrus.Infof("[handleEventChanged] name: %s, eventKind: %s, event: %v", name, event.InvolvedObject.Kind, eventDoc)
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
		logrus.Infof("[handleEventChanged] Message: %s, Reason: %s, Count: %d", event.Message, event.Reason, event.Count)
		logrus.Infof("[handleEventChanged] DB select pod name: %s, status: %s", name, PodTable.Status)

		// 镜像拉取失败、pod持续重启、挂载失败，都需要取消资源占用
		go func() {
			if event.Count < 3 || !eventReasonError(event.Reason) {
				return
			}
			message := strings.ToLower(event.Message)
			if containsImagePullError(message) || containsRestartError(message) || containsMountError(message) {
				i.DeleteResource(name, event.Namespace)
				return
			}
			logrus.Infof("[handleEventChanged] message: %s, reason: %s, count: %d", message, event.Reason, event.Count)
		}()

		// 写入pod reason
		go func(PodTable models.PodTable) {
			reason := classifyEventError(event)
			updates := map[string]interface{}{"reason": reason}
			UpdateReasonMux.Lock()
			defer UpdateReasonMux.Unlock()
			if err := client.DB.Model(PodTable).Updates(updates).Error; err != nil {
				logrus.Errorf("pod name %s DB update reason failed due to: %s", name, err)
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
			logrus.Infof("[handleEventChanged] event record already exists, name: %s, eventKind: %s, event: %v", name, event.InvolvedObject.Kind, eventDoc)
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
			logrus.Infof("event record already exists, name: %s, eventKind: %s, event: %v", name, event.InvolvedObject.Kind, eventDoc)
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
	// 删除关联的pod
	go func() {
		labelSelector := labels.Set{"volcano.sh/job-name": job.NewJobName}.AsSelector()
		pods, err := i.PodLister.List(labelSelector)
		if err != nil {
			logrus.Errorf("[DeleteResource] get pod list error: %v", err)
			return
		}
		for _, pod := range pods {
			err := i.clientSet.CoreV1().Pods(pod.Namespace).Delete(context.TODO(), pod.Name, metav1.DeleteOptions{})
			if err != nil {
				logrus.Errorf("[DeleteResource] delete pod %s Failed", pod.Name)
				continue
			}
			logrus.Tracef("[DeleteResource] delete pod %s success", pod.Name)
		}
	}()
	// 更新job和pod状态为Failed
	if err := utils.UpdateJobStatusByJobName(job.NewJobName, utils.FailedStatus); err != nil {
		logrus.Errorf("[DeleteResource] update job %s status error: %v", job.NewJobName, err)
	}
	if err := utils.UpdatePodStatusByPodName(podName, utils.FailedStatus); err != nil {
		logrus.Errorf("[DeleteResource] update pod %s status error: %v", podName, err)
	}
	if job.JobType == utils.Inference {
		err = utils.LocalCancelInferenceJob(job.NewJobName, job.GpuType, namespace, i.clientSet)
	} else {
		err = i.VcClientSet.BatchV1alpha1().Jobs(namespace).Delete(context.TODO(), job.NewJobName, metav1.DeleteOptions{})
	}
	if err != nil {
		logrus.Errorf("[DeleteResource] delete job %s error: %v", job.NewJobName, err)
		return
	}
	logrus.Infof("[DeleteResource] delete job %s successful", job.NewJobName)
}

func containsImagePullError(msg string) bool {
	return strings.Contains(msg, "imagepullbackoff") ||
		strings.Contains(msg, "back-off pulling image") ||
		strings.Contains(msg, "errimagepull")
}

func containsRestartError(msg string) bool {
	return strings.Contains(msg, "restarting failed")
}

func containsMountError(msg string) bool {
	return strings.Contains(msg, "mountvolume.setUp failed")
}

func eventReasonError(reason string) bool {
	return reason == BackOff || reason == Failed || reason == FailedMount
}

// containsPreemptError 检测 pod 是否因抢占被驱逐
func containsPreemptError(reason, msg string) bool {
	return reason == Evict && strings.Contains(msg, preempt)
}

// 错误分类函数
func classifyEventError(e *corev1.Event) string {
	reason := strings.ToLower(e.Reason)
	msg := strings.ToLower(e.Message)

	// 镜像正在拉取
	if reason == "pulling" || strings.Contains(msg, "pulling image") {
		return ImagePulling
	}

	// 镜像拉取失败
	if reason == "errimagepull" || reason == "imagepullbackoff" ||
		strings.Contains(msg, "imagepullbackoff") ||
		strings.Contains(msg, "back-off pulling image") ||
		strings.Contains(msg, "errimagepull") ||
		strings.Contains(msg, "failed to pull image") {
		return ImagePullError
	}

	// 重启相关错误
	if strings.Contains(msg, "restarting failed") ||
		strings.Contains(msg, "back-off restarting failed container") {
		return RestartError
	}

	// 挂载相关错误
	if reason == "failedmount" ||
		strings.Contains(msg, "mountvolume.setup failed") ||
		strings.Contains(msg, "unable to mount volumes") ||
		strings.Contains(msg, "attachvolume.mount failed") {
		return MountError
	}

	// 调度相关错误
	if reason == "failedscheduling" || reason == "unschedulable" {
		if strings.Contains(msg, "insufficient") || strings.Contains(msg, "nodes are available") {
			return ResourceError // 专门标记为资源不足
		}
		return SchedulingError
	}
	return ""
}
