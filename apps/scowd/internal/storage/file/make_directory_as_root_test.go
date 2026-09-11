package file

import (
	"errors"
	"os"
	"path/filepath"
	"syscall"
	"testing"

	"connectrpc.com/connect"
)

// connectCode 从 error 中提取 connect.Code，非 connect.Error 返回 -1
func connectCode(err error) connect.Code {
	var ce *connect.Error
	if errors.As(err, &ce) {
		return ce.Code()
	}
	return connect.Code(0xff)
}

// TestMakeDirectoryAsRoot_PathValidation 测试路径黑名单及格式校验
func TestMakeDirectoryAsRoot_PathValidation(t *testing.T) {
	tests := []struct {
		name    string
		dirPath string
	}{
		{name: "blacklisted /etc", dirPath: "/etc/evil"},
		{name: "blacklisted /bin", dirPath: "/bin/evil"},
		{name: "blacklisted /usr", dirPath: "/usr/evil"},
		{name: "dot-slash traversal", dirPath: "./nfs/../etc/evil"},
		{name: "path traversal", dirPath: "/tmp/../etc/evil"},
		{name: "redundant separator", dirPath: "/tmp//test"},
		{name: "hidden directory", dirPath: "/tmp/.hidden"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := MakeDirectoryAsRoot(tt.dirPath, "nobody", 0700)
			if err == nil {
				t.Errorf("expected error for path %q, got nil", tt.dirPath)
				return
			}
			if code := connectCode(err); code != connect.CodeInvalidArgument {
				t.Errorf("expected CodeInvalidArgument, got %v", code)
			}
		})
	}
}

// TestMakeDirectoryAsRoot_Success 测试完整的创建流程
func TestMakeDirectoryAsRoot_Success(t *testing.T) {
	if os.Getuid() != 0 {
		t.Skip("test requires root")
	}

	tmpDir := t.TempDir()
	parentDir := filepath.Join(tmpDir, "parent")
	if err := os.Mkdir(parentDir, 0755); err != nil {
		t.Fatalf("create parent dir: %v", err)
	}

	targetDir := filepath.Join(parentDir, "isolated")
	if err := MakeDirectoryAsRoot(targetDir, "nobody", 0700); err != nil {
		t.Fatalf("MakeDirectoryAsRoot() error: %v", err)
	}

	info, err := os.Stat(targetDir)
	if err != nil {
		t.Fatalf("stat target dir: %v", err)
	}
	if !info.IsDir() {
		t.Error("expected directory")
	}
	if perm := info.Mode().Perm(); perm != 0700 {
		t.Errorf("permission = %04o, want 0700", perm)
	}

	stat := info.Sys().(*syscall.Stat_t)
	if stat.Uid != 65534 {
		t.Errorf("UID = %d, want 65534 (nobody)", stat.Uid)
	}
	if stat.Gid != 65534 {
		t.Errorf("GID = %d, want 65534 (nobody)", stat.Gid)
	}
}

// TestMakeDirectoryAsRoot_AlreadyExists 测试目录已存在时返回 CodeAlreadyExists
func TestMakeDirectoryAsRoot_AlreadyExists(t *testing.T) {
	if os.Getuid() != 0 {
		t.Skip("test requires root")
	}

	tmpDir := t.TempDir()
	existingDir := filepath.Join(tmpDir, "existing")
	if err := os.Mkdir(existingDir, 0755); err != nil {
		t.Fatalf("create existing dir: %v", err)
	}

	err := MakeDirectoryAsRoot(existingDir, "nobody", 0700)
	if err == nil {
		t.Fatal("expected error for existing directory")
	}
	if code := connectCode(err); code != connect.CodeAlreadyExists {
		t.Errorf("expected CodeAlreadyExists, got %v", code)
	}
}

// TestMakeDirectoryAsRoot_ParentNotExist 测试父目录不存在时返回 CodeNotFound
func TestMakeDirectoryAsRoot_ParentNotExist(t *testing.T) {
	if os.Getuid() != 0 {
		t.Skip("test requires root")
	}

	err := MakeDirectoryAsRoot("/tmp/nonexistent-parent-"+t.Name()+"/child", "nobody", 0700)
	if err == nil {
		t.Fatal("expected error for nonexistent parent")
	}
	if code := connectCode(err); code != connect.CodeNotFound {
		t.Errorf("expected CodeNotFound, got %v", code)
	}
}

// TestMakeDirectoryAsRoot_InvalidUser 测试无效用户返回 CodeInternal，且目录被回滚
func TestMakeDirectoryAsRoot_InvalidUser(t *testing.T) {
	if os.Getuid() != 0 {
		t.Skip("test requires root")
	}

	tmpDir := t.TempDir()
	targetDir := filepath.Join(tmpDir, "test")

	err := MakeDirectoryAsRoot(targetDir, "nonexistent_user_12345", 0700)
	if err == nil {
		t.Fatal("expected error for invalid user")
	}
	if code := connectCode(err); code != connect.CodeInternal {
		t.Errorf("expected CodeInternal, got %v", code)
	}

	// user lookup 在 mkdir 之前失败，目录不应存在
	if _, statErr := os.Stat(targetDir); !os.IsNotExist(statErr) {
		t.Errorf("directory should not exist after user lookup failure")
	}
}

// TestMakeDirectoryAsRoot_MultiplePermissions 测试不同权限模式
func TestMakeDirectoryAsRoot_MultiplePermissions(t *testing.T) {
	if os.Getuid() != 0 {
		t.Skip("test requires root")
	}

	tests := []struct {
		name string
		mode os.FileMode
	}{
		{name: "0700", mode: 0700},
		{name: "0750", mode: 0750},
		{name: "0755", mode: 0755},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tmpDir := t.TempDir()
			targetDir := filepath.Join(tmpDir, "dir")

			if err := MakeDirectoryAsRoot(targetDir, "nobody", tt.mode); err != nil {
				t.Fatalf("MakeDirectoryAsRoot() error: %v", err)
			}

			info, err := os.Stat(targetDir)
			if err != nil {
				t.Fatalf("stat: %v", err)
			}
			if perm := info.Mode().Perm(); perm != tt.mode {
				t.Errorf("permission = %04o, want %04o", perm, tt.mode)
			}
		})
	}
}

// TestMakeDirectoryAsRoot_HiddenDirectory 测试隐藏目录被拒绝
func TestMakeDirectoryAsRoot_HiddenDirectory(t *testing.T) {
	tests := []struct {
		name    string
		dirPath string
	}{
		{name: "dot prefix", dirPath: "/tmp/.hidden"},
		{name: "dot prefix nested", dirPath: "/tmp/parent/.hidden"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := MakeDirectoryAsRoot(tt.dirPath, "nobody", 0700)
			if err == nil {
				t.Errorf("expected error for hidden directory %q, got nil", tt.dirPath)
				return
			}
			if code := connectCode(err); code != connect.CodeInvalidArgument {
				t.Errorf("expected CodeInvalidArgument, got %v", code)
			}
		})
	}
}
