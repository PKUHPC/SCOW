package handlers

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"

	customError "github.com/PKUHPC/private-scow/apps/scowd/internal/api/rpcerror"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/api/utils/process"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/api/utils/request"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/auth"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/process/parent"
	fileUtils "github.com/PKUHPC/private-scow/apps/scowd/internal/storage/file"

	apiv1 "github.com/PKUHPC/private-scow/apps/scowd/protos/gen/api/storage"
	"github.com/PKUHPC/private-scow/apps/scowd/protos/gen/api/storage/apiv1connect"

	"connectrpc.com/connect"
	"github.com/sirupsen/logrus"
)

type FileServer struct{}

func NewFileServiceClient(httpClient *http.Client, url string) apiv1connect.FileServiceClient {
	return apiv1connect.NewFileServiceClient(httpClient, url)
}

func handleFileRequest[T, D any](
	ctx context.Context,
	req *connect.Request[T],
	userID string,
	serviceOperation func(client apiv1connect.FileServiceClient, ctx context.Context, req *connect.Request[T]) (*connect.Response[D], error),
) (*connect.Response[D], error) {
	childProcess, err := process.GetChildProcess(userID)
	if err != nil {
		return nil, err
	}
	defer childProcess.FinishedUsing()

	client := process.GetChildProcessClient(NewFileServiceClient, childProcess)

	clientReq, err := request.SetSecretHeader(req.Msg, childProcess.GetPort())
	if err != nil {
		return nil, connect.NewError(
			connect.CodeInternal,
			fmt.Errorf("set secret header for %s error: %v", childProcess.GetPort(), err),
		)
	}

	return serviceOperation(client, ctx, clientReq)
}

func (f *FileServer) ReadDirectory(
	ctx context.Context,
	req *connect.Request[apiv1.ReadDirectoryRequest],
) (*connect.Response[apiv1.ReadDirectoryResponse], error) {
	return handleFileRequest(ctx, req, req.Msg.UserId, apiv1connect.FileServiceClient.ReadDirectory)
}

func (f *FileServer) CreateFile(
	ctx context.Context,
	req *connect.Request[apiv1.CreateFileRequest],
) (*connect.Response[apiv1.CreateFileResponse], error) {
	return handleFileRequest(ctx, req, req.Msg.UserId, apiv1connect.FileServiceClient.CreateFile)
}

func (f *FileServer) MakeDirectory(
	ctx context.Context,
	req *connect.Request[apiv1.MakeDirectoryRequest],
) (*connect.Response[apiv1.MakeDirectoryResponse], error) {

	// 路径合法校验
	if err := fileUtils.ValidateMakeDirPath(req.Msg.DirPath); err != nil {
		logrus.WithError(err).Errorf("directory path validation failed: %s", req.Msg.DirPath)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	// mode 只指定权限；root 代建必须由已校验目标路径的后端显式授权。
	if req.Msg.Mode != nil {
		if !req.Msg.GetNoCheckPermission() {
			return nil, connect.NewError(connect.CodePermissionDenied, errors.New("creating a directory with mode as root requires no_check_permission=true"))
		}
		dirMode, err := fileUtils.ParseMakeDirMode(req.Msg.Mode, 0775)
		if err != nil {
			logrus.WithError(err).Errorf("invalid mode for directory %s", req.Msg.DirPath)
			return nil, connect.NewError(connect.CodeInvalidArgument, err)
		}
		logrus.Infof("Creating directory %s with mode %s for user %s as root", req.Msg.DirPath, *req.Msg.Mode, req.Msg.UserId)
		if err := fileUtils.MakeDirectoryAsRoot(req.Msg.DirPath, req.Msg.UserId, dirMode); err != nil {
			return nil, err
		}
		return connect.NewResponse(&apiv1.MakeDirectoryResponse{}), nil
	}

	return handleFileRequest(ctx, req, req.Msg.UserId, apiv1connect.FileServiceClient.MakeDirectory)
}
func (f *FileServer) DeleteDirectory(
	ctx context.Context,
	req *connect.Request[apiv1.DeleteDirectoryRequest],
) (*connect.Response[apiv1.DeleteDirectoryResponse], error) {

	return handleFileRequest(ctx, req, req.Msg.UserId, apiv1connect.FileServiceClient.DeleteDirectory)
}

func (f *FileServer) DeleteFile(
	ctx context.Context,
	req *connect.Request[apiv1.DeleteFileRequest],
) (*connect.Response[apiv1.DeleteFileResponse], error) {

	return handleFileRequest(ctx, req, req.Msg.UserId, apiv1connect.FileServiceClient.DeleteFile)
}

func (f *FileServer) WriteFile(
	ctx context.Context,
	req *connect.Request[apiv1.WriteFileRequest],
) (*connect.Response[apiv1.WriteFileResponse], error) {

	return handleFileRequest(ctx, req, req.Msg.UserId, apiv1connect.FileServiceClient.WriteFile)
}

func (f *FileServer) ReadFile(
	ctx context.Context,
	req *connect.Request[apiv1.ReadFileRequest],
) (*connect.Response[apiv1.ReadFileResponse], error) {

	return handleFileRequest(ctx, req, req.Msg.UserId, apiv1connect.FileServiceClient.ReadFile)
}

func (f *FileServer) ChangeMode(
	ctx context.Context,
	req *connect.Request[apiv1.ChangeModeRequest],
) (*connect.Response[apiv1.ChangeModeResponse], error) {

	return handleFileRequest(ctx, req, req.Msg.UserId, apiv1connect.FileServiceClient.ChangeMode)
}

func (f *FileServer) GetHomeDirectory(
	ctx context.Context,
	req *connect.Request[apiv1.GetHomeDirectoryRequest],
) (*connect.Response[apiv1.GetHomeDirectoryResponse], error) {

	return handleFileRequest(ctx, req, req.Msg.UserId, apiv1connect.FileServiceClient.GetHomeDirectory)
}

func (f *FileServer) GetFileMetadata(
	ctx context.Context,
	req *connect.Request[apiv1.GetFileMetadataRequest],
) (*connect.Response[apiv1.GetFileMetadataResponse], error) {

	return handleFileRequest(ctx, req, req.Msg.UserId, apiv1connect.FileServiceClient.GetFileMetadata)
}

func (f *FileServer) Exists(
	ctx context.Context,
	req *connect.Request[apiv1.ExistsRequest],
) (*connect.Response[apiv1.ExistsResponse], error) {

	return handleFileRequest(ctx, req, req.Msg.UserId, apiv1connect.FileServiceClient.Exists)
}

func (f *FileServer) Copy(
	ctx context.Context,
	req *connect.Request[apiv1.CopyRequest],
) (*connect.Response[apiv1.CopyResponse], error) {
	return handleFileRequest(ctx, req, req.Msg.UserId, apiv1connect.FileServiceClient.Copy)
}

func (f *FileServer) ShareFileOrDir(
	ctx context.Context,
	req *connect.Request[apiv1.ShareFileOrDirRequest],
) (*connect.Response[apiv1.ShareFileOrDirResponse], error) {
	return handleFileRequest(ctx, req, req.Msg.UserId, apiv1connect.FileServiceClient.ShareFileOrDir)
}

func (f *FileServer) CompressFiles(
	ctx context.Context,
	req *connect.Request[apiv1.CompressFilesRequest],
) (*connect.Response[apiv1.CompressFilesResponse], error) {
	return handleFileRequest(ctx, req, req.Msg.UserId, apiv1connect.FileServiceClient.CompressFiles)
}

func (f *FileServer) DecompressFile(
	ctx context.Context,
	req *connect.Request[apiv1.DecompressFileRequest],
) (*connect.Response[apiv1.DecompressFileResponse], error) {
	return handleFileRequest(ctx, req, req.Msg.UserId, apiv1connect.FileServiceClient.DecompressFile)
}

func (f *FileServer) Move(
	ctx context.Context,
	req *connect.Request[apiv1.MoveRequest],
) (*connect.Response[apiv1.MoveResponse], error) {
	return handleFileRequest(ctx, req, req.Msg.UserId, apiv1connect.FileServiceClient.Move)
}

func (f *FileServer) Upload(ctx context.Context,
	stream *connect.ClientStream[apiv1.UploadRequest],
) (*connect.Response[apiv1.UploadResponse], error) {

	logrus.Debug("Start to upload file")

	var childClient apiv1connect.FileServiceClient
	var childStream *connect.ClientStreamForClient[apiv1.UploadRequest, apiv1.UploadResponse]
	var receivedMessages uint64
	var receivedChunks uint64
	var forwardedBytes uint64

	for stream.Receive() {
		req := stream.Msg()
		receivedMessages++

		switch x := req.Message.(type) {
		case *apiv1.UploadRequest_Info_:
			logrus.Debugf("Receive upload info message #%d, user=%s, path=%s, chunked=%t", receivedMessages, x.Info.UserId, x.Info.Path, x.Info.ChunkIdx != nil)
			childProcess, err := parent.GlobalChildProcessManager.GetOrCreateChildProcess(x.Info.UserId)
			if err != nil {
				logrus.Errorf("Start child process for user %s failed", err)
				connectErr := connect.NewError(
					connect.CodeInternal,
					errors.New(customError.MainStartChildProcessError),
				)
				return nil, connectErr
			}
			defer childProcess.FinishedUsing()

			childClient = process.GetChildProcessClient(NewFileServiceClient, childProcess)

			childStream = childClient.Upload(ctx)

			if err := childStream.Send(&apiv1.UploadRequest{
				Message: &apiv1.UploadRequest_Info_{
					Info: &apiv1.UploadRequest_Info{
						Path:     x.Info.Path,
						UserId:   x.Info.UserId,
						ChunkIdx: x.Info.ChunkIdx,
					}},
			}); err != nil {
				forwardErr := err
				var closeErr error
				if _, closeErr = childStream.CloseAndReceive(); closeErr != nil {
					forwardErr = closeErr
				}
				logrus.Errorf("An unknown error occurred while transmitting the file stream (info): sendErr=%v, closeAndReceiveErr=%v, finalErr=%v, finalCode=%s, receivedMessages=%d, receivedChunks=%d, forwardedBytes=%d", err, closeErr, forwardErr, connect.CodeOf(forwardErr), receivedMessages, receivedChunks, forwardedBytes)
				return nil, connect.NewError(connect.CodeOf(forwardErr), forwardErr)
			}
		case *apiv1.UploadRequest_Chunk:
			if childStream == nil {
				logrus.Errorf("received upload chunk before upload info")
				return nil, connect.NewError(connect.CodeFailedPrecondition, errors.New("upload info is required before chunks"))
			}
			receivedChunks++
			forwardedBytes += uint64(len(x.Chunk))
			if receivedChunks == 1 || receivedChunks%128 == 0 {
				logrus.Debugf("Forward upload chunk progress: chunks=%d, forwardedBytes=%d, lastChunkSize=%d", receivedChunks, forwardedBytes, len(x.Chunk))
			}
			if err := childStream.Send(&apiv1.UploadRequest{
				Message: &apiv1.UploadRequest_Chunk{Chunk: x.Chunk},
			}); err != nil {
				forwardErr := err
				var closeErr error
				if _, closeErr = childStream.CloseAndReceive(); closeErr != nil {
					forwardErr = closeErr
				}
				logrus.Errorf("An unknown error occurred while transmitting the file stream (chunk): sendErr=%v, closeAndReceiveErr=%v, finalErr=%v, finalCode=%s, receivedMessages=%d, receivedChunks=%d, forwardedBytes=%d, lastChunkSize=%d", err, closeErr, forwardErr, connect.CodeOf(forwardErr), receivedMessages, receivedChunks, forwardedBytes, len(x.Chunk))
				return nil, connect.NewError(connect.CodeOf(forwardErr), forwardErr)
			}
		default:
			logrus.Errorf("unknown message type")
			return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("unknown message type"))
		}
	}

	if err := stream.Err(); err != nil {
		logrus.Errorf("Unknown error sent while uploading file: %v, receivedMessages=%d, receivedChunks=%d, forwardedBytes=%d", err, receivedMessages, receivedChunks, forwardedBytes)
		return nil, connect.NewError(connect.CodeUnknown, err)
	}
	if childStream == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("no upload message received"))
	}

	logrus.Debugf("Finish receiving upload stream, start waiting child response: receivedMessages=%d, receivedChunks=%d, forwardedBytes=%d", receivedMessages, receivedChunks, forwardedBytes)
	childRes, err := childStream.CloseAndReceive()
	if err != nil {
		logrus.Errorf("Failed to receive upload response: %v, receivedMessages=%d, receivedChunks=%d, forwardedBytes=%d", err, receivedMessages, receivedChunks, forwardedBytes)
		return nil, err
	}
	logrus.Debugf("Upload forwarding finished: writtenBytes=%d, receivedChunks=%d, forwardedBytes=%d", childRes.Msg.WrittenBytes, receivedChunks, forwardedBytes)

	res := connect.NewResponse(&apiv1.UploadResponse{
		WrittenBytes: childRes.Msg.WrittenBytes,
	})

	return res, nil
}

func (f *FileServer) Download(ctx context.Context,
	req *connect.Request[apiv1.DownloadRequest],
	stream *connect.ServerStream[apiv1.DownloadResponse],
) error {
	if err := fileUtils.ValidateDownloadChunkSize(req.Msg.ChunkSizeByte); err != nil {
		return connect.NewError(connect.CodeInvalidArgument, err)
	}

	childProcess, connectErr := process.GetChildProcess(req.Msg.UserId)
	if connectErr != nil {
		return connect.NewError(connect.CodeInvalidArgument, connectErr)
	}
	defer childProcess.FinishedUsing()

	childClient := process.GetChildProcessClient(NewFileServiceClient, childProcess)

	clientReq, err := request.SetSecretHeader(
		&apiv1.DownloadRequest{
			Path:          req.Msg.Path,
			ChunkSizeByte: req.Msg.ChunkSizeByte,
			OffsetBytes:   req.Msg.OffsetBytes,
			LimitBytes:    req.Msg.LimitBytes,
		},
		childProcess.GetPort(),
	)
	if err != nil {
		return connect.NewError(
			connect.CodeInternal,
			fmt.Errorf("set secret header for %s error: %v", childProcess.GetPort(), err),
		)
	}

	childStream, err := childClient.Download(ctx, clientReq)

	if err != nil {
		errCode := connect.CodeOf(err)
		switch errCode {
		case connect.CodePermissionDenied:
			logrus.Error("Insufficient permissions to copy",
				req.Msg.UserId, req.Msg.Path)
		case connect.CodeNotFound:
			logrus.Errorf("path does not exist, %s", req.Msg.Path)
		case connect.CodeInvalidArgument:
			logrus.Errorf("The path %s is a dir not a file", req.Msg.Path)
		default:
			logrus.Error(
				"An unknown error occurred while downloading",
				req.Msg.UserId, req.Msg.Path)
		}
		return connect.NewError(errCode, err)
	}

	// 使用 io.Pipe 创建读写端
	reader, writer := io.Pipe()

	// 启动 Goroutine 从子流读取数据并写入到 pipe
	go func() {
		defer func() {
			if err := writer.Close(); err != nil {
				logrus.Errorf("Failed to close pipe writer: %v", err)
			}
		}()
		for childStream.Receive() {
			chunk := childStream.Msg().Chunk
			if _, err := writer.Write(chunk); err != nil {
				logrus.Errorf("Failed to write to pipe: %v", err)
				return
			}
		}
		if err := childStream.Close(); err != nil {
			logrus.Errorf("Failed to close child stream: %v", err)
		}
	}()

	// 从 pipe 的读端读取数据并发送到客户端
	buf := make([]byte, req.Msg.ChunkSizeByte)
	for {
		childProcess.UpdateLastUsed()
		n, err := reader.Read(buf)
		if err == io.EOF {
			break
		}
		if err != nil {
			logrus.Errorf("Error reading from pipe: %v", err)
			return connect.NewError(connect.CodeInternal, err)
		}

		if err := stream.Send(&apiv1.DownloadResponse{
			Chunk: buf[:n],
		}); err != nil {
			logrus.Errorf("An error occurred while sending data to the client: %v", err)
			return connect.NewError(connect.CodeInternal, err)
		}
	}

	return nil
}

func (f *FileServer) CompressAndDownload(ctx context.Context,
	req *connect.Request[apiv1.CompressAndDownloadRequest],
	stream *connect.ServerStream[apiv1.CompressAndDownloadResponse],
) error {
	if err := fileUtils.ValidateDownloadChunkSize(req.Msg.ChunkSizeByte); err != nil {
		return connect.NewError(connect.CodeInvalidArgument, err)
	}

	childProcess, connectErr := process.GetChildProcess(req.Msg.UserId)
	if connectErr != nil {
		return connect.NewError(connect.CodeInvalidArgument, connectErr)
	}
	defer childProcess.FinishedUsing()

	paths := req.Msg.Paths
	if len(paths) == 0 {
		return connect.NewError(connect.CodeInvalidArgument, errors.New("missing 'paths' parameter"))
	}

	childClient := process.GetChildProcessClient(NewFileServiceClient, childProcess)

	clientReq, err := request.SetSecretHeader(
		&apiv1.CompressAndDownloadRequest{Paths: req.Msg.Paths, ChunkSizeByte: req.Msg.ChunkSizeByte},
		childProcess.GetPort(),
	)
	if err != nil {
		return connect.NewError(
			connect.CodeInternal,
			fmt.Errorf("set secret header for %s error: %v", childProcess.GetPort(), err),
		)
	}

	childStream, err := childClient.CompressAndDownload(ctx, clientReq)
	if err != nil {
		errCode := connect.CodeOf(err)
		switch errCode {
		case connect.CodePermissionDenied:
			logrus.Error("Insufficient permissions to copy",
				req.Msg.UserId, req.Msg.Paths)
		case connect.CodeNotFound:
			logrus.Errorf("path does not exist, %s", req.Msg.Paths)
		default:
			logrus.Error(
				"An unknown error occurred while downloading",
				req.Msg.UserId, req.Msg.Paths)
		}
		return connect.NewError(errCode, err)
	}

	// 使用 io.Pipe 创建读写端
	reader, writer := io.Pipe()

	// 创建一个子上下文，用于管理子 goroutine 的生命周期
	childCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	// 启动 Goroutine 从子流读取数据并写入到 pipe
	go func() {
		defer func() {
			if err := writer.Close(); err != nil {
				logrus.Errorf("Failed to close pipe writer: %v", err)
			}
		}()
		for {
			select {
			case <-childCtx.Done():
				// 上下文被取消，退出 goroutine
				logrus.Info("Context canceled, stopping data transfer")
				return
			default:
				// 尝试接收数据
				if !childStream.Receive() {
					if err := childStream.Err(); err != nil {
						logrus.Errorf("Error receiving from child stream: %v", err)
					}
					return
				}
				chunk := childStream.Msg().Chunk
				if _, err := writer.Write(chunk); err != nil {
					logrus.Errorf("Failed to write to pipe: %v", err)
					return
				}
			}
		}
	}()

	// 启动一个 Goroutine 监听上下文取消事件，并关闭子流
	go func() {
		<-childCtx.Done()
		// 关闭子流以通知子进程停止
		if err := childStream.Close(); err != nil {
			logrus.Errorf("Failed to close child stream on context cancel: %v", err)
		}
	}()

	// 从 pipe 的读端读取数据并发送到客户端
	buf := make([]byte, req.Msg.ChunkSizeByte)
	for {
		childProcess.UpdateLastUsed()
		select {
		case <-ctx.Done():
			// 上下文被取消，停止发送数据
			logrus.Info("Request context canceled, stopping send")
			return connect.NewError(connect.CodeCanceled, ctx.Err())
		default:
			// 尝试读取数据
			n, err := reader.Read(buf)
			if err == io.EOF {
				return nil
			}
			if err != nil {
				logrus.Errorf("Error reading from pipe: %v", err)
				return connect.NewError(connect.CodeInternal, err)
			}

			// 发送数据到客户端
			if err := stream.Send(&apiv1.CompressAndDownloadResponse{
				Chunk: buf[:n],
			}); err != nil {
				// 检查是否是由于上下文取消导致的发送错误
				if errors.Is(err, context.Canceled) {
					logrus.Info("Send operation canceled by client")
					return connect.NewError(connect.CodeCanceled, err)
				}
				logrus.Errorf("An error occurred while sending data to the client: %v", err)
				return connect.NewError(connect.CodeInternal, err)
			}
		}
	}
}

func (f *FileServer) ChangeOwner(
	ctx context.Context,
	req *connect.Request[apiv1.ChangeOwnerRequest],
) (*connect.Response[apiv1.ChangeOwnerResponse], error) {
	logrus.Infof("ChangeOwner path=%s user=%s recursive=%v", req.Msg.Path, req.Msg.UserId, req.Msg.Recursive)

	if req.Msg.Uid == nil && req.Msg.Gid == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("at least one of uid or gid must be specified"))
	}

	if hit, ok := fileUtils.IsRestrictedPath(filepath.Clean(req.Msg.Path)); ok {
		logrus.Errorf("ChangeOwner rejected: path %s is under restricted system directory %s", req.Msg.Path, hit)
		return nil, connect.NewError(connect.CodePermissionDenied,
			fmt.Errorf("operation on system path %s is not allowed", req.Msg.Path))
	}

	if req.Msg.TargetUid == nil {
		// Mode A: change owner/group of all files under path using chown command
		if _, err := os.Lstat(req.Msg.Path); err != nil {
			if os.IsNotExist(err) {
				return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("path %s not found", req.Msg.Path))
			}
			return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("stat path %s: %w", req.Msg.Path, err))
		}
		arg := buildChownArg(req.Msg.Uid, req.Msg.Gid)
		args := make([]string, 0, 3)
		if req.Msg.Recursive {
			args = append(args, "-R")
		}
		args = append(args, arg, req.Msg.Path)
		logrus.Debugf("ChangeOwner Mode A: chown %v", args)
		cmd := exec.CommandContext(ctx, "chown", args...)
		if out, err := cmd.CombinedOutput(); err != nil {
			logrus.Errorf("chown failed for path %s: %v, output: %s", req.Msg.Path, err, string(out))
			return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("chown failed: %w", err))
		}
		logrus.Infof("ChangeOwner Mode A: successfully changed owner for path %s", req.Msg.Path)
	} else {
		// Mode B: forward to child process running as the target user
		targetUser, err := auth.LookupID(fmt.Sprintf("%d", *req.Msg.TargetUid))
		if err != nil {
			logrus.Errorf("ChangeOwner Mode B: failed to lookup user by uid %d: %v", *req.Msg.TargetUid, err)
			return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("lookup user by uid %d: %w", *req.Msg.TargetUid, err))
		}
		logrus.Debugf("ChangeOwner Mode B: resolved targetUid=%d to username=%s", *req.Msg.TargetUid, targetUser.Username)
		return handleFileRequest(ctx, req, targetUser.Username, apiv1connect.FileServiceClient.ChangeOwner)
	}

	return connect.NewResponse(&apiv1.ChangeOwnerResponse{}), nil
}

func (f *FileServer) InitMultipartUpload(ctx context.Context,
	req *connect.Request[apiv1.InitMultipartUploadRequest],
) (*connect.Response[apiv1.InitMultipartUploadResponse], error) {
	return handleFileRequest(ctx, req, req.Msg.UserId, apiv1connect.FileServiceClient.InitMultipartUpload)
}

func (f *FileServer) CompleteMultipartUpload(ctx context.Context,
	req *connect.Request[apiv1.CompleteMultipartUploadRequest],
) (*connect.Response[apiv1.CompleteMultipartUploadResponse], error) {
	return handleFileRequest(ctx, req, req.Msg.UserId, apiv1connect.FileServiceClient.CompleteMultipartUpload)
}
