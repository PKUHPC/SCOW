package storage

import "syscall"

func IsOnNFS(path string) bool {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err == nil {
		return stat.Type == 0x6969 // NFS_SUPER_MAGIC
	}
	return false
}
