package main

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/grpc"
	protos "scow-adapters/gen/go"
)

func TestAddUserToAccount(t *testing.T) {

	// Set up a connection to the server
	conn, err := grpc.Dial("localhost:8972", grpc.WithInsecure())
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := protos.NewUserServiceClient(conn)

	// Call the Add RPC with test data
	req := &protos.AddUserToAccountRequest{
		UserId:      "demotest",
		AccountName: "C_admin",
	}
	_, err = client.AddUserToAccount(context.Background(), req)
	if err != nil {
		t.Fatalf("AddUserToAccount failed: %v", err)
	}

	assert.Empty(t, err)
}
