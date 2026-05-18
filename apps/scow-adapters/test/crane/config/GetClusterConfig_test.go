package main

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/grpc"
	protos "scow-adapters/gen/go"
)

func TestGetClusterConfig(t *testing.T) {
	// Set up a connection to the server
	conn, err := grpc.Dial("localhost:8972", grpc.WithInsecure())
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := protos.NewConfigServiceClient(conn)

	// Call the Add RPC with test data
	req := &protos.GetClusterConfigRequest{}
	res, err := client.GetClusterConfig(context.Background(), req)
	if err != nil {
		t.Fatalf("GetClusterConfig failed: %v", err)
	}

	// Check the result
	assert.IsType(t, []*protos.Partition{}, res.Partitions)
}
