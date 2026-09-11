package handlers

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"time"

	"scowd/pkg/utils"
	"scowd/pkg/utils/buzhash32"
	fileUtils "scowd/pkg/utils/file"
	"scowd/pkg/utils/storage"
	apiv1 "scowd/protos/gen/api/storage"

	"connectrpc.com/connect"
	"github.com/sirupsen/logrus"
	"github.com/zeebo/xxh3"
)

type FileTransferServer struct {
}

type Chunk struct {
	Start int64
	Size  int64
}

type ChunkHash struct {
	Chunk Chunk
	Hash  []byte
}

// FileTransferContext 文件传输上下文
type FileTransferContext struct {
	server             *FileTransferServer
	filePath           string
	hiddenPath         string
	hiddenFileMetaPath string
	file               *os.File
	hiddenFile         *os.File
	hiddenFileMeta     *os.File
	fileLock           sync.RWMutex // 保护文件操作的读写锁
	metaFileLock       sync.RWMutex // 保护元数据文件操作的读写锁
	chunkSize          uint32
	intervalTree       *utils.IntervalTree
	maxWorkers         int
	workerPool         chan struct{}
	respCh             *utils.SafeChannel[*apiv1.FileTransferResponse]
	sendErr            error
	wg                 sync.WaitGroup
	// 响应发送同步：确保通道关闭后发送协程完成
	respWG         sync.WaitGroup
	respCloseOnce  sync.Once
	isFullTransfer bool // 标识是否为全量传输模式
	// 批量写入状态管理
	batchWriteState struct {
		lastWriteTime time.Time
		pendingCount  int
		mutex         sync.Mutex
	}
	// 差异传输统计
	diffTransferStats struct {
		totalBytes int64 // 文件总大小
		reuseBytes int64 // 复用的字节数
		newBytes   int64 // 新传输的字节数
		mutex      sync.Mutex
	}
}

func (f *FileTransferServer) StartFileTransfer(ctx context.Context,
	req *connect.Request[apiv1.StartFileTransferRequest],
) (*connect.Response[apiv1.StartFileTransferResponse], error) {

	return connect.NewResponse(&apiv1.StartFileTransferResponse{}), nil
}

func (f *FileTransferServer) QueryFileTransfer(ctx context.Context,
	req *connect.Request[apiv1.QueryFileTransferRequest],
) (*connect.Response[apiv1.QueryFileTransferResponse], error) {
	return connect.NewResponse(&apiv1.QueryFileTransferResponse{}), nil
}

func (f *FileTransferServer) TerminateFileTransfer(ctx context.Context,
	req *connect.Request[apiv1.TerminateFileTransferRequest],
) (*connect.Response[apiv1.TerminateFileTransferResponse], error) {
	return connect.NewResponse(&apiv1.TerminateFileTransferResponse{}), nil
}

func (f *FileTransferServer) FileTransfer(
	ctx context.Context,
	stream *connect.BidiStream[apiv1.FileTransferRequest, apiv1.FileTransferResponse],
) error {
	logrus.Info("New file transfer connection established")

	// 初始化传输上下文
	transferCtx := f.initTransferContext()
	transferCtx.server = f
	defer transferCtx.cleanup()

	// 启动响应发送协程
	transferCtx.startResponseSender(stream)

	// 处理传输请求
	return transferCtx.processTransferRequests(ctx, stream)
}

// initTransferContext 初始化文件传输上下文
func (f *FileTransferServer) initTransferContext() *FileTransferContext {
	// 使用动态调整的并发控制，根据系统资源设置合理的并发数
	// 初始设置为每个CPU核心2个工作协程，后续会根据文件大小动态调整
	maxWorkers := runtime.NumCPU() * 2
	workerPool := make(chan struct{}, maxWorkers)

	logrus.WithField("max_workers", maxWorkers).Debug("初始化文件传输工作池")

	// 增大响应通道缓冲区，减少阻塞
	respCh := utils.NewSafeChannel[*apiv1.FileTransferResponse](maxWorkers * 4)

	return &FileTransferContext{
		chunkSize:  3 * 1024 * 1024, // 默认的全量传输分块大小
		maxWorkers: maxWorkers,
		workerPool: workerPool,
		respCh:     respCh,
		batchWriteState: struct {
			lastWriteTime time.Time
			pendingCount  int
			mutex         sync.Mutex
		}{lastWriteTime: time.Now()},
	}
}

// cleanup 清理传输上下文资源
func (ctx *FileTransferContext) cleanup() {
	logrus.Debug("cleanup: Starting cleanup process")

	// 先关闭所有文件
	if err := ctx.closeAllFiles(); err != nil {
		logrus.WithError(err).Warn("Error closing files in cleanup")
	}

	// 清理临时文件（隐藏文件和元数据文件）
	if ctx.hiddenPath != "" {
		if err := os.Remove(ctx.hiddenPath); err != nil && !os.IsNotExist(err) {
			logrus.WithError(err).Warn("Failed to remove hidden file during cleanup")
		} else {
			logrus.WithField("hidden_path", ctx.hiddenPath).Debug("Hidden file removed during cleanup")
		}
	}

	// 清理元数据文件
	if ctx.hiddenFileMetaPath != "" {
		if err := os.Remove(ctx.hiddenFileMetaPath); err != nil && !os.IsNotExist(err) {
			logrus.WithError(err).Warn("Failed to remove metadata file during cleanup")
		} else {
			logrus.WithField("metadata_path", ctx.hiddenFileMetaPath).Debug("Metadata file removed during cleanup")
		}
	}

	// 关闭工作池
	if ctx.workerPool != nil {
		close(ctx.workerPool)
		logrus.Debug("cleanup: Worker pool closed")
	}

	// 关闭响应通道
	if ctx.respCh != nil {
		ctx.respCh.Close()
		logrus.Debug("cleanup: Response channel closed")
		// 等待响应发送协程退出，确保所有消息已发送
		ctx.respWG.Wait()
		logrus.Debug("cleanup: Response sender goroutine completed")
	}

	logrus.Debug("cleanup: Cleanup process completed")
}

// startResponseSender 启动响应发送协程
func (ctx *FileTransferContext) startResponseSender(stream *connect.BidiStream[apiv1.FileTransferRequest, apiv1.FileTransferResponse]) {
	logrus.Debug("Starting response sender goroutine")
	ctx.respWG.Add(1)
	go func() {
		defer ctx.respWG.Done()
		logrus.Debug("startResponseSender: Starting response sender goroutine")
		for resp := range ctx.respCh.Receive() {
			if ctx.sendErr != nil { // Stop sending if error exists
				logrus.WithError(ctx.sendErr).Debug("Stopping response sender due to previous error")
				return
			}
			logrus.Debug("Sending response to client")
			if err := stream.Send(resp); err != nil && ctx.sendErr == nil {
				logrus.WithError(err).Error("Failed to send response to client")
				ctx.sendErr = err
			} else {
				logrus.Debug("Response sent successfully to client")
			}
		}
		logrus.Debug("Response channel closed, response sender exiting")
	}()
}

// processTransferRequests 处理传输请求主循环
func (ctx *FileTransferContext) processTransferRequests(cancelCtx context.Context, stream *connect.BidiStream[apiv1.FileTransferRequest, apiv1.FileTransferResponse]) error {
	for {
		// Check for cancellation
		select {
		case <-cancelCtx.Done():
			return cancelCtx.Err()
		default:
		}

		if ctx.sendErr != nil { // Early loop termination
			break
		}

		// Use timeout-enabled receive
		req, err := ctx.receiveWithTimeout(stream)
		if err != nil {
			if err == io.EOF {
				break
			}
			if err.Error() == "接收请求超时" {
				ctx.sendErrorFunc("Transfer terminated due to long period of inactivity")
				return connect.NewError(connect.CodeDeadlineExceeded, err)
			}
			logrus.WithError(err).Error("Failed to receive request")
			ctx.sendErrorFunc(fmt.Sprintf("Failed to receive request: %v", err))
			return connect.NewError(connect.CodeInternal, err)
		}

		// 处理不同类型的请求
		if err := ctx.handleRequest(req); err != nil {
			return err
		}

		// 检查是否完成传输
		if ctx.isTransferComplete(req) {
			break
		}
	}

	return nil
}

// sendErrorFunc 发送错误消息
func (ctx *FileTransferContext) sendErrorFunc(errMsg string) {
	logrus.WithField("error_message", errMsg).Debug("Sending error response")
	err := ctx.respCh.Send(&apiv1.FileTransferResponse{
		ResponseType: &apiv1.FileTransferResponse_Error_{
			Error: &apiv1.FileTransferResponse_Error{
				Message: errMsg,
			},
		},
	})
	if err != nil {
		logrus.WithFields(logrus.Fields{
			"error_message": errMsg,
			"send_error":    err,
		}).Error("Failed to send error response")
	} else {
		logrus.WithField("error_message", errMsg).Debug("Error response sent successfully")
	}

	// 关闭响应通道并等待发送协程退出，确保错误消息已发送
	ctx.respCloseOnce.Do(func() {
		ctx.respCh.Close()
		logrus.Debug("sendErrorFunc: Response channel closed to flush error")
	})
	ctx.respWG.Wait()
}

// receiveWithTimeout 带超时的接收函数
func (ctx *FileTransferContext) receiveWithTimeout(stream *connect.BidiStream[apiv1.FileTransferRequest, apiv1.FileTransferResponse]) (*apiv1.FileTransferRequest, error) {
	ctxTimeout, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	type result struct {
		req *apiv1.FileTransferRequest
		err error
	}
	resCh := make(chan result, 1)
	go func() {
		defer close(resCh)
		req, err := stream.Receive()
		select {
		case resCh <- result{req, err}:
		default:
		}
	}()
	select {
	case res := <-resCh:
		return res.req, res.err
	case <-ctxTimeout.Done():
		ctx.respCh.Close()
		return nil, fmt.Errorf("接收请求超时")
	}
}

// isTransferComplete 检查传输是否完成
func (ctx *FileTransferContext) isTransferComplete(req *apiv1.FileTransferRequest) bool {
	_, isComplete := req.RequestType.(*apiv1.FileTransferRequest_TransferComplete_)
	_, isTerminated := req.RequestType.(*apiv1.FileTransferRequest_TransferTerminated_)
	return isComplete || isTerminated
}

// handleRequest 处理请求
func (ctx *FileTransferContext) handleRequest(req *apiv1.FileTransferRequest) error {
	switch msg := req.RequestType.(type) {
	case *apiv1.FileTransferRequest_Meta_:
		return ctx.handleMetaRequest(msg.Meta)
	case *apiv1.FileTransferRequest_ReuseChunk_:
		return ctx.handleReuseChunkRequest(msg.ReuseChunk)
	case *apiv1.FileTransferRequest_Chunk_:
		return ctx.handleChunkRequest(msg.Chunk)
	case *apiv1.FileTransferRequest_TransferComplete_:
		return ctx.handleTransferComplete()
	case *apiv1.FileTransferRequest_TransferTerminated_:
		return ctx.handleTransferTerminated()
	default:
		return connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("unknown request type"))
	}
}

// handleMetaRequest 处理元数据请求
func (ctx *FileTransferContext) handleMetaRequest(meta *apiv1.FileTransferRequest_Meta) error {
	logrus.WithFields(logrus.Fields{
		"file_path": meta.FilePath,
		"file_size": meta.FileSizeBytes,
	}).Info("Received file metadata request from client")

	if ctx.filePath != "" {
		logrus.WithField("file_path", ctx.filePath).Warn("Duplicate file metadata request received")
		ctx.sendErrorFunc("Duplicate file metadata request")
		return connect.NewError(connect.CodeInvalidArgument, errors.New("duplicate metadata"))
	}

	ctx.filePath = meta.FilePath

	// 构造隐藏文件名
	dir := filepath.Dir(meta.FilePath)
	base := filepath.Base(meta.FilePath)
	ctx.hiddenPath = filepath.Join(dir, ".scowd_cluster_file_transfer."+base)
	ctx.hiddenFileMetaPath = ctx.hiddenPath + ".meta"

	logrus.WithFields(logrus.Fields{
		"file_path":   meta.FilePath,
		"hidden_path": ctx.hiddenPath,
	}).Debug("Constructed file paths")

	// 先检查文件是否存在
	fileInfo, err := os.Stat(meta.FilePath)
	if os.IsNotExist(err) {
		logrus.WithField("file_path", meta.FilePath).Debug("File does not exist, starting new file transfer")
		return ctx.handleNewFile(meta)
	} else if err != nil {
		logrus.WithFields(logrus.Fields{
			"file_path": meta.FilePath,
			"error":     err,
		}).Error("Failed to check file existence")
		ctx.sendErrorFunc(fmt.Sprintf("Failed to check file existence: %v", err))
		return connect.NewError(connect.CodeInternal, err)
	}

	// 文件存在，处理差异传输
	logrus.WithFields(logrus.Fields{
		"file_path": meta.FilePath,
		"file_size": fileInfo.Size(),
	}).Debug("File exists, starting existing file transfer")
	return ctx.handleExistingFile(meta)
}

// handleNewFile 处理新文件创建
func (ctx *FileTransferContext) handleNewFile(meta *apiv1.FileTransferRequest_Meta) error {
	logrus.WithField("file_path", meta.FilePath).Debug("Starting handleNewFile")

	// 创建隐藏文件用于接收数据
	hiddenFile, err := os.OpenFile(ctx.hiddenPath, os.O_RDWR|os.O_CREATE, 0644)
	if err != nil {
		logrus.WithFields(logrus.Fields{
			"hidden_path": ctx.hiddenPath,
			"error":       err,
		}).Error("Failed to create temporary file")
		ctx.sendErrorFunc(fmt.Sprintf("Failed to create temporary file: %v", err))
		return connect.NewError(connect.CodeInternal, err)
	}
	ctx.hiddenFile = hiddenFile
	logrus.WithField("hidden_path", ctx.hiddenPath).Debug("Hidden file created successfully")

	logrus.WithFields(logrus.Fields{
		"hidden_path": ctx.hiddenPath,
		"file_size":   meta.FileSizeBytes,
	}).Debug("Allocating hidden file space")

	// 预分配隐藏文件空间
	if err := hiddenFile.Truncate(meta.FileSizeBytes); err != nil {
		if isStorageError, connectErr := handleStorageError(err, "allocating hidden file space", ctx.hiddenPath); isStorageError {
			logrus.WithFields(logrus.Fields{
				"hidden_path": ctx.hiddenPath,
				"error":       err,
			}).Error("Storage error while allocating hidden file space")
			ctx.sendErrorFunc(fmt.Sprintf("Storage error while allocating hidden file space: %v", err))
			return connectErr
		}
		logrus.WithFields(logrus.Fields{
			"hidden_path": ctx.hiddenPath,
			"error":       err,
		}).Error("Failed to allocate hidden file space")
		ctx.sendErrorFunc(fmt.Sprintf("Failed to allocate hidden file space: %v", err))
		return connect.NewError(connect.CodeInternal, err)
	}

	logrus.WithField("hidden_path", ctx.hiddenPath).Debug("Hidden file space allocated successfully")

	// 对于新文件，默认使用全量传输，不需要创建元数据文件和intervalTree
	// 这些只在差异传输时才需要
	ctx.hiddenFileMeta = nil
	ctx.intervalTree = nil

	// 开启全量传输
	logrus.WithFields(logrus.Fields{
		"file_path":  meta.FilePath,
		"chunk_size": ctx.chunkSize,
		"file_size":  meta.FileSizeBytes,
	}).Info("File not found, start full file transfer")

	logrus.WithFields(logrus.Fields{
		"file_path":  meta.FilePath,
		"chunk_size": ctx.chunkSize,
	}).Debug("About to send FullTransferAction response")

	err = ctx.respCh.Send(&apiv1.FileTransferResponse{
		ResponseType: &apiv1.FileTransferResponse_FullTransferAction_{
			FullTransferAction: &apiv1.FileTransferResponse_FullTransferAction{
				ChunkSizeBytes: ctx.chunkSize,
			},
		},
	})
	if err != nil {
		logrus.WithFields(logrus.Fields{
			"file_path": meta.FilePath,
			"error":     err,
		}).Error("Failed to send full transfer action")
		ctx.sendErrorFunc(fmt.Sprintf("Failed to send full transfer action: %v", err))
		return connect.NewError(connect.CodeInternal, err)
	}
	logrus.WithFields(logrus.Fields{
		"file_path":  meta.FilePath,
		"chunk_size": ctx.chunkSize,
	}).Info("Successfully sent full transfer action to client")
	return nil
}

// createMetadataFile 创建并初始化metadata文件和intervalTree
func (ctx *FileTransferContext) createMetadataFile() error {
	// 创建隐藏文件的元数据文件
	hiddenFileMeta, err := os.OpenFile(ctx.hiddenFileMetaPath, os.O_RDWR|os.O_CREATE, 0644)
	if err != nil {
		logrus.WithFields(logrus.Fields{
			"hidden_path": ctx.hiddenPath,
			"error":       err,
		}).Error("Failed to create temporary metadata file")
		ctx.sendErrorFunc(fmt.Sprintf("Failed to create temporary metadata file: %v", err))
		return connect.NewError(connect.CodeInternal, err)
	}
	ctx.hiddenFileMeta = hiddenFileMeta

	// 初始化 intervalTree
	intervalTree, err := utils.InitIntervalTree(hiddenFileMeta)
	// 元数据文件异常则清空元数据文件
	if err != nil {
		if err := hiddenFileMeta.Truncate(0); err != nil {
			if isStorageError, connectErr := handleStorageError(err, "truncating metadata file", ctx.hiddenFileMetaPath); isStorageError {
				logrus.WithFields(logrus.Fields{
					"hidden_meta_path": ctx.hiddenFileMetaPath,
					"error":            err,
				}).WithError(connectErr).Error("Storage error while truncating temporary metadata file")
				// 注意：这里不返回错误，因为这是清理操作
			} else {
				logrus.WithFields(logrus.Fields{
					"hidden_meta_path": ctx.hiddenFileMetaPath,
					"error":            err,
				}).Error("Failed to truncate temporary metadata file")
			}
		}
	}
	ctx.intervalTree = intervalTree
	return nil
}

// startDiffTransferWithMetadata 启动差异传输（包含metadata文件创建）
func (ctx *FileTransferContext) startDiffTransferWithMetadata(meta *apiv1.FileTransferRequest_Meta, fileInfo os.FileInfo) error {
	// 创建metadata文件
	if err := ctx.createMetadataFile(); err != nil {
		return err
	}

	// 调用原来的差异传输逻辑
	return ctx.startDiffTransfer(meta, fileInfo)
}

// handleExistingFile 处理已存在的文件
func (ctx *FileTransferContext) handleExistingFile(meta *apiv1.FileTransferRequest_Meta) error {
	// 文件存在，直接打开
	file, err := os.OpenFile(meta.FilePath, os.O_RDWR, 0644)
	if err != nil {
		ctx.sendErrorFunc(fmt.Sprintf("Failed to open file: %v", err))
		return connect.NewError(connect.CodeInternal, err)
	}
	ctx.file = file

	// 创建隐藏文件
	hiddenFile, err := os.OpenFile(ctx.hiddenPath, os.O_RDWR|os.O_CREATE, 0644)
	if err != nil {
		logrus.WithFields(logrus.Fields{
			"hidden_path": ctx.hiddenPath,
			"error":       err,
		}).Error("Failed to create temporary file")
		ctx.sendErrorFunc(fmt.Sprintf("Failed to create temporary file: %v", err))
		return connect.NewError(connect.CodeInternal, err)
	}
	ctx.hiddenFile = hiddenFile

	// 预分配文件空间
	if err := hiddenFile.Truncate(meta.FileSizeBytes); err != nil {
		if isStorageError, connectErr := handleStorageError(err, "allocating hidden file space", ctx.hiddenPath); isStorageError {
			logrus.WithFields(logrus.Fields{
				"hidden_path": ctx.hiddenPath,
				"error":       err,
			}).Error("Storage error while allocating hidden file space")
			ctx.sendErrorFunc(fmt.Sprintf("Storage error while allocating hidden file space: %v", err))
			return connectErr
		}
		logrus.WithFields(logrus.Fields{
			"hidden_path": ctx.hiddenPath,
			"error":       err,
		}).Error("Failed to allocate file space")
		ctx.sendErrorFunc(fmt.Sprintf("Failed to allocate file space: %v", err))
		return connect.NewError(connect.CodeInternal, err)
	}

	fileInfo, err := file.Stat()
	if err != nil {
		logrus.WithError(err).Error("Failed to get file info")
		ctx.sendErrorFunc(fmt.Sprintf("Failed to get file info: %v", err))
		return connect.NewError(connect.CodeInternal, err)
	}

	// 判断文件大小，小于10GB时直接传输整个文件
	const tenGB = 10 * 1024 * 1024 * 1024
	if meta.FileSizeBytes < tenGB {
		return ctx.startFullTransfer(meta, fileInfo)
	} else {
		return ctx.startDiffTransferWithMetadata(meta, fileInfo)
	}
}

// startFullTransfer 启动全量传输
func (ctx *FileTransferContext) startFullTransfer(meta *apiv1.FileTransferRequest_Meta, fileInfo os.FileInfo) error {
	logrus.WithFields(logrus.Fields{
		"file":            meta.FilePath,
		"file_size_bytes": fileInfo.Size(),
	}).Info("Start full transfer")

	// 设置为全量传输模式
	ctx.isFullTransfer = true

	// 全量传输模式下不需要元数据文件和区间树，清理相关资源
	if ctx.hiddenFileMeta != nil {
		if err := ctx.hiddenFileMeta.Close(); err != nil {
			logrus.Errorf("Failed to close hidden file metadata: %v", err)
		}
		ctx.hiddenFileMeta = nil
	}
	ctx.intervalTree = nil

	err := ctx.respCh.Send(&apiv1.FileTransferResponse{
		ResponseType: &apiv1.FileTransferResponse_FullTransferAction_{
			FullTransferAction: &apiv1.FileTransferResponse_FullTransferAction{
				ChunkSizeBytes: ctx.chunkSize,
			},
		},
	})
	if err != nil {
		logrus.WithError(err).Error("Failed to send full transfer action")
		ctx.sendErrorFunc(fmt.Sprintf("Failed to send full transfer action: %v", err))
		return connect.NewError(connect.CodeInternal, err)
	}
	return nil
}

// startDiffTransfer 启动差异传输
func (ctx *FileTransferContext) startDiffTransfer(meta *apiv1.FileTransferRequest_Meta, fileInfo os.FileInfo) error {
	logrus.WithFields(logrus.Fields{
		"file":            meta.FilePath,
		"file_size_bytes": fileInfo.Size(),
	}).Info("Start diff transfer")

	// 初始化差异传输统计
	ctx.diffTransferStats.mutex.Lock()
	ctx.diffTransferStats.totalBytes = meta.FileSizeBytes
	ctx.diffTransferStats.reuseBytes = 0
	ctx.diffTransferStats.newBytes = 0
	ctx.diffTransferStats.mutex.Unlock()

	logrus.WithFields(logrus.Fields{
		"file_path":       meta.FilePath,
		"file_size_bytes": meta.FileSizeBytes,
		"chunk_size":      fileUtils.DynamicChunk(fileInfo.Size(), meta.FilePath),
	}).Info("Starting differential transfer mode, will track data reuse statistics")

	// 设置为差异传输模式
	ctx.isFullTransfer = false

	ctx.chunkSize = fileUtils.DynamicChunk(fileInfo.Size(), meta.FilePath)

	// 计算并发送块哈希
	err := ctx.server.calculateAndSendChunkHashes(
		ctx.file, ctx.hiddenFile, ctx.chunkSize, &ctx.fileLock, ctx.intervalTree, ctx.respCh)
	if err != nil {
		logrus.WithError(err).Error("Failed to calculate and send chunk hashes")
		ctx.sendErrorFunc(fmt.Sprintf("Failed to calculate and send chunk hashes: %v", err))
		return connect.NewError(connect.CodeInternal, err)
	}

	err = ctx.respCh.Send(&apiv1.FileTransferResponse{
		ResponseType: &apiv1.FileTransferResponse_StartDiffTransfer_{
			StartDiffTransfer: &apiv1.FileTransferResponse_StartDiffTransfer{
				ChunkSizeBytes: ctx.chunkSize,
			},
		},
	})
	if err != nil {
		logrus.WithError(err).Error("Failed to send start diff transfer action")
		ctx.sendErrorFunc(fmt.Sprintf("Failed to send start diff transfer action: %v", err))
		return connect.NewError(connect.CodeInternal, err)
	}
	return nil
}

// handleReuseChunkRequest 处理块复用请求
func (ctx *FileTransferContext) handleReuseChunkRequest(c *apiv1.FileTransferRequest_ReuseChunk) error {
	logrus.WithFields(logrus.Fields{
		"target_start_bytes": c.TargetStartBytes,
	}).Debug("handleReuseChunkRequest: Starting reuse chunk request processing")

	// 增加WaitGroup计数，表示有一个chunk请求正在处理
	ctx.wg.Add(1)
	defer func() {
		logrus.Debug("handleReuseChunkRequest: Completing reuse chunk request processing")
		ctx.wg.Done()
	}()

	// 获取工作池令牌，控制并发
	ctx.workerPool <- struct{}{}
	defer func() { <-ctx.workerPool }()

	// 全量传输模式下不应该有块复用请求
	if ctx.isFullTransfer {
		ctx.sendErrorFunc("Full transfer mode does not support chunk reuse")
		return connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("full transfer mode does not support chunk reuse"))
	}

	// 检查偏移量是否已上传
	uploaded, err := ctx.server.isOffsetUploaded(c.TargetStartBytes, int64(ctx.chunkSize), ctx.intervalTree)
	if err != nil {
		ctx.sendErrorFunc(fmt.Sprintf("Failed to check if offset is uploaded: %v", err))
		return connect.NewError(connect.CodeInternal, err)
	}
	if uploaded {
		// 已上传，直接发送确认
		return ctx.sendChunkConfirmation(c.TargetStartBytes, ctx.chunkSize)
	}

	// 从源文件复制块到隐藏文件
	return ctx.copyChunkFromSource(c)
}

// sendChunkConfirmation 发送块确认响应
func (ctx *FileTransferContext) sendChunkConfirmation(offsetBytes int64, chunkSizeBytes uint32) error {
	return ctx.respCh.Send(&apiv1.FileTransferResponse{
		ResponseType: &apiv1.FileTransferResponse_ChunkAck_{
			ChunkAck: &apiv1.FileTransferResponse_ChunkAck{
				StartBytes:     offsetBytes,
				ChunkSizeBytes: chunkSizeBytes,
			},
		},
	})
}

// copyChunkFromSource 从源文件复制块到隐藏文件
func (ctx *FileTransferContext) copyChunkFromSource(chunk *apiv1.FileTransferRequest_ReuseChunk) error {
	ctx.fileLock.Lock()
	defer ctx.fileLock.Unlock()

	// 从源文件读取数据
	buffer := make([]byte, ctx.chunkSize)
	n, err := ctx.file.ReadAt(buffer, chunk.SourceStartBytes)
	if err != nil && err != io.EOF {
		logrus.WithError(err).Error("Failed to read from source file")
		ctx.sendErrorFunc(fmt.Sprintf("Failed to read from source file: %v", err))
		return connect.NewError(connect.CodeInternal, err)
	}

	// 写入隐藏文件
	_, err = ctx.hiddenFile.WriteAt(buffer[:n], chunk.TargetStartBytes)
	if err != nil {
		if isStorageError, connectErr := handleStorageError(err, "writing reused chunk to hidden file", ctx.hiddenPath); isStorageError {
			logrus.WithError(err).Error("Storage error while writing reused chunk to hidden file")
			ctx.sendErrorFunc(fmt.Sprintf("Storage error while writing reused chunk to hidden file: %v", err))
			return connectErr
		}
		logrus.WithError(err).Error("Failed to write to hidden file")
		ctx.sendErrorFunc(fmt.Sprintf("Failed to write to hidden file: %v", err))
		return connect.NewError(connect.CodeInternal, err)
	}

	// 只有在差异传输模式下且元数据文件存在时才记录已上传的块
	if !ctx.isFullTransfer && ctx.hiddenFileMeta != nil && ctx.intervalTree != nil {
		err = ctx.server.recordUploadedChunk(ctx, ctx.hiddenFileMeta, &ctx.metaFileLock, chunk.TargetStartBytes, int64(n), ctx.intervalTree)
		if err != nil {
			logrus.WithError(err).Error("Failed to record uploaded chunk")
		}
	}

	// 统计复用的数据量
	if !ctx.isFullTransfer {
		ctx.diffTransferStats.mutex.Lock()
		ctx.diffTransferStats.reuseBytes += int64(n)
		ctx.diffTransferStats.mutex.Unlock()

		logrus.WithFields(logrus.Fields{
			"reused_bytes":       n,
			"total_reused_bytes": ctx.diffTransferStats.reuseBytes,
		}).Debug("Tracking reused data chunk")
	}

	// 同步文件
	if err := ctx.hiddenFile.Sync(); err != nil {
		logrus.WithError(err).Error("Failed to sync hidden file")
	}

	return ctx.sendChunkConfirmation(chunk.TargetStartBytes, uint32(n))
}

// handleChunkRequest 处理数据块请求
func (ctx *FileTransferContext) handleChunkRequest(c *apiv1.FileTransferRequest_Chunk) error {
	logrus.WithFields(logrus.Fields{
		"start_bytes": c.StartBytes,
		"data_size":   len(c.Data),
	}).Debug("handleChunkRequest: Starting chunk request processing")

	// 增加WaitGroup计数，表示有一个chunk请求正在处理
	ctx.wg.Add(1)
	defer func() {
		logrus.Debug("handleChunkRequest: Completing chunk request processing")
		ctx.wg.Done()
	}()

	// 获取工作池令牌，控制并发
	ctx.workerPool <- struct{}{}
	defer func() { <-ctx.workerPool }()

	logrus.WithFields(logrus.Fields{
		"start_bytes": c.StartBytes,
		"data_size":   len(c.Data),
		"file_path":   ctx.filePath,
		"data_prefix": fmt.Sprintf("%x", c.Data[:min(8, len(c.Data))]),
	}).Debug("Server received data chunk")

	ctx.fileLock.Lock()
	defer ctx.fileLock.Unlock()

	// 写入数据块
	n, err := ctx.hiddenFile.WriteAt(c.Data, c.StartBytes)
	if err != nil {
		if isStorageError, connectErr := handleStorageError(err, "writing chunk data", ctx.hiddenPath); isStorageError {
			logrus.WithError(err).Error("Storage error while writing chunk data")
			ctx.sendErrorFunc(fmt.Sprintf("Storage error while writing chunk data: %v", err))
			return connectErr
		}
		logrus.WithError(err).Error("Failed to write chunk data")
		ctx.sendErrorFunc(fmt.Sprintf("Failed to write chunk data: %v", err))
		return connect.NewError(connect.CodeInternal, err)
	}

	// 只有在差异传输模式下且元数据文件存在时才记录已上传的块
	if !ctx.isFullTransfer && ctx.hiddenFileMeta != nil && ctx.intervalTree != nil {
		err = ctx.server.recordUploadedChunk(ctx, ctx.hiddenFileMeta, &ctx.metaFileLock, c.StartBytes, int64(n), ctx.intervalTree)
		if err != nil {
			logrus.WithError(err).Error("Failed to record uploaded chunk")
		}
	}

	// 统计新传输的数据量
	if !ctx.isFullTransfer {
		ctx.diffTransferStats.mutex.Lock()
		ctx.diffTransferStats.newBytes += int64(n)
		ctx.diffTransferStats.mutex.Unlock()

		logrus.WithFields(logrus.Fields{
			"new_bytes":       n,
			"total_new_bytes": ctx.diffTransferStats.newBytes,
		}).Debug("Tracking new transferred data chunk")
	}

	// 同步文件
	if err := ctx.hiddenFile.Sync(); err != nil {
		logrus.WithError(err).Error("Failed to sync hidden file")
	}

	return ctx.sendChunkConfirmation(c.StartBytes, uint32(n))
}

// handleTransferComplete 处理传输完成请求
func (ctx *FileTransferContext) handleTransferComplete() error {
	logrus.Info("handleTransferComplete: Starting transfer completion process")

	// 等待所有chunk请求处理完成
	logrus.Info("handleTransferComplete: Waiting for all chunk requests to complete...")
	ctx.wg.Wait()
	logrus.Info("handleTransferComplete: All chunk requests completed, proceeding with file operations")

	ctx.fileLock.Lock()
	defer ctx.fileLock.Unlock()

	// 关闭所有文件
	if err := ctx.closeAllFiles(); err != nil {
		logrus.WithError(err).Warn("Error closing files")
	}

	// 在NFS上需要更长的延迟
	time.Sleep(500 * time.Millisecond)

	if storage.IsOnNFS(ctx.filePath) {
		// NFS: 使用复制方式
		err := ctx.atomicReplaceFile(ctx.hiddenPath, ctx.filePath)
		if err != nil {
			logrus.WithError(err).Error("Failed to replace original file")
			ctx.sendErrorFunc(fmt.Sprintf("Failed to replace original file: %v", err))
			return connect.NewError(connect.CodeInternal, err)
		}
	} else {
		// 本地文件系统: 使用rename
		err := os.Rename(ctx.hiddenPath, ctx.filePath)
		if err != nil {
			logrus.WithError(err).Error("Failed to replace original file")
			ctx.sendErrorFunc(fmt.Sprintf("Failed to replace original file: %v", err))
			return connect.NewError(connect.CodeInternal, err)
		}
	}

	// 只有在差异传输模式下才删除元数据文件
	if !ctx.isFullTransfer && ctx.hiddenFileMetaPath != "" {
		if err := os.Remove(ctx.hiddenFileMetaPath); err != nil && !os.IsNotExist(err) {
			logrus.WithError(err).Warn("Failed to remove metadata file")
		}
	}

	// 记录差异传输的数据复用比例统计
	if !ctx.isFullTransfer {
		ctx.diffTransferStats.mutex.Lock()
		totalBytes := ctx.diffTransferStats.totalBytes
		reuseBytes := ctx.diffTransferStats.reuseBytes
		newBytes := ctx.diffTransferStats.newBytes
		ctx.diffTransferStats.mutex.Unlock()

		var reuseRatio float64
		if totalBytes > 0 {
			reuseRatio = float64(reuseBytes) / float64(totalBytes) * 100
		}

		logrus.WithFields(logrus.Fields{
			"file_path":           ctx.filePath,
			"total_bytes":         totalBytes,
			"reused_bytes":        reuseBytes,
			"new_bytes":           newBytes,
			"reuse_ratio_percent": fmt.Sprintf("%.2f%%", reuseRatio),
		}).Info("Differential transfer completed, data reuse statistics")
	}

	logrus.WithFields(logrus.Fields{
		"source_path": ctx.hiddenPath,
		"target_path": ctx.filePath,
	}).Info("File transfer completed successfully")

	return nil
}

// handleTransferTerminated 处理传输终止请求
func (ctx *FileTransferContext) handleTransferTerminated() error {
	// 等待所有chunk请求处理完成
	ctx.wg.Wait()

	ctx.fileLock.Lock()
	defer ctx.fileLock.Unlock()

	// 关闭所有文件
	if err := ctx.closeAllFiles(); err != nil {
		logrus.WithError(err).Warn("Error closing files during termination")
	}

	// 延迟确保文件句柄释放
	time.Sleep(300 * time.Millisecond)

	// 直接删除临时文件
	if err := os.Remove(ctx.hiddenPath); err != nil && !os.IsNotExist(err) {
		logrus.WithError(err).Warn("Failed to remove hidden file")
	}

	// 只有在差异传输模式下才删除元数据文件
	if !ctx.isFullTransfer && ctx.hiddenFileMetaPath != "" {
		if err := os.Remove(ctx.hiddenFileMetaPath); err != nil && !os.IsNotExist(err) {
			logrus.WithError(err).Warn("Failed to remove metadata file")
		}
	}

	logrus.WithField("hidden_path", ctx.hiddenPath).Info("File transfer terminated and cleanup completed")

	return nil
}

// 缓冲区池，减少内存分配
var chunkBufferPool = sync.Pool{
	New: func() interface{} {
		// 预分配8MB缓冲区，足够处理大多数块
		buf := make([]byte, 8*1024*1024)
		return &buf
	},
}

// isOffsetUploaded 检查指定偏移量的块是否已上传
func (f *FileTransferServer) isOffsetUploaded(
	offset int64,
	size int64,
	intervalTree *utils.IntervalTree,
) (bool, error) {
	if intervalTree == nil {
		return false, fmt.Errorf("interval tree is empty")
	}

	// 查询区间树判断块是否已上传
	interval := intervalTree.FindContaining(offset)
	if interval == nil {
		return false, nil
	}

	chunkEnd := offset + size - 1
	logrus.WithFields(logrus.Fields{
		"interval_end": interval.End,
		"chunk_end":    chunkEnd,
		"offset":       offset,
		"size":         size,
	}).Debug("Checking if chunk is uploaded")

	return interval.End >= chunkEnd, nil
}

// recordUploadedChunk 记录已上传的块到元数据文件，使用批量处理提高效率
func (f *FileTransferServer) recordUploadedChunk(ctx *FileTransferContext,
	hiddenFileMeta *os.File, lock *sync.RWMutex, offset int64, size int64, intervalTree *utils.IntervalTree) error {
	if hiddenFileMeta == nil {
		return fmt.Errorf("metadata file is empty")
	}

	if lock == nil {
		return fmt.Errorf("lock object is empty")
	}

	if intervalTree == nil {
		return fmt.Errorf("interval tree is empty")
	}

	// 记录开始时间，用于性能监控
	startTime := time.Now()

	// 创建新区间
	newInterval := utils.Interval{Start: offset, End: offset + size - 1}

	// 使用写锁保护区间树操作
	lock.Lock()
	defer lock.Unlock()

	// 插入新区间
	intervalTree.Insert(newInterval)

	// 使用批量合并策略，减少IO操作
	// 只有当满足以下条件之一时才执行合并和写入操作：
	// 1. 当前区间与已有区间有大量重叠
	// 2. 累积的未写入区间数量超过阈值
	// 3. 距离上次写入时间超过阈值
	ctx.batchWriteState.mutex.Lock()
	pendingCount := ctx.batchWriteState.pendingCount + 1
	lastWriteTime := ctx.batchWriteState.lastWriteTime
	ctx.batchWriteState.pendingCount = pendingCount
	ctx.batchWriteState.mutex.Unlock()

	// 确定是否需要执行合并写入操作
	needMergeWrite := pendingCount >= 10 || // 累积10个未写入区间
		time.Since(lastWriteTime) > 500*time.Millisecond // 距离上次写入超过500ms

	if !needMergeWrite {
		// 快速路径：仅插入区间，不执行合并和写入
		return nil
	}

	// 重置计数器和时间戳
	ctx.batchWriteState.mutex.Lock()
	ctx.batchWriteState.pendingCount = 0
	ctx.batchWriteState.lastWriteTime = time.Now()
	ctx.batchWriteState.mutex.Unlock()

	// 执行合并操作
	mergedIntervals := intervalTree.MergeIntervals()

	// 原子性写入元数据文件：先写入临时文件，再重命名
	tempMetadataPath := hiddenFileMeta.Name() + ".tmp"
	tempFile, err := os.Create(tempMetadataPath)
	if err != nil {
		return fmt.Errorf("failed to create temporary metadata file: %w", err)
	}
	defer func() {
		if err := tempFile.Close(); err != nil {
			logrus.Errorf("Failed to close temp file: %v", err)
		}
		if err := os.Remove(tempMetadataPath); err != nil {
			logrus.Errorf("Failed to remove temp metadata file: %v", err)
		} // 清理临时文件
	}()

	// 使用缓冲写入提高性能
	writer := bufio.NewWriter(tempFile)
	for _, interval := range mergedIntervals {
		_, err := fmt.Fprintf(writer, "%d %d\n", interval.Start, interval.End)
		if err != nil {
			return fmt.Errorf("failed to write interval data: %w", err)
		}
	}

	// 刷新缓冲区
	if err := writer.Flush(); err != nil {
		return fmt.Errorf("failed to flush buffer: %w", err)
	}

	// 确保数据持久化
	if err := tempFile.Sync(); err != nil {
		return fmt.Errorf("failed to sync temporary metadata file: %w", err)
	}

	// 关闭临时文件
	if err := tempFile.Close(); err != nil {
		if isStorageError, connectErr := handleStorageError(err, "closing temporary metadata file", tempMetadataPath); isStorageError {
			return connectErr
		}
		return fmt.Errorf("failed to close temporary metadata file: %w", err)
	}

	// 原子性重命名
	if err := os.Rename(tempMetadataPath, hiddenFileMeta.Name()); err != nil {
		return fmt.Errorf("failed to rename metadata file: %w", err)
	}

	// 记录执行时间
	elapsed := time.Since(startTime)
	if elapsed > 100*time.Millisecond {
		// 仅当操作耗时较长时记录日志，避免日志过多
		logrus.WithFields(logrus.Fields{
			"offset":          offset,
			"size":            size,
			"intervals_count": len(mergedIntervals),
			"elapsed_ms":      elapsed.Milliseconds(),
			"batch_mode":      true,
		}).Info("Batch recording of uploaded chunks completed")
	}

	return nil
}

func (f *FileTransferServer) calculateAndSendChunkHashes(
	file *os.File,
	hiddenFile *os.File,
	chunkSize uint32,
	fileLock *sync.RWMutex,
	intervalTree *utils.IntervalTree,
	respCh *utils.SafeChannel[*apiv1.FileTransferResponse],
) error {
	if file == nil {
		return fmt.Errorf("file handle is nil")
	}

	// 获取文件大小
	fileInfo, err := file.Stat()
	if err != nil {
		return fmt.Errorf("failed to get file info: %w", err)
	}
	fileSize := fileInfo.Size()

	// 动态调整工作池大小，根据文件大小和系统资源
	workerCount := calculateOptimalWorkers(fileSize)
	logrus.WithFields(logrus.Fields{
		"file_size": fileSize,
		"workers":   workerCount,
	}).Info("Dynamically adjusting hash calculation worker pool size")

	workerPool := make(chan struct{}, workerCount)
	var wg sync.WaitGroup

	// 创建错误通道
	errCh := make(chan error, workerCount)
	defer close(errCh)

	// 分段处理，将文件分成多个段并行处理
	segmentCount := calculateOptimalSegments(fileSize)

	// 确保段大小是chunkSize的整数倍，这样除最后一段外，每段的最后一块大小正好等于chunkSize
	chunkSizeInt64 := int64(chunkSize)
	// 先计算初始段大小
	segmentSize := fileSize / int64(segmentCount)
	// 向上取整为chunkSize的整数倍
	segmentSize = ((segmentSize + chunkSizeInt64 - 1) / chunkSizeInt64) * chunkSizeInt64

	// 如果段大小小于chunkSize，则使用chunkSize作为段大小
	if segmentSize < chunkSizeInt64 {
		segmentSize = chunkSizeInt64
	}

	// 重新计算段数
	segmentCount = int(fileSize / segmentSize)
	if fileSize%segmentSize > 0 {
		segmentCount++
	}

	logrus.WithFields(logrus.Fields{
		"segments":     segmentCount,
		"segment_size": segmentSize,
		"chunk_size":   chunkSize,
	}).Info("File segmentation parallel processing")

	// 预处理队列，用于存储预先计算的哈希结果
	type hashResult struct {
		offset     int64
		weakHash   uint32
		strongHash []byte
	}
	// 使用带缓冲的通道存储预处理结果，缓冲大小为工作池大小的2倍
	preprocessQueue := make(chan hashResult, workerCount*2)
	var preprocessWg sync.WaitGroup

	// 启动发送协程，从预处理队列获取结果并发送
	preprocessWg.Add(1)
	go func() {
		defer preprocessWg.Done()
		for result := range preprocessQueue {
			// 发送哈希值
			err := respCh.Send(&apiv1.FileTransferResponse{
				ResponseType: &apiv1.FileTransferResponse_ChunkHash_{
					ChunkHash: &apiv1.FileTransferResponse_ChunkHash{
						StartBytes: result.offset,
						WeakHash:   result.weakHash,
						StrongHash: result.strongHash,
					},
				},
			})
			if err != nil {
				errCh <- fmt.Errorf("failed to send chunk hash: %w", err)
				return
			}
		}
	}()

	// 为每个段启动一个处理协程
	for i := 0; i < segmentCount; i++ {
		segmentStart := int64(i) * segmentSize
		segmentEnd := segmentStart + segmentSize
		if segmentEnd > fileSize || i == segmentCount-1 {
			segmentEnd = fileSize
		}

		// 等待工作池中有可用的worker
		workerPool <- struct{}{}
		wg.Add(1)

		go func(segStart, segEnd int64) {
			defer func() {
				wg.Done()
				<-workerPool
			}()

			// 使用对象池获取缓冲区
			buf := chunkBufferPool.Get().(*[]byte)
			defer chunkBufferPool.Put(buf)

			// 如果缓冲区大小小于块大小，则重新分配
			if cap(*buf) < int(chunkSize) {
				*buf = make([]byte, chunkSize)
			}
			*buf = (*buf)[:chunkSize]

			// 处理当前段内的所有块
			for offset := segStart; offset < segEnd; {
				// 计算当前块的实际大小
				remaining := segEnd - offset
				currentChunkSize := int64(chunkSize)
				if remaining < int64(chunkSize) {
					currentChunkSize = remaining
					*buf = (*buf)[:currentChunkSize]
				}

				// 加读锁读取文件块
				fileLock.RLock()
				var n int
				var readErr error
				var useHiddenFile bool

				// 如果hiddenFile存在，尝试从hiddenFile读取数据
				if hiddenFile != nil {
					useHiddenFile, readErr = f.isOffsetUploaded(offset, currentChunkSize, intervalTree)
					if readErr != nil {
						fileLock.RUnlock()
						errCh <- fmt.Errorf("failed to check offset uploaded: %w", readErr)
						return
					}
					if useHiddenFile {
						n, readErr = hiddenFile.ReadAt(*buf, offset)
						logrus.WithFields(logrus.Fields{
							"offset":      offset,
							"size":        n,
							"source":      "hiddenFile",
							"data_prefix": fmt.Sprintf("%x", (*buf)[:min(8, n)]),
						}).Debug("Server reading data for hash calculation")
					}
				}

				// 如果不使用hiddenFile的数据，则从原始文件读取
				if !useHiddenFile {
					n, readErr = file.ReadAt(*buf, offset)
					logrus.WithFields(logrus.Fields{
						"offset":      offset,
						"size":        n,
						"source":      "originalFile",
						"data_prefix": fmt.Sprintf("%x", (*buf)[:min(8, n)]),
					}).Debug("Server reading data for hash calculation")
				}
				fileLock.RUnlock()

				if readErr != nil && readErr != io.EOF {
					errCh <- fmt.Errorf("failed to read file at offset %d: %w", offset, readErr)
					return
				}
				if n == 0 {
					break
				}

				// 创建新的哈希计算器实例
				weakHash := buzhash32.New()

				// 计算弱哈希
				_, err := weakHash.Write((*buf)[:n])
				if err != nil {
					errCh <- fmt.Errorf("failed to calculate weak hash: %w", err)
					return
				}
				weakHashValue := weakHash.Sum32()

				// 计算强哈希
				hasher := xxh3.New()
				_, _ = hasher.Write((*buf)[:n])
				strongHashValue := hasher.Sum(nil)

				// 将结果放入预处理队列
				select {
				case preprocessQueue <- hashResult{
					offset:     offset,
					weakHash:   weakHashValue,
					strongHash: strongHashValue[:],
				}:
					// 成功放入队列
				case <-time.After(500 * time.Millisecond):
					// 如果队列满且超时，直接发送
					err := respCh.Send(&apiv1.FileTransferResponse{
						ResponseType: &apiv1.FileTransferResponse_ChunkHash_{
							ChunkHash: &apiv1.FileTransferResponse_ChunkHash{
								StartBytes: offset,
								WeakHash:   weakHashValue,
								StrongHash: strongHashValue[:],
							},
						},
					})
					if err != nil {
						errCh <- fmt.Errorf("failed to send chunk hash directly: %w", err)
						return
					}
				}

				offset += int64(n)

				// 检查是否有错误发生
				select {
				case err := <-errCh:
					// 有错误发生，提前退出
					errCh <- err
					close(preprocessQueue)
					return
				default:
					// 继续处理
				}
			}
		}(segmentStart, segmentEnd)
	}

	// 等待所有处理协程完成
	wg.Wait()
	// 关闭预处理队列
	close(preprocessQueue)
	// 等待发送协程完成
	preprocessWg.Wait()

	// 最终检查是否有错误
	select {
	case err := <-errCh:
		return err
	default:
		return nil
	}
}

// calculateOptimalWorkers 根据文件大小和系统资源计算最优工作协程数
func calculateOptimalWorkers(fileSize int64) int {
	baseCPU := runtime.NumCPU()

	// 根据文件大小动态调整，专注于大文件场景
	switch {
	case fileSize > 100<<30: // >100GB
		// 对于超大型文件，平衡并发数和系统资源
		// 避免创建过多协程导致资源竞争
		workers := baseCPU * 3
		if workers > 20 {
			workers = 20 // 设置上限避免过度并发
		}
		return workers

	case fileSize > 10<<30: // >10GB
		// 中等大型文件，可以使用较高并发
		workers := baseCPU * 4
		if workers > 16 {
			workers = 16 // 合理上限
		}
		return workers

	default: // 1GB-10GB文件
		// 相对较小的文件，适度并发
		return baseCPU * 2
	}
}

// calculateOptimalSegments 计算文件的最优分段数
func calculateOptimalSegments(fileSize int64) int {
	baseCPU := runtime.NumCPU()
	segments := 12

	// 根据文件大小调整策略
	switch {
	case fileSize > 100<<30: // >100GB
		// 超大型文件，分段数适度增加但设置上限
		maxSegments := baseCPU * 6
		if segments > maxSegments {
			segments = maxSegments
		}
		if segments < 12 {
			segments = 12 // 保证最小并发度
		}

	case fileSize > 10<<30: // >10GB
		// 大型文件，平衡分段数和系统资源
		maxSegments := baseCPU * 4
		if segments > maxSegments {
			segments = maxSegments
		}
		if segments < 8 {
			segments = 8
		}

	default: // 1GB-10GB文件
		maxSegments := baseCPU * 2
		if segments > maxSegments {
			segments = maxSegments
		}
	}

	return int(segments)
}

// 添加一个关闭所有文件的辅助函数
func (ctx *FileTransferContext) closeAllFiles() error {
	var lastErr error

	// 关闭原始文件
	if ctx.file != nil {
		if err := ctx.file.Close(); err != nil {
			logrus.WithError(err).Warn("Failed to close original file")
			lastErr = err
		}
		ctx.file = nil
	}

	// 关闭隐藏文件
	if ctx.hiddenFile != nil {
		if err := ctx.hiddenFile.Sync(); err != nil {
			logrus.WithError(err).Warn("Failed to sync hidden file")
			lastErr = err
		}
		if err := ctx.hiddenFile.Close(); err != nil {
			logrus.WithError(err).Warn("Failed to close hidden file")
			lastErr = err
		}
		ctx.hiddenFile = nil
	}

	// 关闭元数据文件
	if ctx.hiddenFileMeta != nil {
		if err := ctx.hiddenFileMeta.Sync(); err != nil {
			logrus.WithError(err).Warn("Failed to sync metadata file")
			lastErr = err
		}
		if err := ctx.hiddenFileMeta.Close(); err != nil {
			logrus.WithError(err).Warn("Failed to close metadata file")
			lastErr = err
		}
		ctx.hiddenFileMeta = nil
	}

	return lastErr
}

// atomicReplaceFile 原子性替换文件（避免NFS rename问题）
func (ctx *FileTransferContext) atomicReplaceFile(src, dst string) error {
	// 1. 打开源文件
	srcFile, err := os.Open(src)
	if err != nil {
		return fmt.Errorf("failed to open source file: %w", err)
	}
	defer func() {
		if closeErr := srcFile.Close(); closeErr != nil {
			logrus.WithError(closeErr).Warn("Failed to close source file")
		}
	}()

	// 2. 创建临时目标文件
	tmpDst := dst + ".tmp." + fmt.Sprintf("%d", time.Now().UnixNano())
	dstFile, err := os.Create(tmpDst)
	if err != nil {
		return fmt.Errorf("failed to create temp destination file: %w", err)
	}

	// 3. 复制数据
	_, err = io.Copy(dstFile, srcFile)
	if err != nil {
		if closeErr := dstFile.Close(); closeErr != nil {
			logrus.WithError(closeErr).Warn("Failed to close destination file during error handling")
		}
		if removeErr := os.Remove(tmpDst); removeErr != nil {
			logrus.WithError(removeErr).Warn("Failed to remove temp file during error handling")
		}
		return fmt.Errorf("failed to copy data: %w", err)
	}

	// 4. 同步并关闭目标文件
	if err := dstFile.Sync(); err != nil {
		if closeErr := dstFile.Close(); closeErr != nil {
			logrus.WithError(closeErr).Warn("Failed to close destination file during sync error handling")
		}
		if removeErr := os.Remove(tmpDst); removeErr != nil {
			logrus.WithError(removeErr).Warn("Failed to remove temp file during sync error handling")
		}
		return fmt.Errorf("failed to sync destination file: %w", err)
	}
	if closeErr := dstFile.Close(); closeErr != nil {
		logrus.WithError(closeErr).Warn("Failed to close destination file after sync")
	}

	// 5. 关闭源文件
	if closeErr := srcFile.Close(); closeErr != nil {
		logrus.WithError(closeErr).Warn("Failed to close source file explicitly")
	}

	// 6. 原子性重命名（临时文件到目标文件）
	if err := os.Rename(tmpDst, dst); err != nil {
		// 如果rename失败，尝试先删除目标文件再重命名
		if removeErr := os.Remove(dst); removeErr != nil {
			logrus.WithError(removeErr).Warn("Failed to remove destination file before retry")
		}
		if err := os.Rename(tmpDst, dst); err != nil {
			if removeErr := os.Remove(tmpDst); removeErr != nil {
				logrus.WithError(removeErr).Warn("Failed to remove temp file after rename failure")
			}
			return fmt.Errorf("failed to rename temp file: %w", err)
		}
	}

	// 7. 删除源文件
	if err := os.Remove(src); err != nil {
		logrus.WithError(err).Warn("Failed to remove source file, may leave .nfs file")
		// 不返回错误，因为主要操作已完成
	}

	return nil
}
