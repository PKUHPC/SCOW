package handlers

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"connectrpc.com/connect"
	apiv1 "github.com/PKUHPC/private-scow/apps/scowd/protos/gen/api/storage"
	"github.com/PKUHPC/private-scow/apps/scowd/protos/gen/api/storage/apiv1connect"
)

func TestMakeDirectoryModeRequiresExplicitPermission(t *testing.T) {
	servers := map[string]apiv1connect.FileServiceHandler{
		"parent": &FileServer{},
		"k8s":    &K8sFileServer{},
	}
	mode := "0700"
	allowed, denied := true, false
	for name, server := range servers {
		t.Run(name, func(t *testing.T) {
			for _, test := range []struct {
				name       string
				permission *bool
			}{
				{name: "omitted"},
				{name: "false", permission: &denied},
			} {
				t.Run(test.name, func(t *testing.T) {
					path := filepath.Join(t.TempDir(), "private")
					_, err := server.MakeDirectory(context.Background(), connect.NewRequest(&apiv1.MakeDirectoryRequest{
						DirPath: path, UserId: "nobody", Mode: &mode, NoCheckPermission: test.permission,
					}))
					if connect.CodeOf(err) != connect.CodePermissionDenied {
						t.Fatalf("expected PermissionDenied before root mkdir, got %v", err)
					}
					if _, err := os.Stat(path); !os.IsNotExist(err) {
						t.Fatalf("unauthorized request must not create directory: %v", err)
					}
				})
			}

			// 显式授权后到达 root 代建流程；使用缺失父目录，无需实际提权。
			path := filepath.Join(t.TempDir(), "missing", "private")
			_, err := server.MakeDirectory(context.Background(), connect.NewRequest(&apiv1.MakeDirectoryRequest{
				DirPath: path, UserId: "nobody", Mode: &mode, NoCheckPermission: &allowed,
			}))
			if connect.CodeOf(err) != connect.CodeNotFound {
				t.Fatalf("expected root mkdir parent validation, got %v", err)
			}

			for _, path := range []string{"/etc/private", filepath.Join(t.TempDir(), ".hidden")} {
				_, err := server.MakeDirectory(context.Background(), connect.NewRequest(&apiv1.MakeDirectoryRequest{
					DirPath: path, UserId: "nobody", Mode: &mode, NoCheckPermission: &allowed,
				}))
				if connect.CodeOf(err) != connect.CodeInvalidArgument {
					t.Fatalf("explicit permission must preserve path restrictions, got %v", err)
				}
			}
		})
	}
}
