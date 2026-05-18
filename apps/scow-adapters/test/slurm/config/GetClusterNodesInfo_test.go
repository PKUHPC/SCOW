package main

import (
	"context"
	pb "scow-adapters/gen/go"
	"testing"

	"google.golang.org/grpc"
)

func TestGetClusterNodesInfo(t *testing.T) {
	// Set up a connection to the server
	conn, err := grpc.Dial("localhost:8972", grpc.WithInsecure())
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := pb.NewConfigServiceClient(conn)

	// Call the Add RPC with test data
	req := &pb.GetClusterNodesInfoRequest{}
	res, err := client.GetClusterNodesInfo(context.Background(), req)
	if err != nil {
		t.Fatalf("GetClusterConfig failed: %v", err)
	}
	t.Logf("nodes info %v", res.Nodes)
}
