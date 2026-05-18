package main

import (
	"context"
	pb "scow-adapters/gen/go"
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/grpc"
)

func TestCreateAccount(t *testing.T) {

	// Set up a connection to the server
	conn, err := grpc.Dial("localhost:8972", grpc.WithInsecure())
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := pb.NewAccountServiceClient(conn)

	// Call the Add RPC with test data
	req := &pb.CreateAccountRequest{
		AccountName: "eeee22dddddd22",
		OwnerUserId: "test16",
	}
	_, err = client.CreateAccount(context.Background(), req)
	if err != nil {
		t.Fatalf("CreateAccount failed: %v", err)
	}

	// Check the result, 通过判断错误为nil 来决定是否执行成功
	assert.Empty(t, err)
	// log.Println(res)
}
