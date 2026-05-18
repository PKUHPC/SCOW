package main

import (
	"context"
	pb "scow-adapters/gen/go"
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/grpc"
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
	fields := []string{}
	user := []string{"test03", "test02"}
	// account := []string{"c_admin", "a_admin"}
	// account := []string{}
	state := []string{"COMPLETED", "PENDING"}
	req := &pb.GetJobsRequest{
		Fields: fields,
		// Filter: &pb.GetJobsRequest_Filter{Users: user, States: state, EndTime: &pb.TimeRange{StartTime: &timestamppb.Timestamp{Seconds: 1682066342}, EndTime: &timestamppb.Timestamp{Seconds: 1682586485}}},
		// Filter: &pb.GetJobsRequest_Filter{Users: user, Accounts: account, States: state},
		// Filter: &pb.GetJobsRequest_Filter{Users: user, Accounts: account},
		Filter: &pb.GetJobsRequest_Filter{Users: user, States: state},
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
