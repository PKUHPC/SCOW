package main

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/grpc"

	pb "scow-adapters/gen/go"
)

func TestGetClusterConfig(t *testing.T) {
	// Set up a connection to the server
	conn, err := grpc.Dial("localhost:8972", grpc.WithInsecure())
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := pb.NewConfigServiceClient(conn)

	// Call the Add RPC with test data
	req := &pb.GetClusterConfigRequest{}
	res, err := client.GetClusterConfig(context.Background(), req)
	if err != nil {
		t.Fatalf("GetClusterConfig failed: %v", err)
	}

	t.Logf("partitions %v", res.Partitions)
	// Check the result
	assert.IsType(t, []*pb.Partition{}, res.Partitions)
}
