package pod

import (
	"context"
	"fmt"
	"google.golang.org/grpc"
	pb "scow-adapters/gen/go"
	"testing"
	"time"
)

func TestGetPodLog(t *testing.T) {

	// Set up a connection to the server
	// 更换具体的适配器地址
	conn, err := grpc.Dial("10.129.227.66:8972", grpc.WithInsecure(), grpc.WithDefaultCallOptions(grpc.MaxCallRecvMsgSize(1024*1024*1024)))
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := pb.NewJobServiceClient(conn)
	req := &pb.GetPodLogsRequest{
		PodId: "bda7f8d8-63a9-4eae-878f-259de626de46", // 填写有日志的pod uid
	}
	res, err := client.GetPodLogs(context.Background(), req)
	if err != nil {
		t.Fatalf("GetJobs failed: %v", err)
	}
	for {
		fmt.Println(res.Recv())
		time.Sleep(time.Second * 5)
	}

}
