package handlers

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os/exec"
	"path/filepath"
	"scowd/pkg/libs/auth"
	"scowd/pkg/utils/desktop"
	apiv1 "scowd/protos/gen/api/application"
	"strings"
	"syscall"

	"connectrpc.com/connect"
	"github.com/sirupsen/logrus"
)

type DesktopServer struct{}

func (d *DesktopServer) CreateDesktop(
	ctx context.Context,
	req *connect.Request[apiv1.CreateDesktopRequest],
) (*connect.Response[apiv1.CreateDesktopResponse], error) {
	// start a session
	// explicitly set securitytypes to avoid requiring setting vnc passwd
	params := []string{"-securitytypes", "OTP", "-otp"}
	if req.Msg.Wm != "" {
		params = append(params, "-wm", req.Msg.Wm)
	}
	if req.Msg.DesktopName != "" {
		params = append(params, "-name", req.Msg.DesktopName)
	}

	// 此处不能使用 os.UserHomeDir(), UserHomeDir 获取环境变量中的 HOME, 而子进程的这个环境变量继承自父进程
	currentUser, err := auth.Lookup(req.Msg.UserId)
	if err != nil {
		logrus.Errorf("CreateDesktop: Get home directory error")
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	startSessionCmd := exec.Command("bash", "-c",
		fmt.Sprintf("source ~/.bash_profile; cd %s && %s %s", currentUser.HomeDir, req.Msg.VncServerBinPath, strings.Join(params, " ")))

	startSessionCmd.SysProcAttr = &syscall.SysProcAttr{
		Setpgid: true,
	}

	var startStderrBuf bytes.Buffer
	startSessionCmd.Stderr = &startStderrBuf

	// 运行命令
	err = startSessionCmd.Run()
	if err != nil {
		fmt.Printf("Error: %s\n", err)
	}

	stderr := startStderrBuf.String()

	// parse the OTP from output. the output was in stderr
	password, err := desktop.ParseOTP(stderr)
	if err != nil {
		logrus.Errorf("CreateDesktop: parseOTP error: %v", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	// parse display id from output
	displayID, err := desktop.ParseDisplayID(stderr)
	if err != nil {
		logrus.Errorf("CreateDesktop: ParseDisplayID error: %v", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	res := connect.NewResponse(&apiv1.CreateDesktopResponse{
		Password: password, DisplayId: int32(displayID),
	})

	return res, nil
}

func (d *DesktopServer) KillDesktop(
	ctx context.Context,
	req *connect.Request[apiv1.KillDesktopRequest],
) (*connect.Response[apiv1.KillDesktopResponse], error) {
	listCmd := exec.Command(req.Msg.VncServerBinPath, "-list")
	var stdoutBuf bytes.Buffer
	listCmd.Stdout = &stdoutBuf
	if err := listCmd.Run(); err == nil {
		m, err := desktop.ParseListOutputWithPid(stdoutBuf.String())
		if err == nil {
			pidPtr, ok := m[int(req.Msg.DisplayId)]
			if !ok {
				res := connect.NewResponse(&apiv1.KillDesktopResponse{})
				return res, nil
			}
			if pidPtr == nil {
				if err := desktop.CleanupStaleDesktop(req.Msg.UserId, int(req.Msg.DisplayId)); err != nil {
					return nil, connect.NewError(connect.CodeInternal, err)
				}
				res := connect.NewResponse(&apiv1.KillDesktopResponse{})
				return res, nil
			}
		}
	}

	killCmd := exec.Command(req.Msg.VncServerBinPath, "-kill", fmt.Sprintf(":%d", req.Msg.DisplayId))
	if err := killCmd.Run(); err != nil {
		logrus.Errorf("kill desktop error: %s", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	res := connect.NewResponse(&apiv1.KillDesktopResponse{})

	return res, nil
}

func (d *DesktopServer) ConnectToDesktop(
	ctx context.Context,
	req *connect.Request[apiv1.ConnectToDesktopRequest],
) (*connect.Response[apiv1.ConnectToDesktopResponse], error) {
	vncServerPath := filepath.Join(filepath.Dir(req.Msg.VncPasswdPath), "vncserver")
	listCmd := exec.Command(vncServerPath, "-list")
	var stdoutBuf bytes.Buffer
	listCmd.Stdout = &stdoutBuf
	if err := listCmd.Run(); err == nil {
		m, err := desktop.ParseListOutputWithPid(stdoutBuf.String())
		if err == nil {
			pidPtr, ok := m[int(req.Msg.DisplayId)]
			if !ok {
				return nil, connect.NewError(connect.CodeNotFound, errors.New("desktop display not found"))
			}
			if pidPtr == nil {
				return nil, connect.NewError(connect.CodeFailedPrecondition, errors.New("desktop process missing"))
			}
		}
	}

	password, err := desktop.RefreshPassword(fmt.Sprintf(":%d", req.Msg.DisplayId), req.Msg.VncPasswdPath)
	if err != nil {
		logrus.Errorf("ConnectToDesktop: refresh password error %v", err)
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("ConnectToDesktop: refresh password error %v", err))
	}
	res := connect.NewResponse(&apiv1.ConnectToDesktopResponse{Password: password})
	return res, nil
}

func (d *DesktopServer) ListUserDesktops(
	ctx context.Context,
	req *connect.Request[apiv1.ListUserDesktopsRequest],
) (*connect.Response[apiv1.ListUserDesktopsResponse], error) {
	listCmd := exec.Command(req.Msg.VncServerBinPath, "-list")
	var stdoutBuf bytes.Buffer
	listCmd.Stdout = &stdoutBuf

	if err := listCmd.Run(); err != nil {
		logrus.Errorf("list running session error: %s", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	m, err := desktop.ParseListOutputWithPid(stdoutBuf.String())
	if err != nil {
		logrus.Errorf("parse session output err: %s", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	var userDesktops []*apiv1.Desktop
	for displayID, pidPtr := range m {
		isActive := pidPtr != nil
		userDesktops = append(userDesktops, &apiv1.Desktop{
			DisplayId: uint32(displayID),
			IsActive:  isActive,
		})
	}

	return connect.NewResponse(&apiv1.ListUserDesktopsResponse{UserDesktops: userDesktops}), nil
}
