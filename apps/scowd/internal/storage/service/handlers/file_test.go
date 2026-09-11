package handlers

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	apiv1 "scowd/protos/gen/api/storage"

	"connectrpc.com/connect"
)

func TestFileServerExistsHandlesNotDir(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	server := &FileServer{}

	leafFile := filepath.Join(tempDir, "leaf.txt")
	if err := os.WriteFile(leafFile, []byte("dummy"), 0o600); err != nil {
		t.Fatalf("failed to create test file: %v", err)
	}

	req := connect.NewRequest(&apiv1.ExistsRequest{
		Path: filepath.Join(leafFile, "sub"),
	})

	resp, err := server.Exists(context.Background(), req)
	if err != nil {
		t.Fatalf("Exists returned error: %v", err)
	}

	if resp.Msg == nil || resp.Msg.Exists {
		t.Fatalf("expected Exists false for path below file, got %+v", resp.Msg)
	}
}
