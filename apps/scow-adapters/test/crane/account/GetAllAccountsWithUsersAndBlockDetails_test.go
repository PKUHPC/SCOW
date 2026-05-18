package main

import (
	"context"
	"testing"

	"google.golang.org/grpc"
	protos "scow-adapters/gen/go"
)

func TestGetAllAccountsWithUsersAndBlockedDetails(t *testing.T) {

	// Set up a connection to the server
	conn, err := grpc.Dial("localhost:8999", grpc.WithInsecure())
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := protos.NewAccountServiceClient(conn)

	// Call the Add RPC with test data
	req := &protos.GetAllAccountsWithUsersAndBlockedDetailsRequest{}
	res, err := client.GetAllAccountsWithUsersAndBlockedDetails(context.Background(), req)
	if err != nil {
		t.Fatalf("GetAllAccountsWithUsersAndBlockedDetails failed: %v", err)
	}
	t.Logf("AccountsWithUsersAndBlockedDetails info %v", res.Accounts)
	// assert.IsType(t, []*protos.ClusterAccountInfoWithBlockedDetails{}, res.Accounts)
}
