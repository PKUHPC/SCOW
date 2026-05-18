package main

import (
	"context"
	"fmt"
	pb "scow-adapters/gen/go"
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/grpc"
)

func TestGetClusterConfig(t *testing.T) {

	// Set up a connection to the server
	conn, err := grpc.Dial("localhost:8972", grpc.WithInsecure())
	if err != nil {
		t.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := pb.NewConfigServiceClient(conn)

	// Call the Add RPC with test data
	req := &pb.GetClusterConfigRequest{}
	result, err := client.GetClusterConfig(context.Background(), req)
	if err != nil {
		t.Fatalf("GetClusterConfig failed: %v", err)
	}
	fmt.Println(result)

	// Check the result, 通过判断错误为nil 来决定是否执行成功
	assert.Empty(t, err)
}
