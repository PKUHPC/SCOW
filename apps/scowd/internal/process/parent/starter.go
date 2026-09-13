package parent

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/PKUHPC/private-scow/apps/scowd/internal/auth"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/config"
	httpUtils "github.com/PKUHPC/private-scow/apps/scowd/internal/httpserver/httputil"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/utils/security"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/utils/system"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
)

// Start 启动子进程
func (cp *ChildProcess) Start(userID string) error {
	cp.sessionID = uuid.New().String()

	// 端口管理增强
	port, err := GlobalChildProcessManager.AcquirePort(cp.sessionID)
	if err != nil {
		return fmt.Errorf("port acquisition failed: %w", err)
	}

	credentials, err := lookupUserCredentials(userID)
	if err != nil {
		logrus.Infof("Get User %s id failed when start child process: %v", userID, err)
		return err
	}
	uid, gid := credentials.uid, credentials.gid

	// 创建 /run/user/[uid] 目录 桌面需要
	err = system.CreateRunUserDir(uid, gid)
	if err != nil {
		logrus.Errorf("Create /run/user/%d for user %s error, %v", uid, userID, err)
		return err
	}

	// 生成子进程对应的公钥和私钥，并将公钥作为进程启动的参数
	if err := GlobalSecureKeyManager.GenerateKeyPairAndSignToken(port); err != nil {
		logrus.Errorf("Failed to generate key pair when starting child process for user %s, %v", userID, err)
		return err
	}
	publicKey, err := GlobalSecureKeyManager.GetPublicKey(port)
	if err != nil {
		logrus.Errorf("Failed to get public key for user %s: %v", userID, err)
		return err
	}

	publicKeyString, err := security.SerializePublicKey(publicKey)
	if err != nil {
		logrus.Errorf("The provided public key %v is malformed and cannot be serialized: %v", publicKey, err)
		return err
	}

	// 创建命令
	cmd, err := cp.createCommand(userID, uid, gid, port, publicKeyString)
	if err != nil {
		return fmt.Errorf("failed to create command: %w", err)
	}

	// 设置环境变量（如果需要）
	if err := cp.setupEnvironment(cmd, userID, uid, gid, port, publicKeyString); err != nil {
		return fmt.Errorf("failed to setup environment: %w", err)
	}

	logrus.Infof("Starting child process: user=%s port=%s", userID, port)

	// 启动进程
	if err := cmd.Start(); err != nil {
		return cp.handleStartError(err, cmd)
	}

	cp.cmd = cmd
	cp.port = port
	cp.userID = userID
	cp.lastUsed = time.Now()
	cp.setCredentials(credentials)
	cp.Mu.Lock()
	// done 由 monitorProcess 关闭，作为 Stop 等待唯一 Wait 调用完成的通知。
	cp.done = make(chan struct{})
	cp.stopping = false
	cp.stopDone = nil
	cp.stopErr = nil
	cp.Mu.Unlock()

	// 启动后监控
	go cp.monitorProcess()

	// 等待HTTP服务就绪
	ready := httpUtils.CheckHTTPServerReady(port)
	if !ready {
		logrus.Errorf("Start child process's http server failed, %s", userID)
		return errors.New("start child process's http server failed")
	}
	logrus.Infof("Started child process's http server for user %s", userID)

	return nil
}

// createCommand 创建执行命令
func (cp *ChildProcess) createCommand(userID string, uid, gid uint32, port, publicKeyString string) (*exec.Cmd, error) {
	// 读取配置以确定是否使用资源限制
	scowdConfig, err := config.GetScowdConfig()
	if err != nil {
		logrus.Errorf("Failed to read config: %v", err)
		// 如果配置读取失败，使用不限制资源的方式启动
		return cp.createStandardCommand(userID, uid, gid), nil
	}

	if !scowdConfig.ChildProcess.ResourceLimits.Enabled {
		// 使用原有方式启动
		return cp.createStandardCommand(userID, uid, gid), nil
	}

	// 尝试使用systemd-run启动子进程并应用资源限制
	cmd := cp.createSystemdRunCommand(userID, uid, gid, scowdConfig.ChildProcess.ResourceLimits, port, publicKeyString)

	// 测试systemd-run是否可用
	if err := testSystemdRunAvailability(); err != nil {
		logrus.Warnf("systemd-run test failed (%v), falling back to standard exec", err)
		// 回退到标准方式
		return cp.createStandardCommand(userID, uid, gid), nil
	}

	return cmd, nil
}

// createStandardCommand 创建标准的exec命令
func (cp *ChildProcess) createStandardCommand(userID string, uid, gid uint32) *exec.Cmd {
	cmd := exec.Command(os.Args[0], "--child", userID)
	return cmd
}

// setupEnvironment 设置环境变量
func (cp *ChildProcess) setupEnvironment(cmd *exec.Cmd, userID string, uid, gid uint32, port, publicKeyString string) error {
	userHomeDir, err := auth.GetUserHomeDir(userID)
	if err != nil {
		logrus.Info("Error getting user home directory:", err)
	} else {
		logrus.Info("User home directory is:", userHomeDir)
	}

	// 检查并创建用户主目录
	if err := system.CreateUserHomeDir(userID, userHomeDir); err != nil {
		logrus.Errorf("Failed to create user home directory: %v", err)
		return fmt.Errorf("failed to create user home directory: %w", err)
	}

	// 在用户家目录下创建一个 scow 目录
	if err := system.CreateScowDir(userHomeDir, int(uid), int(gid)); err != nil {
		logrus.Errorf("Failed to create scow directory: %v", err)
		return fmt.Errorf("failed to create scow directory: %w", err)
	}

	// 检查是否需要设置环境变量
	needEnvVars := cp.needsEnvironmentVariables(cmd)

	if needEnvVars {
		// 将换行符和空格替换为特殊标记以避免shell解析问题
		escapedPublicKey := strings.ReplaceAll(publicKeyString, "\n", "__NEWLINE__")
		escapedPublicKey = strings.ReplaceAll(escapedPublicKey, " ", "__SPACE__")
		cmd.Env = append(os.Environ(),
			"HOME="+userHomeDir,
			"USER="+userID,
			"LOGNAME="+userID,
			"XDG_RUNTIME_DIR="+fmt.Sprintf("/run/user/%d", uid),
			fmt.Sprintf("PORT=%s", port),
			fmt.Sprintf("PUBLIC_KEY=%s", escapedPublicKey),
		)
	}

	return nil
}

// needsEnvironmentVariables 判断是否需要设置环境变量
func (cp *ChildProcess) needsEnvironmentVariables(cmd *exec.Cmd) bool {
	scowdConfig, err := config.GetScowdConfig()
	if err != nil || !scowdConfig.ChildProcess.ResourceLimits.Enabled {
		return true
	}

	// 如果启用了资源限制但使用的是fallback方式（检查命令路径）
	if cmd.Path != "/usr/bin/systemd-run" && !strings.Contains(cmd.Path, "systemd-run") {
		return true
	}

	return false
}

// handleStartError 处理启动错误
func (cp *ChildProcess) handleStartError(err error, cmd *exec.Cmd) error {
	logrus.Errorf("Process start failed: error=%v", err)
	logrus.Errorf("Command that failed: %s %v", cmd.Path, cmd.Args)

	if pathErr, ok := err.(*os.PathError); ok {
		logrus.Errorf("System error details: op=%s path=%s err=%v", pathErr.Op, pathErr.Path, pathErr.Err)
	}
	if exitErr, ok := err.(*exec.ExitError); ok {
		logrus.Errorf("Exit status: %s", exitErr.Stderr)
	}

	// 如果是systemd-run失败，提供额外的诊断信息
	if strings.Contains(cmd.Path, "systemd-run") {
		logrus.Errorf("systemd-run command failed. Please check:")
		logrus.Errorf("1. systemd-run is available: which systemd-run")
		logrus.Errorf("2. User has permission to use systemd-run")
		logrus.Errorf("3. systemd user session is active")
		logrus.Errorf("4. Resource limits are valid")
	}

	return fmt.Errorf("start failed: %w", err)
}
