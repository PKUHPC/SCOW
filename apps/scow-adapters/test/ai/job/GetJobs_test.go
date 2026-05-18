package main

import (
	"context"
	pb "scow-adapters/gen/go"
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/grpc"
	// "google.golang.org/protobuf/types/known/timestamppb"
	// "google.golang.org/protobuf/types/known/timestamppb"
)

func TestGetJobs(t *testing.T) {

	// Set up a connection to the server
	conn, err := grpc.Dial("localhost:8972", grpc.WithInsecure(), grpc.WithDefaultCallOptions(grpc.MaxCallRecvMsgSize(1024*1024*1024)))
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := pb.NewJobServiceClient(conn)

	// Call the Add RPC with test data
	// fields := []string{"job_id", "state", "elapsed_seconds", "time_limit_minutes"}
	fields := []string{"job_id", "name", "account", "user", "partition", "qos", "state", "cpus_req", "mem_req_mb", "nodes_req", "time_limit_minutes", "submit_time", "working_directory", "stdout_path", "stderr_path", "start_time", "elapsed_seconds", "reason", "node_list", "gpus_alloc", "cpus_alloc", "mem_alloc_mb", "nodes_alloc", "end_time"}
	// user := []string{"test03", "test02"}
	account := []string{"a_admin1", "a_admin2", "a_lylzh"}
	// account := []string{}
	// state := []string{"RUNNING", "PENDING"}
	jobName := "jupyter-20240624-162944"
	req := &pb.GetJobsRequest{
		Fields: fields,
		// Filter: &pb.GetJobsRequest_Filter{Accounts: account,  PageInfo: &pb.PageInfo{Page: 1, PageSize: 10}},
		// Filter: &pb.GetJobsRequest_Filter{Users: user, Accounts: account, States: state},
		// Filter: &pb.GetJobsRequest_Filter{Users: user, Accounts: account},
		Filter:   &pb.GetJobsRequest_Filter{Accounts: account, JobName: &jobName, SubmitTime: &pb.TimeRange{}, EndTime: &pb.TimeRange{}},
		PageInfo: &pb.PageInfo{Page: 1, PageSize: 10},
		// Sort:   &pb.SortInfo{Field: "state", Order: pb.SortInfo_DESC},
	}
	res, err := client.GetJobs(context.Background(), req)
	if err != nil {
		t.Fatalf("GetJobs failed: %v", err)
	}

	// Check the result, 通过判断错误为nil 来决定是否执行成功
	// assert.Empty(t, err)
	assert.IsType(t, []*pb.JobInfo{}, res.Jobs)
}
