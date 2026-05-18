package main

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/grpc"
	protos "scow-adapters/gen/go"
)

func TestQueryJobTimeLimit(t *testing.T) {

	// Set up a connection to the server
	conn, err := grpc.Dial("localhost:8972", grpc.WithInsecure())
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := protos.NewJobServiceClient(conn)

	// Call the Add RPC with test data
	req := &protos.QueryJobTimeLimitRequest{
		JobId: 110,
	}
	res, err := client.QueryJobTimeLimit(context.Background(), req)
	if err != nil {
		t.Fatalf("QueryJobTimeLimit failed: %v", err)
	}

	assert.IsType(t, uint64(1), res.TimeLimitMinutes)
}
