package main

import (
	"context"
	pb "scow-adapters/gen/go"
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/grpc"
)

func TestBlockAccount(t *testing.T) {

	// Set up a connection to the server
	conn, err := grpc.Dial("localhost:8972", grpc.WithInsecure())
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := pb.NewAccountServiceClient(conn)

	// var list []string
	// Call the Add RPC with test data
	// list = append(list, "compute")
	req := &pb.BlockAccountRequest{
		AccountName: "a_admin",
		// BlockedPartitions: list,
	}
	_, err = client.BlockAccount(context.Background(), req)
	if err != nil {
		t.Fatalf("BlockAccount failed: %v", err)
	}

	// Check the result, 通过判断错误为nil 来决定是否执行成功
	assert.Empty(t, err)
	// log.Println(res)
}
