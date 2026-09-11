package system

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/sirupsen/logrus"
)

func CreateUserHomeDir(userID string, userHomeDir string) error {
	// 检查并创建用户主目录
	if _, err := os.Stat(userHomeDir); os.IsNotExist(err) {
		logrus.Infof("User's home dir is not exist, try to create.")
		createHomeCmd := exec.Command("su", "-l", userID, "-c", "exit")
		err := createHomeCmd.Run()
		if err != nil {
			logrus.Errorf("Create home directory error: %v", err)
			return fmt.Errorf("create home directory error: %w", err)
		} else {
			logrus.Infof("Create home directory success")
		}
	}
	return nil
}

// CreateScowDir creates the scow directory in the user's home directory
func CreateScowDir(userHomeDir string, uid, gid int) error {
	if userHomeDir == "" {
		return fmt.Errorf("user home directory is empty")
	}
	scowDir := filepath.Join(userHomeDir, "scow")
	if err := os.Mkdir(scowDir, 0755); err != nil && !os.IsExist(err) {
		return fmt.Errorf("failed to create scow directory: %v", err)
	}

	// Check for symlinks to avoid security issues
	info, err := os.Lstat(scowDir)
	if err != nil {
		return fmt.Errorf("failed to stat scow directory: %v", err)
	}

	if (info.Mode() & os.ModeSymlink) != 0 {
		return fmt.Errorf("refusing to operate on symbolic link: %s", scowDir)
	}
	if !info.IsDir() {
		return fmt.Errorf("scow path is not a directory: %s", scowDir)
	}

	// Ensure permissions are set correctly even if directory already existed
	if err := os.Chmod(scowDir, 0755); err != nil {
		return fmt.Errorf("failed to chmod scow directory: %v", err)
	}
	if err := os.Chown(scowDir, uid, gid); err != nil {
		return fmt.Errorf("failed to change ownership of scow directory: %v", err)
	}
	return nil
}
