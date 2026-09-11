package system

import (
	"fmt"
	"os"
	"os/exec"

	"github.com/sirupsen/logrus"
)

// 创建 /run/user/<UID> 目录
func CreateRunUserDir(uid, gid uint32) error {
	// 构建目录路径
	runUserDir := fmt.Sprintf("/run/user/%d", uid)

	// 创建目录
	err := os.MkdirAll(runUserDir, 0700)
	if err != nil {
		return err
	}

	// 设置目录权限命令
	chmodCmd := exec.Command("chmod", "700", runUserDir)

	// 设置目录所有者命令
	chownCmd := exec.Command("chown", fmt.Sprintf("%d:%d", uid, gid), runUserDir)

	err = chmodCmd.Run()
	if err != nil {
		logrus.Fatalf("Failed to set directory permissions: %v", err)
		return err
	}

	err = chownCmd.Run()
	if err != nil {
		logrus.Fatalf("Setting directory owner failed: %v", err)
		return err
	}

	return nil
}
