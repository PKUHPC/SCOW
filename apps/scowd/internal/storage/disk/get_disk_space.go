package storage

import (
	"github.com/shirou/gopsutil/v3/disk"
)

func GetDiskSpace(path string) (totalBytes, usedBytes uint64, err error) {
	usageStat, err := disk.Usage(path) // 核心调用
	if err != nil {
		return 0, 0, err
	}
	return usageStat.Total, usageStat.Used, nil
}
