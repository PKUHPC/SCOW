package storage

import (
	"fmt"
	"os"
	"syscall"
)

// CheckDiskSpace 磁盘空间检查函数
func CheckDiskSpace(path string, requiredBytes uint64) error {
	// 首先检查路径是否存在
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return fmt.Errorf("path does not exist: %s", path)
	}

	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil {
		return fmt.Errorf("failed to get filesystem stats for %s: %w", path, err)
	}

	freeSpace := stat.Bavail * uint64(stat.Bsize)
	if freeSpace < requiredBytes {
		return fmt.Errorf("insufficient disk space: need %d bytes, only %d available", requiredBytes, freeSpace)
	}
	return nil
}
