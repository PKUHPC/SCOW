package main

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/grpc"
	protos "scow-adapters/gen/go"
)

func TestQueryUserInAccountBlockStatus(t *testing.T) {

	// Set up a connection to the server
	conn, err := grpc.Dial("localhost:8972", grpc.WithInsecure())
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := protos.NewUserServiceClient(conn)

	// Call the Add RPC with test data
	req := &protos.QueryUserInAccountBlockStatusRequest{
		UserId:      "yangjie",
		AccountName: "yangjie",
	}
	_, err = client.QueryUserInAccountBlockStatus(context.Background(), req)
	if err != nil {
		t.Fatalf("QueryUserInAccountBlockStatus failed: %v", err)
	}

	assert.Empty(t, err)
}
