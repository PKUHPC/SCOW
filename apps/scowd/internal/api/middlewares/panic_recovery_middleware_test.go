package middlewares

import (
	"context"
	"testing"

	"connectrpc.com/connect"
)

func TestPanicRecoveryHandlerOption(t *testing.T) {
	err := recoverRPCPanic(context.Background(), connect.Spec{Procedure: "/test.Service/Panic"}, nil, "test panic")
	if connect.CodeOf(err) != connect.CodeInternal {
		t.Fatalf("expected internal error, got %v", err)
	}
}
