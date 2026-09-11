package file

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"

	"scowd/pkg/libs/auth"
)

// 创建用户隔离目录使用的前缀黑名单（/opt, /home可能会使用，不在黑名单中定义）
// userDirBlacklist 使用 sync.Once 保证初始化后不可变
// 小写私有，外部无法访问；Once 保证包内也只初始化一次
var (
	blacklistOnce    sync.Once
	userDirBlacklist map[string]struct{}
)

func getBlacklist() map[string]struct{} {
	blacklistOnce.Do(func() {
		userDirBlacklist = map[string]struct{}{
			"/":      {},
			"/bin":   {},
			"/sbin":  {},
			"/usr":   {},
			"/lib":   {},
			"/lib64": {},
			"/boot":  {},
			"/dev":   {},
			"/proc":  {},
			"/sys":   {},
			"/etc":   {},
			"/run":   {},
			"/var":   {},
			"/root":  {},
		}
	})
	return userDirBlacklist // 返回原始引用，但 Once 保证不会被重复初始化
}

// IsRestrictedPath 检查路径是否命中受限路径列表（精确匹配 + 子路径匹配）。
// 返回命中的受限路径项，方便错误信息定位。
// path 应为 filepath.Clean 处理后的路径。
func IsRestrictedPath(path string) (string, bool) {
	bl := getBlacklist()

	// 1. 精确匹配 O(1)
	if _, ok := bl[path]; ok {
		return path, true
	}

	// 2. 子路径匹配：/usr/local 应命中 /usr
	//    加 "/" 后缀防止 /usrlocal 误匹配 /usr
	for blacklisted := range bl {
		if strings.HasPrefix(path, blacklisted+"/") {
			return blacklisted, true
		}
	}

	return "", false
}

// ValidateMakeDirPath 校验目录路径的安全性：
//   - 清理后不得包含路径穿越
//   - 不得落在系统关键目录的黑名单中
//   - 不检查绝对路径，因为 .nfs/public等路径可能合法
func ValidateMakeDirPath(dirPath string) error {
	cleaned := filepath.Clean(dirPath)
	if cleaned != dirPath {
		return fmt.Errorf("path contains traversal or redundant separators: %s", dirPath)
	}
	if hit, ok := IsRestrictedPath(cleaned); ok {
		return fmt.Errorf("path %s is under restricted system directory %s", dirPath, hit)
	}
	return nil
}

// ParseMakeDirMode 将八进制字符串（如 "0700"、"0755"）解析为 os.FileMode。
// 传入 nil 时返回 defaultMode。
// 拒绝 setuid/setgid/sticky 等高位权限（必须 <= 0777）。
func ParseMakeDirMode(mode *string, defaultMode os.FileMode) (os.FileMode, error) {
	if mode == nil {
		return defaultMode, nil
	}
	parsed, err := strconv.ParseUint(*mode, 8, 32)
	if err != nil {
		return 0, fmt.Errorf("invalid mode %q: %w", *mode, err)
	}
	if parsed > 0777 {
		return 0, fmt.Errorf("mode %q (%04o) exceeds maximum allowed 0777", *mode, parsed)
	}
	return os.FileMode(parsed), nil
}

// CheckFileReadPermission 检查指定用户是否有读取指定文件的权限（仅支持Linux系统）
func CheckFileReadPermission(userID, filePath string) error {
	// 检查文件是否存在
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("file does not exist: %s", filePath)
		}
		return fmt.Errorf("failed to get file info: %w", err)
	}

	// Linux系统权限检查
	return checkLinuxFilePermission(userID, filePath, fileInfo)
}

// checkLinuxFilePermission Linux系统文件权限检查
func checkLinuxFilePermission(userID, filePath string, fileInfo os.FileInfo) error {
	// 获取文件的详细权限信息
	stat, ok := fileInfo.Sys().(*syscall.Stat_t)
	if !ok {
		return fmt.Errorf("failed to get file system info")
	}

	// 获取目标用户信息
	uid, _, groups, err := auth.GetUserInfo(userID)
	if err != nil {
		return fmt.Errorf("user %s does not exist: %w", userID, err)
	}

	// 检查权限
	fileMode := fileInfo.Mode()
	fileUID := stat.Uid
	fileGID := stat.Gid

	// 检查用户权限（文件所有者）
	if uid == fileUID {
		if fileMode&0400 != 0 { // 所有者读权限
			return nil
		}
		return fmt.Errorf("user %s as file owner does not have read permission for file %s", userID, filePath)
	}

	// 检查组权限（包括主组和附加组）
	if hasGroupPermission(groups, fileGID) {
		if fileMode&0040 != 0 { // 组读权限
			return nil
		}
		return fmt.Errorf("user %s as group member does not have read permission for file %s", userID, filePath)
	}

	// 检查其他用户权限
	if fileMode&0004 != 0 { // 其他用户读权限
		return nil
	}

	return fmt.Errorf("user %s does not have read permission for file %s", userID, filePath)
}

// hasGroupPermission 检查用户是否属于指定的组（包括主组和附加组）
func hasGroupPermission(groups []int, fileGID uint32) bool {
	for _, gid := range groups {
		if uint32(gid) == fileGID {
			return true
		}
	}
	return false
}
