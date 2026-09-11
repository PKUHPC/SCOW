package file

import (
	"os"
	"path/filepath"
	"testing"
)

// TestConvertToRelativePath 测试 convertToRelativePath 函数
func TestConvertToRelativePath(t *testing.T) {
	// 创建临时目录作为测试根目录
	tempDir, err := os.MkdirTemp("", "test_root")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer func() { _ = os.RemoveAll(tempDir) }()

	// 创建 os.Root 实例
	root, err := os.OpenRoot(tempDir)
	if err != nil {
		t.Fatalf("Failed to create root: %v", err)
	}
	defer func() { _ = root.Close() }()

	tests := []struct {
		name         string
		absolutePath string
		wantErr      bool
		expected     string
	}{
		{
			name:         "valid path within root",
			absolutePath: filepath.Join(tempDir, "test", "file.txt"),
			wantErr:      false,
			expected:     filepath.Join("test", "file.txt"),
		},
		{
			name:         "root directory itself",
			absolutePath: tempDir,
			wantErr:      false,
			expected:     ".",
		},
		{
			name:         "path outside root directory",
			absolutePath: filepath.Join(filepath.Dir(tempDir), "other"),
			wantErr:      true,
		},
		{
			name:         "path with parent directory traversal",
			absolutePath: filepath.Join(filepath.Dir(tempDir), "../other"),
			wantErr:      true,
		},
		{
			name:         "empty path",
			absolutePath: "",
			wantErr:      true,
		},
		{
			name:         "relative path input",
			absolutePath: "relative/path",
			wantErr:      true,
		},
		{
			name:         "path with double slashes",
			absolutePath: filepath.Join(tempDir, "test//file.txt"),
			wantErr:      false,
			expected:     filepath.Join("test", "file.txt"),
		},
		{
			name:         "path with dot segments",
			absolutePath: filepath.Join(tempDir, "./test/./file.txt"),
			wantErr:      false,
			expected:     filepath.Join("test", "file.txt"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := convertToRelativePath(root, tt.absolutePath)
			if (err != nil) != tt.wantErr {
				t.Errorf("convertToRelativePath() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && result != tt.expected {
				t.Errorf("convertToRelativePath() = %v, want %v", result, tt.expected)
			}
		})
	}
}
