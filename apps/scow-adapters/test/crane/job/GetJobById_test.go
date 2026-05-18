package main

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/grpc"
	protos "scow-adapters/gen/go"
)

func TestGetJobById(t *testing.T) {

	// Set up a connection to the server
	conn, err := grpc.Dial("localhost:8972", grpc.WithInsecure())
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := protos.NewJobServiceClient(conn)

	// Call the Add RPC with test data
	req := &protos.GetJobByIdRequest{
		// Fields: []string{"job_id"},
		JobId: 8,
	}
	res, err := client.GetJobById(context.Background(), req)
	if err != nil {
		t.Fatalf("GetJobById failed: %v", err)
	}

	assert.IsType(t, &protos.JobInfo{}, res.Job)
}
