package handlers

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"regexp"
	"strings"

	stream "github.com/PKUHPC/private-scow/apps/scowd/internal/api/utils/stream"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/application/container"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/application/image"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/auth"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/utils"
	apiv1 "github.com/PKUHPC/private-scow/apps/scowd/protos/gen/api/application"

	"connectrpc.com/connect"
	"github.com/sirupsen/logrus"
)

type ImageServer struct{}

func execOciCommand(command string, args []string) (string, error) {
	baseCmd, finalArgs, buildErr := image.BuildOciCommand(command, args)
	if buildErr != nil {
		return "", buildErr
	}

	logrus.Infof("Executing command: %s %s", baseCmd, strings.Join(finalArgs, " "))

	cmd := exec.Command(baseCmd, finalArgs...)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	outStr := stdout.String()
	errStr := stderr.String()

	if err != nil {
		logrus.Errorf("Command failed: %s %s", baseCmd, strings.Join(finalArgs, " "))
		logrus.Errorf("stderr: %s", errStr)
		return outStr, fmt.Errorf("command failed: %w - stderr: %s", err, errStr)
	}

	logrus.Infof("Command output: %s", outStr)
	return outStr, nil
}

// execOciCommandWithOutput 执行 oci command并获得输出，使得结果可以通过流式返回
func execOciCommandWithOutput(command string, args []string) (string, error) {
	baseCmd, finalArgs, buildErr := image.BuildOciCommand(command, args)
	if buildErr != nil {
		return "", buildErr
	}
	cmd := exec.Command(baseCmd, finalArgs...)
	output, err := cmd.CombinedOutput()
	logrus.Infof("Command output: %s", output)
	return string(output), err
}

func (f *ImageServer) LoadImage(ctx context.Context,
	req *connect.Request[apiv1.LoadImageRequest],
) (*connect.Response[apiv1.LoadImageResponse], error) {

	logrus.Infof("Get load image request of user: %s, %s", req.Msg.SourcePath, req.Msg.UserId)
	runtimeCommand := container.GetRuntimeCommand(container.GetContainerRuntime())
	output, err := execOciCommand(runtimeCommand, []string{"load", "-i", req.Msg.SourcePath})

	if err != nil {
		logrus.Errorf("load image %s failed: %v", req.Msg.SourcePath, err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// 1) 先尝试从 "Loaded image: ..." 提取 name[:tag]
	//    兼容 docker/nerdctl，多行输出，用(?m)逐行匹配
	//    允许 . / - _ 数字字母；tag 允许 . - _，并可不存在
	reLoaded := regexp.MustCompile(`(?m)^Loaded image:\s+([A-Za-z0-9._/\-]+(?::[A-Za-z0-9._\-]+)?)\s*$`)
	if m := reLoaded.FindStringSubmatch(output); len(m) >= 2 {
		img := strings.TrimSpace(m[1])
		// 某些 nerdctl 在无 tag 时会打印形如 "overlayfs:"，这类等价于“没有名字”，需要过滤掉
		if img != "" && !strings.HasSuffix(img, ":") {
			return connect.NewResponse(&apiv1.LoadImageResponse{
				ImageUrl: img,
			}), nil
		}
	}

	// 2) 回退：从 "unpacking ..." 里提取 sha256 digest
	//    兼容两种形式：
	//    unpacking foo@sha256:<64hex> (sha256:<64hex>)...
	//    或任意行中出现 sha256:<64hex>
	reDigest := regexp.MustCompile(`(?m)sha256:[a-f0-9]{64}`)
	if m := reDigest.FindString(output); m != "" {
		// 返回 digest，交由上层决定是否 retag
		return connect.NewResponse(&apiv1.LoadImageResponse{
			ImageUrl: m, // e.g. "sha256:1f1429e1..."
		}), nil
	}

	return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("no image name or digest found in output: %s", output))
}

// execOciCommandStreamingForPull 专门为 Pull 操作设计的流式执行函数
func (f *ImageServer) execOciCommandStreamingForPull(
	ctx context.Context,
	command string,
	args []string,
	streamConn *connect.ServerStream[apiv1.PullImageResponse],
) (int, error) {
	sender := stream.NewPullSender(streamConn)
	return image.ExecOciCommandStreamingBuffered(ctx, command, args, sender)
}

// execOciCommandStreamingForPush 专门为 Push 操作设计的流式执行函数
func (f *ImageServer) execOciCommandStreamingForPush(
	ctx context.Context,
	command string,
	args []string,
	streamConn *connect.ServerStream[apiv1.PushImageToHarborResponse],
) (int, error) {
	sender := stream.NewPushSender(streamConn)
	return image.ExecOciCommandStreamingBuffered(ctx, command, args, sender)
}

// execRemoteCommandStreamingForPush 远程执行Push结果通过流式返回
func (f *ImageServer) execRemoteCommandStreamingForPush(
	ctx context.Context,
	config utils.SSHConfig,
	userHomeDir string,
	command string,
	args []string,
	streamConn *connect.ServerStream[apiv1.PushImageToHarborResponse],
) (int, error) {
	cmdStr := fmt.Sprintf("%s %s", command, strings.Join(args, " "))
	logrus.Infof("Executing remote streaming push command: %s", cmdStr)

	sender := stream.NewPushSender(streamConn)

	// 先使用同步方式获取输出，然后流式发送
	stdout, stderr, err := utils.ExecuteCommand(config, userHomeDir, cmdStr)

	// 发送stdout
	if stdout != "" {
		if sendErr := sender.SendStdout(stdout, image.OutputFormatOptions{FilterProgress: true}); sendErr != nil {
			return 1, sendErr
		}
	}
	// 发送 stderr
	if stderr != "" {
		if sendErr := sender.SendStderr(stderr, image.OutputFormatOptions{FilterProgress: true}); sendErr != nil {
			return 1, sendErr
		}
	}
	exitCode := 0
	if err != nil {
		exitCode = 1
	}
	return exitCode, err
}

func (f *ImageServer) PullImage(ctx context.Context,
	req *connect.Request[apiv1.PullImageRequest],
	streamConn *connect.ServerStream[apiv1.PullImageResponse],
) error {

	logrus.Infof("Get pull image request of user: %s, %s", req.Msg.SourcePath, req.Msg.UserId)
	runtimeCommand := container.GetRuntimeCommand(container.GetContainerRuntime())
	var isLoggedIn bool

	// 取 registry 地址部分
	registryMirror := strings.Split(req.Msg.SourcePath, "/")[0]
	loginInfo := req.Msg.LoginInfo

	sender := stream.NewPullSender(streamConn)

	// 登录逻辑
	if loginInfo != nil && loginInfo.UserName != "" && loginInfo.Password != "" {
		logrus.Infof("Logging in to registry: %s", registryMirror)

		loginOutput, err := execOciCommandWithOutput(runtimeCommand, []string{"login", registryMirror,
			"-u", loginInfo.UserName,
			"-p", loginInfo.Password,
		})

		if err != nil {
			// 发送登录失败的输出
			if err := sender.SendStderr(loginOutput, image.OutputFormatOptions{AddNewlines: true}); err != nil {
				return err
			}
			// 发送完成信号，表示失败
			return streamConn.Send(&apiv1.PullImageResponse{
				Message: &apiv1.PullImageResponse_Completed{
					Completed: &apiv1.PullImageResponse_CompletedPull{
						ExitCode: 1,
					},
				},
			})
		}

		// 发送登录成功的输出
		if err := sender.SendStdout("Login Successful.", image.OutputFormatOptions{AddNewlines: true}); err != nil {
			logrus.Errorf("Error sending chunk of data: %v during pull image of %s from %s", err, req.Msg.SourcePath, req.Msg.UserId)
			return connect.NewError(connect.CodeInternal, err)
		}

		isLoggedIn = true
	}

	// 流式执行拉取镜像命令
	logrus.Infof("Starting to pull image: %s from user %s", req.Msg.SourcePath, req.Msg.UserId)

	var finalExitCode int32 = 0
	exitCode, err := f.execOciCommandStreamingForPull(ctx, runtimeCommand, []string{"pull", req.Msg.SourcePath}, streamConn)
	if err != nil {
		logrus.Errorf("Pull image failed: %v", err)

		// 如果是 context 取消，直接返回
		if ctx.Err() != nil {
			logrus.Infof("Pull image of %s from user %s cancelled by context", req.Msg.SourcePath, req.Msg.UserId)
			return nil
		}

		// 系统级错误返回客户端
		errMsg := err.Error()
		if err := sender.SendStderr(errMsg, image.OutputFormatOptions{AddNewlines: true}); err != nil {
			logrus.Errorf("Error sending chunk of data: %v during pull image of %s from %s", err, req.Msg.SourcePath, req.Msg.UserId)
			return connect.NewError(connect.CodeInternal, err)
		}
		finalExitCode = 1
	} else {
		finalExitCode = int32(exitCode)
	}

	// 登出
	if isLoggedIn {
		logrus.Infof("Logging out from registry: %s", registryMirror)

		logoutOutput, logoutErr := execOciCommandWithOutput(runtimeCommand, []string{"logout", registryMirror})
		if logoutErr != nil {
			logrus.Warnf("Logout failed: %v", logoutErr)
		}

		// 发送登出信息（无论成功失败）
		if err := sender.SendStdout(logoutOutput, image.OutputFormatOptions{AddNewlines: true}); err != nil {
			logrus.Errorf("Error sending chunk of data: %v during pull image of %s from %s", err, req.Msg.SourcePath, req.Msg.UserId)
			return connect.NewError(connect.CodeInternal, err)
		}
	}

	// 发送最终完成信号
	imageUrl := ""
	if finalExitCode == 0 {
		imageUrl = req.Msg.SourcePath
	}

	return streamConn.Send(&apiv1.PullImageResponse{
		Message: &apiv1.PullImageResponse_Completed{
			Completed: &apiv1.PullImageResponse_CompletedPull{
				ImageUrl: &imageUrl,
				ExitCode: int32(finalExitCode),
			},
		},
	})
}

func (f *ImageServer) PushImageToHarbor(ctx context.Context,
	req *connect.Request[apiv1.PushImageToHarborRequest],
	streamConn *connect.ServerStream[apiv1.PushImageToHarborResponse],
) error {
	logrus.Infof("Get push image to harbor request of %s from user %s, node: %s", req.Msg.LocalImageUrl, req.Msg.UserId, req.Msg.Node)
	runtimeCommand := container.GetRuntimeCommand(container.GetContainerRuntime())

	var exec func(ctx context.Context, stream *connect.ServerStream[apiv1.PushImageToHarborResponse], args ...string) (int, error)

	sender := stream.NewPushSender(streamConn)

	if req.Msg.Node == "" {
		// 本地执行
		exec = func(ctx context.Context, stream *connect.ServerStream[apiv1.PushImageToHarborResponse], args ...string) (int, error) {
			return f.execOciCommandStreamingForPush(ctx, runtimeCommand, args, stream)
		}
	} else {
		// 远程执行
		userHomeDir, err := auth.GetUserHomeDir(req.Msg.UserId)
		if err != nil {
			logrus.Errorf("Get home directory error of user %s: %v", req.Msg.UserId, err)
			errMsg := fmt.Sprintf("Failed to get user home directory of user %s: %v", req.Msg.UserId, err)
			if sendErr := sender.SendStderr(errMsg, image.OutputFormatOptions{AddNewlines: true}); sendErr != nil {
				return sendErr
			}
			// 返回最终结果
			return streamConn.Send(&apiv1.PushImageToHarborResponse{
				Message: &apiv1.PushImageToHarborResponse_Completed{
					Completed: &apiv1.PushImageToHarborResponse_CompletedPush{
						ExitCode: 1,
					},
				},
			})
		}

		config := utils.SSHConfig{
			Host:     req.Msg.Node,
			Username: req.Msg.UserId,
		}

		exec = func(ctx context.Context, stream *connect.ServerStream[apiv1.PushImageToHarborResponse], args ...string) (int, error) {
			return f.execRemoteCommandStreamingForPush(ctx, config, userHomeDir, runtimeCommand, args, stream)
		}
	}

	// 登录 Harbor
	logrus.Infof("Logging in to Harbor for pushing image of %s from user %s...", req.Msg.LocalImageUrl, req.Msg.UserId)
	if err := sender.SendStdout("Logging in to Harbor...", image.OutputFormatOptions{AddNewlines: true}); err != nil {
		return err
	}

	loginExitCode, err := exec(ctx, streamConn, "login", req.Msg.HarborInfo.Url, "-u", req.Msg.HarborInfo.User, "-p", req.Msg.HarborInfo.Password)
	if err != nil || loginExitCode != 0 {
		if ctx.Err() != nil {
			return nil
		}
		errMsg := fmt.Sprintf("Failed to login to Harbor during pushing image of %s from: %s", req.Msg.LocalImageUrl, req.Msg.UserId)
		if err != nil {
			errMsg = fmt.Sprintf("Failed to login to Harbor during pushing image of %s from %s: %v", req.Msg.LocalImageUrl, req.Msg.UserId, err)
		}

		if sendErr := sender.SendStderr(errMsg, image.OutputFormatOptions{AddNewlines: true}); sendErr != nil {
			return sendErr
		}
		// 返回最终结果
		return streamConn.Send(&apiv1.PushImageToHarborResponse{
			Message: &apiv1.PushImageToHarborResponse_Completed{
				Completed: &apiv1.PushImageToHarborResponse_CompletedPush{
					ExitCode: int32(loginExitCode),
				},
			},
		})
	}

	// tag
	taggingInfo := fmt.Sprintf("Tagging image: %s -> %s", req.Msg.LocalImageUrl, req.Msg.HarborImageUrl)
	logrus.Infof("Tagging image: %s -> %s", req.Msg.LocalImageUrl, req.Msg.HarborImageUrl)
	if err := sender.SendStdout(taggingInfo, image.OutputFormatOptions{AddNewlines: true}); err != nil {
		return err
	}

	tagExitCode, err := exec(ctx, streamConn, "tag", req.Msg.LocalImageUrl, req.Msg.HarborImageUrl)
	if err != nil || tagExitCode != 0 {
		if ctx.Err() != nil {
			return nil
		}

		errMsg := fmt.Sprintf("Failed to tag image of %s, user: %s", req.Msg.LocalImageUrl, req.Msg.UserId)
		if err != nil {
			errMsg = fmt.Sprintf("Failed to tag image of %s, user: %s, err: %v", req.Msg.LocalImageUrl, req.Msg.UserId, err)
		}
		if sendErr := sender.SendStderr(errMsg, image.OutputFormatOptions{AddNewlines: true}); sendErr != nil {
			return sendErr
		}

		return streamConn.Send(&apiv1.PushImageToHarborResponse{
			Message: &apiv1.PushImageToHarborResponse_Completed{
				Completed: &apiv1.PushImageToHarborResponse_CompletedPush{
					ExitCode: int32(tagExitCode),
				},
			},
		})
	}

	// 推送镜像
	pushingInfo := fmt.Sprintf("Pushing image: %s, user: %s", req.Msg.HarborImageUrl, req.Msg.UserId)
	logrus.Infof("Pushing image: %s, user: %s", req.Msg.HarborImageUrl, req.Msg.UserId)
	if err := sender.SendStdout(pushingInfo, image.OutputFormatOptions{AddNewlines: true}); err != nil {
		return err
	}

	pushExitCode, err := exec(ctx, streamConn, "push", req.Msg.HarborImageUrl)
	if err != nil || pushExitCode != 0 {
		if ctx.Err() != nil {
			return nil
		}

		logrus.Errorf("Failed to push image %s from user %s. This may be caused by multi-platform content or auth issues.", req.Msg.HarborImageUrl, req.Msg.UserId)

		errMsg := fmt.Sprintf("Failed to push image %s from user %s. Cleaning up tagged and local images...", req.Msg.HarborImageUrl, req.Msg.UserId)
		if sendErr := sender.SendStderr(errMsg, image.OutputFormatOptions{AddNewlines: true}); sendErr != nil {
			return sendErr
		}

		// 清理失败的镜像
		if cleanupErr := f.cleanupImagesStreaming(ctx, exec, streamConn, req.Msg.HarborImageUrl, req.Msg.LocalImageUrl); cleanupErr != nil {
			logrus.Errorf("Cleanup failed after pushing image from local image %s: %v", req.Msg.LocalImageUrl, cleanupErr)
		}

		return streamConn.Send(&apiv1.PushImageToHarborResponse{
			Message: &apiv1.PushImageToHarborResponse_Completed{
				Completed: &apiv1.PushImageToHarborResponse_CompletedPush{
					ExitCode: int32(pushExitCode),
				},
			},
		})
	}

	// 成功后清除本地镜像
	cleaningInfo := fmt.Sprintf("Image %s push successfully from user %s, cleaning up local images...", req.Msg.HarborImageUrl, req.Msg.UserId)
	logrus.Info(cleaningInfo)
	if err := sender.SendStdout(cleaningInfo, image.OutputFormatOptions{AddNewlines: true}); err != nil {
		return err
	}

	if cleanupErr := f.cleanupImagesStreaming(ctx, exec, streamConn, req.Msg.HarborImageUrl, req.Msg.LocalImageUrl); cleanupErr != nil {
		// 清理失败不影响整体成功
		logrus.Errorf("Cleanup failed during pushing image %s from user %s: %v", req.Msg.LocalImageUrl, req.Msg.UserId, cleanupErr)
	}

	// 发送最终完成信号
	return streamConn.Send(&apiv1.PushImageToHarborResponse{
		Message: &apiv1.PushImageToHarborResponse_Completed{
			Completed: &apiv1.PushImageToHarborResponse_CompletedPush{
				ExitCode: 0,
			},
		},
	})
}

func (f *ImageServer) CommitContainerImage(ctx context.Context,
	req *connect.Request[apiv1.CommitContainerImageRequest],
) (*connect.Response[apiv1.CommitContainerImageResponse], error) {

	logrus.Infof("Commit container image on remote node: %s", req.Msg.Node)
	runtimeCommand := container.GetRuntimeCommand(container.GetContainerRuntime())
	formattedContainerID := container.FormatContainerID(req.Msg.RowContainerId)

	userHomeDir, err := auth.GetUserHomeDir(req.Msg.UserId)
	if err != nil {
		logrus.Errorf("Get home directory error")
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	config := utils.SSHConfig{
		Host:     req.Msg.Node,
		Username: req.Msg.UserId,
	}
	logrus.Infof("CommitContainerImage: config: %v,userHomeDir: %v ", config, userHomeDir)

	// 检查容器是否存在
	checkCommand := fmt.Sprintf("%s ps --no-trunc", runtimeCommand)
	stdout, _, err := utils.ExecuteCommand(config, userHomeDir, checkCommand)
	if err != nil {
		logrus.Errorf("CommitContainerImage: ps command failed: %v", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	if !strings.Contains(stdout, formattedContainerID) {
		logrus.Errorf("CommitContainerImage: container %s not found on %s", formattedContainerID, req.Msg.Node)
		return nil, connect.NewError(connect.CodeInternal,
			fmt.Errorf("container %s not found on node %s", formattedContainerID, req.Msg.Node))
	}

	// 执行 commit 命令
	commitCommand := fmt.Sprintf("%s commit %s %s", runtimeCommand, formattedContainerID, req.Msg.ImageUrl)
	_, stderr, err := utils.ExecuteCommand(config, userHomeDir, commitCommand)
	if err != nil {
		logrus.Errorf("CommitContainerImage: commit command failed: %v, stderr: %s", err, stderr)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&apiv1.CommitContainerImageResponse{}), nil
}

func (f *ImageServer) cleanupImagesStreaming(
	ctx context.Context,
	exec func(ctx context.Context, stream *connect.ServerStream[apiv1.PushImageToHarborResponse], args ...string) (int, error),
	streamConn *connect.ServerStream[apiv1.PushImageToHarborResponse],
	harborImageUrl, localImageUrl string,
) error {
	sender := stream.NewPushSender(streamConn)
	// 清理 harbor 镜像
	if harborImageUrl != "" {
		// 发送开始信息
		cleaningHarborImageInfo := fmt.Sprintf("Cleaning up harbor image: %s", harborImageUrl)
		if err := sender.SendStdout(cleaningHarborImageInfo, image.OutputFormatOptions{AddNewlines: true}); err != nil {
			logrus.Errorf("Stream send failed: %v", err)
			return err
		}
		// 流式执行清理命令
		exitCode, err := exec(ctx, streamConn, "rmi", harborImageUrl)
		if err != nil || exitCode != 0 {
			logrus.Errorf("rmi HarborImageUrl failed: %v, exit code: %d", err, exitCode)
			errMsg := fmt.Sprintf("Failed to remove harbor image (exit code: %d): %v", exitCode, err)
			if sendErr := sender.SendStderr(errMsg, image.OutputFormatOptions{AddNewlines: true}); sendErr != nil {
				return sendErr
			}
		} else {
			if err := sender.SendStdout("Harbor image removed successfully", image.OutputFormatOptions{AddNewlines: true}); err != nil {
				return err
			}
		}
	}

	// 清理本地镜像
	if localImageUrl != "" {
		// 发送开始信息
		cleaningLocalImageInfo := fmt.Sprintf("Cleaning up local image: %s", localImageUrl)
		if err := sender.SendStdout(cleaningLocalImageInfo, image.OutputFormatOptions{AddNewlines: true}); err != nil {
			logrus.Errorf("Stream send failed: %v", err)
			return err
		}
		// 流式执行清理命令
		exitCode, err := exec(ctx, streamConn, "rmi", localImageUrl)
		if err != nil || exitCode != 0 {
			logrus.Errorf("rmi LocalImageUrl failed: %v, exit code: %d", err, exitCode)
			errMsg := fmt.Sprintf("Failed to remove local image (exit code: %d): %v\n", exitCode, err)
			if sendErr := sender.SendStderr(errMsg, image.OutputFormatOptions{AddNewlines: true}); sendErr != nil {
				return sendErr
			}
		} else {
			if err := sender.SendStdout("Local image removed successfully", image.OutputFormatOptions{AddNewlines: true}); err != nil {
				return err
			}
		}
	}

	// 发送完成信息
	if err := sender.SendStdout("Image cleanup completed", image.OutputFormatOptions{AddNewlines: true}); err != nil {
		return err
	}

	return nil
}
