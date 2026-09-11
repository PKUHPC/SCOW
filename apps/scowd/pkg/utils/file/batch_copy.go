package file

import (
	"os"
	"sort"
	"sync"
	"sync/atomic"

	"github.com/sirupsen/logrus"
)

// CopyTask 表示一个文件复制任务
type CopyTask struct {
	SourceStart int64
	TargetStart int64
	Size        uint32
}

// BatchCopyManager 批量复制管理器
type BatchCopyManager struct {
	Tasks        []CopyTask
	SrcFile      *os.File
	DstFile      *os.File
	Mu           sync.Mutex
	MaxBatchSize int // 最大批处理大小
}

// NewBatchCopyManager 创建新的批量复制管理器
func NewBatchCopyManager(srcFile, dstFile *os.File) *BatchCopyManager {
	manager := &BatchCopyManager{
		Tasks:        make([]CopyTask, 0, 1000),
		SrcFile:      srcFile,
		DstFile:      dstFile,
		MaxBatchSize: 1000,
	}

	return manager
}

// AddTask 添加复制任务
func (m *BatchCopyManager) AddTask(sourceStart, targetStart int64, size uint32) {
	m.Mu.Lock()

	// 尝试与最后一个任务合并（如果可能）
	tasksLen := len(m.Tasks)
	if tasksLen > 0 {
		last := &m.Tasks[tasksLen-1]
		lastEnd := last.TargetStart + int64(last.Size)
		lastSourceEnd := last.SourceStart + int64(last.Size)

		// 检查是否可以直接合并到最后一个任务
		if targetStart == lastEnd && sourceStart == lastSourceEnd {
			// 源区域和目标区域都连续，直接合并
			last.Size += size
			m.Mu.Unlock()
			return
		}
	}

	// 不能合并，添加为新任务
	m.Tasks = append(m.Tasks, CopyTask{
		SourceStart: sourceStart,
		TargetStart: targetStart,
		Size:        size,
	})

	// 检查是否达到批处理阈值
	needFlush := len(m.Tasks) >= m.MaxBatchSize
	m.Mu.Unlock()

	// 如果任务数量达到阈值，立即执行批处理
	if needFlush {
		m.Flush()
	}
}

// Flush 执行所有待处理任务
func (m *BatchCopyManager) Flush() {
	m.Mu.Lock()
	tasksNum := len(m.Tasks)
	if tasksNum == 0 {
		m.Mu.Unlock()
		return
	}

	// 复制任务列表并清空原列表
	tasksCopy := make([]CopyTask, tasksNum)
	copy(tasksCopy, m.Tasks)
	m.Tasks = m.Tasks[:0]

	// 解锁，不阻塞并发时的 AddTask 操作
	m.Mu.Unlock()

	// 按目标位置排序
	sort.Slice(tasksCopy, func(i, j int) bool {
		return tasksCopy[i].TargetStart < tasksCopy[j].TargetStart
	})

	// 尝试合并相邻或重叠的任务，但需要考虑源位置的对应关系
	mergedTasks := make([]CopyTask, 0, len(tasksCopy))

	// 先添加第一个任务
	if len(tasksCopy) > 0 {
		mergedTasks = append(mergedTasks, tasksCopy[0])
	}

	// 遍历剩余任务
	for i := 1; i < len(tasksCopy); i++ {
		current := tasksCopy[i]
		last := &mergedTasks[len(mergedTasks)-1]

		// 检查是否可以合并（相邻或重叠）
		lastEnd := last.TargetStart + int64(last.Size)
		lastSourceEnd := last.SourceStart + int64(last.Size)

		// 改进的合并逻辑：
		// 1. 目标区域相邻或重叠
		// 2. 源区域相邻（连续）
		if current.TargetStart <= lastEnd &&
			(current.SourceStart == lastSourceEnd ||
				// 允许目标区域重叠的情况下，源区域也必须有相同的偏移
				(current.TargetStart < lastEnd &&
					current.SourceStart-last.SourceStart == current.TargetStart-last.TargetStart)) {

			// 计算合并后的结束位置
			currentEnd := current.TargetStart + int64(current.Size)
			if currentEnd > lastEnd {
				// 更新合并后的大小
				last.Size = uint32(currentEnd - last.TargetStart)
			}
		} else {
			// 不能安全合并，添加为新任务
			mergedTasks = append(mergedTasks, current)
		}
	}

	// 执行合并后的任务
	var wg sync.WaitGroup
	var errCount int32
	var totalBytes int64

	// 计算总处理字节数
	for _, task := range mergedTasks {
		totalBytes += int64(task.Size)
	}

	// 创建工作池来限制并发数
	// 根据任务总量动态调整并发数，但不超过8
	concurrency := 4
	if totalBytes > 10*1024*1024 { // 如果总量超过10MB
		concurrency = 8
	}
	semaphore := make(chan struct{}, concurrency)

	// 并发执行合并后的任务
	for i, task := range mergedTasks {
		wg.Add(1)
		go func(t CopyTask, taskIndex int) {
			defer wg.Done()
			semaphore <- struct{}{}        // 获取信号量
			defer func() { <-semaphore }() // 释放信号量

			// 重试逻辑
			var err error
			for retry := 0; retry < 3; retry++ {
				err = CopyFileBlock(m.SrcFile, t.SourceStart, t.Size, m.DstFile, t.TargetStart)
				if err == nil {
					break
				}

				if retry < 2 { // 只记录重试的错误，不是最终错误
					logrus.Warnf("Retry %d: Failed to copy file block (task %d/%d): %v",
						retry+1, taskIndex+1, len(mergedTasks), err)
				}
			}

			if err != nil {
				logrus.Errorf("Failed to copy file block after retries (task %d/%d): %v",
					taskIndex+1, len(mergedTasks), err)
				atomic.AddInt32(&errCount, 1)
			}
		}(task, i)
	}

	// 等待所有任务完成
	wg.Wait()

	// 计算成功处理的任务数
	processedCount := len(mergedTasks) - int(atomic.LoadInt32(&errCount))

	// 清空任务列表 - 这里不需要再清空，因为已经在获取锁后清空了
	// 记录详细的处理信息
	logrus.Infof("Batch processing completed: original_tasks=%d, merged_tasks=%d, success=%d, failed=%d, total_bytes=%d",
		tasksNum, len(mergedTasks), processedCount, errCount, totalBytes)

	// 如果有错误，记录更详细的信息
	if errCount > 0 {
		logrus.Warnf("During batch processing, %d tasks failed, please check logs for detailed error information", errCount)
	}
}

// Close 关闭管理器并执行剩余任务
func (m *BatchCopyManager) Close() {
	// 执行剩余任务
	tasksCount := 0

	m.Mu.Lock()
	tasksCount = len(m.Tasks)
	m.Mu.Unlock()

	if tasksCount > 0 {
		logrus.Infof("Closing batch copy manager, processing remaining %d tasks", tasksCount)
		m.Flush()
	}

	// 确保资源被正确释放
	logrus.Debug("Batch copy manager closed")
}
