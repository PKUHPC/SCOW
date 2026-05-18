package job

import (
	"context"
	"errors"
	"time"

	"github.com/sirupsen/logrus"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/config"
	"scow-adapters/pkg/ai/db/models"
	"scow-adapters/pkg/ai/services/monitor"
	"scow-adapters/pkg/ai/utils"
)

func (s *ServerJob) GetPodMonitorInfo(ctx context.Context, in *pb.GetPodMonitorInfoRequest) (response *pb.GetPodMonitorInfoResponse, err error) {
	var (
		step        time.Duration
		accelerator string = "CPU"
		jobInfo     *models.JobTable
	)
	response = &pb.GetPodMonitorInfoResponse{}
	logrus.Infof("pod monitor get info: %v", in)
	addr := config.Value.PrometheusAddr
	if addr == "" {
		msg := "monitor info addr is nil"
		logrus.Errorf("get pod monitor info failed: %v", msg)
		return response, errors.New(msg)
	}
	podInfo, err := GetPodByName(in.PodName)
	if err != nil {
		logrus.Errorf("get pod %s info failed: %v", in.PodName, err)
	} else {
		if jobInfo, err = utils.GetJobByName(podInfo.JobName); err != nil {
			logrus.Errorf("get job %s info failed: %v", podInfo.JobName, err)
		} else if jobInfo.GPUsReq > 0 {
			accelerator = jobInfo.GpuType
		}
	}
	// range范围自动转step, prometheus api 只支持11000条数据
	rangeTime := in.End.AsTime().Unix() - in.Start.AsTime().Unix()
	if rangeTime > int64(in.StepSeconds*10000) {
		step = time.Duration(rangeTime/10000) * time.Second
	} else if rangeTime < int64(in.StepSeconds) {
		step = 15 * time.Second
	} else {
		step = time.Duration(in.StepSeconds) * time.Second
	}
	logrus.Infof("pod %s monitor get step: %v", in.PodName, step)
	mn := monitor.NewPromethuesInfo(
		monitor.WithAddress(addr),
		monitor.WithAccelerator(accelerator),
		monitor.WithRangeStart(in.Start.AsTime()),
		monitor.WithRangeStep(step),
		monitor.WithRangeEnd(in.End.AsTime()),
	)
	mn.SetPodQueryString(in.PodName)
	res := mn.GetAllMetrics()
	logrus.Trace(res)
	if res == nil {
		msg := "get monitor info failed, response is nil"
		logrus.Info(msg)
		return response, errors.New(msg)
	}
	response.MonitorData = res
	logrus.Infof("get pod %s monitor response success", in.PodName)
	return response, nil
}
