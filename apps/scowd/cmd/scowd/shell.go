package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/sirupsen/logrus"

	"scowd"
)

var scowShellFileSh = scowd.ShellScript

// initShellFile 初始化 shell 文件到系统目录
func initShellFile() error {
	// Define the target directory and file paths
	targetDir := "/etc/profile.d"
	targetFile := filepath.Join(targetDir, "scow-shell-file.sh")

	// Check if /etc/profile.d exists
	if _, err := os.Stat(targetDir); os.IsNotExist(err) {
		// Create the directory with 755 permissions
		if err := os.MkdirAll(targetDir, 0755); err != nil {
			return fmt.Errorf("failed to create directory %s: %v", targetDir, err)
		}
	}

	// Create the target file
	output, err := os.Create(targetFile)
	if err != nil {
		return fmt.Errorf("failed to create target file %s: %v", targetFile, err)
	}
	defer func() { _ = output.Close() }()

	// Write the file content
	if _, err := output.WriteString(scowShellFileSh); err != nil {
		return fmt.Errorf("failed to write scow-shell-file.sh to %s: %w", targetFile, err)
	}

	// Set permissions for the target file (rw-r--r--)
	if err := os.Chmod(targetFile, 0644); err != nil {
		return fmt.Errorf("failed to set permissions on file %s: %v", targetFile, err)
	}

	logrus.Infof("Shell file initialized successfully.")
	return nil
}
