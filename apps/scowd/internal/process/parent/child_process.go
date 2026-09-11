package parent

import (
	"fmt"
	"os"
	"os/exec"
	"sync"
	"syscall"
	"time"

	"scowd/internal/auth"

	httpUtils "scowd/internal/httpserver/httputil"

	"github.com/sirupsen/logrus"
)

type ChildProcess struct {
	cmd              *exec.Cmd
	lastUsed         time.Time
	lastCheckTime    time.Time
	userID           string
	port             string
	shellConnections int
	Mu               sync.RWMutex
	wg               sync.WaitGroup
	sessionID        string // 跟踪标识
	Client           any    // 缓存的client实例
	credentials      userCredentials
	hasCredentials   bool
	done             chan struct{}
	stopping         bool
	stopDone         chan struct{}
	stopErr          error
	portReleased     bool
}

const checkInterval = time.Second // 设置HTTP检查的最小间隔时间

// requestDrainTimeout prevents a stuck request from blocking child cleanup forever.
const requestDrainTimeout = 30 * time.Second

type userCredentials struct {
	uid    uint32
	gid    uint32
	groups []int
}

func lookupUserCredentials(userID string) (userCredentials, error) {
	uid, gid, groups, err := auth.GetUserInfo(userID)
	if err != nil {
		return userCredentials{}, err
	}

	return userCredentials{
		uid:    uid,
		gid:    gid,
		groups: cloneGroups(groups),
	}, nil
}

func cloneGroups(groups []int) []int {
	if groups == nil {
		return nil
	}
	return append([]int(nil), groups...)
}

func sameUserCredentials(a, b userCredentials) bool {
	if a.uid != b.uid || a.gid != b.gid || len(a.groups) != len(b.groups) {
		return false
	}

	groupSet := make(map[int]int, len(a.groups))
	for _, group := range a.groups {
		groupSet[group]++
	}
	for _, group := range b.groups {
		if groupSet[group] == 0 {
			return false
		}
		groupSet[group]--
	}

	return true
}

func (cp *ChildProcess) setCredentials(credentials userCredentials) {
	cp.Mu.Lock()
	defer cp.Mu.Unlock()

	cp.credentials = userCredentials{
		uid:    credentials.uid,
		gid:    credentials.gid,
		groups: cloneGroups(credentials.groups),
	}
	cp.hasCredentials = true
}

func (cp *ChildProcess) credentialsChanged(userID string) (bool, userCredentials, error) {
	currentCredentials, err := lookupUserCredentials(userID)
	if err != nil {
		return false, userCredentials{}, err
	}

	cp.Mu.RLock()
	startedCredentials := cp.credentials
	hasCredentials := cp.hasCredentials
	cp.Mu.RUnlock()

	if !hasCredentials {
		return true, currentCredentials, nil
	}

	return !sameUserCredentials(startedCredentials, currentCredentials), currentCredentials, nil
}

func (cp *ChildProcess) GetPort() string {
	cp.Mu.RLock()
	defer cp.Mu.RUnlock()

	return cp.port
}

func (cp *ChildProcess) GetLastUsed() time.Time {
	cp.Mu.RLock()
	defer cp.Mu.RUnlock()

	return cp.lastUsed
}

func (cp *ChildProcess) UpdateLastUsed() {
	cp.Mu.Lock()
	defer cp.Mu.Unlock()

	cp.lastUsed = time.Now()
}

func (cp *ChildProcess) IncShellConnections() {
	cp.Mu.Lock()
	defer cp.Mu.Unlock()

	cp.shellConnections++
	cp.lastUsed = time.Now()
}

func (cp *ChildProcess) DecShellConnections() {
	cp.Mu.Lock()
	defer cp.Mu.Unlock()

	if cp.shellConnections <= 0 {
		cp.shellConnections = 0
		return
	}
	cp.shellConnections--
	if cp.shellConnections == 0 {
		cp.lastUsed = time.Now()
	}
}

func (cp *ChildProcess) HasShellConnections() bool {
	cp.Mu.RLock()
	defer cp.Mu.RUnlock()

	return cp.shellConnections > 0
}

func (cp *ChildProcess) CheckAndStartUsing() bool {
	cp.Mu.Lock()
	defer cp.Mu.Unlock()
	if cp.stopping {
		// 停止流程一旦开始，禁止新请求加入 WaitGroup，避免与 Wait 并发 Add。
		return false
	}

	now := time.Now()
	// 如果距离上次检查时间小于间隔阈值，则跳过HTTP检查
	if now.Sub(cp.lastCheckTime) < checkInterval {
		cp.lastUsed = now
		cp.wg.Add(1)
		return true
	}

	// 更新检查时间并执行HTTP检查
	cp.lastCheckTime = now
	if !httpUtils.CheckHTTPServerReady(cp.port) {
		return false
	}

	cp.lastUsed = now
	cp.wg.Add(1)
	return true
}

func (cp *ChildProcess) FinishedUsing() {
	cp.wg.Done()
}

func (cp *ChildProcess) Wait() {
	cp.wg.Wait()
}

func (cp *ChildProcess) waitForRequests(timeout time.Duration) bool {
	done := make(chan struct{})
	go func() {
		cp.wg.Wait()
		close(done)
	}()
	select {
	case <-done:
		return true
	case <-time.After(timeout):
		return false
	}
}

// Stop 确保资源回收
func (cp *ChildProcess) Stop() error {
	logrus.WithField("session", cp.sessionID).Info("Stopping process")
	cp.Mu.Lock()
	if cp.stopping {
		// 只有第一个调用者执行实际停止；后续调用者等待同一个完成信号，保证幂等。
		done := cp.stopDone
		cp.Mu.Unlock()
		<-done
		cp.Mu.RLock()
		err := cp.stopErr
		cp.Mu.RUnlock()
		return err
	}
	cp.stopping = true
	// 先发布 stopping 状态，再释放锁；之后所有请求都会被拒绝。
	cp.stopDone = make(chan struct{})
	stopDone := cp.stopDone
	cmd, processDone := cp.cmd, cp.done
	cp.Mu.Unlock()

	// 优先等待已有请求结束；超时后继续终止 child，避免单个卡死请求阻塞整个用户进程生命周期。
	if !cp.waitForRequests(requestDrainTimeout) {
		logrus.WithField("session", cp.sessionID).Warnf("Timed out waiting for active requests after %v; forcing child shutdown", requestDrainTimeout)
	}
	var stopErr error
	if cmd != nil && cmd.Process != nil {
		if err := cmd.Process.Signal(syscall.SIGTERM); err != nil && err != os.ErrProcessDone {
			stopErr = err
		}
		select {
		case <-processDone:
			// monitorProcess 是唯一调用 Wait 的 goroutine，通过 done 通知回收完成。
		case <-time.After(5 * time.Second):
			// 优雅退出超时后强制终止，但仍然等待 monitor 完成 Wait。
			if err := cmd.Process.Kill(); err != nil && err != os.ErrProcessDone {
				stopErr = fmt.Errorf("force stop: %w", err)
			}
			select {
			case <-processDone:
			case <-time.After(2 * time.Second):
				stopErr = fmt.Errorf("process stop timeout")
			}
		}
	}
	cp.Mu.Lock()
	cp.stopErr = stopErr
	close(stopDone)
	cp.Mu.Unlock()
	logrus.WithField("session", cp.sessionID).Info("Process stopped")
	return stopErr
}

// releasePortOnce 只允许 child 自己释放一次端口。
// 调用者必须已经确认 monitor 完成了 Wait；如果 manager 已经指向新 child，
// 说明该端口可能已经被重新分配，旧 child 不能再释放它。
func (cp *ChildProcess) releasePortOnce() {
	cp.Mu.Lock()
	if cp.portReleased {
		cp.Mu.Unlock()
		return
	}
	cp.portReleased = true
	port, userID, sessionID := cp.port, cp.userID, cp.sessionID
	cp.Mu.Unlock()

	GlobalChildProcessManager.mu.Lock()
	current, exists := GlobalChildProcessManager.childProcesses[userID]
	if exists && current != cp {
		GlobalChildProcessManager.mu.Unlock()
		return
	}
	if exists && current == cp {
		delete(GlobalChildProcessManager.childProcesses, userID)
	}
	GlobalChildProcessManager.mu.Unlock()
	GlobalChildProcessManager.ReleasePort(port, sessionID)
}
