package main

import (
	"context"
	pb "scow-adapters/gen/go"
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/grpc"
)

func TestUnblockAccount(t *testing.T) {
	// var (
	// 	unBlockPartitions []string
	// )

	// Set up a connection to the server
	conn, err := grpc.Dial("localhost:8972", grpc.WithInsecure())
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := pb.NewAccountServiceClient(conn)

	// unBlockPartitions = append(unBlockPartitions, "")

	// Call the Add RPC with test data
	req := &pb.UnblockAccountRequest{
		AccountName: "a_admin",
		// UnblockedPartitions: unBlockPartitions,
	}
	_, err = client.UnblockAccount(context.Background(), req)
	if err != nil {
		t.Fatalf("BlockAccount failed: %v", err)
	}

	// 通过判断错误为nil 来决定是否执行成功
	assert.Empty(t, err)
}
