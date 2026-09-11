package filetransfer

import (
	"context"
	"fmt"
	"io"
	"os"
	"scowd/internal/utils"
	"scowd/internal/utils/buzhash32"
	fileUtils "scowd/internal/storage/file"
	"slices"
	"sync"
	"syscall"

	apiv1 "scowd/protos/gen/api/storage"

	"github.com/sirupsen/logrus"
	"github.com/zeebo/xxh3"
)

// FileHandle 文件句柄包装器
type FileHandle struct {
	file     *os.File
	mmapData []byte // mmap映射的数据
	mmapSize int64  // mmap映射的大小
	refCount int32  // 引用计数
	mutex    sync.RWMutex
}

// DiffTransferContext 差异传输上下文
type DiffTransferContext struct {
	file      *os.File
	reqCh     *utils.SafeChannel[*apiv1.FileTransferRequest]
	hashTable *fileUtils.ChunkHashTable
	chunkSize uint32
	fileSize  int64
	bufPool   *sync.Pool
	// 文件I/O优化相关字段
	fileHandlePool *sync.Pool   // 文件句柄池
	readCache      []byte       // 预读缓存
	cacheStart     int64        // 缓存起始位置
	cacheSize      int64        // 缓存大小
	cacheMutex     sync.RWMutex // 缓存读写锁
	// mmap相关字段
	masterHandle *FileHandle // 主文件句柄（用于mmap）
	// 传输任务引用
	ft *FileTransferTask // 用于记录传输速度
	// 调试计数器
	weakMatchDebugCount int64
}

// StartDiffTransfer 启动差异传输
func StartDiffTransfer(
	ctx context.Context,
	file *os.File,
	reqCh *utils.SafeChannel[*apiv1.FileTransferRequest],
	hashTable *fileUtils.ChunkHashTable,
	chunkSize uint32,
	ft *FileTransferTask,
) error {
	logrus.WithFields(logrus.Fields{
		"chunk_size": chunkSize,
	}).Info("StartDiffTransfer: entered")

	// 参数验证
	if err := validateDiffTransferParams(file, reqCh, hashTable, chunkSize); err != nil {
		logrus.Errorf("StartDiffTransfer: validation failed: %v", err)
		return err
	}

	logrus.Info("StartDiffTransfer: initializing context")
	// 初始化传输上下文
	transferCtx, err := initDiffTransferContext(file, reqCh, hashTable, chunkSize, ft)
	if err != nil {
		logrus.Errorf("StartDiffTransfer: init failed: %v", err)
		return err
	}
	logrus.Info("StartDiffTransfer: context initialized")

	// 确保资源清理
	defer transferCtx.cleanup()

	logrus.Info("StartDiffTransfer: starting processDiffTransfer")
	// 执行差异传输
	return transferCtx.processDiffTransfer(ctx)
}

// validateDiffTransferParams 验证差异传输参数
func validateDiffTransferParams(file *os.File, reqCh *utils.SafeChannel[*apiv1.FileTransferRequest], hashTable *fileUtils.ChunkHashTable, chunkSize uint32) error {
	if file == nil {
		return fmt.Errorf("invalid file handle")
	}
	if reqCh == nil {
		return fmt.Errorf("invalid request channel")
	}
	if hashTable == nil {
		return fmt.Errorf("invalid hash table")
	}
	if chunkSize == 0 {
		return fmt.Errorf("invalid chunk size")
	}
	return nil
}

// initDiffTransferContext 初始化差异传输上下文
func initDiffTransferContext(file *os.File, reqCh *utils.SafeChannel[*apiv1.FileTransferRequest], hashTable *fileUtils.ChunkHashTable, chunkSize uint32, ft *FileTransferTask) (*DiffTransferContext, error) {
	fileInfo, err := file.Stat()
	if err != nil {
		return nil, fmt.Errorf("failed to get file info: %w", err)
	}

	bufPool := &sync.Pool{
		New: func() interface{} {
			buf := make([]byte, chunkSize)
			return &buf
		},
	}

	// 文件句柄池，复用文件句柄避免频繁打开关闭
	fileHandlePool := &sync.Pool{
		New: func() interface{} {
			f, err := os.Open(file.Name())
			if err != nil {
				return nil
			}
			return &FileHandle{
				file:     f,
				refCount: 0,
			}
		},
	}

	// 计算预读缓存大小：至少是块大小的8倍，最大16MB
	cacheSize := int64(chunkSize) * 8
	if cacheSize > 16*1024*1024 {
		cacheSize = 16 * 1024 * 1024
	}

	ctx := &DiffTransferContext{
		file:           file,
		reqCh:          reqCh,
		hashTable:      hashTable,
		chunkSize:      chunkSize,
		fileSize:       fileInfo.Size(),
		bufPool:        bufPool,
		fileHandlePool: fileHandlePool,
		readCache:      make([]byte, cacheSize),
		cacheStart:     -1, // 初始化为无效位置
		cacheSize:      cacheSize,
		ft:             ft, // 设置FileTransferTask引用
	}

	// 创建主文件句柄并进行内存映射
	logrus.Info("initDiffTransferContext: creating master handle")
	masterHandle, err := ctx.createMasterHandle(file.Name())
	if err != nil {
		return nil, fmt.Errorf("failed to create mmap master handle: %w", err)
	}
	ctx.masterHandle = masterHandle

	return ctx, nil
}

// processDiffTransfer 处理差异传输主循环
func (ctx *DiffTransferContext) processDiffTransfer(cancelCtx context.Context) error {
	pos := int64(0)
	logrus.WithField("file_size", ctx.fileSize).Info("processDiffTransfer: starting loop")

	for pos < ctx.fileSize {
		// 检查任务是否已被取消
		select {
		case <-cancelCtx.Done():
			logrus.Warn("processDiffTransfer: context cancelled")
			// 发送终止消息通知服务端
			_ = ctx.reqCh.Send(&apiv1.FileTransferRequest{
				RequestType: &apiv1.FileTransferRequest_TransferTerminated_{},
			})
			return fmt.Errorf("diff transfer terminated by user: %w", cancelCtx.Err())
		default:
		}

		remaining := ctx.fileSize - pos
		if remaining <= 0 {
			logrus.Info("processDiffTransfer: remaining <= 0, breaking")
			break
		}

		// 处理最后一个不完整的块
		if remaining < int64(ctx.chunkSize) {
			logrus.WithField("remaining", remaining).Info("processDiffTransfer: processing last chunk")
			if err := ctx.processLastChunk(pos, remaining); err != nil {
				return err
			}
			break
		}

		// 处理完整的块
		if pos%int64(ctx.chunkSize*10) == 0 { // 减少日志量，每10个块打印一次
			logrus.WithField("pos", pos).Info("processDiffTransfer: processing chunk")
		}
		newPos, err := ctx.processChunk(cancelCtx, pos)
		if err != nil {
			return err
		}
		pos = newPos
	}

	logrus.Info("processDiffTransfer: completed")
	return nil
}

// processLastChunk 处理最后一个不完整的块
func (ctx *DiffTransferContext) processLastChunk(pos int64, remaining int64) error {
	// 创建独立的数据副本，不使用缓冲池以避免数据竞争
	data := make([]byte, remaining)

	_, err := ctx.file.ReadAt(data, pos)
	if err != nil && err != io.EOF {
		return fmt.Errorf("failed to read last chunk of file: %w", err)
	}

	// 打印发送最后一块数据的起始位置和数据大小
	logrus.WithFields(logrus.Fields{
		"start_position": pos,
		"data_size":      remaining,
		"chunk_size":     ctx.chunkSize,
	}).Debug("Sending last chunk data")

	err = sendChunkData(ctx.reqCh, pos, data, ctx.ft)
	if err != nil {
		return fmt.Errorf("failed to send last chunk data: %w", err)
	}
	return nil
}

// processChunk 处理完整的块
func (ctx *DiffTransferContext) processChunk(cancelCtx context.Context, pos int64) (int64, error) {
	// 读取当前块（使用优化的读取方法）
	bufPtr := ctx.bufPool.Get().(*[]byte)
	buf := *bufPtr
	defer ctx.bufPool.Put(bufPtr)

	err := ctx.readAtWithCache(buf, pos)
	if err != nil && err != io.EOF {
		return pos, fmt.Errorf("failed to read file chunk: %w", err)
	}

	// 尝试直接匹配
	if matched, newPos, err := ctx.tryDirectMatch(buf, pos); err != nil {
		return pos, err
	} else if matched {
		return newPos, nil
	}

	logrus.Debug("processChunk: entering sliding window")
	// 进入滑动窗口模式
	return ctx.processSlideWindow(cancelCtx, buf, pos)
}

// tryDirectMatch 尝试直接匹配当前块
func (ctx *DiffTransferContext) tryDirectMatch(buf []byte, pos int64) (bool, int64, error) {
	// 计算弱哈希
	weakHash := buzhash32.New()
	_, _ = weakHash.Write(buf)
	weakHashValue := weakHash.Sum32()

	// 查找哈希表
	if chunks, ok := ctx.hashTable.Table[weakHashValue]; ok {
		// 计算强哈希
		hasher := xxh3.New()
		_, _ = hasher.Write(buf)
		strongHash := hasher.Sum(nil)
		for _, chunk := range chunks {
			if slices.Equal(strongHash[:], chunk.StrongHash) {
				// 打印直接匹配成功的信息
				logrus.WithFields(logrus.Fields{
					"client_pos":         pos,
					"server_chunk_start": chunk.Start,
					"weak_hash":          fmt.Sprintf("%08x", weakHashValue),
					"strong_hash_prefix": fmt.Sprintf("%x", strongHash[:8]),
				}).Debug("Direct match successful, sending chunk reuse request")
				// 发送复用消息
				err := sendReuseChunkRequest(ctx.reqCh, chunk.Start, pos, ctx.chunkSize, ctx.ft)
				if err != nil {
					return false, pos, fmt.Errorf("failed to send chunk reuse request: %w", err)
				}
				return true, pos + int64(ctx.chunkSize), nil
			}
		}
		// 弱哈希匹配但强哈希不匹配
		logrus.WithFields(logrus.Fields{
			"client_pos":         pos,
			"weak_hash":          fmt.Sprintf("%08x", weakHashValue),
			"strong_hash_prefix": fmt.Sprintf("%x", strongHash[:8]),
			"chunk_count":        len(chunks),
		}).Debug("Weak hash matched but strong hash mismatched")
	}
	return false, pos, nil
}

// processSlideWindow 处理滑动窗口模式
func (ctx *DiffTransferContext) processSlideWindow(cancelCtx context.Context, buf []byte, pos int64) (int64, error) {
	// 环形缓冲区，用于滑动窗口
	ringBufPtr := ctx.bufPool.Get().(*[]byte)
	ringBuf := *ringBufPtr
	defer ctx.bufPool.Put(ringBufPtr)

	// 使用环形缓冲区初始化
	copy(ringBuf, buf)
	weakHash := buzhash32.New()
	_, _ = weakHash.Write(buf)
	currentWeakHash := weakHash.Sum32()
	startPos := pos
	slideCount := 0
	ringPos := 0 // 环形缓冲区当前位置

	// 预读滑动窗口可能需要的额外数据
	slideBufPtr := ctx.bufPool.Get().(*[]byte)
	slideBuf := *slideBufPtr
	defer ctx.bufPool.Put(slideBufPtr)

	err := ctx.readAtWithCache(slideBuf, pos+int64(ctx.chunkSize))
	if err != nil && err != io.EOF {
		return pos, fmt.Errorf("failed to read sliding window data: %w", err)
	}

	// 逐字节滑动窗口，确保不会错过任何潜在的匹配
	collisionCount := 0
	logrus.WithFields(logrus.Fields{
		"pos":        pos,
		"chunk_size": ctx.chunkSize,
		"file_size":  ctx.fileSize,
	}).Info("processSlideWindow: starting loop")

	for slideCount < int(ctx.chunkSize) && (pos+int64(slideCount)+int64(ctx.chunkSize)) <= ctx.fileSize {
		// 每处理一定数量的字节后检查取消信号，避免过于频繁的检查
		if slideCount%1024 == 0 {
			select {
			case <-cancelCtx.Done():
				return pos, fmt.Errorf("slide window processing terminated by user")
			default:
			}
		}

		// 每10万次打印进度
		if slideCount%100000 == 0 || slideCount == 0 {
			logrus.WithFields(logrus.Fields{
				"slide_count":     slideCount,
				"pos":             pos,
				"collision_count": collisionCount,
			}).Info("Sliding window progress")
		}

		currentPos := pos + int64(slideCount)
		if slideCount > 0 {
			// 更新滚动哈希
			inByte := slideBuf[slideCount-1] // 预读数据
			weakHash.Roll(inByte)
			currentWeakHash = weakHash.Sum32()

			// 更新环形缓冲区
			ringPos = (ringPos + 1) % int(ctx.chunkSize)
			ringBuf[ringPos] = inByte
		}

		// 尝试在当前位置匹配
		// if slideCount%1000 == 0 {
		// 	logrus.WithField("slide_count", slideCount).Debug("Calling trySlideMatch")
		// }
		matched, newPos, collision, err := ctx.trySlideMatch(ringBuf, ringPos, currentWeakHash, weakHash, startPos, currentPos)
		if err != nil {
			return pos, err
		} else if matched {
			return newPos, nil
		}

		if collision {
			collisionCount++
			if collisionCount > 10000 {
				logrus.WithField("pos", pos).Warn("Too many hash collisions in sliding window, aborting window")
				break
			}
		}

		slideCount++
	}

	// 没有找到匹配，发送整个原始块
	return ctx.sendOriginalChunk(buf, pos)
}

// trySlideMatch 尝试在滑动窗口中匹配
func (ctx *DiffTransferContext) trySlideMatch(ringBuf []byte, ringPos int, currentWeakHash uint32, weakHash *buzhash32.Buzhash32, startPos, currentPos int64) (bool, int64, bool, error) {
	// 检查哈希表
	if chunks, ok := ctx.hashTable.Table[currentWeakHash]; ok {
		// 采样打印日志：每1000次弱哈希匹配打印一次，或者总次数很少时打印
		ctx.weakMatchDebugCount++
		shouldLog := ctx.weakMatchDebugCount%1000 == 0 || ctx.weakMatchDebugCount < 5

		if shouldLog {
			logrus.WithFields(logrus.Fields{
				"pos":       currentPos,
				"weak_hash": fmt.Sprintf("%08x", currentWeakHash),
				"match_cnt": ctx.weakMatchDebugCount,
			}).Debug("Weak hash match, calculating strong hash")
		}

		// 计算强哈希 - 直接使用环形缓冲区，避免内存分配和复制
		hasher := xxh3.New()
		startIdx := (ringPos + 1) % int(ctx.chunkSize)

		// 分两段写入：从startIdx到末尾，从开头到startIdx
		// 如果startIdx为0，说明数据正好是线性的，只需写一段
		if startIdx == 0 {
			_, _ = hasher.Write(ringBuf)
		} else {
			_, _ = hasher.Write(ringBuf[startIdx:])
			_, _ = hasher.Write(ringBuf[:startIdx])
		}
		strongHash := hasher.Sum(nil)

		if shouldLog {
			logrus.WithFields(logrus.Fields{
				"pos":         currentPos,
				"weak_hash":   fmt.Sprintf("%08x", currentWeakHash),
				"strong_hash": fmt.Sprintf("%x", strongHash[:8]),
			}).Debug("Strong hash calculated")
		}

		for _, chunk := range chunks {
			if slices.Equal(strongHash[:], chunk.StrongHash) {
				// 发送未匹配的前部数据
				if currentPos > startPos {
					if err := ctx.sendUnmatchedData(startPos, currentPos-startPos); err != nil {
						return false, currentPos, false, fmt.Errorf("failed to send unmatched data: %w", err)
					}
				}
				// 打印滑动窗口匹配成功的信息
				logrus.WithFields(logrus.Fields{
					"client_pos":         currentPos,
					"server_chunk_start": chunk.Start,
					"weak_hash":          fmt.Sprintf("%08x", currentWeakHash),
					"strong_hash_prefix": fmt.Sprintf("%x", strongHash[:8]),
					"slide_count":        currentPos - startPos,
				}).Debug("Sliding window match successful, sending chunk reuse request")
				// 发送复用消息
				err := sendReuseChunkRequest(ctx.reqCh, chunk.Start, currentPos, ctx.chunkSize, ctx.ft)
				if err != nil {
					return false, currentPos, false, fmt.Errorf("failed to send sliding window match chunk reuse request: %w", err)
				}
				return true, currentPos + int64(ctx.chunkSize), false, nil
			}
		}
		// 弱哈希匹配但强哈希不匹配，返回碰撞标识
		return false, currentPos, true, nil
	}
	return false, currentPos, false, nil
}

// sendUnmatchedData 发送未匹配的数据
func (ctx *DiffTransferContext) sendUnmatchedData(startPos int64, dataSize int64) error {
	// 创建独立的数据副本，不使用缓冲池以避免数据竞争
	data := make([]byte, dataSize)

	err := ctx.readAtWithCache(data, startPos)
	if err != nil {
		return fmt.Errorf("failed to read unmatched data: %w", err)
	}

	// 打印发送数据的起始位置和数据大小
	logrus.WithFields(logrus.Fields{
		"start_position": startPos,
		"data_size":      dataSize,
		"chunk_size":     ctx.chunkSize,
	}).Debug("Sending unmatched data")

	return sendChunkData(ctx.reqCh, startPos, data, ctx.ft)
}

// sendOriginalChunk 发送原始块数据
func (ctx *DiffTransferContext) sendOriginalChunk(buf []byte, pos int64) (int64, error) {
	// 创建独立的数据副本，不使用缓冲池以避免数据竞争
	dataCopy := make([]byte, len(buf))
	copy(dataCopy, buf)

	// 打印发送数据的起始位置和数据大小
	logrus.WithFields(logrus.Fields{
		"start_position": pos,
		"data_size":      len(dataCopy),
		"chunk_size":     ctx.chunkSize,
		"data_prefix":    fmt.Sprintf("%x", dataCopy[:min(8, len(dataCopy))]),
	}).Debug("Sending original chunk data")

	err := sendChunkData(ctx.reqCh, pos, dataCopy, ctx.ft)
	if err != nil {
		return pos, fmt.Errorf("failed to send original chunk data: %w", err)
	}
	return pos + int64(ctx.chunkSize), nil
}

// cleanup 清理资源
func (ctx *DiffTransferContext) cleanup() {
	// 清理主文件句柄和mmap资源
	if ctx.masterHandle != nil {
		if err := ctx.masterHandle.close(); err != nil {
			logrus.Errorf("Failed to close master handle: %v", err)
		}
		ctx.masterHandle = nil
	}

	// 清理文件句柄池中的资源
	if ctx.fileHandlePool != nil {
		// 尝试清空池中的句柄
		for {
			handle := ctx.fileHandlePool.Get()
			if handle == nil {
				break
			}
			if fh, ok := handle.(*FileHandle); ok {
				if err := fh.close(); err != nil {
					logrus.Errorf("Failed to close file handle: %v", err)
				}
			}
		}
	}
}

// sendReuseChunkRequest 发送块复用请求
func sendReuseChunkRequest(
	reqCh *utils.SafeChannel[*apiv1.FileTransferRequest],
	sourceStart int64, // 源文件中的块起始位置
	targetStart int64, // 目标位置
	chunkSize uint32, // 块大小
	ft *FileTransferTask, // 用于记录传输速度
) error {
	if reqCh == nil {
		return fmt.Errorf("invalid request channel")
	}

	// 打印块复用请求的源位置和目标位置
	logrus.WithFields(logrus.Fields{
		"source_start": sourceStart,
		"target_start": targetStart,
	}).Debug("Sending chunk reuse request")

	err := reqCh.Send(&apiv1.FileTransferRequest{
		RequestType: &apiv1.FileTransferRequest_ReuseChunk_{
			ReuseChunk: &apiv1.FileTransferRequest_ReuseChunk{
				SourceStartBytes: sourceStart,
				TargetStartBytes: targetStart,
			},
		},
	})

	if err != nil {
		return fmt.Errorf("failed to send chunk reuse request: %w", err)
	}

	// 记录传输速度 - 复用块也算作传输的数据
	if ft != nil {
		ft.recordTransferSpeed(int64(chunkSize))
		logrus.WithFields(logrus.Fields{
			"bytes_reused": chunkSize,
			"source_start": sourceStart,
			"target_start": targetStart,
		}).Debug("Recorded transfer speed for reused chunk")
	}

	return nil
}

// 发送数据块
func sendChunkData(
	reqCh *utils.SafeChannel[*apiv1.FileTransferRequest],
	start int64,
	data []byte,
	ft *FileTransferTask,
) error {
	if reqCh == nil {
		return fmt.Errorf("invalid request channel")
	}

	if len(data) == 0 {
		return fmt.Errorf("invalid data chunk")
	}

	// 打印发送数据块的起始位置和数据大小
	logrus.WithFields(logrus.Fields{
		"start_position": start,
		"data_size":      len(data),
	}).Debug("Sending data chunk")

	err := reqCh.Send(&apiv1.FileTransferRequest{
		RequestType: &apiv1.FileTransferRequest_Chunk_{
			Chunk: &apiv1.FileTransferRequest_Chunk{
				StartBytes: start,
				Data:       data,
			},
		},
	})

	if err != nil {
		return fmt.Errorf("failed to send data chunk: %w", err)
	}

	// 记录传输速度
	if ft != nil {
		ft.recordTransferSpeed(int64(len(data)))
		logrus.WithFields(logrus.Fields{
			"bytes_sent":     len(data),
			"start_position": start,
		}).Debug("Recorded transfer speed for diff transfer chunk")
	}

	return nil
}

// createMasterHandle 创建主文件句柄并进行mmap映射
func (ctx *DiffTransferContext) createMasterHandle(filename string) (*FileHandle, error) {
	logrus.WithField("filename", filename).Info("createMasterHandle: opening file")
	file, err := os.Open(filename)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}

	handle := &FileHandle{
		file:     file,
		refCount: 1,
	}

	// 进行mmap映射
	logrus.WithField("file_size", ctx.fileSize).Info("createMasterHandle: creating mmap")
	if err := handle.createMmap(ctx.fileSize); err != nil {
		return nil, fmt.Errorf("failed to create mmap: %w", err)
	}

	return handle, nil
}

// createMmap 创建内存映射
func (fh *FileHandle) createMmap(fileSize int64) error {
	fh.mutex.Lock()
	defer fh.mutex.Unlock()

	if fh.mmapData != nil {
		return nil // 已经映射
	}

	// Unix/Linux mmap实现
	fd := int(fh.file.Fd())
	data, err := syscall.Mmap(fd, 0, int(fileSize), syscall.PROT_READ, syscall.MAP_SHARED)
	if err != nil {
		return fmt.Errorf("failed to create mmap: %w", err)
	}

	fh.mmapData = data
	fh.mmapSize = fileSize

	return nil
}

// closeMmap 关闭内存映射
func (fh *FileHandle) closeMmap() error {
	fh.mutex.Lock()
	defer fh.mutex.Unlock()

	if fh.mmapData == nil {
		return nil
	}

	// 取消映射
	err := syscall.Munmap(fh.mmapData)
	fh.mmapData = nil
	fh.mmapSize = 0

	if err != nil {
		return fmt.Errorf("failed to unmap file: %w", err)
	}

	return nil
}

// close 关闭文件句柄
func (fh *FileHandle) close() error {
	if err := fh.closeMmap(); err != nil {
		return err
	}
	return fh.file.Close()
}

// getFileHandle 从池中获取文件句柄
func (ctx *DiffTransferContext) getFileHandle() *FileHandle {
	handle := ctx.fileHandlePool.Get().(*FileHandle)
	if handle == nil {
		return nil
	}
	handle.mutex.Lock()
	handle.refCount++
	handle.mutex.Unlock()
	return handle
}

// putFileHandle 将文件句柄放回池中
func (ctx *DiffTransferContext) putFileHandle(handle *FileHandle) {
	if handle == nil {
		return
	}
	handle.mutex.Lock()
	handle.refCount--
	if handle.refCount <= 0 {
		handle.refCount = 0
	}
	handle.mutex.Unlock()
	ctx.fileHandlePool.Put(handle)
}

// readAt 使用内存映射进行文件读取
func (ctx *DiffTransferContext) readAt(buf []byte, pos int64) error {
	if ctx.masterHandle == nil {
		return fmt.Errorf("mmap master handle not initialized")
	}

	ctx.masterHandle.mutex.RLock()
	defer ctx.masterHandle.mutex.RUnlock()

	if ctx.masterHandle.mmapData == nil {
		return fmt.Errorf("file not memory mapped")
	}

	// 检查读取范围是否有效
	if pos < 0 || pos >= ctx.masterHandle.mmapSize {
		return fmt.Errorf("read position out of file range")
	}

	readSize := int64(len(buf))
	if pos+readSize > ctx.masterHandle.mmapSize {
		readSize = ctx.masterHandle.mmapSize - pos
	}

	// 直接从内存映射中复制数据
	copy(buf[:readSize], ctx.masterHandle.mmapData[pos:pos+readSize])

	// 如果读取的数据少于请求的数据，清零剩余部分
	if readSize < int64(len(buf)) {
		for i := readSize; i < int64(len(buf)); i++ {
			buf[i] = 0
		}
	}

	return nil
}

// readAtWithCache 使用mmap或预读缓存进行文件读取
func (ctx *DiffTransferContext) readAtWithCache(buf []byte, pos int64) error {
	// 如果主句柄可用，优先使用mmap读取
	if ctx.masterHandle != nil {
		return ctx.readAt(buf, pos)
	}

	// 回退到缓存读取方法
	ctx.cacheMutex.RLock()
	// 检查是否可以从缓存中读取
	if ctx.cacheStart >= 0 && pos >= ctx.cacheStart && pos+int64(len(buf)) <= ctx.cacheStart+ctx.cacheSize {
		// 缓存命中，直接从缓存读取
		cacheOffset := pos - ctx.cacheStart
		copy(buf, ctx.readCache[cacheOffset:cacheOffset+int64(len(buf))])
		ctx.cacheMutex.RUnlock()
		return nil
	}
	ctx.cacheMutex.RUnlock()

	// 缓存未命中，需要重新加载缓存
	ctx.cacheMutex.Lock()
	defer ctx.cacheMutex.Unlock()

	// 双重检查，防止并发时重复加载
	if ctx.cacheStart >= 0 && pos >= ctx.cacheStart && pos+int64(len(buf)) <= ctx.cacheStart+ctx.cacheSize {
		cacheOffset := pos - ctx.cacheStart
		copy(buf, ctx.readCache[cacheOffset:cacheOffset+int64(len(buf))])
		return nil
	}

	// 从文件句柄池获取句柄
	fileHandle := ctx.getFileHandle()
	if fileHandle == nil {
		return fmt.Errorf("unable to get file handle")
	}
	defer ctx.putFileHandle(fileHandle)

	// 计算新的缓存起始位置（对齐到块边界）
	newCacheStart := (pos / int64(ctx.chunkSize)) * int64(ctx.chunkSize)
	readSize := ctx.cacheSize
	if newCacheStart+readSize > ctx.fileSize {
		readSize = ctx.fileSize - newCacheStart
	}

	// 读取数据到缓存
	n, err := fileHandle.file.ReadAt(ctx.readCache[:readSize], newCacheStart)
	if err != nil && err != io.EOF {
		return err
	}

	// 更新缓存状态
	ctx.cacheStart = newCacheStart
	ctx.cacheSize = int64(n)

	// 从新缓存中读取所需数据
	if pos >= ctx.cacheStart && pos+int64(len(buf)) <= ctx.cacheStart+ctx.cacheSize {
		cacheOffset := pos - ctx.cacheStart
		copy(buf, ctx.readCache[cacheOffset:cacheOffset+int64(len(buf))])
		return nil
	}

	return fmt.Errorf("unable to read required data after cache reload")
}
