package main

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/grpc"

	pb "scow-adapters/gen/go"
)

func TestListAccounts(t *testing.T) {

	// Set up a connection to the server
	conn, err := grpc.Dial("localhost:8999", grpc.WithInsecure())
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := pb.NewAccountServiceClient(conn)

	// Call the Add RPC with test data
	req := &pb.ListAccountsRequest{
		UserId: "demo_user",
	}
	_, err = client.ListAccounts(context.Background(), req)
	if err != nil {
		t.Fatalf("CreateAccount failed: %v", err)
	}

	// Check the result, 通过判断错误为nil 来决定是否执行成功
	assert.Empty(t, err)
}
