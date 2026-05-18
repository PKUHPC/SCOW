package main

import (
	"context"
	"testing"

	"google.golang.org/grpc"
	protos "scow-adapters/gen/go"
)

func TestGetClusterInfo(t *testing.T) {
	// Set up a connection to the server
	conn, err := grpc.Dial("localhost:8972", grpc.WithInsecure())
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := protos.NewConfigServiceClient(conn)

	// Call the Add RPC with test data
	req := &protos.GetClusterInfoRequest{}
	_, err = client.GetClusterInfo(context.Background(), req)
	if err != nil {
		t.Fatalf("GetClusterConfig failed: %v", err)
	}

	// Check the result
	// assert.IsType(t, []*protos.Partition{}, res.Partitions)
}
