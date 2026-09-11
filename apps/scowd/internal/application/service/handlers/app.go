package handlers

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"scowd/internal/config"
	"scowd/internal/auth"
	"scowd/internal/utils"
	"scowd/internal/application/submission"
	"scowd/internal/desktop"
	apiv1 "scowd/protos/gen/api/application"
	"strconv"
	"strings"

	"connectrpc.com/connect"
	"github.com/sirupsen/logrus"
)

var (
	ErrorRefreshPasswordUnknow = errors.New("an unknown error occurred while refreshing your password")
)

type AppServer struct{}

func (a *AppServer) GetAppLastSubmission(
	ctx context.Context,
	req *connect.Request[apiv1.GetAppLastSubmissionRequest],
) (*connect.Response[apiv1.GetAppLastSubmissionResponse], error) {

	currentUser, err := auth.Lookup(req.Msg.UserId)
	if err != nil {
		logrus.Errorf("Get home directory error")
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	userHomeDir := currentUser.HomeDir

	// Check if the file exists
	filePath := filepath.Join(userHomeDir, req.Msg.FilePath)
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		logrus.Infof("file %s does not exist", req.Msg.FilePath)
		return connect.NewResponse(&apiv1.GetAppLastSubmissionResponse{
			FileData: nil,
		}), nil
	}

	// Read the file
	fileContent, err := os.ReadFile(filePath)
	if err != nil {
		logrus.Errorf("read last submission file error: %v", err)
		return nil, err
	}

	// Parse the JSON content into the apiv1.SubmissionInfo structure
	info, err := app.ParseSubmissionContent(fileContent)
	if err != nil {
		logrus.Errorf("unmarshal last submission file content error: %v", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	res := connect.NewResponse(&apiv1.GetAppLastSubmissionResponse{
		FileData: info,
	})

	return res, nil
}

func (a *AppServer) RefreshVncPassword(ctx context.Context,
	req *connect.Request[apiv1.RefreshVncPasswordRequest],
) (*connect.Response[apiv1.RefreshVncPasswordResponse], error) {

	currentUser, err := auth.Lookup(req.Msg.UserId)
	if err != nil {
		logrus.Errorf("Get home directory error")
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	userHomeDir := currentUser.HomeDir

	var password string
	var refreshErr error

	// 优先尝试 SSH 刷新密码
	sshConfig := utils.SSHConfig{
		Host:     req.Msg.Host,
		Username: req.Msg.UserId,
	}
	password, refreshErr = refreshVncPasswordViaSSH(sshConfig, userHomeDir, req.Msg.VncPasswdPath, req.Msg.DisplayId)
	if refreshErr == nil {
		return connect.NewResponse(&apiv1.RefreshVncPasswordResponse{Password: password}), nil
	}

	logrus.Warnf("Failed to refresh VNC password via SSH: %v, attempting fallback to srun if applicable", refreshErr)

	// 如果 SSH 失败且提供了 JobId，尝试使用 srun
	if req.Msg.JobId != 0 {
		// 获取配置以确定 srun 命令路径
		srunPath := "srun" // 默认值
		scowdConfig, err := config.GetScowdConfig()
		if err != nil {
			logrus.Warnf("Failed to load config: %v, using default srun command", err)
		} else if scowdConfig.Slurm.BinPath != "" {
			srunPath = filepath.Join(scowdConfig.Slurm.BinPath, "srun")
		}

		password, srunErr := refreshVncPasswordViaSrun(srunPath, req.Msg.Host, req.Msg.VncPasswdPath, req.Msg.JobId, req.Msg.DisplayId)
		if srunErr == nil {
			return connect.NewResponse(&apiv1.RefreshVncPasswordResponse{Password: password}), nil
		}
		logrus.Errorf("Failed to refresh VNC password via srun: %v", srunErr)
	}

	return nil, connect.NewError(connect.CodeInternal, ErrorRefreshPasswordUnknow)
}

func (a *AppServer) RunScript(ctx context.Context,
	req *connect.Request[apiv1.RunScriptRequest],
) (*connect.Response[apiv1.RunScriptResponse], error) {

	script := req.Msg.Script
	logrus.Debugf("Executing dynamic form script: %s", script)

	timeout := 30 * time.Second
	if req.Msg.TimeoutSeconds > 0 {
		timeout = time.Duration(req.Msg.TimeoutSeconds) * time.Second
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, "sh", "-c", script)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			logrus.Errorf("Dynamic form script timed out: %s", script)
			return nil, connect.NewError(connect.CodeDeadlineExceeded, fmt.Errorf("script execution timed out after %s", timeout))
		}
		logrus.Errorf("Failed to execute dynamic form script: %v, stderr: %s", err, stderr.String())
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to execute script: %v", err))
	}

	output := stdout.String()
	return connect.NewResponse(&apiv1.RunScriptResponse{Output: output}), nil

}

// refreshVncPasswordViaSrun 通过 srun 命令刷新 VNC 密码
// srunPath: srun 命令的路径 (e.g. "srun" or "/usr/bin/srun")
// srun 参数说明:
// --jobid=<job_id>: 指定要在哪个作业中运行命令。这确保命令在分配给该作业的资源（节点）上执行。
// --nodelist=<host>: 指定要在哪个节点上运行命令。虽然指定了 jobid，但在多节点作业中，明确指定节点更安全。
// -N1: 告诉 Slurm 只需要分配 1 个节点。
// -n1: 告诉 Slurm 只需要运行 1 个任务（进程）。
// <vnc_passwd_path>: 要执行的命令（即刷新密码的脚本/程序的路径）。
// -o -display :<display_id>: 这是传递给 <vnc_passwd_path> 命令的参数，告诉它这是一个一次性密码请求 (-o) 并且指定了显示编号。
func refreshVncPasswordViaSrun(srunPath, host, vncPasswdPath string, jobID uint32, displayID int32) (string, error) {
	displayArg := ":" + strconv.Itoa(int(displayID))
	srunArgs := []string{
		"--jobid=" + strconv.Itoa(int(jobID)),
		"--nodelist=" + host,
		"-N1", "-n1",
		vncPasswdPath,
		"-o", "-display", displayArg,
	}

	// 直接执行 srun，假设当前程序运行用户即为提交作业的用户
	cmd := exec.Command(srunPath, srunArgs...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	logrus.Infof("Executing srun command: %s", cmd.String())
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("srun execution failed: %w, stderr: %s", err, stderr.String())
	}

	logrus.Infof("parse otp for %d from srun output", displayID)
	return desktop.ParseOTP(stderr.String())
}

// refreshVncPasswordViaSSH 通过 SSH 刷新 VNC 密码
func refreshVncPasswordViaSSH(config utils.SSHConfig, userHomeDir, vncPasswdPath string, displayId int32) (string, error) {
	params := []string{"-o", "-display", ":" + strconv.Itoa(int(displayId))}
	command := fmt.Sprintf("%s %s", vncPasswdPath, strings.Join(params, " "))

	_, stderr, err := utils.ExecuteCommand(config, userHomeDir, command)
	if err != nil {
		return "", err
	}

	logrus.Infof("parse otp for %d from ssh output", displayId)
	return desktop.ParseOTP(stderr)
}
