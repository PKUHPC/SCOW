package main

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/grpc"
	protos "scow-adapters/gen/go"
)

func TestGetAllAccountsWithUsers(t *testing.T) {

	// Set up a connection to the server
	conn, err := grpc.Dial("localhost:8972", grpc.WithInsecure())
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := protos.NewAccountServiceClient(conn)

	// Call the Add RPC with test data
	req := &protos.GetAllAccountsWithUsersRequest{}
	res, err := client.GetAllAccountsWithUsers(context.Background(), req)
	if err != nil {
		t.Fatalf("GetAllAccountsWithUsers failed: %v", err)
	}

	assert.IsType(t, []*protos.ClusterAccountInfo{}, res.Accounts)
}
