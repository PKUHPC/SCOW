package main

import (
	"context"
	"fmt"
	"google.golang.org/grpc"
	pb "scow-adapters/gen/go"
	"testing"
)

func TestDevHost1(t *testing.T) {

	// Set up a connection to the server
	conn, err := grpc.Dial("115.27.162.124:8972", grpc.WithInsecure(), grpc.WithDefaultCallOptions(grpc.MaxCallRecvMsgSize(1024*1024*1024)))
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := pb.NewJobServiceClient(conn)
	memory := uint64(2048)
	lt := uint32(3000)
	req := &pb.CreateDevHostRequest{
		UserId:           "demoadmin",
		JobName:          "test123",
		Account:          "a_admin",
		Partition:        "cpu",
		Qos:              "normal",
		CoreCount:        100,
		MemoryMb:         &memory,
		WorkingDirectory: "/data/home/demoadmin/",
		VscodeInfo: &pb.CreateDevHostRequest_VscodeInfo{
			VscodeBinPath: "/data/home/demoadmin/devhost/code-server-4.96.2-linux-amd64/bin/code-server",
		},
		JupyterLabInfo: &pb.CreateDevHostRequest_JupyterLabInfo{
			ProxyBasePath: "/api/proxy/jyb-k8s/absolute",
		},
		Mounts:           nil,
		PublicMounts:     []string{},
		Image:            "crpi-u0hdpwcobdb87rnx.cn-beijing.personal.cr.aliyuncs.com/qsx/pytorch-ddp-test:v1",
		TimeLimitMinutes: &lt,
	}
	res, err := client.CreateDevHost(context.Background(), req)
	fmt.Println(err)
	if err != nil {
		t.Fatalf("create dev host failed: %v", err)
	}
	fmt.Println(res)
}
func TestSubmitJob(t *testing.T) {

	// Set up a connection to the server
	conn, err := grpc.Dial("115.27.162.124:8972", grpc.WithInsecure(), grpc.WithDefaultCallOptions(grpc.MaxCallRecvMsgSize(1024*1024*1024)))
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := pb.NewJobServiceClient(conn)
	memory := uint64(2048)
	lt := uint32(3000)
	qos := "normal"
	req := &pb.SubmitJobRequest{
		UserId:           "demoadmin",
		JobName:          "test123",
		Account:          "a_admin",
		Partition:        "cpu",
		Qos:              &qos,
		CoreCount:        40,
		MemoryMb:         &memory,
		NodeCount:        2,
		WorkingDirectory: "/data/home/demoadmin/",
		ExtraOptions: []string{
			"train",
			"",
			"crpi-u0hdpwcobdb87rnx.cn-beijing.personal.cr.aliyuncs.com/qsx/pytorch-ddp-test:v1",
		},
		TimeLimitMinutes: &lt,
	}
	res, err := client.SubmitJob(context.Background(), req)
	fmt.Println(err)
	if err != nil {
		t.Fatalf("create job failed: %v", err)
	}
	fmt.Println(res)
}

func TestDevHost(t *testing.T) {

	// Set up a connection to the server
	conn, err := grpc.Dial("10.129.227.66:8972", grpc.WithInsecure(), grpc.WithDefaultCallOptions(grpc.MaxCallRecvMsgSize(1024*1024*1024)))
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := pb.NewJobServiceClient(conn)
	memory := uint64(2048)
	lt := uint32(3000)
	mount := &pb.CreateDevHostRequest_MountInfo{
		Path:   "/nfs/home/demo_admin2/0424",
		Target: "/111",
	}
	//s2 := `[{"path":"/nfs/public/","target":"/nfs/public/"}]`
	req := &pb.CreateDevHostRequest{
		UserId:           "demo_admin2",
		JobName:          "test123",
		Account:          "a_admin2",
		Partition:        "cpu",
		Qos:              "normal",
		CoreCount:        1,
		MemoryMb:         &memory,
		WorkingDirectory: "/nfs/home/demo_admin2",
		VscodeInfo: &pb.CreateDevHostRequest_VscodeInfo{
			VscodeBinPath: "/nfs/public/vscode/code-server-4.96.2-linux-amd64/bin/code-server",
		},
		JupyterLabInfo: &pb.CreateDevHostRequest_JupyterLabInfo{
			ProxyBasePath: "/ai/api/proxy/dev-k8s-c/absolute",
		},
		Mounts: []*pb.CreateDevHostRequest_MountInfo{mount},
		//PublicMounts:     []string{s2},
		PublicMounts:     []string{"/nfs/public/"},
		Image:            "crpi-u0hdpwcobdb87rnx.cn-beijing.personal.cr.aliyuncs.com/qsx/pytorch-ddp-test:v1",
		TimeLimitMinutes: &lt,
	}
	res, err := client.CreateDevHost(context.Background(), req)
	fmt.Println(err)
	if err != nil {
		t.Fatalf("create dev host failed: %v", err)
	}
	fmt.Println(res)
}

func TestGetDevHost(t *testing.T) {
	conn, err := grpc.Dial("10.129.227.66:8972", grpc.WithInsecure(), grpc.WithDefaultCallOptions(grpc.MaxCallRecvMsgSize(1024*1024*1024)))
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := pb.NewJobServiceClient(conn)
	jobType := pb.JobType_JOB_TYPE_DEV_HOST
	req := &pb.GetJobsRequest{
		Fields: []string{
			"job_id",
			"state",
			"elapsed_seconds",
			"time_limit_minutes",
			"reason",
			"partition",
			"gpus_alloc",
			"cpus_alloc",
			"mem_alloc_mb",
			"nodes_alloc",
			"gpus_req",
			"cpus_req",
			"mem_req_mb",
			"nodes_req",
		},
		JobTypes: []pb.JobType{jobType},
	}
	res, err := client.GetJobs(context.TODO(), req)
	fmt.Println(err)
	for _, job := range res.Jobs {
		fmt.Println(job)
	}
}

func TestGetQueue(t *testing.T) {
	conn, err := grpc.Dial("10.129.227.66:8972", grpc.WithInsecure(), grpc.WithDefaultCallOptions(grpc.MaxCallRecvMsgSize(1024*1024*1024)))
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := pb.NewConfigServiceClient(conn)
	req := &pb.GetClusterConfigRequest{}
	res, err := client.GetClusterConfig(context.TODO(), req)
	fmt.Println(err)
	for _, pt := range res.Partitions {
		fmt.Println(pt)
	}
}
