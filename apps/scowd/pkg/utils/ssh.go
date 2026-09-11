package utils

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/sirupsen/logrus"
	"golang.org/x/crypto/ssh"
)

var (
	ErrorCreateSession = errors.New("failed to create SSH session")
	ErrorDialSSH       = errors.New("failed to dial SSH")
	ErrorRunSSHCommand = errors.New("failed to run command")
)

var (
	ScowdPrivateKeyName = "scowd_id_rsa"
)

// SSHConfig 保存 SSH 连接配置
type SSHConfig struct {
	Host     string // 远程主机地址（如 IP 或主机名）
	Port     int    // 远程主机 SSH 端口（默认 22）
	Username string // SSH 登录用户名
}

// GetAddress 返回完整的地址，若未指定端口则默认使用 22
func (c *SSHConfig) GetAddress() string {
	if c.Port == 0 {
		c.Port = 22
	}
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}

func loadSigner(path string) (ssh.Signer, error) {
	key, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return ssh.ParsePrivateKey(key)
}

func buildAuthMethods(userHomeDir string) ([]ssh.AuthMethod, error) {
	var signers []ssh.Signer
	for _, k := range []string{
		filepath.Join(userHomeDir, ".ssh", ScowdPrivateKeyName),
		filepath.Join(userHomeDir, ".ssh", "id_rsa"),
	} {
		if s, err := loadSigner(k); err == nil {
			signers = append(signers, s)
		} else {
			logrus.Infof("Failed to loadSigner %s:%v", k, err)
		}
	}
	if len(signers) == 0 {
		return nil, fmt.Errorf("No private key found")
	}
	return []ssh.AuthMethod{ssh.PublicKeys(signers...)}, nil
}

func addSSHConfig(userHomeDir string) error {
	sshConfigPath := filepath.Join(userHomeDir, ".ssh", "config")
	configEntries := "Host *\n    IdentityFile ~/.ssh/id_rsa\n    IdentityFile ~/.ssh/scowd_id_rsa\n"

	// Check if the config file exists
	if _, err := os.Stat(sshConfigPath); os.IsNotExist(err) {
		// If not, create it and write the configuration
		if err := os.WriteFile(sshConfigPath, []byte(configEntries), 0600); err != nil {
			return fmt.Errorf("failed to create SSH config file: %w", err)
		}
		logrus.Infof("SSH config file created with multiple key entries")
	} else {
		// If it exists, check if it already has the required entries
		content, err := os.ReadFile(sshConfigPath)
		if err != nil {
			return fmt.Errorf("failed to read SSH config file: %w", err)
		}
		if !strings.Contains(string(content), configEntries) {
			// Append the entries if they’re not already present
			f, err := os.OpenFile(sshConfigPath, os.O_APPEND|os.O_WRONLY, 0600)
			if err != nil {
				return fmt.Errorf("failed to open SSH config file for appending: %w", err)
			}
			defer f.Close()
			if _, err := f.WriteString(configEntries); err != nil {
				return fmt.Errorf("failed to write to SSH config file: %w", err)
			}
			logrus.Infof("Multiple key entries added to SSH config file")
		} else {
			logrus.Infof("SSH config already contains the required entries")
		}
	}

	return nil
}

// ExecuteCommand 执行 SSH 命令并返回结果
func ExecuteCommand(config SSHConfig, userHomeDir string, command string) (string, string, error) {
	// 执行命令前确保免密
	err := ensureSSHKey(userHomeDir)
	if err != nil {
		logrus.Infof("Failed to create ssh public and private keys and write to authorized_keys")
		// 生成失败不返回，继续尝试
		// return "", "", err
	}

	// 让 ssh 命令能识别 scowd 的免密文件
	err = addSSHConfig(userHomeDir)
	if err != nil {
		logrus.Infof("Unable to check ssh config settings")
		// 检查 config 失败不返回，继续尝试
		// return "", "", err
	}

	// 加载私钥
	auth, err := buildAuthMethods(userHomeDir)
	if err != nil {
		logrus.Infof("failed to load private key: %v", err)
		// 加载失败仍然不处理，仍然尝试去连接
	}

	// SSH 配置，使用免密登录
	sshConfig := &ssh.ClientConfig{
		User:            config.Username,
		Auth:            auth,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // 自动接受主机密钥
	}

	// 建立 SSH 连接
	address := config.GetAddress()
	conn, err := ssh.Dial("tcp", address, sshConfig)
	if err != nil {
		logrus.Infof("failed to dial SSH: %v", err)
		return "", "", ErrorDialSSH
	}
	defer conn.Close()

	// 创建会话
	session, err := conn.NewSession()
	if err != nil {
		logrus.Infof("failed to create SSH session: %v", err)
		return "", "", ErrorCreateSession
	}
	defer session.Close()

	// 获取标准输出和错误输出管道
	stdout, err := session.StdoutPipe()
	if err != nil {
		logrus.Infof("failed to get stdout pipe: %v", err)
		return "", "", ErrorRunSSHCommand
	}
	stderr, err := session.StderrPipe()
	if err != nil {
		logrus.Infof("failed to get stderr pipe: %v", err)
		return "", "", ErrorRunSSHCommand
	}

	logrus.Infof("exec command %s on %s", command, config.Host)
	// 启动命令
	if err := session.Start(command); err != nil {
		logrus.Infof("failed to start command: %v", err)
		return "", "", ErrorRunSSHCommand
	}

	// 读取标准输出和错误输出
	var stdoutBuf, stderrBuf bytes.Buffer
	_, err = io.Copy(&stdoutBuf, stdout)
	if err != nil {
		logrus.Infof("failed to read stdout: %v", err)
		return "", "", ErrorRunSSHCommand
	}
	_, err = io.Copy(&stderrBuf, stderr)
	if err != nil {
		logrus.Infof("failed to read stderr: %v", err)
		return "", "", ErrorRunSSHCommand
	}

	// 等待命令完成
	if err := session.Wait(); err != nil {
		logrus.Infof("failed to wait for command completion: %v", err)
		return stdoutBuf.String(), stderrBuf.String(), ErrorRunSSHCommand
	}

	return stdoutBuf.String(), stderrBuf.String(), nil
}

func ensureSSHKey(userHomeDir string) error {
	// SSH directory path
	sshDir := filepath.Join(userHomeDir, ".ssh")
	privateKeyPath := filepath.Join(sshDir, ScowdPrivateKeyName)
	publicKeyPath := privateKeyPath + ".pub" // This will now be "scowd_id_rsa.pub"
	authorizedKeysPath := filepath.Join(sshDir, "authorized_keys")

	// Check if .ssh directory exists, if not, create it
	if _, err := os.Stat(sshDir); os.IsNotExist(err) {
		if err := os.Mkdir(sshDir, 0700); err != nil {
			return fmt.Errorf("failed to create .ssh directory: %w", err)
		}
	}

	// Check if private or public key files exist
	_, statPrivateKeyPathErr := os.Stat(privateKeyPath)
	_, statPublicKeyPathErr := os.Stat(publicKeyPath)
	if os.IsNotExist(statPrivateKeyPathErr) || os.IsNotExist(statPublicKeyPathErr) {
		// If either file is missing, generate a key pair
		cmd := exec.Command("ssh-keygen", "-t", "rsa", "-b", "2048", "-f", privateKeyPath, "-N", "")
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("failed to generate SSH key: %w", err)
		}
		logrus.Infof("SSH key pair successfully generated")
	}

	// Read the public key file content
	publicKey, err := os.ReadFile(publicKeyPath)
	if err != nil {
		return fmt.Errorf("failed to read public key file: %w", err)
	}

	// Check if the public key is already in authorized_keys
	if authKeysContent, err := os.ReadFile(authorizedKeysPath); err == nil {
		if strings.Contains(string(authKeysContent), string(publicKey)) {
			logrus.Println("Public key already exists in authorized_keys")
			return nil // Public key already present, so exit without adding
		}
	}

	// Open the authorized_keys file with append write permissions, create it if it doesn't exist
	authKeysFile, err := os.OpenFile(authorizedKeysPath, os.O_APPEND|os.O_WRONLY|os.O_CREATE, 0600)
	if err != nil {
		return fmt.Errorf("failed to open authorized_keys file: %w", err)
	}
	defer authKeysFile.Close()

	// Write the public key to the authorized_keys file
	if _, err := authKeysFile.Write(publicKey); err != nil {
		return fmt.Errorf("failed to write public key to authorized_keys file: %w", err)
	}

	logrus.Println("Public key successfully added to authorized_keys")
	return nil
}
