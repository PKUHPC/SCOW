package file

import (
	"fmt"
	"syscall"

	"github.com/sirupsen/logrus"
)

// IsCrossDevice 判断 srcPath 和 dstParentPath 是否位于不同设备
// 已提前验证 dstParentPath 存在
// 对 srcPath 使用 Lstat，不跟随符号链接，以链接本身所在设备为准
func IsCrossDevice(srcPath, dstParentPath string) (bool, error) {
	var srcStat, dstStat syscall.Stat_t

	// Lstat：不跟随符号链接
	if err := syscall.Lstat(srcPath, &srcStat); err != nil {
		return false, fmt.Errorf("lstat src %s: %w", srcPath, err)
	}
	// dstParentPath 是目录，用 Stat 取实际设备
	if err := syscall.Stat(dstParentPath, &dstStat); err != nil {
		return false, fmt.Errorf("stat dst parent %s: %w", dstParentPath, err)
	}

	logrus.Debugf("Cross-device check: src=%s (dev:%d), dst=%s (dev:%d)",
		srcPath, srcStat.Dev, dstParentPath, dstStat.Dev)

	return srcStat.Dev != dstStat.Dev, nil
}
