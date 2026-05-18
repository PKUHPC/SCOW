package job

import (
	"strconv"
	"time"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc"
	"k8s.io/client-go/kubernetes"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/client"
	"scow-adapters/pkg/ai/db/models"
	podlog "scow-adapters/pkg/ai/services/job/podlog"
	"scow-adapters/pkg/ai/utils"
)

const (
	Job = "Job"
)

func (s *ServerJob) GetPodLogs(in *pb.GetPodLogsRequest, stream grpc.ServerStreamingServer[pb.GetPodLogsResponse]) error {
	logLength := -1
	resp := &pb.GetPodLogsResponse{}
	podInfo, err := GetPodByUid(in.GetPodId())
	if err != nil {
		logrus.Errorf("[GetPodLog] Get pod info error: %s", err.Error())
		return err
	}
	clientSet, err := utils.GetK8sClient()
	if err != nil {
		logrus.Errorf("[GetPodLog] Get k8s clientSet error: %s", err.Error())
		return err
	}
	logrus.Infof("[GetPodLog] Get pod %s log start", podInfo.Name)
	// logLength 大于0， 取最近的 logLength 行日志
	// 反之，取出全部日志
	if in.GetRowLimit() > 0 {
		logLength = int(in.GetRowLimit())
	}
	content, err := GetK8sPodLogs(clientSet, podInfo.Uid, logLength, "")
	//logrus.Infof("[GetPodLog]pod log: %v", content)
	if err != nil {
		logrus.Errorf("[GetPodLog] Get pod log error: %v", err)
		return err
	}
	resp.Log = string(content)
	if err = stream.Send(resp); err != nil {
		logrus.Errorf("[GetPodLog] send pod log error: %s", err.Error())
		return err
	}
	logrus.Infof("continue....")
	for {
		// 获取5秒的日志
		content, err = GetK8sPodLogs(clientSet, podInfo.Uid, -1, strconv.Itoa(5))
		if err != nil {
			logrus.Errorf("[GetPodLog]get pod log error: %v", err)
			break
		}
		if len(content) == 0 {
			time.Sleep(time.Second * 5)
			continue
		}
		resp.Log = string(content)
		if err = stream.Send(resp); err != nil {
			logrus.Errorf("[GetPodLog] send pod  %s log error: %s", podInfo.Name, err.Error())
			break
		}
		logrus.Infof("[GetPodLog]send pod %s log successful", podInfo.Name)
		time.Sleep(time.Second * 5)
	}
	return nil
}

// 通过podID 获取日志

func GetK8sPodLogs(clientSet *kubernetes.Clientset, podUid string, tail int, ss string) (Content []byte, err error) {
	var (
		pod     models.PodTable
		podName []string
	)
	if pod, err = GetPodByUid(podUid); err != nil {
		logrus.Errorf("[GetPodLogs] get pod uid %s info failed, err  %v", podUid, err)
		return
	}
	logrus.Infof("[GetPodLogs] pod name %s", pod.Name)
	podName = append(podName, pod.Name)
	outerArgs := &podlog.OuterRequestArgs{
		Namespace:    pod.Namespace,
		KubeClient:   clientSet,
		RetryCount:   5,
		RetryTimeout: time.Millisecond,
		Tail:         tail,
		SinceSeconds: ss,
	}
	logPrinter, err := podlog.NewPodLogPrinter(podName, outerArgs)
	if err != nil {
		logrus.Errorf("[getPodLogs] get log printer failed %v", err.Error())
		return
	}
	return logPrinter.Reader()
}

func GetPodByUid(podUid string) (podInfo models.PodTable, err error) {
	err = client.DB.Where("uid = ?", podUid).First(&podInfo).Error
	if err != nil {
		return podInfo, err
	}
	return podInfo, nil
}

func GetPodByName(name string) (podInfo models.PodTable, err error) {
	err = client.DB.Where("name = ?", name).First(&podInfo).Error
	if err != nil {
		return podInfo, err
	}
	return podInfo, nil
}
