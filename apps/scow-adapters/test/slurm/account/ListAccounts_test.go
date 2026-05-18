package main

import (
	"context"
	pb "scow-adapters/gen/go"
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/grpc"
)

func TestListAccounts(t *testing.T) {

	// Set up a connection to the server
	conn, err := grpc.Dial("localhost:8972", grpc.WithInsecure())
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := pb.NewAccountServiceClient(conn)

	// Call the Add RPC with test data
	req := &pb.ListAccountsRequest{
		UserId: "demo_admin",
	}
	res, err := client.ListAccounts(context.Background(), req)
	if err != nil {
		t.Fatalf("ListAccounts failed: %v", err)
	}

	// Check the result
	assert.IsType(t, []string{}, res.Accounts)
	// log.Println(res)
}
