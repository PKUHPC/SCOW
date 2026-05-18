package main

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/grpc"
	protos "scow-adapters/gen/go"
)

func TestListAccounts(t *testing.T) {

	// Set up a connection to the server
	conn, err := grpc.Dial("localhost:8972", grpc.WithInsecure())
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := protos.NewAccountServiceClient(conn)

	// Call the Add RPC with test data
	req := &protos.ListAccountsRequest{
		UserId: "demo",
	}
	res, err := client.ListAccounts(context.Background(), req)
	if err != nil {
		t.Fatalf("ListAccounts failed: %v", err)
	}

	// Check the result
	assert.IsType(t, []string{}, res.Accounts)
}
