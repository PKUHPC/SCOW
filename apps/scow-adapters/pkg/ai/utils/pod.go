package utils

import (
	"context"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
	"google.golang.org/protobuf/types/known/timestamppb"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/client"
	"scow-adapters/pkg/ai/db/models"
)

func CreatePodTable(pt *models.PodTable) (err error) {
	if pt == nil {
		logrus.Errorf("pod model is nil")
		return err
	}
	return client.DB.Create(pt).Error
}

func GetPodInfoByUid(uid string) (modelPod *models.PodTable, err error) {
	err = client.DB.Where("uid = ? ", uid).First(&modelPod).Error // 通过作业名查作业信息
	if err != nil {
		logrus.Errorf("DB select pod uid  %s error: %v", uid, err)
		return nil, err
	}
	return modelPod, nil
}

func GetPodInfoByJobName(jobName string) (podInfo []*pb.JobInfo_PodInfo, err error) {
	var modelsPod []*models.PodTable
	err = client.DB.Where("job_name = ? AND status = ?", jobName, RunningStatus).
		Order("updated DESC").
		Find(&modelsPod).Error
	if err != nil {
		logrus.Errorf("DB select pod failed by jobname %s, error: %v", jobName, err)
		return nil, err
	}
	return GetPodInfoFromPodTables(modelsPod), nil
}

func GetPodInfoFromPodTables(modelsPod []*models.PodTable) (podInfo []*pb.JobInfo_PodInfo) {
	podInfo = make([]*pb.JobInfo_PodInfo, 0, len(modelsPod))
	for _, pod := range modelsPod {
		status := pb.JobInfo_PodStatus_value[strings.ToUpper(pod.Status)]
		tmpPod := &pb.JobInfo_PodInfo{
			PodName:        pod.Name,
			NodeName:       pod.NodeName,
			Namespace:      pod.Namespace,
			PodId:          pod.Uid,
			PodIp:          pod.IP,
			PodStatus:      pb.JobInfo_PodStatus(status),
			PodCreatedTime: timestamppb.New(time.Unix(pod.Created, 0)),
			ContainerId:    pod.ContainerID,
			Events:         GetEventsById(pod.Uid, Pod),
			PodReason:      &pod.Reason,
		}
		if pod.EndTime != 0 {
			tmpPod.PodEndTime = timestamppb.New(time.Unix(pod.EndTime, 0))
		}
		podInfo = append(podInfo, tmpPod)
	}
	return podInfo
}

func GetPodByNodeName(nodeName string, status []string) (modelsPod []*models.PodTable, err error) {
	podTables := make([]*models.PodTable, 0)
	err = client.DB.Where("node_name = ? AND status IN ?", nodeName, status).Find(&podTables).Error
	if err != nil {
		logrus.Errorf("DB select pod failed by nodeName %s, error: %v", nodeName, err)
		return nil, err
	}
	for _, pod := range podTables {
		jobModel := &models.JobTable{}
		if jobModel, err = GetJobByName(pod.JobName); err != nil {
			continue
		}
		if strings.EqualFold(jobModel.State, pod.Status) {
			modelsPod = append(modelsPod, pod)
		}
	}
	return modelsPod, nil
}

func GetPodByLabels(namespace, labelSelector string) (pod *v1.Pod, err error) {
	var (
		pods      *v1.PodList
		clientSet *kubernetes.Clientset
	)
	clientSet, err = GetK8sClient()
	if err != nil {
		logrus.Errorf("Get  clientSet error: %v", err)
		return nil, err
	}
	pods, err = clientSet.CoreV1().Pods(namespace).List(context.TODO(), metav1.ListOptions{
		LabelSelector: labelSelector,
		Limit:         1, // 限制返回一个
	})
	if err != nil || len(pods.Items) == 0 {
		logrus.Errorf("get tensorboard pods error: %v", err)
		return nil, err
	}
	return &pods.Items[0], nil
}

func GetPodStatus(pod *v1.Pod) string {
	// Completed job
	if pod.Status.Phase == v1.PodSucceeded {
		return string(v1.PodSucceeded)
	}
	// Failed job
	if pod.Status.Phase == v1.PodFailed {
		return string(v1.PodFailed)
	}

	for _, cs := range pod.Status.ContainerStatuses {
		if cs.State.Waiting != nil {
			reason := cs.State.Waiting.Reason
			if reason == "ContainerCreating" {
				return ContainerCreatingStatus
			}
			if reason == "CrashLoopBackOff" ||
				reason == "ImagePullBackOff" ||
				reason == "ErrImagePull" ||
				reason == "CreateContainerConfigError" ||
				reason == "RunContainerError" {
				return string(v1.PodFailed)
			}
		}
	}

	for _, cond := range pod.Status.Conditions {
		if cond.Type == v1.PodScheduled && cond.Status == v1.ConditionFalse {
			return string(v1.PodPending) //  Unschedulable
		}
	}

	// 最后默认返回 phase
	return string(pod.Status.Phase)
}

func ShouldRetainPodReason(status string) bool {
	return status == string(v1.PodPending) ||
		status == string(v1.PodFailed) ||
		status == ContainerCreatingStatus ||
		status == FailedStatus
}

func GetJobInfoByPodName(podName string) (job *models.JobTable, err error) {
	var modelPod *models.PodTable
	err = client.DB.Where("name = ? ", podName).First(&modelPod).Error
	if err != nil {
		logrus.Errorf("DB select pod name  %s error: %v", podName, err)
		return nil, err
	}
	return GetJobByName(modelPod.JobName)
}

func UpdatePodStatusByPodName(PodName, status string) (err error) {
	logrus.Tracef("[UpdatePodStatusByPodName]pod: %s, status: %s", PodName, status)
	modelPod := models.PodTable{}
	err = client.DB.Where("name = ? ", PodName).Order("created DESC").First(&modelPod).Error
	if err != nil {
		logrus.Errorf("[UpdatePodStatusByPodName] DB select pod name  %s error: %v", PodName, err)
		return err
	}
	updates := map[string]interface{}{
		"status": status,
	}
	if !ShouldRetainPodReason(status) {
		updates["reason"] = ""
	}
	err = client.DB.Model(&modelPod).Updates(updates).Error
	if err != nil {
		logrus.Tracef("[UpdatePodStatusByPodName] update pod %s status %s error: %v", PodName, status, err)
		return err
	}
	logrus.Tracef("[UpdatePodStatusByPodName] update pod %s status %s success", PodName, status)
	return nil
}

func UpdatePodStatusByJobName(jobName, status string) error {
	logrus.Tracef("[UpdatePodStatusByJobName] job: %s, status: %s", jobName, status)
	updates := map[string]interface{}{"status": status}
	if !ShouldRetainPodReason(status) {
		updates["reason"] = ""
	}
	err := client.DB.Model(&models.PodTable{}).Where("job_name = ?", jobName).Updates(updates).Error
	if err != nil {
		logrus.Errorf("[UpdatePodStatusByJobName] update pods for job %s status %s error: %v", jobName, status, err)
	}
	return err
}

func GetPodsByJobName(jobName string) (podTables []*models.PodTable) {
	err := client.DB.Where("job_name = ? ", jobName).Find(&podTables).Error // 通过作业名查pod
	if err != nil {
		logrus.Errorf("DB select pod failed by jobName  %s error: %v", jobName, err)
		return nil
	}
	return podTables
}

func GetNodeRunningPods(nodeName string, allPods []v1.Pod) []v1.Pod {
	runningPods := make([]v1.Pod, 0)
	for _, pod := range allPods {
		if _, ok := pod.Labels[Creator]; !ok { // 过滤掉非scow 创建的 pod
			continue
		}
		if pod.Spec.NodeName == nodeName {
			podStatus := GetPodStatus(&pod)
			if podStatus == string(v1.PodRunning) || podStatus == string(v1.PodPending) || podStatus == ContainerCreatingStatus {
				runningPods = append(runningPods, pod)
			}
		}
	}
	return runningPods
}
