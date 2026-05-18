package main

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/types/known/timestamppb"
	protos "scow-adapters/gen/go"
)

func TestGetJobs(t *testing.T) {

	// Set up a connection to the server
	conn, err := grpc.Dial("localhost:8972", grpc.WithInsecure())
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := protos.NewJobServiceClient(conn)

	// Call the Add RPC with test data
	user := []string{"root"}
	// account := []string{"C_admin", "a_admin"}
	state := []string{"COMPLETED", "FAILED"}
	req := &protos.GetJobsRequest{
		Fields: []string{},
		// Filter: &pb.GetJobsRequest_Filter{Users: user, Accounts: account, States: state, EndTime: &pb.TimeRange{StartTime: &timestamppb.Timestamp{Seconds: 1682066342}, EndTime: &timestamppb.Timestamp{Seconds: 1682586485}}}, PageInfo: &pb.PageInfo{Page: 1, PageSize: 10},
		Filter: &protos.GetJobsRequest_Filter{Users: user, States: state, EndTime: &protos.TimeRange{EndTime: &timestamppb.Timestamp{Seconds: 1686883307}}},
		// Filter: &protos.GetJobsRequest_Filter{Users: user, States: state},
	}
	res, err := client.GetJobs(context.Background(), req)
	if err != nil {
		t.Fatalf("GetJobs failed: %v", err)
	}

	assert.IsType(t, []*protos.JobInfo{}, res.Jobs)
}
