package main

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/grpc"

	pb "scow-adapters/gen/go"
)

func TestGetAvailablePartitions(t *testing.T) {
	// Set up a connection to the server
	conn, err := grpc.Dial("localhost:8972", grpc.WithInsecure())
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := pb.NewConfigServiceClient(conn)

	// Call the Add RPC with test data
	req := &pb.GetAvailablePartitionsRequest{
		AccountName: "hpc0006162500",
		UserId:      "0006162500",
	}
	res, err := client.GetAvailablePartitions(context.Background(), req)
	if err != nil {
		t.Fatalf("GetAvailablePartitions failed: %v", err)
	}

	t.Logf("partitions %v", res.Partitions)
	// Check the result
	assert.IsType(t, []*pb.Partition{}, res.Partitions)
}
