package handlers

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sync"

	"scowd/internal/api/utils"
	"scowd/internal/api/utils/process"
	customError "scowd/internal/api/rpcerror"
	"scowd/internal/storage/filetransfer"
	"scowd/internal/process/parent"

	apiv1 "scowd/protos/gen/api/storage"
	"scowd/protos/gen/api/storage/apiv1connect"

	"connectrpc.com/connect"
	"github.com/sirupsen/logrus"
)

type FileTransferServer struct {
	transferTaskManager *filetransfer.TaskManager
}

func NewFileTransferServer(manager *filetransfer.TaskManager) *FileTransferServer {
	return &FileTransferServer{
		transferTaskManager: manager,
	}
}

func NewFileTransferServiceClient(httpClient *http.Client, url string) apiv1connect.FileTransferServiceClient {
	return apiv1connect.NewFileTransferServiceClient(httpClient, url)
}

func (s *FileTransferServer) StartFileTransfer(ctx context.Context,
	req *connect.Request[apiv1.StartFileTransferRequest],
) (*connect.Response[apiv1.StartFileTransferResponse], error) {
	logFields := logrus.Fields{
		"user_id":      req.Msg.UserId,
		"source_path":  req.Msg.SourcePath,
		"dest_path":    req.Msg.DestPath,
		"dest_address": req.Msg.DestAddress,
	}
	logrus.WithFields(logFields).Info("Starting file transfer task")

	// 创建文件传输任务并添加到任务管理器
	task := filetransfer.NewFileTransfer(
		"", req.Msg.UserId, req.Msg.SourcePath, req.Msg.DestPath, req.Msg.DestAddress, s.transferTaskManager.TLSConfig,
	)

	if err := s.transferTaskManager.AddTask(task, 0); err != nil {
		logrus.WithFields(logFields).WithError(err).Error("Failed to add file transfer task")
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	logrus.WithFields(logFields).Info("File transfer task added successfully")
	return connect.NewResponse(&apiv1.StartFileTransferResponse{}), nil
}

func (s *FileTransferServer) QueryFileTransfer(ctx context.Context,
	req *connect.Request[apiv1.QueryFileTransferRequest],
) (*connect.Response[apiv1.QueryFileTransferResponse], error) {
	logrus.WithField("user_id", req.Msg.UserId).Debug("Querying file transfer status")

	// 清理用户的已完成和已终止任务记录
	if err := s.transferTaskManager.CleanupCompletedAndTerminatedTasks(req.Msg.UserId); err != nil {
		logrus.WithFields(logrus.Fields{
			"user_id": req.Msg.UserId,
			"error":   err,
		}).Warn("Failed to cleanup completed and terminated task records")
		// 清理失败不影响查询操作，继续执行
	}

	// 获取用户所有正在进行和pending的传输任务
	activeTasks := s.transferTaskManager.GetUserActiveAndPendingTasks(req.Msg.UserId)

	// 构建 TransferInfo 列表
	var transferInfos []*apiv1.TransferInfo
	for _, task := range activeTasks {
		// 更新任务的资源使用情况
		task.UpdateResourceUsage()

		// 获取基本传输信息
		transferInfo := &apiv1.TransferInfo{
			ToCluster:            task.GetDestAddress(),
			FilePath:             task.GetSourcePath(),
			TransferSizeKb:       task.GetTransferSizeKB(),
			Progress:             uint32(task.GetProgress() * 100), // 转换为百分比
			SpeedKBps:            task.GetTransferSpeedKBps(),
			RemainingTimeSeconds: uint64(task.GetRemainingTimeSeconds()),
		}

		transferInfos = append(transferInfos, transferInfo)
	}

	logrus.WithFields(logrus.Fields{
		"user_id":    req.Msg.UserId,
		"task_count": len(transferInfos),
	}).Debug("Retrieved active transfer tasks")

	return connect.NewResponse(&apiv1.QueryFileTransferResponse{
		TransferInfos: transferInfos,
	}), nil
}

func (s *FileTransferServer) TerminateFileTransfer(ctx context.Context,
	req *connect.Request[apiv1.TerminateFileTransferRequest],
) (*connect.Response[apiv1.TerminateFileTransferResponse], error) {
	logFields := logrus.Fields{
		"user_id":     req.Msg.UserId,
		"source_path": req.Msg.SourcePath,
		// "dest_path":    req.Msg.DestPath,
		"dest_address": req.Msg.DestAddress,
	}
	logrus.WithFields(logFields).Info("Terminating file transfer task")

	// 根据用户ID、源文件路径、目标文件路径和目标地址终止匹配的任务
	if err := s.transferTaskManager.StopUserTasksByPath(
		req.Msg.UserId,
		req.Msg.SourcePath,
		req.Msg.DestAddress,
	); err != nil {
		logrus.WithFields(logFields).WithError(err).Error("Failed to terminate file transfer task")
		return nil, connect.NewError(connect.CodeNotFound, err)
	}

	logrus.WithFields(logFields).Info("File transfer task terminated successfully")
	return connect.NewResponse(&apiv1.TerminateFileTransferResponse{}), nil
}

func (s *FileTransferServer) FileTransfer(
	ctx context.Context,
	stream *connect.BidiStream[apiv1.FileTransferRequest, apiv1.FileTransferResponse],
) error {
	var (
		childClient apiv1connect.FileTransferServiceClient
		childStream *connect.BidiStreamForClient[apiv1.FileTransferRequest, apiv1.FileTransferResponse]
		wg          sync.WaitGroup
		userID      string
	)

	defer func() {
		wg.Wait() // Ensure all goroutines are completed
		if childStream != nil {
			_ = childStream.CloseRequest()  // Safely close request stream
			_ = childStream.CloseResponse() // Safely close response stream
		}
	}()

	for {
		req, err := stream.Receive()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			logrus.WithFields(logrus.Fields{
				"user_id": userID,
				"error":   err,
			}).Error("Failed to receive file transfer request")
			return connect.NewError(connect.CodeInternal, fmt.Errorf("failed to receive request: %w", err))
		}

		switch msg := req.RequestType.(type) {
		case *apiv1.FileTransferRequest_Meta_:
			if childStream != nil {
				logrus.Warn("Received duplicate Connect request")
				continue
			}
			userID = msg.Meta.UserId

			// Create child process (with error wrapping)
			childProcess, err := parent.GlobalChildProcessManager.GetOrCreateChildProcess(userID)
			if err != nil {
				logrus.Errorf("Failed to create child process: %v", err)
				return connect.NewError(
					connect.CodeInternal,
					fmt.Errorf("%w: %v", errors.New(customError.MainStartChildProcessError), err),
				)
			}
			defer childProcess.FinishedUsing()

			childClient = process.GetChildProcessClient(NewFileTransferServiceClient, childProcess)
			childStream = childClient.FileTransfer(ctx)
			if childStream == nil {
				return connect.NewError(connect.CodeUnavailable, errors.New("failed to create child stream"))
			}

			// Start bidirectional forwarding goroutine
			wg.Add(1)
			go func() {
				defer wg.Done()
				for {
					res, err := childStream.Receive()
					childProcess.UpdateLastUsed()

					if err != nil {
						if errors.Is(err, io.EOF) {
							// 客户端已经用 CloseRequest() 半关写侧，所有消息都读完了
							logrus.WithField("user", userID).Debug("Child stream received EOF, all messages processed")
							break
						}
						logrus.WithFields(logrus.Fields{
							"error": err,
							"user":  userID,
						}).Error("Failed to receive response from child stream")
						return
					}

					if sendErr := stream.Send(res); sendErr != nil {
						logrus.WithFields(logrus.Fields{
							"error": sendErr,
							"user":  userID,
						}).Error("Failed to send response to client")
						return
					}
				}
			}()

			err = childStream.Send(req)
			if err != nil {
				return connect.NewError(connect.CodeUnavailable,
					fmt.Errorf("child process connection failed: %w", err))
			}
		case *apiv1.FileTransferRequest_Chunk_:
			if childStream == nil {
				return connect.NewError(connect.CodeFailedPrecondition,
					errors.New("child stream not initialized"))
			}

			if err := childStream.Send(req); err != nil {
				return utils.WrapStreamError("Failed to send chunk", err)
			}
		case *apiv1.FileTransferRequest_ReuseChunk_:
			if childStream == nil {
				return connect.NewError(connect.CodeFailedPrecondition,
					errors.New("child stream not initialized"))
			}

			if err := childStream.Send(req); err != nil {
				return utils.WrapStreamError("Failed to send reuse chunk", err)
			}
		case *apiv1.FileTransferRequest_TransferComplete_:
			if childStream == nil {
				return connect.NewError(connect.CodeFailedPrecondition,
					errors.New("child stream not initialized"))
			}

			if err := childStream.Send(req); err != nil {
				return utils.WrapStreamError("Failed to send TransferComplete request", err)
			}

			if err := childStream.CloseRequest(); err != nil {
				logrus.Warnf("Failed to close child stream: %v, user: %s", err, userID)
			}

			return nil
		case *apiv1.FileTransferRequest_TransferTerminated_:
			if childStream == nil {
				return connect.NewError(connect.CodeFailedPrecondition,
					errors.New("child stream not initialized"))
			}

			if err := childStream.Send(req); err != nil {
				return utils.WrapStreamError("Failed to send TransferTerminated request", err)
			}

			if err := childStream.CloseRequest(); err != nil {
				logrus.Warnf("Failed to close child stream: %v, user: %s", err, userID)
			}

			return nil
		default:
			return connect.NewError(connect.CodeInvalidArgument,
				errors.New("unknown message type"))
		}
	}
}
