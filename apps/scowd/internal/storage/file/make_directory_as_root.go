package file

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/PKUHPC/private-scow/apps/scowd/internal/auth"

	"connectrpc.com/connect"
	"github.com/sirupsen/logrus"
)

// MakeDirectoryAsRoot 以 root 权限创建单级目录，创建后将所有权转交给指定用户。
// 用于用户隔离目录等场景，父目录为 root:755 时普通用户无法直接创建子目录。
// 不允许在root权限下创建以 "." 开头的隐藏目录
// 当 dirMode 存在时， K8S 和 hpc 逻辑一致
func MakeDirectoryAsRoot(dirPath, userID string, dirMode os.FileMode) error {
	// 再次确保路径安全
	if err := ValidateMakeDirPath(dirPath); err != nil {
		return connect.NewError(connect.CodeInvalidArgument, err)
	}

	// 禁止创建隐藏目录（以 "." 开头）
	if filepath.Base(dirPath)[0] == '.' {
		return connect.NewError(connect.CodeInvalidArgument,
			fmt.Errorf("make dir as root: directory name must not start with '.': %s", filepath.Base(dirPath)))
	}

	// 检查父目录是否存在
	parentDir := filepath.Dir(dirPath)
	if _, err := os.Stat(parentDir); err != nil {
		if os.IsNotExist(err) {
			return connect.NewError(connect.CodeNotFound,
				fmt.Errorf("make dir as root: parent directory %s does not exist", parentDir))
		}
		return connect.NewError(connect.CodeInternal,
			fmt.Errorf("make dir as root: stat parent directory %s: %w", parentDir, err))
	}

	// 获取用户 UID/GID
	uid, gid, _, err := auth.GetUserInfo(userID)
	if err != nil {
		logrus.WithError(err).Errorf("failed to get user info for %s", userID)
		return connect.NewError(connect.CodeInternal,
			fmt.Errorf("make dir as root: get user info for %s: %w", userID, err))
	}

	// 以 root 权限创建单级目录
	// 使用 Mkdir 而非 MkdirAll，避免意外创建中间目录
	if err := os.Mkdir(dirPath, dirMode); err != nil {
		if os.IsExist(err) {
			logrus.Infof("directory already exists at %s", dirPath)
			return connect.NewError(connect.CodeAlreadyExists,
				fmt.Errorf("make dir as root: directory %s already exists", dirPath))
		}
		logrus.WithError(err).Errorf("root mkdir error at %s", dirPath)
		return connect.NewError(connect.CodeInternal,
			fmt.Errorf("mkdir %s: %w", dirPath, err))
	}

	// 目录已创建，后续步骤失败时回滚
	needRollback := true
	defer func() {
		if !needRollback {
			return
		}
		if removeErr := os.Remove(dirPath); removeErr != nil {
			logrus.WithError(removeErr).Errorf("failed to rollback directory %s", dirPath)
		} else {
			logrus.Infof("rolled back directory %s due to post-creation error", dirPath)
		}
	}()

	// 将目录所有权转交给用户
	if err := os.Chown(dirPath, int(uid), int(gid)); err != nil {
		logrus.WithError(err).Errorf("chown directory error at %s", dirPath)
		return connect.NewError(connect.CodeInternal,
			fmt.Errorf("chown %s: %w", dirPath, err))
	}

	// Mkdir 受 umask 影响，需额外 Chmod 确保权限精确
	if err := os.Chmod(dirPath, dirMode); err != nil {
		logrus.WithError(err).Errorf("chmod directory error at %s", dirPath)
		return connect.NewError(connect.CodeInternal,
			fmt.Errorf("chmod %s: %w", dirPath, err))
	}

	needRollback = false
	logrus.Infof("created directory %s (mode=%04o) for user %s as root", dirPath, dirMode, userID)
	return nil
}
