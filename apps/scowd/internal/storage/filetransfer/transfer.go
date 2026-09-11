// Package filetransfer provides functionality for transferring files between clusters,
// including task management, progress tracking, and differential transfer capabilities.
package filetransfer

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"

	"scowd/internal/config"
	"scowd/internal/utils"
	"scowd/internal/utils/client"
	fileUtils "scowd/internal/storage/file"
	apiv1 "scowd/protos/gen/api/storage"
	"scowd/protos/gen/api/storage/apiv1connect"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
)

// TransferSpeedRecord 传输速率记录
type TransferSpeedRecord struct {
	timestamp int64 // 时间戳
	bytes     int64 // 传输字节数
}

// CancelReason 取消原因枚举
type CancelReason int

const (
	CancelReasonNone           CancelReason = iota // 未取消
	CancelReasonUser                               // 用户手动取消
	CancelReasonSystemShutdown                     // 系统关闭
)

type FileTransferTask struct {
	id                 string // 任务唯一标识符
	userID             string // 执行传输任务的用户
	sourcePath         string // 源文件路径
	destPath           string // 目标路径
	destAddress        string // 目标集群
	stream             *connect.BidiStreamForClient[apiv1.FileTransferRequest, apiv1.FileTransferResponse]
	tlsConfig          config.ServerTLS
	destFileClient     apiv1connect.FileServiceClient         // 目标集群客户端，用于复用
	destTransferClient apiv1connect.FileTransferServiceClient // 目标集群客户端，用于复用

	totalBytes   int64 // 所有文件的总字节数
	intervalTree *utils.IntervalTree
	subTasks     []*FileTransferTask // 子任务列表，用于目录传输
	isDirectory  bool                // 是否为目录传输任务
	mutex        sync.Mutex          // 用于保护进度更新
	priority     int                 // 任务优先级
	transferRate int64               // 当前传输速率（字节/秒）
	startTime    int64               // 传输开始时间
	cancelCtx    context.Context
	cancel       context.CancelFunc
	cancelReason CancelReason // 取消原因

	// 传输速率统计相关字段
	speedRecords    []TransferSpeedRecord // 最近的传输速率记录
	speedRecordsTTL time.Duration         // 速率记录保留时间（默认10秒）
	lastSpeedUpdate int64                 // 上次更新速率的时间戳

	// 进度缓存相关字段
	cachedProgress     float64       // 缓存的进度值
	lastProgressUpdate time.Time     // 上次更新进度的时间
	progressCacheTTL   time.Duration // 进度缓存有效期
}

func newFileServiceClient(httpClient *http.Client, url string) apiv1connect.FileServiceClient {
	return apiv1connect.NewFileServiceClient(httpClient, url)
}

func newFileTransferServiceClient(httpClient *http.Client, url string) apiv1connect.FileTransferServiceClient {
	return apiv1connect.NewFileTransferServiceClient(httpClient, url)
}

func NewFileTransfer(
	id, userID, sourcePath, destPath, destAddress string, tlsConfig config.ServerTLS,
) *FileTransferTask {
	ctx, cancel := context.WithCancel(context.Background())
	if id == "" {
		id = uuid.New().String()
	}
	return &FileTransferTask{
		id:           id,
		userID:       userID,
		sourcePath:   sourcePath,
		destPath:     destPath,
		destAddress:  destAddress,
		tlsConfig:    tlsConfig,
		cancelCtx:    ctx,
		cancel:       cancel,
		cancelReason: CancelReasonNone, // 初始化为未取消
		// 初始化进度缓存，设置缓存有效期为500毫秒
		progressCacheTTL: 500 * time.Millisecond,
		// 初始化传输速率统计字段
		speedRecords:    make([]TransferSpeedRecord, 0),
		speedRecordsTTL: 10 * time.Second, // 保留最近10秒的记录
		lastSpeedUpdate: 0,
	}
}

func (ft *FileTransferTask) SyncFile() error {
	logrus.Infof("Starting file transfer task: %s -> %s", ft.sourcePath, ft.destPath)

	// 检查用户对源文件的读取权限
	if err := fileUtils.CheckFileReadPermission(ft.userID, ft.sourcePath); err != nil {
		logrus.WithFields(logrus.Fields{
			"user_id":     ft.userID,
			"source_path": ft.sourcePath,
			"error":       err,
		}).Error("Permission check failed during transfer")
		return fmt.Errorf("insufficient permissions: %w", err)
	}

	// 检查源文件是否能正常读取
	fileInfo, err := os.Stat(ft.sourcePath)
	if err != nil {
		return fmt.Errorf("failed to get file info: %w", err)
	}

	// 创建源文件客户端
	if ft.destFileClient == nil {
		ft.destFileClient, err = client.CreateClient(ft.tlsConfig, newFileServiceClient, ft.destAddress)
		if err != nil {
			return fmt.Errorf("failed to create destination cluster client: %w", err)
		}
	}

	if ft.destTransferClient == nil {
		ft.destTransferClient, err = client.CreateClient(ft.tlsConfig, newFileTransferServiceClient, ft.destAddress)
		if err != nil {
			return fmt.Errorf("failed to create destination transfer client: %w", err)
		}
	}

	// 如果是目录，则同步目录，如果目录存在直接报错
	if fileInfo.IsDir() {
		ft.isDirectory = true

		return ft.syncDirectory()
	}

	// 开始传输文件
	file, err := os.Open(ft.sourcePath)
	if err != nil {
		return fmt.Errorf("failed to open file: %w", err)
	}
	defer func() {
		if err := file.Close(); err != nil {
			logrus.Errorf("Failed to close file %s: %v", ft.sourcePath, err)
		}
		file = nil
	}()

	atomic.StoreInt64(&ft.totalBytes, fileInfo.Size())
	ft.intervalTree = &utils.IntervalTree{}
	ft.startTime = time.Now().Unix()

	logrus.Infof("Starting file transfer: %s (size: %d bytes)", ft.sourcePath, fileInfo.Size())

	stream := ft.destTransferClient.FileTransfer(ft.cancelCtx)
	if stream == nil {
		return fmt.Errorf("failed to create file transfer stream")
	}
	ft.stream = stream

	// 创建可取消的context用于错误传播
	errorCtx, cancelOnError := context.WithCancel(ft.cancelCtx)
	defer cancelOnError()

	var (
		wg         sync.WaitGroup
		done                  = make(chan struct{})
		chunkSize  uint32     = 3 * 1024 * 1024 // 3MB
		hashTable             = fileUtils.NewChunkHashTable(fileInfo.Size(), chunkSize, ft.sourcePath)
		lastError  error      // 存储最后发生的错误
		errorMutex sync.Mutex // 保护lastError的并发访问
	)

	// 设置错误的辅助函数
	setError := func(err error) {
		errorMutex.Lock()
		defer errorMutex.Unlock()
		if lastError == nil { // 只记录第一个错误
			lastError = err
			cancelOnError() // 取消context，通知所有goroutine停止
		}
	}

	// 获取错误的辅助函数
	getError := func() error {
		errorMutex.Lock()
		defer errorMutex.Unlock()
		return lastError
	}

	reqCh := utils.NewSafeChannel[*apiv1.FileTransferRequest](128)
	defer reqCh.Close()

	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case <-errorCtx.Done():
				// 错误发生，停止发送
				return
			case req, ok := <-reqCh.Receive():
				if !ok {
					// 通道已关闭
					return
				}
				if err := stream.Send(req); err != nil {
					logrus.Errorf("send error: %v", err)
					setError(err)
					return
				}
			}
		}
	}()

	// 检查任务是否已被取消
	select {
	case <-errorCtx.Done():
		// 任务被取消或发生错误
		err = reqCh.Send(&apiv1.FileTransferRequest{
			RequestType: &apiv1.FileTransferRequest_TransferTerminated_{},
		})
		if err != nil {
			return fmt.Errorf("failed to send termination message: %w", err)
		}
		if lastErr := getError(); lastErr != nil {
			return fmt.Errorf("task failed: %w", lastErr)
		}
		return fmt.Errorf("task %s terminated by user", ft.id)
	default:
	}

	logrus.WithFields(logrus.Fields{
		"user_id":   ft.userID,
		"task_id":   ft.id,
		"dest_path": ft.destPath,
		"file_size": fileInfo.Size(),
	}).Info("Sending file metadata to server")
	err = reqCh.Send(&apiv1.FileTransferRequest{
		RequestType: &apiv1.FileTransferRequest_Meta_{
			Meta: &apiv1.FileTransferRequest_Meta{
				UserId:        ft.userID,
				FilePath:      path.Join(ft.destPath, path.Base(ft.sourcePath)),
				FileSizeBytes: fileInfo.Size(),
			},
		},
	})
	if err != nil {
		return fmt.Errorf("failed to send meta message: %w", err)
	}
	logrus.WithFields(logrus.Fields{
		"user_id": ft.userID,
		"task_id": ft.id,
	}).Info("Successfully sent file metadata, waiting for server response")

	wg.Add(1)
	go func() {
		defer wg.Done()
		// 检查任务是否已被取消或发生错误
		select {
		case <-errorCtx.Done():
			// 发送终止消息
			_ = reqCh.Send(&apiv1.FileTransferRequest{
				RequestType: &apiv1.FileTransferRequest_TransferTerminated_{},
			})
			if lastErr := getError(); lastErr == nil {
				// 如果没有其他错误，说明是用户取消
				setError(fmt.Errorf("task %s terminated by user", ft.id))
			}
			return
		default:
		}

		for {
			logrus.WithFields(logrus.Fields{
				"user_id": ft.userID,
				"task_id": ft.id,
			}).Debug("Waiting for server response...")

			resp, err := ft.receiveWithTimeout()
			if err == io.EOF {
				logrus.WithFields(logrus.Fields{
					"user_id": ft.userID,
					"task_id": ft.id,
				}).Debug("Received EOF from server")
				return
			}
			if err != nil {
				logrus.WithFields(logrus.Fields{
					"user_id": ft.userID,
					"task_id": ft.id,
					"error":   err,
				}).Error("Failed to receive response from server")
				setError(fmt.Errorf("receive error: %w", err))
				return
			}

			logrus.WithFields(logrus.Fields{
				"user_id":       ft.userID,
				"task_id":       ft.id,
				"response_type": fmt.Sprintf("%T", resp.ResponseType),
			}).Debug("Received response from server")

			switch resp := resp.ResponseType.(type) {
			case *apiv1.FileTransferResponse_Error_:
				logrus.WithFields(logrus.Fields{
					"user_id": ft.userID,
					"task_id": ft.id,
				}).Errorf("server error: %s", resp.Error.Message)

				// 发送TransferTerminated消息通知服务端清理资源
				if err := reqCh.Send(&apiv1.FileTransferRequest{
					RequestType: &apiv1.FileTransferRequest_TransferTerminated_{},
				}); err != nil {
					logrus.WithFields(logrus.Fields{
						"user_id": ft.userID,
						"task_id": ft.id,
					}).Warnf("Failed to send TransferTerminated: %v", err)
				}

				setError(fmt.Errorf("server error: %s", resp.Error.Message))
				return

			case *apiv1.FileTransferResponse_ChunkHash_:
				hashTable.AddChunk(resp.ChunkHash.WeakHash, resp.ChunkHash.StrongHash, resp.ChunkHash.StartBytes)

			case *apiv1.FileTransferResponse_StartDiffTransfer_:
				chunkSize = resp.StartDiffTransfer.ChunkSizeBytes
				go func() {
					if err := StartDiffTransfer(errorCtx, file, reqCh, hashTable, chunkSize, ft); err != nil {
						setError(err)
						// 当StartDiffTransfer出错时，通过context取消通知所有goroutine
					}
				}()

			case *apiv1.FileTransferResponse_FullTransferAction_:
				chunkSize = resp.FullTransferAction.ChunkSizeBytes
				logrus.WithFields(logrus.Fields{
					"user_id":    ft.userID,
					"task_id":    ft.id,
					"chunk_size": chunkSize,
					"file_size":  fileInfo.Size(),
				}).Info("Received FullTransferAction, starting to send chunks")

				// 特殊处理0字节文件：直接发送完成信号
				if fileInfo.Size() == 0 {
					logrus.WithFields(logrus.Fields{
						"user_id": ft.userID,
						"task_id": ft.id,
					}).Info("File size is 0, sending completion signal directly")

					if err := ft.sendCompletionSignal(reqCh); err != nil {
						logrus.WithFields(logrus.Fields{
							"user_id": ft.userID,
							"task_id": ft.id,
							"error":   err,
						}).Error("Failed to send completion signal for empty file")
						setError(err)
					}
					done <- struct{}{}
					return
				} else {
					go func() {
						if err := ft.sendChunk(errorCtx, file, chunkSize, reqCh); err != nil {
							logrus.WithFields(logrus.Fields{
								"user_id": ft.userID,
								"task_id": ft.id,
								"error":   err,
							}).Error("Failed to send chunks")
							setError(err)
						}
					}()
				}

			case *apiv1.FileTransferResponse_ChunkAck_:
				chunk := resp.ChunkAck
				ft.intervalTree.Insert(utils.Interval{
					Start: chunk.StartBytes,
					End:   chunk.StartBytes + int64(chunk.ChunkSizeBytes) - 1,
				})

				// 检查是否完成传输
				if ft.intervalTree.IsComplete(ft.totalBytes - 1) {
					if err := ft.sendCompletionSignal(reqCh); err != nil {
						// 发送完成失败，终止传输
						logrus.WithFields(logrus.Fields{
							"user_id": ft.userID,
							"task_id": ft.id,
						}).Errorf("failed to send completion signal: %v", err)
						setError(fmt.Errorf("failed to send completion signal: %w", err))
						return
					}
					done <- struct{}{}
					return
				}
			default:
				logrus.Infof("unknown message: %v", resp)
			}
		}
	}()

	select {
	case <-done:
		reqCh.Close()
		wg.Wait()
		close(done)
		if closeErr := ft.stream.CloseRequest(); closeErr != nil {
			return fmt.Errorf("failed to close request: %w", closeErr)
		}
		logrus.Infof("File transfer completed successfully: %s", ft.sourcePath)
	case <-errorCtx.Done():
		reqCh.Close()
		wg.Wait()
		err := getError()
		if err == nil {
			err = fmt.Errorf("task cancelled")
		}
		if closeErr := ft.stream.CloseRequest(); closeErr != nil {
			return fmt.Errorf("file transfer interrupted: %w, failed to close request stream: %w", err, closeErr)
		}
		logrus.Errorf("File transfer failed: %s, error: %v", ft.sourcePath, err)
		return fmt.Errorf("file transfer interrupted: %w", err)
	}

	return nil
}

// recordTransferSpeed 记录传输速率
func (ft *FileTransferTask) recordTransferSpeed(bytesTransferred int64) {
	ft.mutex.Lock()
	defer ft.mutex.Unlock()

	now := time.Now().Unix()
	logrus.Debugf("[%s] recordTransferSpeed: recording transfer - bytes=%d, timestamp=%d", ft.id, bytesTransferred, now)

	// 添加新的传输记录
	ft.speedRecords = append(ft.speedRecords, TransferSpeedRecord{
		timestamp: now,
		bytes:     bytesTransferred,
	})
	logrus.Debugf("[%s] recordTransferSpeed: total records after adding=%d", ft.id, len(ft.speedRecords))

	// 清理过期的记录（超过TTL的记录）
	cutoffTime := now - int64(ft.speedRecordsTTL.Seconds())
	validRecords := make([]TransferSpeedRecord, 0, len(ft.speedRecords))
	expiredCount := 0
	for _, record := range ft.speedRecords {
		if record.timestamp >= cutoffTime {
			validRecords = append(validRecords, record)
		} else {
			expiredCount++
		}
	}
	ft.speedRecords = validRecords

	if expiredCount > 0 {
		logrus.Debugf("[%s] recordTransferSpeed: cleaned expired records - expired=%d, remaining=%d, cutoff_time=%d",
			ft.id, expiredCount, len(ft.speedRecords), cutoffTime)
	}

	// 更新最后更新时间
	ft.lastSpeedUpdate = now
	logrus.Debugf("[%s] recordTransferSpeed: update completed - last_update_time=%d", ft.id, ft.lastSpeedUpdate)
}

// calculateCurrentSpeed 计算当前传输速率（字节/秒）
func (ft *FileTransferTask) calculateCurrentSpeed() int64 {
	// 注意：这个方法已经在调用方加了锁，不需要再次加锁

	if len(ft.speedRecords) == 0 {
		logrus.Debugf("[%s] calculateCurrentSpeed: no speed records", ft.id)
		return 0
	}

	now := time.Now().Unix()
	logrus.Debugf("[%s] calculateCurrentSpeed: current_time=%d, record_count=%d", ft.id, now, len(ft.speedRecords))

	// 如果只有一条记录，使用简单的速率计算
	if len(ft.speedRecords) == 1 {
		record := ft.speedRecords[0]
		timeElapsed := now - record.timestamp
		logrus.Debugf("[%s] calculateCurrentSpeed: single record - bytes=%d, timestamp=%d, time_elapsed=%d",
			ft.id, record.bytes, record.timestamp, timeElapsed)
		if timeElapsed <= 0 {
			logrus.Debugf("[%s] calculateCurrentSpeed: time_elapsed<=0, returning 0", ft.id)
			return 0
		}
		speed := record.bytes / timeElapsed
		logrus.Debugf("[%s] calculateCurrentSpeed: single record speed=%d bytes/sec", ft.id, speed)
		return speed
	}

	// 计算最近时间窗口内的传输速率
	var totalBytes int64
	var validRecords []TransferSpeedRecord

	// 只使用最近的记录来计算速度，避免平均化效应
	cutoffTime := now - int64(ft.speedRecordsTTL.Seconds())
	logrus.Debugf("[%s] calculateCurrentSpeed: cutoff_time=%d, ttl=%v", ft.id, cutoffTime, ft.speedRecordsTTL)

	for i, record := range ft.speedRecords {
		if record.timestamp >= cutoffTime {
			validRecords = append(validRecords, record)
			totalBytes += record.bytes
			logrus.Debugf("[%s] calculateCurrentSpeed: valid record[%d] - bytes=%d, timestamp=%d",
				ft.id, i, record.bytes, record.timestamp)
		} else {
			logrus.Debugf("[%s] calculateCurrentSpeed: expired record[%d] - bytes=%d, timestamp=%d",
				ft.id, i, record.bytes, record.timestamp)
		}
	}

	if len(validRecords) == 0 {
		logrus.Debugf("[%s] calculateCurrentSpeed: no valid records", ft.id)
		return 0
	}

	logrus.Debugf("[%s] calculateCurrentSpeed: valid_record_count=%d, total_bytes=%d", ft.id, len(validRecords), totalBytes)

	// 计算时间跨度
	minTime := validRecords[0].timestamp
	maxTime := validRecords[0].timestamp

	for _, record := range validRecords {
		if record.timestamp < minTime {
			minTime = record.timestamp
		}
		if record.timestamp > maxTime {
			maxTime = record.timestamp
		}
	}

	timeSpan := maxTime - minTime
	logrus.Debugf("[%s] calculateCurrentSpeed: time_span=%d (min_time=%d, max_time=%d)",
		ft.id, timeSpan, minTime, maxTime)

	if timeSpan <= 0 {
		// 如果所有记录都在同一秒内，使用总字节数除以1秒
		logrus.Debugf("[%s] calculateCurrentSpeed: time_span<=0, using total_bytes=%d", ft.id, totalBytes)
		return totalBytes
	}

	speed := totalBytes / timeSpan
	logrus.Debugf("[%s] calculateCurrentSpeed: final speed=%d bytes/sec (total_bytes=%d / time_span=%d)",
		ft.id, speed, totalBytes, timeSpan)
	return speed
}

// UpdateResourceUsage 更新任务的资源使用情况
func (ft *FileTransferTask) UpdateResourceUsage() {
	ft.mutex.Lock()
	defer ft.mutex.Unlock()

	// 更新传输速率
	if ft.startTime > 0 {
		// 使用新的速率计算方法
		ft.transferRate = ft.calculateCurrentSpeed()
	}
}

func (ft *FileTransferTask) sendChunk(
	ctx context.Context,
	file *os.File,
	chunkSize uint32,
	reqCh *utils.SafeChannel[*apiv1.FileTransferRequest],
) error {
	var wg sync.WaitGroup

	// 创建一个context用于控制goroutine的生命周期和错误传播
	cancelCtx, cancel := context.WithCancel(ctx)
	var lastError error
	var errorMutex sync.Mutex

	// 设置错误的辅助函数
	setError := func(err error) {
		errorMutex.Lock()
		defer errorMutex.Unlock()
		if lastError == nil {
			lastError = err
			cancel() // 取消context，通知所有goroutine停止
		}
	}

	// 获取错误的辅助函数
	getError := func() error {
		errorMutex.Lock()
		defer errorMutex.Unlock()
		return lastError
	}

	defer func() {
		cancel()  // 确保所有goroutine都能正确退出
		wg.Wait() // 等待所有goroutine完成
	}()

	fileInfo, err := file.Stat()
	if err != nil {
		logrus.WithFields(logrus.Fields{
			"user_id": ft.userID,
			"task_id": ft.id,
			"error":   err,
		}).Error("Failed to get file info in sendChunk")
		return fmt.Errorf("failed to get file info: %w", err)
	}

	logrus.WithFields(logrus.Fields{
		"user_id":    ft.userID,
		"task_id":    ft.id,
		"file_size":  fileInfo.Size(),
		"chunk_size": chunkSize,
	}).Info("Starting to send file chunks")

	// 创建一个本地goroutine池来限制并发数量
	maxConcurrency := 10 // 限制最大并发数
	semaphore := make(chan struct{}, maxConcurrency)

	for offset := int64(0); offset < fileInfo.Size(); offset += int64(chunkSize) {
		end := offset + int64(chunkSize)
		if end > fileInfo.Size() {
			end = fileInfo.Size()
		}

		// 获取信号量
		select {
		case semaphore <- struct{}{}:
		case <-cancelCtx.Done():
			return fmt.Errorf("task cancelled")
		}

		wg.Add(1)
		go func(offset, end int64) {
			defer func() {
				wg.Done()
				<-semaphore // 释放信号量
			}()

			// 检查是否已经有错误发生或任务被取消
			select {
			case <-cancelCtx.Done():
				return
			default:
			}

			// 为每个goroutine创建独立的文件句柄，避免并发读取冲突
			fileClone, err := os.Open(file.Name())
			if err != nil {
				setError(fmt.Errorf("failed to open file clone at offset %d: %w", offset, err))
				return
			}
			defer func() {
				if err := fileClone.Close(); err != nil {
					logrus.Errorf("Failed to close file clone: %v", err)
				}
			}()

			buf := make([]byte, end-offset)
			n, err := fileClone.ReadAt(buf, offset)
			if err != nil && err != io.EOF {
				setError(fmt.Errorf("failed to read file block at offset %d: %w", offset, err))
				return
			}

			// 检查任务是否已被取消
			select {
			case <-cancelCtx.Done():
				// 发送终止消息
				_ = reqCh.Send(&apiv1.FileTransferRequest{
					RequestType: &apiv1.FileTransferRequest_TransferTerminated_{},
				})
				// 如果没有其他错误，设置取消错误
				if getError() == nil {
					setError(fmt.Errorf("task %s terminated by user", ft.id))
				}
				return
			default:
				// 发送数据块
				err := reqCh.Send(&apiv1.FileTransferRequest{
					RequestType: &apiv1.FileTransferRequest_Chunk_{
						Chunk: &apiv1.FileTransferRequest_Chunk{
							StartBytes: offset,
							Data:       buf[:n],
						},
					},
				})
				if err != nil {
					setError(fmt.Errorf("failed to send chunk at offset %d: %w", offset, err))
					return
				}

				// 记录传输速率
				ft.recordTransferSpeed(int64(n))

				logrus.WithFields(logrus.Fields{
					"offset":        offset,
					"size":          n,
					"expected_size": end - offset,
					"data_prefix":   fmt.Sprintf("%x", buf[:min(8, n)]),
				}).Debug("客户端发送数据块")
			}
		}(offset, end)
	}

	// 等待所有goroutine完成
	wg.Wait()
	logrus.WithFields(logrus.Fields{
		"user_id": ft.userID,
		"task_id": ft.id,
	}).Info("Finished sending all chunks")

	// 检查是否有错误发生
	if err := getError(); err != nil {
		return err
	}
	return nil
}

func (ft *FileTransferTask) sendCompletionSignal(reqCh *utils.SafeChannel[*apiv1.FileTransferRequest]) error {
	logrus.Debugf("Sending completion signal for file: %s", ft.sourcePath)

	err := reqCh.Send(&apiv1.FileTransferRequest{
		RequestType: &apiv1.FileTransferRequest_TransferComplete_{},
	})

	return err
}

// calculateDirectorySize 计算目录的总大小
func (ft *FileTransferTask) calculateDirectorySize(dirPath string) (int64, error) {
	var totalSize int64

	err := filepath.Walk(dirPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			totalSize += info.Size()
		}
		return nil
	})

	return totalSize, err
}

func (ft *FileTransferTask) syncDirectory() error {
	logrus.Infof("Starting directory synchronization: %s", ft.sourcePath)

	// 计算目录总大小
	if ft.totalBytes == 0 {
		totalSize, err := ft.calculateDirectorySize(ft.sourcePath)
		if err != nil {
			logrus.WithFields(logrus.Fields{
				"user_id":     ft.userID,
				"task_id":     ft.id,
				"source_path": ft.sourcePath,
				"error":       err,
			}).Error("Failed to calculate directory size")
			return fmt.Errorf("failed to calculate directory size: %w", err)
		}
		atomic.StoreInt64(&ft.totalBytes, totalSize)
		logrus.Infof("Directory total size: %d bytes", totalSize)
	}

	// 构造实际的目标目录路径：目标路径 + 源目录名
	actualDestPath := path.Join(ft.destPath, path.Base(ft.sourcePath))
	logrus.Infof("Creating destination directory: %s", actualDestPath)

	// 检查任务是否已被取消
	select {
	case <-ft.cancelCtx.Done():
		return fmt.Errorf("task %s terminated by user", ft.id)
	default:
	}

	// 创建根目录
	_, err := ft.destFileClient.MakeDirectory(ft.cancelCtx, &connect.Request[apiv1.MakeDirectoryRequest]{
		Msg: &apiv1.MakeDirectoryRequest{
			UserId:  ft.userID,
			DirPath: actualDestPath,
		},
	})
	if err != nil && connect.CodeOf(err) != connect.CodeAlreadyExists {
		return fmt.Errorf("failed to create destination directory %s: %w", actualDestPath, err)
	}

	// 使用filepath.Walk遍历整个目录树，创建扁平化的子任务列表
	var allFiles []string
	var allDirs []string

	err = filepath.Walk(ft.sourcePath, func(walkPath string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// 检查任务是否已被取消
		select {
		case <-ft.cancelCtx.Done():
			return fmt.Errorf("task %s terminated by user", ft.id)
		default:
		}

		// 跳过根目录本身
		if walkPath == ft.sourcePath {
			return nil
		}

		if info.IsDir() {
			allDirs = append(allDirs, walkPath)
		} else {
			allFiles = append(allFiles, walkPath)
		}

		return nil
	})

	if err != nil {
		logrus.WithFields(logrus.Fields{
			"user_id":     ft.userID,
			"task_id":     ft.id,
			"source_path": ft.sourcePath,
		}).Errorf("failed to walk directory: %v", err)
		return fmt.Errorf("failed to walk directory: %w", err)
	}

	logrus.Infof("Found %d directories and %d files to transfer", len(allDirs), len(allFiles))

	// 首先创建所有目录（仅创建叶子目录，父目录由递归创建自动处理）
	// 收集并规范化相对目录路径，去重
	dirSet := make(map[string]struct{}, len(allDirs))
	relDirs := make([]string, 0, len(allDirs))
	for _, dirPath := range allDirs {
		// 计算相对路径
		relPath, err := filepath.Rel(ft.sourcePath, dirPath)
		if err != nil {
			return fmt.Errorf("failed to calculate relative path for %s: %w", dirPath, err)
		}
		relSlash := filepath.ToSlash(relPath)
		if relSlash == "" || relSlash == "." {
			continue
		}
		if _, exists := dirSet[relSlash]; !exists {
			dirSet[relSlash] = struct{}{}
			relDirs = append(relDirs, relSlash)
		}
	}

	// 标记有子目录的父目录
	parents := make(map[string]struct{}, len(relDirs))
	for _, d := range relDirs {
		p := path.Dir(d)
		if p != "." && p != "/" {
			parents[p] = struct{}{}
		}
	}

	// 仅保留叶子目录（不在父目录集合中的目录）
	leafDirs := make([]string, 0, len(relDirs))
	for _, d := range relDirs {
		if _, isParent := parents[d]; !isParent {
			leafDirs = append(leafDirs, d)
		}
	}

	logrus.Debugf("Creating %d leaf directories with recursive creation (parents auto-created)", len(leafDirs))

	for _, rel := range leafDirs {
		// 检查任务是否已被取消
		select {
		case <-ft.cancelCtx.Done():
			return fmt.Errorf("task %s terminated by user", ft.id)
		default:
		}

		// 构造目标目录路径（递归创建）
		destDirPath := path.Join(actualDestPath, rel)

		logrus.Debugf("Creating leaf directory: %s -> %s", path.Join(ft.sourcePath, rel), destDirPath)

		_, err := ft.destFileClient.MakeDirectory(ft.cancelCtx, &connect.Request[apiv1.MakeDirectoryRequest]{
			Msg: &apiv1.MakeDirectoryRequest{
				UserId:  ft.userID,
				DirPath: destDirPath,
			},
		})
		if err != nil && connect.CodeOf(err) != connect.CodeAlreadyExists {
			logrus.WithFields(logrus.Fields{
				"user_id":     ft.userID,
				"task_id":     ft.id,
				"source_path": path.Join(ft.sourcePath, rel),
				"dest_path":   destDirPath,
			}).Errorf("failed to create directory: %v", err)
			return fmt.Errorf("failed to create directory %s: %w", destDirPath, err)
		}
	}

	// 然后处理所有文件，创建扁平化的子任务
	for _, filePath := range allFiles {
		// 检查任务是否已被取消
		select {
		case <-ft.cancelCtx.Done():
			return fmt.Errorf("task %s terminated by user", ft.id)
		default:
		}

		// 计算相对路径
		relPath, err := filepath.Rel(ft.sourcePath, filePath)
		if err != nil {
			return fmt.Errorf("failed to calculate relative path for %s: %w", filePath, err)
		}

		// 构造目标文件的目录路径
		destFileDir := path.Join(actualDestPath, filepath.ToSlash(filepath.Dir(relPath)))

		// 获取文件信息
		fileInfo, err := os.Stat(filePath)
		if err != nil {
			return fmt.Errorf("failed to get file info for %s: %w", filePath, err)
		}

		logrus.WithFields(logrus.Fields{
			"user_id":     ft.userID,
			"task_id":     ft.id,
			"source_path": filePath,
			"dest_dir":    destFileDir,
			"file_size":   fileInfo.Size(),
		}).Debug("Starting file transfer subtask")

		// 创建文件传输子任务
		fileTask := NewFileTransfer(
			"",
			ft.userID,
			filePath,
			destFileDir,
			ft.destAddress,
			ft.tlsConfig,
		)
		fileTask.priority = ft.priority // 继承父任务的优先级

		// 继承父任务的取消上下文和客户端连接
		fileTask.cancelCtx = ft.cancelCtx
		fileTask.cancel = ft.cancel

		// 将子任务添加到主任务的subTasks列表中
		ft.mutex.Lock()
		ft.subTasks = append(ft.subTasks, fileTask)
		ft.mutex.Unlock()

		// 同步执行文件传输任务
		if syncErr := fileTask.SyncFile(); syncErr != nil {
			logrus.WithFields(logrus.Fields{
				"user_id":     ft.userID,
				"task_id":     ft.id,
				"source_path": filePath,
				"dest_path":   destFileDir,
				"error":       syncErr,
			}).Error("File transfer subtask failed")
			return fmt.Errorf("failed to sync file %s: %w", filePath, syncErr)
		}

		logrus.WithFields(logrus.Fields{
			"user_id":     ft.userID,
			"task_id":     ft.id,
			"source_path": filePath,
			"dest_path":   destFileDir,
			"file_size":   fileInfo.Size(),
		}).Debug("File transfer subtask completed successfully")
	}

	logrus.Infof("Directory synchronization completed: %s", ft.sourcePath)
	return nil
}

func (ft *FileTransferTask) GetProgress() float64 {
	ft.mutex.Lock()
	defer ft.mutex.Unlock()

	// 检查缓存是否有效
	if time.Since(ft.lastProgressUpdate) < ft.progressCacheTTL {
		return ft.cachedProgress
	}

	// 缓存过期，重新计算进度
	var progress float64

	if ft.isDirectory {
		// 对于目录传输，使用总字节数计算进度，而不是子任务平均进度
		total := atomic.LoadInt64(&ft.totalBytes)
		if total == 0 {
			progress = 1.0 // 空目录的情况
		} else {
			// 计算所有子任务的已传输字节总和
			var totalTransferred int64
			for _, task := range ft.subTasks {
				if task.intervalTree != nil {
					merged := task.intervalTree.MergeIntervals()
					for _, interval := range merged {
						totalTransferred += interval.End - interval.Start
					}
				}
			}
			progress = float64(totalTransferred) / float64(total)
		}
	} else {
		total := atomic.LoadInt64(&ft.totalBytes)
		if total == 0 {
			progress = 0.0
		} else {
			// 获取已合并的有效传输区间
			merged := ft.intervalTree.MergeIntervals()

			// 计算实际传输字节数（允许断点续传）
			transferred := int64(0)
			for _, interval := range merged {
				transferred += interval.End - interval.Start
			}

			progress = float64(transferred) / float64(total)
		}
	}

	// 确保进度在合理范围内
	if progress > 1.0 {
		progress = 1.0
	} else if progress < 0.0 {
		progress = 0.0
	}

	// 更新缓存
	ft.cachedProgress = progress
	ft.lastProgressUpdate = time.Now()

	// 异步更新资源使用情况，避免阻塞进度查询
	go ft.UpdateResourceUsage()

	return progress
}

// GetID 获取任务ID
func (ft *FileTransferTask) GetID() string {
	return ft.id
}

// GetTransferSizeKB 获取传输文件大小（KB）
func (ft *FileTransferTask) GetTransferSizeKB() uint64 {
	ft.mutex.Lock()
	defer ft.mutex.Unlock()
	return uint64(ft.totalBytes / 1024)
}

// GetTransferSpeedKBps 获取传输速率（KB/s）
func (ft *FileTransferTask) GetTransferSpeedKBps() float32 {
	ft.mutex.Lock()
	defer ft.mutex.Unlock()

	logrus.Debugf("[%s] GetTransferSpeedKBps: starting speed calculation", ft.id)

	if ft.isDirectory {
		// 对于目录传输，计算所有子任务的速度总和
		var totalSpeed int64
		logrus.Debugf("[%s] GetTransferSpeedKBps: directory transfer, calculating subtask speeds", ft.id)

		for _, subTask := range ft.subTasks {
			subSpeed := subTask.calculateCurrentSpeed()
			totalSpeed += subSpeed
			logrus.Debugf("[%s] GetTransferSpeedKBps: subtask %s speed=%d bytes/sec", ft.id, subTask.id, subSpeed)
		}

		logrus.Debugf("[%s] GetTransferSpeedKBps: total directory speed=%d bytes/sec", ft.id, totalSpeed)
		speedKBps := float32(totalSpeed) / 1024.0
		logrus.Debugf("[%s] GetTransferSpeedKBps: final speed=%.2f KB/s", ft.id, speedKBps)
		return speedKBps
	} else {
		// 对于单文件传输，直接计算当前任务的速度
		currentSpeed := ft.calculateCurrentSpeed()
		logrus.Debugf("[%s] GetTransferSpeedKBps: single file speed=%d bytes/sec", ft.id, currentSpeed)
		speedKBps := float32(currentSpeed) / 1024.0
		logrus.Debugf("[%s] GetTransferSpeedKBps: final speed=%.2f KB/s", ft.id, speedKBps)
		return speedKBps
	}
}

// GetRemainingTimeSeconds 获取剩余传输时间（秒）
func (ft *FileTransferTask) GetRemainingTimeSeconds() int64 {
	ft.mutex.Lock()
	defer ft.mutex.Unlock()

	logrus.Debugf("[%s] GetRemainingTimeSeconds: starting remaining time calculation", ft.id)

	var currentSpeed int64
	var currentTransferred int64

	if ft.isDirectory {
		// 对于目录传输，计算所有子任务的速度总和和已传输字节总和
		logrus.Debugf("[%s] GetRemainingTimeSeconds: directory transfer, calculating subtask speeds and transferred bytes", ft.id)

		for _, subTask := range ft.subTasks {
			subSpeed := subTask.calculateCurrentSpeed()
			currentSpeed += subSpeed
			logrus.Debugf("[%s] GetRemainingTimeSeconds: subtask %s speed=%d bytes/sec", ft.id, subTask.id, subSpeed)

			// 获取子任务已传输字节数
			if subTask.intervalTree != nil {
				merged := subTask.intervalTree.MergeIntervals()
				var subTransferred int64
				for _, interval := range merged {
					subTransferred += interval.End - interval.Start
				}
				currentTransferred += subTransferred
				logrus.Debugf("[%s] GetRemainingTimeSeconds: subtask %s transferred=%d bytes", ft.id, subTask.id, subTransferred)
			}
		}

		logrus.Debugf("[%s] GetRemainingTimeSeconds: total directory speed=%d bytes/sec, total transferred=%d bytes",
			ft.id, currentSpeed, currentTransferred)
	} else {
		// 对于单文件传输，直接计算当前任务的速度和已传输字节数
		currentSpeed = ft.calculateCurrentSpeed()
		if ft.intervalTree != nil {
			merged := ft.intervalTree.MergeIntervals()
			for _, interval := range merged {
				currentTransferred += interval.End - interval.Start
			}
		}
		logrus.Debugf("[%s] GetRemainingTimeSeconds: single file speed=%d bytes/sec, transferred=%d bytes",
			ft.id, currentSpeed, currentTransferred)
	}

	totalBytes := atomic.LoadInt64(&ft.totalBytes)
	logrus.Debugf("[%s] GetRemainingTimeSeconds: total_bytes=%d, current_transferred=%d",
		ft.id, totalBytes, currentTransferred)

	if currentSpeed <= 0 {
		logrus.Debugf("[%s] GetRemainingTimeSeconds: speed<=0, returning -1", ft.id)
		return -1 // 无法计算剩余时间
	}

	remainingBytes := totalBytes - currentTransferred
	if remainingBytes <= 0 {
		logrus.Debugf("[%s] GetRemainingTimeSeconds: remaining_bytes<=0, transfer complete", ft.id)
		return 0 // 传输已完成
	}

	remainingTime := remainingBytes / currentSpeed
	logrus.Debugf("[%s] GetRemainingTimeSeconds: remaining_bytes=%d, remaining_time=%d seconds",
		ft.id, remainingBytes, remainingTime)

	return remainingTime
}

// GetSourcePath 获取源文件路径
func (ft *FileTransferTask) GetSourcePath() string {
	return ft.sourcePath
}

// GetDestAddress 获取目标集群地址
func (ft *FileTransferTask) GetDestAddress() string {
	return ft.destAddress
}

// receiveWithTimeout 带超时的接收函数
func (ft *FileTransferTask) receiveWithTimeout() (*apiv1.FileTransferResponse, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	type result struct {
		req *apiv1.FileTransferResponse
		err error
	}
	resCh := make(chan result, 1)
	go func() {
		defer close(resCh)
		req, err := ft.stream.Receive()
		select {
		case resCh <- result{req, err}:
		default:
		}
	}()
	select {
	case res := <-resCh:
		return res.req, res.err
	case <-ctx.Done():
		return nil, fmt.Errorf("request receive timeout")
	}
}
