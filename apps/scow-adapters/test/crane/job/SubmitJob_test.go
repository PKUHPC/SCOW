package main

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/grpc"
	protos "scow-adapters/gen/go"
)

func TestSubmitJob(t *testing.T) {

	// Set up a connection to the server
	conn, err := grpc.Dial("localhost:8972", grpc.WithInsecure())
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := protos.NewJobServiceClient(conn)

	// Call the Add RPC with test data
	qos := "UNLIMITED"
	timeLimitMinutes := uint32(1)
	memoryMb := uint64(200)
	stdout := "crane-%j.out"
	stderr := "crane-%j.out"
	req := &protos.SubmitJobRequest{
		UserId:           "demo",
		JobName:          "test",
		Account:          "a_admin",
		Partition:        "CPU",
		Qos:              &qos,
		NodeCount:        1,
		GpuCount:         0,
		MemoryMb:         &memoryMb,
		CoreCount:        1,
		TimeLimitMinutes: &timeLimitMinutes,
		Script:           "sleep 100",
		WorkingDirectory: "/nfs/home/demo",
		Stdout:           &stdout,
		Stderr:           &stderr,
	}
	res, err := client.SubmitJob(context.Background(), req)
	if err != nil {
		t.Fatalf("SubmitJob failed: %v", err)
	}

	// assert.Empty(t, err)
	assert.IsType(t, uint32(1), res.JobId)
}
