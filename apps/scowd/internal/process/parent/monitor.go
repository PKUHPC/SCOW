package parent

import (
	"os/exec"
	"strings"

	"github.com/sirupsen/logrus"
)

// monitorProcess 是 exec.Cmd.Wait 的唯一调用者，Stop 只发送信号并等待这里的结果。
func (cp *ChildProcess) monitorProcess() {
	cp.Mu.RLock()
	cmd, done, userID, port := cp.cmd, cp.done, cp.userID, cp.port
	cp.Mu.RUnlock()
	logrus.Infof("Monitoring child process for user %s on port %s", userID, port)
	err := cmd.Wait()
	state := cmd.ProcessState
	// 先保存 Wait 返回后的状态；在 manager 映射和端口清理完成前不能通知 Stop 返回。

	if state != nil {
		exitCode := state.ExitCode()
		logrus.Errorf("Child process exit: user=%s port=%s exit_code=%d sys=%v", userID, port, exitCode, state.Sys())
		switch exitCode {
		case 0:
			logrus.Info("Exit code analysis: Normal exit (success)")
		case 1:
			logrus.Error("Exit code analysis: General error")
		case 2:
			logrus.Error("Exit code analysis: Misuse of shell builtins")
		case 126:
			logrus.Error("Exit code analysis: Command invoked cannot execute (permission problem or not executable)")
		case 127:
			logrus.Error("Exit code analysis: Command not found (possible missing dependencies)")
		case 128:
			logrus.Error("Exit code analysis: Invalid argument to exit")
		case 130:
			logrus.Error("Exit code analysis: Script terminated by Control-C")
		case 137:
			logrus.Error("Exit code analysis: SIGKILL (possibly terminated by system OOM)")
		case 143:
			logrus.Error("Exit code analysis: SIGTERM (normal termination)")
		default:
			logrus.Errorf("Exit code analysis: Terminated or unknown (%d)", exitCode)
		}
		logrus.Infof("Process resource usage: %v", state.SysUsage())
	}
	if err != nil {
		logrus.Errorf("Exit error analysis: type=%T err=%v", err, err)
		if exitErr, ok := err.(*exec.ExitError); ok {
			logrus.Errorf("Child process standard error output:\n%s", string(exitErr.Stderr))
		}
		if strings.Contains(err.Error(), "systemd") {
			logrus.Errorf("Possible systemd-run related error")
		}
	}

	// Wait 已完成后才允许释放端口；releasePortOnce 会再次校验 child 身份。
	cp.releasePortOnce()
	// done 表示进程回收及 manager/端口清理都已完成，Stop 收到后即可安全创建新 child。
	if done != nil {
		close(done)
	}
	if err != nil {
		exitCode := -1
		if state != nil {
			exitCode = state.ExitCode()
		}
		logrus.WithFields(logrus.Fields{"session": cp.sessionID, "user": userID, "exit": exitCode}).Error("Process exited abnormally")
	}
}
