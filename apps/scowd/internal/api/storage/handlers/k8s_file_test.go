package handlers

import (
	"context"
	"os"
	"os/user"
	"path/filepath"
	"testing"

	"github.com/PKUHPC/private-scow/apps/scowd/internal/config"
	apiv1 "github.com/PKUHPC/private-scow/apps/scowd/protos/gen/api/storage"

	"connectrpc.com/connect"
)

// TestGetRelativePathForUser 测试用户路径转换函数
func TestGetRelativePathForUser(t *testing.T) {
	// 使用登录用户名（Username）查找用户，Name 是可能为空的显示名称。
	currentUser, err := user.Current()
	t.Logf("currentUser: %+v", currentUser)
	if err != nil {
		t.Skipf("Cannot get current user: %v", err)
	}

	tests := []struct {
		name         string
		userID       string
		absolutePath string
		wantErr      bool
		expected     string
	}{
		{
			name:         "valid path in home directory",
			userID:       currentUser.Username,
			absolutePath: filepath.Join(currentUser.HomeDir, "test", "file.txt"),
			wantErr:      false,
			expected:     filepath.Join("test", "file.txt"),
		},
		{
			name:         "home directory itself",
			userID:       currentUser.Username,
			absolutePath: currentUser.HomeDir,
			wantErr:      false,
			expected:     ".",
		},
		{
			name:         "path outside home directory",
			userID:       currentUser.Username,
			absolutePath: filepath.Join(filepath.Dir(currentUser.HomeDir), "other"),
			wantErr:      true,
		},
		{
			name:         "invalid user ID",
			userID:       "999999", // 使用一个不太可能存在的用户ID
			absolutePath: "/some/path",
			wantErr:      true,
		},
		// 边界情况测试
		{
			name:         "empty path",
			userID:       currentUser.Username,
			absolutePath: "",
			wantErr:      true,
		},
		{
			name:         "relative path input",
			userID:       currentUser.Username,
			absolutePath: "relative/path",
			wantErr:      true,
		},
		{
			name:         "path with double slashes",
			userID:       currentUser.Username,
			absolutePath: filepath.Join(currentUser.HomeDir, "test//file.txt"),
			wantErr:      false,
			expected:     filepath.Join("test", "file.txt"),
		},
		{
			name:         "path with dot segments",
			userID:       currentUser.Username,
			absolutePath: filepath.Join(currentUser.HomeDir, "./test/./file.txt"),
			wantErr:      false,
			expected:     filepath.Join("test", "file.txt"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := getRelativePathForUser(tt.userID, tt.absolutePath)
			if (err != nil) != tt.wantErr {
				t.Errorf("getRelativePathForUser() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && result != tt.expected {
				t.Errorf("getRelativePathForUser() = %v, want %v", result, tt.expected)
			}
		})
	}
}

// TestGetRelativePathForRoot 测试根据共享文件夹状态的路径转换函数
func TestGetRelativePathForRoot(t *testing.T) {
	// 使用登录用户名（Username）查找用户，Name 是可能为空的显示名称。
	currentUser, err := user.Current()
	if err != nil {
		t.Skipf("Cannot get current user: %v", err)
	}

	// 创建测试用的K8sFileServer实例
	server := &K8sFileServer{
		config: &config.ScowdConfig{
			AI: config.AIConfig{
				SharedFolderPath: "/shared",
			},
		},
	}

	tests := []struct {
		name         string
		userID       string
		absolutePath string
		inShared     bool
		wantErr      bool
		expected     string
	}{
		{
			name:         "shared folder path",
			userID:       currentUser.Username,
			absolutePath: "/shared/test/file.txt",
			inShared:     true,
			wantErr:      false,
			expected:     filepath.Join("test", "file.txt"),
		},
		{
			name:         "shared folder root",
			userID:       currentUser.Username,
			absolutePath: "/shared",
			inShared:     true,
			wantErr:      false,
			expected:     ".",
		},
		{
			name:         "path outside shared folder",
			userID:       currentUser.Username,
			absolutePath: "/other/path",
			inShared:     true,
			wantErr:      true,
		},
		{
			name:         "user home path when not in shared",
			userID:       currentUser.Username,
			absolutePath: filepath.Join(currentUser.HomeDir, "test.txt"),
			inShared:     false,
			wantErr:      false,
			expected:     "test.txt",
		},
		{
			name:         "path outside user home when not in shared",
			userID:       currentUser.Username,
			absolutePath: "/tmp/test.txt",
			inShared:     false,
			wantErr:      true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := server.getRelativePathForRoot(tt.userID, tt.absolutePath, tt.inShared)
			if (err != nil) != tt.wantErr {
				t.Errorf("getRelativePathForRoot() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && result != tt.expected {
				t.Errorf("getRelativePathForRoot() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestK8sFileServerExistsHandlesNotDir(t *testing.T) {
	t.Parallel()

	currentUser, err := user.Current()
	if err != nil {
		t.Skipf("Cannot get current user: %v", err)
	}

	sharedDir, err := os.MkdirTemp(currentUser.HomeDir, "k8sfile-shared-notdir-")
	if err != nil {
		t.Fatalf("failed to create shared dir under home: %v", err)
	}
	t.Cleanup(func() {
		_ = os.RemoveAll(sharedDir)
	})

	userTempDir, err := os.MkdirTemp(sharedDir, "k8sfile-notdir-")
	if err != nil {
		t.Fatalf("failed to create temp dir under home: %v", err)
	}
	t.Cleanup(func() {
		_ = os.RemoveAll(userTempDir)
	})

	server := &K8sFileServer{
		config: &config.ScowdConfig{
			AI: config.AIConfig{
				SharedFolderPath: sharedDir,
			},
		},
	}

	leafFile := filepath.Join(userTempDir, "111.txt")
	if err := os.WriteFile(leafFile, []byte("dummy"), 0o600); err != nil {
		t.Fatalf("failed to write test file: %v", err)
	}

	nonDirPath := filepath.Join(leafFile, "session.json")
	req := connect.NewRequest(&apiv1.ExistsRequest{
		UserId: currentUser.Username,
		Path:   nonDirPath,
	})

	resp, err := server.Exists(context.Background(), req)
	if err != nil {
		t.Fatalf("Exists returned error: %v", err)
	}

	if resp.Msg == nil || resp.Msg.Exists {
		t.Fatalf("expected Exists to be false for path under non-directory, got response: %+v", resp.Msg)
	}
}

func TestK8sFileServerCopyNoCheckPermissionWithMode(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	server := &K8sFileServer{}

	srcFile := filepath.Join(tempDir, "src.txt")
	if err := os.WriteFile(srcFile, []byte("dummy"), 0o644); err != nil {
		t.Fatalf("failed to create source file: %v", err)
	}

	noCheckPermission := true
	mode := "0600"
	dstFile := filepath.Join(tempDir, "dst.txt")
	resp, err := server.Copy(context.Background(), connect.NewRequest(&apiv1.CopyRequest{
		FromPath:          srcFile,
		ToPath:            dstFile,
		Mode:              &mode,
		NoCheckPermission: &noCheckPermission,
	}))
	if err != nil {
		t.Fatalf("Copy returned error: %v", err)
	}
	if resp.Msg == nil {
		t.Fatalf("expected response message")
	}

	info, err := os.Stat(dstFile)
	if err != nil {
		t.Fatalf("expected copied file: %v", err)
	}
	if got := info.Mode().Perm(); got != 0o600 {
		t.Fatalf("expected copied file mode 0600, got %#o", got)
	}
}

func TestK8sFileServerCopyNoCheckPermissionWithRecursiveMode(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	server := &K8sFileServer{}

	srcDir := filepath.Join(tempDir, "src")
	if err := os.MkdirAll(srcDir, 0o755); err != nil {
		t.Fatalf("failed to create source dir: %v", err)
	}
	srcFile := filepath.Join(srcDir, "nested.txt")
	if err := os.WriteFile(srcFile, []byte("dummy"), 0o644); err != nil {
		t.Fatalf("failed to create source file: %v", err)
	}

	noCheckPermission := true
	mode := "0710"
	chmodRecursive := true
	dstDir := filepath.Join(tempDir, "dst")
	resp, err := server.Copy(context.Background(), connect.NewRequest(&apiv1.CopyRequest{
		FromPath:          srcDir,
		ToPath:            dstDir,
		Mode:              &mode,
		ChmodRecursive:    &chmodRecursive,
		NoCheckPermission: &noCheckPermission,
	}))
	if err != nil {
		t.Fatalf("Copy returned error: %v", err)
	}
	if resp.Msg == nil {
		t.Fatalf("expected response message")
	}

	dstInfo, err := os.Stat(dstDir)
	if err != nil {
		t.Fatalf("expected copied directory: %v", err)
	}
	if got := dstInfo.Mode().Perm(); got != 0o710 {
		t.Fatalf("expected copied directory mode 0710, got %#o", got)
	}

	fileInfo, err := os.Stat(filepath.Join(dstDir, "nested.txt"))
	if err != nil {
		t.Fatalf("expected copied nested file: %v", err)
	}
	if got := fileInfo.Mode().Perm(); got != 0o710 {
		t.Fatalf("expected copied nested file mode 0710, got %#o", got)
	}
}

func TestK8sFileServerCopyRejectsInvalidMode(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	server := &K8sFileServer{}

	srcFile := filepath.Join(tempDir, "src.txt")
	if err := os.WriteFile(srcFile, []byte("dummy"), 0o644); err != nil {
		t.Fatalf("failed to create source file: %v", err)
	}

	noCheckPermission := true
	mode := "invalid"
	_, err := server.Copy(context.Background(), connect.NewRequest(&apiv1.CopyRequest{
		FromPath:          srcFile,
		ToPath:            filepath.Join(tempDir, "dst.txt"),
		Mode:              &mode,
		NoCheckPermission: &noCheckPermission,
	}))
	if err == nil {
		t.Fatalf("expected invalid mode error")
	}
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("expected InvalidArgument, got %s: %v", connect.CodeOf(err), err)
	}
	if _, statErr := os.Stat(filepath.Join(tempDir, "dst.txt")); !os.IsNotExist(statErr) {
		t.Fatalf("expected destination not to be created after invalid mode, stat err: %v", statErr)
	}
}

func TestK8sFileServerCopyRejectsInvalidModeWithoutCreatingTargetDir(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	server := &K8sFileServer{}

	srcDir := filepath.Join(tempDir, "v1")
	if err := os.MkdirAll(srcDir, 0o755); err != nil {
		t.Fatalf("failed to create source dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(srcDir, "dataset.txt"), []byte("dummy"), 0o644); err != nil {
		t.Fatalf("failed to create source file: %v", err)
	}

	noCheckPermission := true
	chmodRecursive := true
	mode := "invalid"
	dstDir := filepath.Join(tempDir, "target", "v1")
	if err := os.MkdirAll(filepath.Dir(dstDir), 0o755); err != nil {
		t.Fatalf("failed to create target parent dir: %v", err)
	}

	_, err := server.Copy(context.Background(), connect.NewRequest(&apiv1.CopyRequest{
		FromPath:          srcDir,
		ToPath:            dstDir,
		Mode:              &mode,
		ChmodRecursive:    &chmodRecursive,
		NoCheckPermission: &noCheckPermission,
	}))
	if err == nil {
		t.Fatalf("expected invalid mode error")
	}
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("expected InvalidArgument, got %s: %v", connect.CodeOf(err), err)
	}
	if _, statErr := os.Stat(dstDir); !os.IsNotExist(statErr) {
		t.Fatalf("expected destination directory not to be created after invalid mode, stat err: %v", statErr)
	}
}

func TestK8sFileServerCopyWithModeRollsBackTempOnChmodFailure(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	server := &K8sFileServer{}

	srcFile := filepath.Join(tempDir, "src.txt")
	if err := os.WriteFile(srcFile, []byte("dummy"), 0o644); err != nil {
		t.Fatalf("failed to create source file: %v", err)
	}

	noCheckPermission := true
	chmodRecursive := true
	mode := "0750"
	dstFile := filepath.Join(tempDir, "dst.txt")
	_, err := server.Copy(context.Background(), connect.NewRequest(&apiv1.CopyRequest{
		FromPath:          srcFile,
		ToPath:            dstFile,
		Mode:              &mode,
		ChmodRecursive:    &chmodRecursive,
		NoCheckPermission: &noCheckPermission,
	}))
	if err == nil {
		t.Fatalf("expected recursive chmod failure for file copy")
	}
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("expected InvalidArgument, got %s: %v", connect.CodeOf(err), err)
	}
	if _, statErr := os.Stat(dstFile); !os.IsNotExist(statErr) {
		t.Fatalf("expected destination file not to be created after rollback, stat err: %v", statErr)
	}
	assertNoTempPath(t, tempDir, ".scowd-copy-tmp-*")
}

func TestK8sFileServerCopyRejectsSelfAndSubdirectory(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	server := &K8sFileServer{}

	srcDir := filepath.Join(tempDir, "src")
	if err := os.MkdirAll(srcDir, 0o755); err != nil {
		t.Fatalf("failed to create source dir: %v", err)
	}

	noCheckPermission := true
	mode := "0750"
	chmodRecursive := true
	_, err := server.Copy(context.Background(), connect.NewRequest(&apiv1.CopyRequest{
		FromPath:          srcDir,
		ToPath:            srcDir,
		Mode:              &mode,
		ChmodRecursive:    &chmodRecursive,
		NoCheckPermission: &noCheckPermission,
	}))
	if err == nil {
		t.Fatalf("expected copy-to-self error")
	}
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("expected InvalidArgument for copy-to-self, got %s: %v", connect.CodeOf(err), err)
	}

	_, err = server.Copy(context.Background(), connect.NewRequest(&apiv1.CopyRequest{
		FromPath:          srcDir,
		ToPath:            filepath.Join(srcDir, "child"),
		Mode:              &mode,
		ChmodRecursive:    &chmodRecursive,
		NoCheckPermission: &noCheckPermission,
	}))
	if err == nil {
		t.Fatalf("expected copy-to-subdirectory error")
	}
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("expected InvalidArgument for copy-to-subdirectory, got %s: %v", connect.CodeOf(err), err)
	}
}

func TestK8sFileServerShareFileOrDirRejectsInvalidSourceBeforeCreatingTarget(t *testing.T) {
	t.Parallel()

	currentUser, err := user.Current()
	if err != nil {
		t.Skipf("Cannot get current user: %v", err)
	}

	sharedDir := t.TempDir()
	outsideDir := t.TempDir()
	server := &K8sFileServer{
		config: &config.ScowdConfig{
			AI: config.AIConfig{
				SharedFolderPath: sharedDir,
			},
		},
	}

	sourceFilePath := filepath.Join(outsideDir, "source.txt")
	if err := os.WriteFile(sourceFilePath, []byte("dummy"), 0o644); err != nil {
		t.Fatalf("failed to create outside source file: %v", err)
	}

	targetDirectory := filepath.Join(sharedDir, currentUser.Username, "dataset")
	targetTopDir := filepath.Join(targetDirectory, "algo")
	targetFullDir := filepath.Join(targetTopDir, "v1")
	sharedFilePath := filepath.Join(targetFullDir, "source.txt")

	_, err = server.ShareFileOrDir(context.Background(), connect.NewRequest(&apiv1.ShareFileOrDirRequest{
		UserId:          currentUser.Username,
		SourceFilePath:  sourceFilePath,
		TargetDirectory: targetDirectory,
		TargetTopDir:    targetTopDir,
		TargetFullDir:   targetFullDir,
		SharedFilePath:  sharedFilePath,
		Mode:            "0755",
	}))
	if err == nil {
		t.Fatalf("expected invalid source path error")
	}
	if _, statErr := os.Stat(targetDirectory); !os.IsNotExist(statErr) {
		t.Fatalf("expected target directory not to be created after source validation failure, stat err: %v", statErr)
	}
}

func TestK8sFileServerShareFileOrDirCreatesTreeAndCopiesBasename(t *testing.T) {
	t.Parallel()

	userName, sourceFilePath := createShareSourceInCurrentUserHome(t, "source.txt", []byte("dummy"))
	sharedDir := t.TempDir()
	server := &K8sFileServer{
		config: &config.ScowdConfig{
			AI: config.AIConfig{
				SharedFolderPath: sharedDir,
			},
		},
	}

	targetDirectory := filepath.Join(sharedDir, userName, "dataset")
	targetTopDir := filepath.Join(targetDirectory, "algo")
	targetFullDir := filepath.Join(targetTopDir, "v1")
	sharedFilePath := filepath.Join(targetFullDir, "source.txt")

	resp, err := server.ShareFileOrDir(context.Background(), connect.NewRequest(newK8sShareFileOrDirRequestWithUser(
		userName,
		sourceFilePath,
		targetDirectory,
		targetTopDir,
		targetFullDir,
		sharedFilePath,
		"0755",
	)))
	if err != nil {
		t.Fatalf("ShareFileOrDir returned error: %v", err)
	}
	if resp.Msg == nil {
		t.Fatalf("expected response message")
	}
	if _, err := os.Stat(sharedFilePath); err != nil {
		t.Fatalf("expected shared file: %v", err)
	}

	targetTopInfo, err := os.Stat(targetTopDir)
	if err != nil {
		t.Fatalf("failed to stat target top dir: %v", err)
	}
	if got := targetTopInfo.Mode().Perm(); got != 0o755 {
		t.Fatalf("expected target top dir mode 0755, got %#o", got)
	}
}

func TestK8sFileServerShareFileOrDirAcceptsConfiguredSharedRoot(t *testing.T) {
	t.Parallel()

	userName, sourceFilePath := createShareSourceInCurrentUserHome(t, "source.txt", []byte("dummy"))
	dataDir := t.TempDir()
	sharedRoot := filepath.Join(dataDir, ".shared")
	server := &K8sFileServer{
		config: &config.ScowdConfig{
			AI: config.AIConfig{
				SharedFolderPath: sharedRoot,
			},
		},
	}

	if err := os.MkdirAll(sharedRoot, 0o755); err != nil {
		t.Fatalf("failed to create shared root: %v", err)
	}

	targetDirectory := filepath.Join(sharedRoot, userName, "dataset")
	targetTopDir := filepath.Join(targetDirectory, "algo")
	targetFullDir := filepath.Join(targetTopDir, "v1")
	sharedFilePath := filepath.Join(targetFullDir, "source.txt")

	resp, err := server.ShareFileOrDir(context.Background(), connect.NewRequest(newK8sShareFileOrDirRequestWithUser(
		userName,
		sourceFilePath,
		targetDirectory,
		targetTopDir,
		targetFullDir,
		sharedFilePath,
		"0755",
	)))
	if err != nil {
		t.Fatalf("ShareFileOrDir returned error: %v", err)
	}
	if resp.Msg == nil {
		t.Fatalf("expected response message")
	}
	if _, err := os.Stat(sharedFilePath); err != nil {
		t.Fatalf("expected shared file under configured shared root: %v", err)
	}
}

func TestK8sFileServerShareFileOrDirRollsBackTempWhenFinalPathExists(t *testing.T) {
	t.Parallel()

	userName, sourceFilePath := createShareSourceInCurrentUserHome(t, "source.txt", []byte("new content"))
	sharedDir := t.TempDir()
	server := &K8sFileServer{
		config: &config.ScowdConfig{
			AI: config.AIConfig{
				SharedFolderPath: sharedDir,
			},
		},
	}

	targetDirectory := filepath.Join(sharedDir, userName, "dataset")
	targetTopDir := filepath.Join(targetDirectory, "algo")
	targetFullDir := filepath.Join(targetTopDir, "v1")
	sharedFilePath := filepath.Join(targetFullDir, "source.txt")
	if err := os.MkdirAll(targetFullDir, 0o755); err != nil {
		t.Fatalf("failed to create target full dir: %v", err)
	}
	originalContent := []byte("existing content")
	if err := os.WriteFile(sharedFilePath, originalContent, 0o644); err != nil {
		t.Fatalf("failed to create existing shared file: %v", err)
	}

	_, err := server.ShareFileOrDir(context.Background(), connect.NewRequest(newK8sShareFileOrDirRequestWithUser(
		userName,
		sourceFilePath,
		targetDirectory,
		targetTopDir,
		targetFullDir,
		sharedFilePath,
		"0755",
	)))
	if err == nil {
		t.Fatalf("expected already exists error")
	}
	if connect.CodeOf(err) != connect.CodeAlreadyExists {
		t.Fatalf("expected AlreadyExists, got %s: %v", connect.CodeOf(err), err)
	}

	content, err := os.ReadFile(sharedFilePath)
	if err != nil {
		t.Fatalf("failed to read existing shared file: %v", err)
	}
	if string(content) != string(originalContent) {
		t.Fatalf("expected existing shared file to remain unchanged, got %q", string(content))
	}
	assertNoTempPath(t, targetFullDir, ".scowd-share-tmp-*")
}

func TestK8sFileServerShareFileOrDirRejectsInvalidMode(t *testing.T) {
	t.Parallel()

	userName, sourceFilePath := createShareSourceInCurrentUserHome(t, "source.txt", []byte("dummy"))
	sharedDir := t.TempDir()
	server := &K8sFileServer{
		config: &config.ScowdConfig{
			AI: config.AIConfig{
				SharedFolderPath: sharedDir,
			},
		},
	}

	targetDirectory := filepath.Join(sharedDir, userName, "dataset")
	targetTopDir := filepath.Join(targetDirectory, "algo")
	targetFullDir := filepath.Join(targetTopDir, "v1")
	sharedFilePath := filepath.Join(targetFullDir, "source.txt")

	_, err := server.ShareFileOrDir(context.Background(), connect.NewRequest(newK8sShareFileOrDirRequestWithUser(
		userName,
		sourceFilePath,
		targetDirectory,
		targetTopDir,
		targetFullDir,
		sharedFilePath,
		"invalid",
	)))
	if err == nil {
		t.Fatalf("expected invalid mode error")
	}
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("expected InvalidArgument, got %s: %v", connect.CodeOf(err), err)
	}
	if _, statErr := os.Stat(targetDirectory); !os.IsNotExist(statErr) {
		t.Fatalf("expected target directory not to be created after invalid mode, stat err: %v", statErr)
	}
}

func TestK8sFileServerShareFileOrDirRejectsOtherUserSharedRoot(t *testing.T) {
	t.Parallel()

	userName, sourceFilePath := createShareSourceInCurrentUserHome(t, "source.txt", []byte("dummy"))
	sharedDir := t.TempDir()
	server := &K8sFileServer{
		config: &config.ScowdConfig{
			AI: config.AIConfig{
				SharedFolderPath: sharedDir,
			},
		},
	}

	targetDirectory := filepath.Join(sharedDir, "other-user", "dataset")
	targetTopDir := filepath.Join(targetDirectory, "algo")
	targetFullDir := filepath.Join(targetTopDir, "v1")
	sharedFilePath := filepath.Join(targetFullDir, "source.txt")

	_, err := server.ShareFileOrDir(context.Background(), connect.NewRequest(newK8sShareFileOrDirRequestWithUser(
		userName,
		sourceFilePath,
		targetDirectory,
		targetTopDir,
		targetFullDir,
		sharedFilePath,
		"0755",
	)))
	if err == nil {
		t.Fatalf("expected invalid argument error")
	}
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("expected InvalidArgument, got %s: %v", connect.CodeOf(err), err)
	}
	if _, statErr := os.Stat(targetDirectory); !os.IsNotExist(statErr) {
		t.Fatalf("expected other user's target directory not to be created, stat err: %v", statErr)
	}
}

func TestK8sFileServerShareFileOrDirReusesExistingTreeAndAppliesMode(t *testing.T) {
	t.Parallel()

	userName, sourceFilePath := createShareSourceInCurrentUserHome(t, "source.txt", []byte("dummy"))
	sharedDir := t.TempDir()
	server := &K8sFileServer{
		config: &config.ScowdConfig{
			AI: config.AIConfig{
				SharedFolderPath: sharedDir,
			},
		},
	}

	targetDirectory := filepath.Join(sharedDir, userName, "dataset")
	targetTopDir := filepath.Join(targetDirectory, "algo")
	targetFullDir := filepath.Join(targetTopDir, "v1")
	sharedFilePath := filepath.Join(targetFullDir, "source.txt")

	if err := os.MkdirAll(targetFullDir, 0o700); err != nil {
		t.Fatalf("failed to create existing target tree: %v", err)
	}
	if err := os.Chmod(targetTopDir, 0o700); err != nil {
		t.Fatalf("failed to chmod existing target top dir: %v", err)
	}

	resp, err := server.ShareFileOrDir(context.Background(), connect.NewRequest(newK8sShareFileOrDirRequestWithUser(
		userName,
		sourceFilePath,
		targetDirectory,
		targetTopDir,
		targetFullDir,
		sharedFilePath,
		"0750",
	)))
	if err != nil {
		t.Fatalf("ShareFileOrDir returned error: %v", err)
	}
	if resp.Msg == nil {
		t.Fatalf("expected response message")
	}

	if _, err := os.Stat(sharedFilePath); err != nil {
		t.Fatalf("expected shared file: %v", err)
	}
	targetTopInfo, err := os.Stat(targetTopDir)
	if err != nil {
		t.Fatalf("failed to stat target top dir: %v", err)
	}
	if got := targetTopInfo.Mode().Perm(); got != 0o750 {
		t.Fatalf("expected existing target top dir mode 0750, got %#o", got)
	}
	sharedFileInfo, err := os.Stat(sharedFilePath)
	if err != nil {
		t.Fatalf("failed to stat shared file: %v", err)
	}
	if got := sharedFileInfo.Mode().Perm(); got != 0o750 {
		t.Fatalf("expected shared file mode 0750, got %#o", got)
	}
}

func TestK8sFileServerShareFileOrDirRejectsInvalidPathRelationships(t *testing.T) {
	t.Parallel()

	userName, sourceFilePath := createShareSourceInCurrentUserHome(t, "source.txt", []byte("dummy"))
	sharedDir := t.TempDir()
	server := &K8sFileServer{
		config: &config.ScowdConfig{
			AI: config.AIConfig{
				SharedFolderPath: sharedDir,
			},
		},
	}

	validTargetDirectory := filepath.Join(sharedDir, userName, "dataset")
	validTargetTopDir := filepath.Join(validTargetDirectory, "algo")
	validTargetFullDir := filepath.Join(validTargetTopDir, "v1")
	validSharedFilePath := filepath.Join(validTargetFullDir, "source.txt")

	tests := []struct {
		name            string
		targetDirectory string
		targetTopDir    string
		targetFullDir   string
		sharedFilePath  string
	}{
		{
			name:            "target top dir outside target directory",
			targetDirectory: validTargetDirectory,
			targetTopDir:    filepath.Join(sharedDir, "outside", "algo"),
			targetFullDir:   validTargetFullDir,
			sharedFilePath:  validSharedFilePath,
		},
		{
			name:            "target full dir outside target top dir",
			targetDirectory: validTargetDirectory,
			targetTopDir:    validTargetTopDir,
			targetFullDir:   filepath.Join(validTargetDirectory, "other", "v1"),
			sharedFilePath:  validSharedFilePath,
		},
		{
			name:            "shared file path outside target full dir",
			targetDirectory: validTargetDirectory,
			targetTopDir:    validTargetTopDir,
			targetFullDir:   validTargetFullDir,
			sharedFilePath:  filepath.Join(validTargetTopDir, "source.txt"),
		},
		{
			name:            "shared file basename differs from source",
			targetDirectory: validTargetDirectory,
			targetTopDir:    validTargetTopDir,
			targetFullDir:   validTargetFullDir,
			sharedFilePath:  filepath.Join(validTargetFullDir, "renamed.txt"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			_, err := server.ShareFileOrDir(context.Background(), connect.NewRequest(newK8sShareFileOrDirRequestWithUser(
				userName,
				sourceFilePath,
				tt.targetDirectory,
				tt.targetTopDir,
				tt.targetFullDir,
				tt.sharedFilePath,
				"0755",
			)))
			if err == nil {
				t.Fatalf("expected invalid argument error")
			}
			if connect.CodeOf(err) != connect.CodeInvalidArgument {
				t.Fatalf("expected InvalidArgument, got %s: %v", connect.CodeOf(err), err)
			}
		})
	}
}

func newK8sShareFileOrDirRequest(
	sourceFilePath string,
	targetDirectory string,
	targetTopDir string,
	targetFullDir string,
	sharedFilePath string,
	mode string,
) *apiv1.ShareFileOrDirRequest {
	return newK8sShareFileOrDirRequestWithUser("u1", sourceFilePath, targetDirectory, targetTopDir, targetFullDir, sharedFilePath, mode)
}

func newK8sShareFileOrDirRequestWithUser(
	userID string,
	sourceFilePath string,
	targetDirectory string,
	targetTopDir string,
	targetFullDir string,
	sharedFilePath string,
	mode string,
) *apiv1.ShareFileOrDirRequest {
	return &apiv1.ShareFileOrDirRequest{
		UserId:          userID,
		SourceFilePath:  sourceFilePath,
		TargetDirectory: targetDirectory,
		TargetTopDir:    targetTopDir,
		TargetFullDir:   targetFullDir,
		SharedFilePath:  sharedFilePath,
		Mode:            mode,
	}
}

func createShareSourceInCurrentUserHome(t *testing.T, name string, content []byte) (string, string) {
	t.Helper()

	currentUser, err := user.Current()
	if err != nil {
		t.Skipf("Cannot get current user: %v", err)
	}

	sourceDir, err := os.MkdirTemp(currentUser.HomeDir, "scow-share-source-*")
	if err != nil {
		t.Skipf("Cannot create source directory under current user home %s: %v", currentUser.HomeDir, err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(sourceDir) })

	sourceFilePath := filepath.Join(sourceDir, name)
	if err := os.WriteFile(sourceFilePath, content, 0o644); err != nil {
		t.Fatalf("failed to create source file under current user home: %v", err)
	}
	return currentUser.Username, sourceFilePath
}

func assertNoTempPath(t *testing.T, dir string, pattern string) {
	t.Helper()

	matches, err := filepath.Glob(filepath.Join(dir, pattern))
	if err != nil {
		t.Fatalf("failed to glob temp paths: %v", err)
	}
	if len(matches) != 0 {
		t.Fatalf("expected no temp paths matching %s under %s, got %v", pattern, dir, matches)
	}
}
