package informer

import (
	"errors"
	"time"

	"github.com/sirupsen/logrus"
	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"

	"scow-adapters/pkg/ai/client"
	"scow-adapters/pkg/ai/db/models"
	"scow-adapters/pkg/ai/utils"
)

func (i *K8sInformer) handlePodAdd(obj interface{}) {
	pod := obj.(*v1.Pod)
	// 过滤非queue命名空间的pod
	if !i.IsQueue(pod.Namespace) {
		return
	}
	jobName, err := GetJobNameByPod(pod)
	if err != nil {
		// 通过pod label 找不到 job name，就跳过
		logrus.Errorf("pod %s labels get job name failed due to ", pod.Name)
		return
	}
	// 通过pod uid查找pod信息
	if _, err = utils.GetPodInfoByUid(string(pod.UID)); err == nil {
		logrus.Errorf("DB select podName %s exists", pod.Name)
		return
	}
	status := utils.GetPodStatus(pod)
	modelPod := models.PodTable{
		Uid:       string(pod.UID),
		Name:      pod.Name,
		Status:    status,
		NodeName:  pod.Spec.NodeName,
		Namespace: pod.Namespace,
		Created:   pod.CreationTimestamp.Unix(),
		Updated:   time.Now().Unix(),
		IP:        pod.Status.PodIP,
		JobName:   jobName,
		EndTime:   GetPodEndTime(pod),
		StartTime: GetPodStartTime(pod),
	}
	if status == string(v1.PodRunning) {
		modelPod.Reason = ""
	}
	if len(pod.Status.ContainerStatuses) > 0 {
		//modelPod.ContainerID = strings.Split(pod.Status.ContainerStatuses[0].ContainerID, "//")[1]
		modelPod.ContainerID = pod.Status.ContainerStatuses[0].ContainerID
	}
	logrus.Infof("[handlePodAdd] pod info: %v", modelPod)
	if err = utils.CreatePodTable(&modelPod); err != nil {
		logrus.Errorf("[handlePodAdd] create pod %s error: %v", modelPod.Name, err)
	}
	logrus.Infof("[handlePodAdd] Add pod %s succeed", pod.Name)
	return
}

func (i *K8sInformer) handlePodUpdate(obj interface{}) {
	var status string
	pod := obj.(*v1.Pod)
	if !i.IsQueue(pod.Namespace) {
		return
	}
	PodTable := &models.PodTable{}
	jobName, err := GetJobNameByPod(pod)
	if err != nil {
		// 通过pod label 找不到 job name，就跳过
		logrus.Errorf("pod %s labels get job name  failed due to %s", pod.Name, err)
		return
	}
	// 通过pod uid查找pod信息
	if PodTable, err = utils.GetPodInfoByUid(string(pod.UID)); err != nil {
		logrus.Errorf("DB select pod name %s error: %v", pod.Name, err)
		return
	}
	if PodTable.Status != utils.TimeOutStatus {
		status = utils.GetPodStatus(pod)
	} else {
		status = utils.TimeOutStatus
	}
	updates := map[string]interface{}{
		"status":    status,
		"node_name": pod.Spec.NodeName,
		"namespace": pod.Namespace,
		"updated":   time.Now().Unix(),
		"ip":        pod.Status.PodIP,
		"job_name":  jobName,
	}
	if len(pod.Status.ContainerStatuses) > 0 {
		updates["container_id"] = pod.Status.ContainerStatuses[0].ContainerID
	}
	if endTime := GetPodEndTime(pod); endTime != 0 {
		updates["end_time"] = endTime
	}
	if startTime := GetPodStartTime(pod); startTime != 0 {
		updates["start_time"] = startTime
	}
	logrus.Infof("[handlePodUpdate] pod updates: %v", updates)
	// 当一个pod Failed之后，同一个job下的其他pod 也需要Failed
	go func() {
		if status != string(v1.PodFailed) {
			return
		}
		// 查询job关联的pod
		time.Sleep(time.Second * 5)
		labelSelector := labels.Set{utils.JobNameLabelKey: jobName}.AsSelector()
		pods, err := i.PodLister.List(labelSelector)
		if err != nil {
			logrus.Errorf("[handlePodUpdate] get pod list error: %v", err)
			return
		}
		if len(pods) < 2 {
			return
		}
		// 找到父进程是1的进程，然后kill掉
		//cmd := fmt.Sprintf("kill -9 $(ps -eo pid,ppid | awk '$2==1 {print $1}')")
		cmd := "pkill -9 -P 1"
		for _, pd := range pods {
			if pd.Status.Phase == v1.PodFailed || pd.Name == pod.Name {
				continue
			}
			output, _, err := utils.ExecPodCMD(pd.Name, pd.Namespace, jobName, []string{"sh", "-c", cmd}, nil)
			if err != nil {
				logrus.Errorf("[handlePodUpdate] pod %s exec cmd %s failed, output: %s, err: %v", pd.Name, cmd, output, err)
				continue
			}
			logrus.Infof("[handlePodUpdate] pod %s exec cmd %s success", pd.Name, cmd)
		}
	}()
	err = client.DB.Model(PodTable).Updates(updates).Error
	if err != nil {
		logrus.Errorf("pod name %s DB update failed due to: %s", pod.Name, err)
		return
	}
	logrus.Infof("[handlePodUpdate] Update pod %s status %s successful", pod.Name, status)
	return
}

func (i *K8sInformer) handlePodDelete(obj interface{}) {
	var (
		err      error
		pod      *v1.Pod
		podTable *models.PodTable
		endTime  int64
	)
	pod = obj.(*v1.Pod)
	if !i.IsQueue(pod.Namespace) {
		return
	}
	if podTable, err = utils.GetPodInfoByUid(string(pod.UID)); err != nil {
		logrus.Errorf("[handlePodDelete] DB select pod name %s error: %v", pod.Name, err)
		return
	}
	endTime = GetPodEndTime(pod)
	curTime := time.Now().Unix()
	if endTime == 0 {
		endTime = curTime
	}
	updates := map[string]interface{}{
		"updated":  curTime,
		"end_time": endTime,
	}
	logrus.Tracef("[handlePodDelete] pod %s status is %s", podTable.Name, podTable.Status)
	if podTable.Status != utils.TimeOutStatus {
		updates["status"] = utils.CanceledStatus
	}
	logrus.Infof("[handlePodDelete] pod info: %v", updates)
	err = client.DB.Model(&podTable).Updates(updates).Error
	if err != nil {
		logrus.Errorf("[handlePodDelete] pod name %s DB update failed due to: %s", pod.Name, err)
		return
	}
	logrus.Infof("[handlePodDelete] delete pod %s successful", pod.Name)
	return
}

// GetJobNameByPod 通过pod的labels获取job name信息
func GetJobNameByPod(pod *v1.Pod) (string, error) {
	jobNameKey := "volcano.sh/job-name"
	jobName, ok := pod.ObjectMeta.Labels[jobNameKey]
	if !ok {
		return jobName, errors.New("job name label not found")
	}
	return jobName, nil
}

func GetPodEndTime(pod *v1.Pod) (endTime int64) {
	if pod.Status.Phase == v1.PodPending || pod.Status.Phase == v1.PodRunning {
		endTime = 0
		return
	}
	for _, cs := range pod.Status.ContainerStatuses {
		if cs.State.Terminated == nil || cs.State.Terminated.FinishedAt.IsZero() {
			endTime = time.Now().Unix()
			break
		}
		endTime = cs.State.Terminated.FinishedAt.Time.Unix()
	}
	logrus.Infof("[GetPodEndTime] pod: %s, endTime: %d", pod.Name, endTime)
	return
}

func GetPodStartTime(pod *v1.Pod) (startTime int64) {
	if pod.Status.StartTime == nil || pod.Status.StartTime.IsZero() {
		startTime = 0
		return
	}
	startTime = pod.Status.StartTime.Time.Unix()
	logrus.Infof("[GetPodStartTime] pod: %s, startTime: %d", pod.Name, startTime)
	return
}
