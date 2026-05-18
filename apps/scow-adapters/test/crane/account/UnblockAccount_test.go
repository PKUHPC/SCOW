package main

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/grpc"
	protos "scow-adapters/gen/go"
)

func TestUnblockAccount(t *testing.T) {

	// Set up a connection to the server
	conn, err := grpc.Dial("localhost:8972", grpc.WithInsecure())
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := protos.NewAccountServiceClient(conn)

	// Call the Add RPC with test data
	req := &protos.UnblockAccountRequest{
		AccountName: "yangjie",
	}
	_, err = client.UnblockAccount(context.Background(), req)
	if err != nil {
		t.Fatalf("BlockAccount failed: %v", err)
	}

	// 通过判断错误为nil 来决定是否执行成功
	assert.Empty(t, err)
}
