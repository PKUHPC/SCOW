package filetransfer

import (
	"fmt"
	"scowd/internal/config"
	"scowd/internal/utils"
	"sync"
	"time"

	fileUtils "scowd/internal/storage/file"

	"github.com/sirupsen/logrus"
)

type TaskManager struct {
	maxWorkers    int
	taskQueue     []*FileTransferTask          // 使用切片存储任务
	taskMap       map[string]*FileTransferTask // 任务ID到任务实例的映射
	queueLock     sync.RWMutex                 // 队列操作读写锁
	taskMapLock   sync.RWMutex                 // 任务映射专用锁，减少锁竞争
	activeWorkers int                          // 当前活跃工作协程数
	workerCond    *sync.Cond                   // 工作协程条件变量
	shutdownChan  chan struct{}                // 关闭信号通道
	TLSConfig     config.ServerTLS
	priorityQueue *utils.PriorityQueue[*FileTransferTask] // 优先级队列
	recordManager *TaskRecordManager                      // 任务记录管理器
}

func NewTaskManager(maxWorkers int, tlsConfig config.ServerTLS) (*TaskManager, error) {
	recordManager, err := NewTaskRecordManager()
	if err != nil {
		return nil, fmt.Errorf("failed to create task record manager: %v", err)
	}

	tm := &TaskManager{
		maxWorkers:    maxWorkers,
		taskQueue:     make([]*FileTransferTask, 0, 100),
		taskMap:       make(map[string]*FileTransferTask),
		shutdownChan:  make(chan struct{}),
		TLSConfig:     tlsConfig,
		priorityQueue: utils.NewPriorityQueue(func(i, j *FileTransferTask) bool { return i.priority > j.priority }),
		recordManager: recordManager,
	}
	tm.workerCond = sync.NewCond(&tm.queueLock)
	go tm.backgroundOptimizer() // 启动后台容量优化

	return tm, nil
}

// AddTask 添加任务（并发安全）
func (tm *TaskManager) AddTask(task *FileTransferTask, priority int) error {
	logrus.Infof("Add task: %s", task.id)

	// 检查用户对源文件的读取权限
	if err := fileUtils.CheckFileReadPermission(task.userID, task.sourcePath); err != nil {
		logrus.WithFields(logrus.Fields{
			"user_id":     task.userID,
			"source_path": task.sourcePath,
			"error":       err,
		}).Error("Permission check failed")
		return fmt.Errorf("insufficient permissions: %w", err)
	}

	// 检查是否存在相同的运行中或等待中的任务
	tm.taskMapLock.RLock()
	for _, existingTask := range tm.taskMap {
		if existingTask.userID == task.userID &&
			existingTask.sourcePath == task.sourcePath &&
			// 当前认为一个传输任务只需要源路径和目标集群一致，就是一个任务
			// 即一个文件或目录只能不能并发传输到一个集群不同位置
			// existingTask.destPath == task.destPath &&
			existingTask.destAddress == task.destAddress {
			tm.taskMapLock.RUnlock()
			logrus.WithFields(logrus.Fields{
				"user_id":      task.userID,
				"source_path":  task.sourcePath,
				"dest_path":    task.destPath,
				"dest_address": task.destAddress,
				"existing_id":  existingTask.id,
			}).Warn("Duplicate task detected")
			return fmt.Errorf("task already exists, please do not submit duplicate. Source file: %s, Target path: %s, Target cluster: %s", task.sourcePath, task.destPath, task.destAddress)
		}
	}
	tm.taskMapLock.RUnlock()

	task.priority = priority

	// 分离锁操作，减少锁竞争
	tm.queueLock.Lock()
	tm.taskQueue = append(tm.taskQueue, task)
	tm.priorityQueue.Push(task)
	tm.queueLock.Unlock()

	tm.taskMapLock.Lock()
	tm.taskMap[task.id] = task
	tm.taskMapLock.Unlock()

	// 保存任务记录
	record := TaskRecord{
		ID:          task.id,
		UserID:      task.userID,
		SourcePath:  task.sourcePath,
		DestPath:    task.destPath,
		DestAddress: task.destAddress,
		Status:      TaskStatusPending,
		StartTime:   time.Now().Unix(),
	}
	// 检查任务是否已存在，如果是从文件加载的任务则不重复写入
	existingRecords, err := tm.recordManager.GetUserTaskRecords(task.userID, []string{task.id})
	if err != nil {
		logrus.Errorf("Failed to check existing task record: %v", err)
	} else if len(existingRecords) == 0 {
		if err := tm.recordManager.SaveTaskRecord(record); err != nil {
			logrus.Errorf("Failed to save task record: %v", err)
		}
	}

	tm.queueLock.Lock()
	tm.workerCond.Signal() // 通知等待的工作协程
	tm.queueLock.Unlock()

	return nil
}

// Start 启动任务处理
func (tm *TaskManager) Start() error {
	// Restore unfinished tasks
	pendingTasks, err := tm.recordManager.LoadPendingTasks()
	if err != nil {
		logrus.Errorf("Failed to load pending tasks: %v", err)
		return fmt.Errorf("failed to load pending tasks: %v", err)
	}

	for _, record := range pendingTasks {
		task := NewFileTransfer(
			record.ID,
			record.UserID,
			record.SourcePath,
			record.DestPath,
			record.DestAddress,
			tm.TLSConfig,
		)
		if err := tm.AddTask(task, 0); err != nil {
			logrus.WithFields(logrus.Fields{
				"task_id": record.ID,
				"user_id": record.UserID,
				"error":   err,
			}).Error("Failed to restore pending task")
			// 继续处理其他任务，不因为单个任务失败而中断
			continue
		}
	}

	// Start worker goroutines
	for i := 0; i < tm.maxWorkers; i++ {
		go tm.worker()
	}

	return nil
}

func (tm *TaskManager) worker() {
	for {
		// Get pending task
		task := tm.dequeueTask()
		if task == nil { // Received shutdown signal
			return
		}

		// 检查任务是否已被取消
		select {
		case <-task.cancelCtx.Done():
			// 任务已被取消，直接跳过执行，但需要从taskMap中删除
			logrus.WithField("task_id", task.id).Info("Task was canceled before execution")
			tm.taskMapLock.Lock()
			delete(tm.taskMap, task.id)
			tm.taskMapLock.Unlock()
			continue
		default:
		}

		// Update task status to running
		record := TaskRecord{
			ID:          task.id,
			UserID:      task.userID,
			SourcePath:  task.sourcePath,
			DestPath:    task.destPath,
			DestAddress: task.destAddress,
			Status:      TaskStatusRunning,
			StartTime:   time.Now().Unix(),
		}
		if err := tm.recordManager.SaveTaskRecord(record); err != nil {
			logrus.Errorf("Failed to update task status: %v", err)
		}

		// Execute task
		tm.queueLock.Lock()
		tm.activeWorkers++
		tm.queueLock.Unlock()

		if err := task.SyncFile(); err != nil {
			// 检查是否是因为取消导致的错误
			select {
			case <-task.cancelCtx.Done():
				logrus.WithField("task_id", task.id).Info("Task was canceled during execution")
				// 根据取消原因设置不同的状态和错误信息
				if task.cancelReason == CancelReasonUser {
					// 用户手动取消，设置为已终止
					record.Status = TaskStatusTerminated
					record.EndTime = time.Now().Unix()
					record.Error = "Task canceled by user"
				} else {
					// 系统关闭，不修改状态为terminated，保持原状态
					logrus.WithField("task_id", task.id).Info("Task canceled due to system shutdown, not setting to terminated")
					// 对于系统关闭的情况，我们不保存状态记录，直接跳到清理部分
					record = TaskRecord{} // 清空record，表示不需要保存
				}
			default:
				logrus.Errorf("Task failed: %v -> %v, error: %v",
					task.sourcePath, task.destPath, err)
				// 任务执行失败
				record.Status = TaskStatusFailed
				record.EndTime = time.Now().Unix()
				record.Error = err.Error()
			}
		} else {
			logrus.Infof("Task completed: %v -> %v",
				task.sourcePath, task.destPath)

			// Update task status to completed
			record.Status = TaskStatusCompleted
			record.EndTime = time.Now().Unix()
		}

		// Save final status (only if record is not empty)
		if record.ID != "" {
			if err := tm.recordManager.SaveTaskRecord(record); err != nil {
				logrus.Errorf("Failed to save task final status: %v", err)
			}
		}

		// 任务完成后从taskMap中删除
		tm.taskMapLock.Lock()
		delete(tm.taskMap, task.id)
		tm.taskMapLock.Unlock()

		tm.queueLock.Lock()
		tm.activeWorkers--
		tm.workerCond.Broadcast() // Notify any waiting goroutines
		tm.queueLock.Unlock()
	}
}

// Dequeue task with shutdown check
func (tm *TaskManager) dequeueTask() *FileTransferTask {
	tm.queueLock.Lock()
	defer tm.queueLock.Unlock()

	// Wait for task or shutdown signal
	for len(tm.taskQueue) == 0 {
		// 首先检查是否收到关闭信号
		select {
		case <-tm.shutdownChan:
			return nil
		default:
		}

		// 释放锁并等待条件变量，避免死锁
		tm.workerCond.Wait()

		// 重新检查关闭信号，因为Wait()可能被Broadcast()唤醒
		select {
		case <-tm.shutdownChan:
			return nil
		default:
		}
	}

	// Get highest priority task
	task := tm.priorityQueue.Pop()
	if task == nil {
		return nil
	}
	// Remove task from queue and map
	for i, t := range tm.taskQueue {
		if t.id == task.id {
			tm.taskQueue = append(tm.taskQueue[:i], tm.taskQueue[i+1:]...)
			break
		}
	}
	// 注意：这里不应该从taskMap中删除，因为任务可能还在执行中
	// delete(tm.taskMap, task.id) // 移除这行，任务完成后再删除
	return task
}

// Background slice capacity optimization (check every 5 minutes)
func (tm *TaskManager) backgroundOptimizer() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			tm.optimizeCapacity()
		case <-tm.shutdownChan:
			return
		}
	}
}

// Optimize slice memory usage (shrink when capacity exceeds usage by 2x)
func (tm *TaskManager) optimizeCapacity() {
	tm.queueLock.Lock()
	defer tm.queueLock.Unlock()

	if cap(tm.taskQueue) > 2*len(tm.taskQueue) {
		newQueue := make([]*FileTransferTask, len(tm.taskQueue))
		copy(newQueue, tm.taskQueue)
		tm.taskQueue = newQueue
	}
}

// GetTaskProgress gets the progress of a specified task
func (tm *TaskManager) GetTaskProgress(taskID string) (float64, error) {
	tm.taskMapLock.RLock()
	task, exists := tm.taskMap[taskID]
	tm.taskMapLock.RUnlock()

	if !exists {
		return 0, fmt.Errorf("task does not exist: %s", taskID)
	}

	return task.GetProgress(), nil
}

// GetUserActiveTasks 获取用户所有正在进行的传输任务
func (tm *TaskManager) GetUserActiveTasks(userID string) []*FileTransferTask {
	tm.taskMapLock.RLock()
	defer tm.taskMapLock.RUnlock()

	var userTasks []*FileTransferTask
	for _, task := range tm.taskMap {
		if task.userID == userID {
			userTasks = append(userTasks, task)
		}
	}

	return userTasks
}

// GetUserActiveAndPendingTasks 获取用户所有正在进行和pending的传输任务
func (tm *TaskManager) GetUserActiveAndPendingTasks(userID string) []*FileTransferTask {
	tm.taskMapLock.RLock()
	defer tm.taskMapLock.RUnlock()

	var userTasks []*FileTransferTask
	for _, task := range tm.taskMap {
		if task.userID == userID {
			userTasks = append(userTasks, task)
		}
	}

	return userTasks
}

// StopTask 终止指定的传输任务
func (tm *TaskManager) StopTask(taskID string) error {
	tm.taskMapLock.RLock()
	task, exists := tm.taskMap[taskID]
	tm.taskMapLock.RUnlock()

	if !exists {
		return fmt.Errorf("task does not exist: %s", taskID)
	}

	// 设置取消原因为用户手动取消
	task.cancelReason = CancelReasonUser

	// 取消任务执行
	task.cancel()

	// 更新任务状态为已终止
	record := TaskRecord{
		ID:          task.id,
		UserID:      task.userID,
		SourcePath:  task.sourcePath,
		DestPath:    task.destPath,
		DestAddress: task.destAddress,
		Status:      TaskStatusTerminated,
		EndTime:     time.Now().Unix(),
	}

	// 保存终止状态到记录文件
	if err := tm.recordManager.SaveTaskRecord(record); err != nil {
		logrus.Errorf("Failed to save terminated task status: %v", err)
	}

	return nil
}

// StopUserTasksByPath 根据用户ID、源文件路径、目标文件路径和目标地址终止用户的传输任务
func (tm *TaskManager) StopUserTasksByPath(userID, sourcePath, destAddress string) error {
	tm.taskMapLock.RLock()
	var tasksToStop []*FileTransferTask
	for _, task := range tm.taskMap {
		if task.userID == userID &&
			task.sourcePath == sourcePath &&
			task.destAddress == destAddress {
			tasksToStop = append(tasksToStop, task)
		}
	}
	tm.taskMapLock.RUnlock()

	if len(tasksToStop) == 0 {
		return fmt.Errorf("no matching tasks found for user %s with source %s, address %s",
			userID, sourcePath, destAddress)
	}

	// 终止所有匹配的任务
	for _, task := range tasksToStop {
		// 取消任务执行
		task.cancel()

		// 更新任务状态为已终止
		record := TaskRecord{
			ID:          task.id,
			UserID:      task.userID,
			SourcePath:  task.sourcePath,
			DestPath:    task.destPath,
			DestAddress: task.destAddress,
			Status:      TaskStatusTerminated,
			EndTime:     time.Now().Unix(),
		}

		// 保存终止状态到记录文件
		if err := tm.recordManager.SaveTaskRecord(record); err != nil {
			logrus.Errorf("Failed to save terminated task status: %v", err)
		}

		logrus.WithFields(logrus.Fields{
			"task_id":      task.id,
			"user_id":      userID,
			"source_path":  sourcePath,
			"dest_address": destAddress,
		}).Info("Task terminated by path matching")
	}

	return nil
}

// CleanupCompletedAndTerminatedTasks 清理用户的已完成和已终止任务记录
func (tm *TaskManager) CleanupCompletedAndTerminatedTasks(userID string) error {
	return tm.recordManager.CleanupCompletedAndTerminatedTasks(userID)
}

// Stop stops all worker goroutines and cleans up resources
// 主要用于程序结束时进行资源清理
func (tm *TaskManager) Stop() {
	logrus.Info("Stopping file transfer manager...")

	// 首先取消所有正在进行的任务
	tm.taskMapLock.RLock()
	for _, task := range tm.taskMap {
		logrus.WithField("task_id", task.id).Info("Canceling running task")
		// 设置取消原因为系统关闭
		task.cancelReason = CancelReasonSystemShutdown
		task.cancel()
	}
	tm.taskMapLock.RUnlock()

	// 发送关闭信号给工作协程
	close(tm.shutdownChan)

	// 唤醒所有等待的工作协程
	tm.queueLock.Lock()
	tm.workerCond.Broadcast()
	tm.queueLock.Unlock()

	// 等待所有工作协程完成，设置超时防止无限等待
	timeout := time.NewTimer(30 * time.Second)
	defer timeout.Stop()

	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-timeout.C:
			// 超时后强制退出，记录警告
			tm.queueLock.RLock()
			activeCount := tm.activeWorkers
			tm.queueLock.RUnlock()
			logrus.WithField("active_workers", activeCount).Warn("Timeout waiting for workers to finish, forcing shutdown")
			return
		case <-ticker.C:
			tm.queueLock.RLock()
			activeCount := tm.activeWorkers
			tm.queueLock.RUnlock()

			if activeCount == 0 {
				logrus.Info("File transfer manager stopped successfully")
				return
			}

			logrus.WithField("active_workers", activeCount).Debug("Waiting for workers to finish...")
		}
	}
}
