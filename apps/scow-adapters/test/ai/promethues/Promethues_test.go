package promethues

import (
	"context"
	"fmt"
	"testing"
	"time"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/services/monitor"

	"google.golang.org/grpc"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func TestPromethues(t *testing.T) {
	start := time.Now().Add(-1 * time.Hour)
	end := time.Now()
	step := 60 * time.Second
	accelerator := monitor.Nvidia
	podName := ""
	addr := "http://10.129.227.66:32001"
	prom := monitor.NewPromethuesInfo(
		monitor.WithAddress(addr),
		monitor.WithAccelerator(accelerator),
		monitor.WithRangeStart(start),
		monitor.WithRangeStep(step),
		monitor.WithRangeEnd(end),
	)
	prom.SetPodQueryString(podName)
	fmt.Println(prom.GetAllMetrics())
}

func TestGetMonitorInfo(t *testing.T) {

	// Set up a connection to the server
	// 更换具体的适配器地址
	conn, err := grpc.Dial("10.129.227.66:8972", grpc.WithInsecure(), grpc.WithDefaultCallOptions(grpc.MaxCallRecvMsgSize(1024*1024*1024)))
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := pb.NewJobServiceClient(conn)
	oneHourAgo := time.Now().Add(-10 * time.Minute)
	req := pb.GetPodMonitorInfoRequest{
		PodName:     "dev-k8s-c-jupyter-20250513-140540-1747116343-worker-0",
		Start:       timestamppb.New(oneHourAgo),
		End:         timestamppb.New(time.Now()),
		StepSeconds: 30,
	}
	res, err := client.GetPodMonitorInfo(context.Background(), &req)
	//fmt.Println(res, err)
	for _, v := range res.MonitorData {
		fmt.Println(v.GetMetrics())
		for _, n := range v.Values {
			fmt.Println(n.GetTimestampMillisecond(), n.GetValue())
		}
	}
}
