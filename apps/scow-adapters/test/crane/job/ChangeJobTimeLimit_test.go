package main

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/grpc"
	protos "scow-adapters/gen/go"
)

func TestChangeJobTimeLimit(t *testing.T) {

	// Set up a connection to the server
	conn, err := grpc.Dial("localhost:8972", grpc.WithInsecure())
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := protos.NewJobServiceClient(conn)

	// Call the Add RPC with test data
	req := &protos.ChangeJobTimeLimitRequest{
		JobId:        30,
		DeltaMinutes: 4,
	}
	_, err = client.ChangeJobTimeLimit(context.Background(), req)
	if err != nil {
		t.Fatalf("ChangeJobTimeLimit failed: %v", err)
	}

	assert.Empty(t, err)
}
