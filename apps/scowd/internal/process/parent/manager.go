package parent

import (
	"errors"
	"fmt"
	"os/exec"
	"sync"
	"time"

	"github.com/PKUHPC/private-scow/apps/scowd/internal/config"
	httpUtils "github.com/PKUHPC/private-scow/apps/scowd/internal/httpserver/httputil"

	"github.com/sirupsen/logrus"
)

// 定义子进程管理器
type ChildProcessManager struct {
	mu             sync.RWMutex
	childProcesses map[string]*ChildProcess
	portPool       map[string]string // 端口到 child session 的所有权
	portMu         sync.Mutex
}

// 定义全局的管理器实例
var GlobalChildProcessManager = &ChildProcessManager{
	childProcesses: make(map[string]*ChildProcess),
	portPool:       make(map[string]string),
}

const defaultNonShellIdleDuration = time.Duration(config.DefaultNonShellIdleDurationMinutes) * time.Minute

// 添加子进程到管理器
func (m *ChildProcessManager) AddChildProcess(userID string, cmd *exec.Cmd, port string) *ChildProcess {
	m.mu.Lock()
	defer m.mu.Unlock()

	childProcess := &ChildProcess{
		cmd:      cmd,
		port:     port,
		lastUsed: time.Now(),
	}
	m.childProcesses[userID] = childProcess

	return childProcess
}

func (m *ChildProcessManager) processCredentialsChanged(userID string, childProcess *ChildProcess) (bool, error) {
	changed, currentCredentials, err := childProcess.credentialsChanged(userID)
	if err != nil {
		return false, fmt.Errorf("check credentials for user %s: %w", userID, err)
	}
	if changed {
		logrus.WithFields(logrus.Fields{
			"user": userID,
			"uid":  currentCredentials.uid,
			"gid":  currentCredentials.gid,
		}).Info("User credentials changed, restarting child process")
	}

	return changed, nil
}

// 移除并重新创建子进程
func (m *ChildProcessManager) removeProcess(userID string) error {
	childProcess, exists := m.childProcesses[userID]
	if !exists {
		return fmt.Errorf("no child process found for user %s", userID)
	}

	// 尝试停止子进程
	if err := childProcess.Stop(); err != nil {
		return fmt.Errorf("failed to stop child process for user %s: %w", userID, err)
	}

	// 从映射中删除进程
	delete(m.childProcesses, userID)
	return nil
}

// 创建子进程
func (m *ChildProcessManager) createProcess(userID string) (*ChildProcess, error) {
	childProcess := &ChildProcess{}
	if err := childProcess.Start(userID); err != nil {
		return nil, err
	}

	// 添加到映射中
	m.childProcesses[userID] = childProcess
	childProcess.CheckAndStartUsing()
	return childProcess, nil
}

// GetProcess 从管理器获取子进程
func (m *ChildProcessManager) GetProcess(userID string) *ChildProcess {
	m.mu.RLock()
	defer m.mu.RUnlock()

	childProcess, exists := m.childProcesses[userID]
	if exists {
		credentialsChanged, err := m.processCredentialsChanged(userID, childProcess)
		if err != nil {
			logrus.WithError(err).Warnf("Failed to check child process credentials for user %s", userID)
			return nil
		}
		if credentialsChanged {
			return nil
		}
		ready := httpUtils.CheckHTTPServerReady(childProcess.GetPort())
		if !ready {
			return nil
		}
		childProcess.UpdateLastUsed()
		childProcess.CheckAndStartUsing()
		return childProcess
	}
	return nil
}

// GetOrCreateChildProcess 获取或创建子进程
func (m *ChildProcessManager) GetOrCreateChildProcess(userID string) (*ChildProcess, error) {
	// 先尝试获取读锁
	m.mu.RLock()
	childProcess, exists := m.childProcesses[userID]
	m.mu.RUnlock()

	// 如果存在且进程就绪，直接返回
	if exists {
		credentialsChanged, err := m.processCredentialsChanged(userID, childProcess)
		if err != nil {
			return nil, err
		}
		if !credentialsChanged && childProcess.CheckAndStartUsing() {
			return childProcess, nil
		}
	}

	// 停止 child 不能在持有 m.mu 时执行，因为 monitor 完成退出时也需要获取这把锁。
	m.mu.Lock()

	// 在获取写锁后，重新检查一下进程是否已经存在（可能在等待锁的过程中被其他协程创建）
	childProcess, exists = m.childProcesses[userID]
	if exists {
		credentialsChanged, err := m.processCredentialsChanged(userID, childProcess)
		if err != nil {
			m.mu.Unlock()
			return nil, err
		}
		if credentialsChanged {
			delete(m.childProcesses, userID)
			m.mu.Unlock()
			if err := childProcess.Stop(); err != nil {
				return nil, fmt.Errorf("failed to stop child process for user %s: %w", userID, err)
			}
			m.mu.Lock()
			// 停止期间其他请求可能已经创建了新 child。重新检查映射并复用它，
			// 避免当前调用再次创建并覆盖该实例。
			if current, ok := m.childProcesses[userID]; ok && current != childProcess {
				m.mu.Unlock()
				if current.CheckAndStartUsing() {
					return current, nil
				}
				if err := current.Stop(); err != nil {
					return nil, fmt.Errorf("failed to stop duplicate child process for user %s: %w", userID, err)
				}
				m.mu.Lock()
				if m.childProcesses[userID] == current {
					delete(m.childProcesses, userID)
				}
			}
		} else if childProcess.CheckAndStartUsing() {
			m.mu.Unlock()
			return childProcess, nil
		} else {
			delete(m.childProcesses, userID)
			m.mu.Unlock()
			if err := childProcess.Stop(); err != nil {
				return nil, fmt.Errorf("failed to stop child process for user %s: %w", userID, err)
			}
			m.mu.Lock()
			if current, ok := m.childProcesses[userID]; ok && current != childProcess {
				m.mu.Unlock()
				if current.CheckAndStartUsing() {
					return current, nil
				}
				if err := current.Stop(); err != nil {
					return nil, fmt.Errorf("failed to stop duplicate child process for user %s: %w", userID, err)
				}
				m.mu.Lock()
				if m.childProcesses[userID] == current {
					delete(m.childProcesses, userID)
				}
			}
		}
	}

	// 创建新进程
	newProcess, err := m.createProcess(userID)
	m.mu.Unlock()
	if err != nil {
		return nil, err
	}
	return newProcess, nil
}

func (m *ChildProcessManager) AcquirePort(owner string) (string, error) {
	m.portMu.Lock()
	defer m.portMu.Unlock()

	// 实现带重试的端口查找
	for i := 0; i < 3; i++ {
		port, err := httpUtils.FindAvailablePort()
		if err != nil {
			continue
		}

		if _, occupied := m.portPool[port]; !occupied {
			m.portPool[port] = owner
			return port, nil
		}
	}
	return "", errors.New("no available ports after 3 attempts")
}

func (m *ChildProcessManager) ReleasePort(port, owner string) {
	m.portMu.Lock()
	if current, exists := m.portPool[port]; exists && current == owner {
		delete(m.portPool, port)
	}
	m.portMu.Unlock()
}

// 增强的清理逻辑
func (m *ChildProcessManager) ManageChildProcesses() {
	const batchSize = 10 // 分批次处理避免长时间锁
	for {
		shellIdleDuration := config.GetShellIdleTimeout()
		time.Sleep(30 * time.Second)

		var candidates []*ChildProcess
		m.mu.RLock()
		for _, cp := range m.childProcesses {
			idleDuration := defaultNonShellIdleDuration
			if cp.HasShellConnections() {
				idleDuration = shellIdleDuration
			}
			if time.Since(cp.GetLastUsed()) > idleDuration {
				candidates = append(candidates, cp)
				if len(candidates) >= batchSize {
					break
				}
			}
		}
		m.mu.RUnlock()

		var wg sync.WaitGroup
		for _, cp := range candidates {
			wg.Add(1)
			go func(p *ChildProcess) {
				defer wg.Done()
				// 检查Stop的错误并记录
				if err := p.Stop(); err != nil {
					logrus.WithField("session", p.sessionID).Errorf("Failed to stop process: %v", err)
				}
				m.mu.Lock()
				delete(m.childProcesses, p.userID)
				m.mu.Unlock()
			}(cp)
		}
		wg.Wait()
	}
}

func (m *ChildProcessManager) ShutdownAllChildProcesses() {
	m.mu.Lock()
	processes := make(map[string]*ChildProcess, len(m.childProcesses))
	for userID, childProcess := range m.childProcesses {
		processes[userID] = childProcess
	}
	m.mu.Unlock()

	for userID, childProcess := range processes {
		if err := childProcess.Stop(); err != nil {
			logrus.Errorf("Failed to gracefully stop child process for user %s: %v", userID, err)
		}
		// 确保从管理器中删除记录
		m.mu.Lock()
		if current, exists := m.childProcesses[userID]; exists && current == childProcess {
			delete(m.childProcesses, userID)
		}
		m.mu.Unlock()
		logrus.Infof("Cleaned up child process for user %s", userID)
	}
}
