package main

import (
	"context"
	pb "scow-adapters/gen/go"
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/grpc"
)

func TestSubmitJob(t *testing.T) {

	// Set up a connection to the server
	conn, err := grpc.Dial("localhost:8999", grpc.WithInsecure())
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := pb.NewJobServiceClient(conn)

	// Call the Add RPC with test data
	qos := "normal"
	timeLimitMinutes := uint32(1)
	memoryMb := uint64(200)
	stdout := "slurm-%j.out"
	stderr := "slurm-%j.out"
	req := &pb.SubmitJobRequest{
		UserId:           "test15",
		JobName:          "test",
		Account:          "a_admin",
		Partition:        "compute",
		Qos:              &qos,
		NodeCount:        1,
		GpuCount:         0,
		MemoryMb:         &memoryMb,
		CoreCount:        1,
		TimeLimitMinutes: &timeLimitMinutes,
		Script:           "sleep 100",
		WorkingDirectory: "dffffeeee11",
		Stdout:           &stdout,
		Stderr:           &stderr,
	}
	res, err := client.SubmitJob(context.Background(), req)
	if err != nil {
		t.Fatalf("SubmitJob failed: %v", err)
	}

	// Check the result, 通过判断错误为nil 来决定是否执行成功
	// assert.Empty(t, err)
	assert.IsType(t, uint32(1), res.JobId)
}
