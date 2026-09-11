package parent

import (
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"

	"scowd/pkg/config"
	"scowd/pkg/libs/auth"

	"github.com/sirupsen/logrus"
)

// getMemoryLimitParameter 检测systemd版本并返回合适的内存限制参数
func (cp *ChildProcess) getMemoryLimitParameter() string {
	// 尝试获取systemd版本
	cmd := exec.Command("systemctl", "--version")
	output, err := cmd.Output()
	if err != nil {
		logrus.Warnf("Failed to get systemd version: %v, using MemoryLimit as fallback", err)
		return "MemoryLimit"
	}

	// 解析版本号
	versionStr := string(output)
	lines := strings.Split(versionStr, "\n")
	if len(lines) == 0 {
		logrus.Warn("Unable to parse systemd version, using MemoryLimit as fallback")
		return "MemoryLimit"
	}

	// 第一行通常包含版本信息，格式如: "systemd 245 (245.4-4ubuntu3.22)"
	firstLine := lines[0]
	fields := strings.Fields(firstLine)
	if len(fields) < 2 {
		logrus.Warn("Unable to parse systemd version format, using MemoryLimit as fallback")
		return "MemoryLimit"
	}

	// 提取版本号
	versionNum := fields[1]
	// 移除可能的非数字字符
	var versionDigits strings.Builder
	for _, char := range versionNum {
		if char >= '0' && char <= '9' {
			versionDigits.WriteRune(char)
		} else {
			break // 遇到非数字字符就停止
		}
	}

	if versionDigits.Len() == 0 {
		logrus.Warn("Unable to extract systemd version number, using MemoryLimit as fallback")
		return "MemoryLimit"
	}

	// 转换为整数进行比较
	version, err := strconv.Atoi(versionDigits.String())
	if err != nil {
		logrus.Warnf("Failed to parse systemd version number: %v, using MemoryLimit as fallback", err)
		return "MemoryLimit"
	}

	// systemd 230+ 支持 MemoryMax，之前的版本使用 MemoryLimit
	if version >= 230 {
		logrus.Infof("Detected systemd version %d, using MemoryMax", version)
		return "MemoryMax"
	} else {
		logrus.Infof("Detected systemd version %d, using MemoryLimit", version)
		return "MemoryLimit"
	}
}

// createSystemdRunCommand 创建使用systemd-run的命令
func (cp *ChildProcess) createSystemdRunCommand(userID string, uid, gid uint32, limits config.ResourceLimits, port, publicKeyString string) *exec.Cmd {
	userHomeDir, err := auth.GetUserHomeDir(userID)
	if err != nil {
		logrus.Errorf("Error getting user home directory for systemd-run: %v", err)
		userHomeDir = "/tmp" // 使用临时目录作为fallback
	}

	// 检查是否支持用户会话
	useUserSession := cp.checkUserSessionSupport()

	// 构建systemd-run参数
	args := []string{
		"systemd-run",
	}

	// 根据用户会话支持情况决定是否添加 --user 参数
	if useUserSession {
		args = append(args, "--user") // 使用用户会话
		logrus.Infof("Using systemd user session for user %s", userID)
	} else {
		logrus.Warnf("User session not available, using system session for user %s", userID)
	}

	args = append(args,
		"--scope",   // 创建scope而不是service
		"--collect", // 自动清理scope
	)

	// 添加CPU限制
	if limits.CPUCores > 0 {
		cpuQuota := limits.CPUCores * 100 // 每个核心100%
		args = append(args, fmt.Sprintf("--property=CPUQuota=%d%%", cpuQuota))
		logrus.Infof("Setting CPU limit: %d cores (%d%% quota)", limits.CPUCores, cpuQuota)
	}

	// 添加内存限制 - 根据systemd版本选择合适的参数
	if limits.MemoryMB > 0 {
		// 检测systemd版本并选择合适的内存限制参数
		memoryParam := cp.getMemoryLimitParameter()
		args = append(args, fmt.Sprintf("--property=%s=%dM", memoryParam, limits.MemoryMB))
		logrus.Infof("Setting memory limit: %dMB (using %s)", limits.MemoryMB, memoryParam)
	}

	// 设置环境变量
	args = append(args, "--setenv=HOME="+userHomeDir)
	args = append(args, "--setenv=USER="+userID)
	args = append(args, "--setenv=LOGNAME="+userID)
	args = append(args, "--setenv=XDG_RUNTIME_DIR="+fmt.Sprintf("/run/user/%d", uid))
	args = append(args, "--setenv=PORT="+port)
	// 将换行符和空格替换为特殊标记以避免shell解析问题
	escapedPublicKey := strings.ReplaceAll(publicKeyString, "\n", "__NEWLINE__")
	escapedPublicKey = strings.ReplaceAll(escapedPublicKey, " ", "__SPACE__")
	args = append(args, "--setenv=PUBLIC_KEY="+escapedPublicKey)
	// 设置PATH环境变量，确保子进程能找到必要的命令
	args = append(args, "--setenv=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin")
	// 设置TERM环境变量
	args = append(args, "--setenv=TERM=xterm-256color")

	// 获取当前可执行文件的绝对路径
	executablePath, err := os.Executable()
	if err != nil {
		logrus.Errorf("Failed to get executable path: %v, falling back to os.Args[0]", err)
		executablePath = os.Args[0]
	}

	// 添加分隔符和实际要执行的命令
	args = append(args, "--", executablePath, "--child", userID)

	logrus.Debugf("Creating systemd-run command for user %s with resource limits", userID)
	logrus.Debugf("Using executable path: %s", executablePath)
	logrus.Debugf("Full systemd-run command: %s", strings.Join(args, " "))

	cmd := exec.Command(args[0], args[1:]...)
	// 设置标准错误输出以便调试
	cmd.Stderr = os.Stderr
	cmd.Stdout = os.Stdout
	return cmd
}

// checkUserSessionSupport 检查是否支持用户会话
func (cp *ChildProcess) checkUserSessionSupport() bool {
	// 尝试检查用户会话状态
	checkCmd := exec.Command("systemctl", "--user", "is-active", "default.target")
	if err := checkCmd.Run(); err != nil {
		logrus.Debugf("User session check failed: %v", err)
		return false
	}

	return true
}

// testSystemdRunAvailability 测试systemd-run是否可用
func testSystemdRunAvailability() error {
	// 首先检查 systemd-run 命令是否存在
	_, err := exec.LookPath("systemd-run")
	if err != nil {
		return fmt.Errorf("systemd-run not found: %w", err)
	}

	// 检查 systemd-run 版本，这是一个更安全的测试方法
	testCmd := exec.Command("systemd-run", "--version")
	output, err := testCmd.Output()
	if err != nil {
		return fmt.Errorf("systemd-run version check failed: %w", err)
	}

	// 检查输出是否包含预期的版本信息
	if !strings.Contains(string(output), "systemd") {
		return fmt.Errorf("unexpected systemd-run version output: %s", string(output))
	}

	// 检查是否有用户会话支持（可选检查）
	// 这个检查比较轻量，不会尝试实际创建 scope
	envCmd := exec.Command("systemd-run", "--user", "--help")
	if err := envCmd.Run(); err != nil {
		// 如果 --user 参数不被支持，我们仍然可以尝试系统级别的 systemd-run
		logrus.Warnf("systemd-run --user not available, will try without --user flag: %v", err)
		// 不返回错误，让调用方决定是否继续
	}

	return nil
}
