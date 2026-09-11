package filetransfer

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sync"

	"scowd/internal/auth"

	"github.com/sirupsen/logrus"
)

// TaskStatus 表示任务状态
type TaskStatus string

const (
	TaskStatusPending    TaskStatus = "pending"    // 等待执行
	TaskStatusRunning    TaskStatus = "running"    // 正在执行
	TaskStatusCompleted  TaskStatus = "completed"  // 已完成
	TaskStatusFailed     TaskStatus = "failed"     // 失败
	TaskStatusTerminated TaskStatus = "terminated" // 已终止
)

// TaskRecord 表示任务记录
type TaskRecord struct {
	ID          string     `json:"id"`           // 任务ID
	UserID      string     `json:"user_id"`      // 用户ID
	SourcePath  string     `json:"source_path"`  // 源路径
	DestPath    string     `json:"dest_path"`    // 目标路径
	DestAddress string     `json:"dest_cluster"` // 目标集群
	Status      TaskStatus `json:"status"`       // 任务状态
	StartTime   int64      `json:"start_time"`   // 开始时间
	EndTime     int64      `json:"end_time"`     // 结束时间
	Error       string     `json:"error"`        // 错误信息
}

// TaskRecordManager 管理任务记录
type TaskRecordManager struct {
	recordDir string
	mutex     sync.RWMutex
}

// NewTaskRecordManager 创建任务记录管理器
func NewTaskRecordManager() (*TaskRecordManager, error) {
	recordDir := filepath.Join("./transfer-record")
	// Ensure record directory exists
	if err := os.MkdirAll(recordDir, 0755); err != nil {
		logrus.WithField("dir_path", recordDir).Errorf("Failed to create task record directory: %v", err)
		return nil, fmt.Errorf("failed to create task record directory: %v", err)
	}
	logrus.WithField("dir_path", recordDir).Info("Initialized task record manager")

	manager := &TaskRecordManager{
		recordDir: recordDir,
	}

	return manager, nil
}

// getRecordFilePath 获取用户任务记录文件路径
func (m *TaskRecordManager) getRecordFilePath(userID string) string {
	return filepath.Join(m.recordDir, fmt.Sprintf("%s.json", userID))
}

// setFileOwnership 设置文件拥有者为指定用户
func (m *TaskRecordManager) setFileOwnership(filePath, userID string) error {
	uid, gid, _, err := auth.GetUserInfo(userID)
	if err != nil {
		logrus.WithFields(logrus.Fields{
			"user_id": userID,
			"error":   err,
		}).Warn("Failed to get user info, skipping file ownership change")
		return nil // 不返回错误，只记录警告
	}

	// 使用chown命令设置文件拥有者
	chownCmd := exec.Command("chown", fmt.Sprintf("%d:%d", uid, gid), filePath)
	if err := chownCmd.Run(); err != nil {
		logrus.WithFields(logrus.Fields{
			"file_path": filePath,
			"user_id":   userID,
			"uid":       uid,
			"gid":       gid,
			"error":     err,
		}).Warn("Failed to change file ownership")
		return nil // 不返回错误，只记录警告
	}

	logrus.WithFields(logrus.Fields{
		"file_path": filePath,
		"user_id":   userID,
		"uid":       uid,
		"gid":       gid,
	}).Debug("Successfully changed file ownership")
	return nil
}

// writeFileWithOwnership 写入文件并在首次创建时设置拥有者
func (m *TaskRecordManager) writeFileWithOwnership(filePath, userID string, data []byte) error {
	// 检查文件是否存在
	fileExists := true
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		fileExists = false
	}

	// 写入文件
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return err
	}

	// 只在文件首次创建时设置拥有者
	if !fileExists {
		if err := m.setFileOwnership(filePath, userID); err != nil {
			logrus.WithFields(logrus.Fields{
				"file_path": filePath,
				"user_id":   userID,
				"error":     err,
			}).Error("Failed to set file ownership")
			return fmt.Errorf("failed to set file ownership for %s: %w", filePath, err)
		}
	}

	return nil
}

// loadUserTasksUnsafe 加载用户的所有任务（不加锁的内部方法）
func (m *TaskRecordManager) loadUserTasksUnsafe(userID string) ([]TaskRecord, error) {
	filePath := m.getRecordFilePath(userID)
	data, err := os.ReadFile(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			logrus.WithField("file_path", filePath).Debug("User task record file does not exist")
			return []TaskRecord{}, nil
		}
		logrus.WithFields(logrus.Fields{
			"file_path": filePath,
			"error":     err,
		}).Error("Failed to read user task record file")
		return nil, err
	}

	var records []TaskRecord
	if err := json.Unmarshal(data, &records); err != nil {
		logrus.WithFields(logrus.Fields{
			"user_id": userID,
			"error":   err,
		}).Error("Failed to parse user task records")
		return nil, err
	}
	logrus.WithFields(logrus.Fields{
		"user_id":      userID,
		"record_count": len(records),
	}).Debug("Successfully loaded user task records")
	return records, nil
}

// LoadUserTasks 加载用户的所有任务
func (m *TaskRecordManager) LoadUserTasks(userID string) ([]TaskRecord, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	return m.loadUserTasksUnsafe(userID)
}

// SaveTaskRecord 保存任务记录
func (m *TaskRecordManager) SaveTaskRecord(record TaskRecord) error {
	// 先获取现有记录
	records, err := m.LoadUserTasks(record.UserID)
	if err != nil {
		logrus.WithFields(logrus.Fields{
			"user_id": record.UserID,
			"error":   err,
		}).Error("Failed to load user task records")
		return err
	}

	// 获取写锁
	m.mutex.Lock()
	defer m.mutex.Unlock()

	// 重新读取记录以确保数据一致性
	filePath := m.getRecordFilePath(record.UserID)
	data, err := os.ReadFile(filePath)
	if err != nil && !os.IsNotExist(err) {
		logrus.WithFields(logrus.Fields{
			"file_path": filePath,
			"error":     err,
		}).Error("Failed to read task record file")
		return err
	}

	if !os.IsNotExist(err) {
		var currentRecords []TaskRecord
		if err := json.Unmarshal(data, &currentRecords); err != nil {
			logrus.WithFields(logrus.Fields{
				"user_id": record.UserID,
				"error":   err,
			}).Error("Failed to parse user task records")
			return err
		}
		records = currentRecords
	}

	logrus.WithFields(logrus.Fields{
		"user_id": record.UserID,
		"task_id": record.ID,
		"status":  record.Status,
	}).Info("Starting to save task record")

	// 查找并更新现有记录或添加新记录
	updated := false
	for i, r := range records {
		if r.ID == record.ID {
			records[i] = record
			updated = true
			break
		}
	}
	if !updated {
		records = append(records, record)
	}

	// 保存到文件
	data, err = json.MarshalIndent(records, "", "  ")
	if err != nil {
		logrus.WithFields(logrus.Fields{
			"user_id": record.UserID,
			"error":   err,
		}).Error("Failed to serialize task records")
		return err
	}

	if err := m.writeFileWithOwnership(filePath, record.UserID, data); err != nil {
		logrus.WithFields(logrus.Fields{
			"file_path": filePath,
			"error":     err,
		}).Error("Failed to write task record file")
		return err
	}

	logrus.WithFields(logrus.Fields{
		"user_id": record.UserID,
		"task_id": record.ID,
	}).Info("Successfully saved task record")
	return nil
}

// LoadPendingTasks 加载所有待处理的任务
func (m *TaskRecordManager) LoadPendingTasks() ([]TaskRecord, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	logrus.Info("Starting to load all pending tasks")
	files, err := os.ReadDir(m.recordDir)
	if err != nil {
		logrus.WithFields(logrus.Fields{
			"dir_path": m.recordDir,
			"error":    err,
		}).Error("Failed to read task record directory")
		return nil, err
	}

	var pendingTasks []TaskRecord
	for _, file := range files {
		if file.IsDir() {
			continue
		}

		userID := file.Name()[:len(file.Name())-5] // 移除.json后缀
		records, err := m.loadUserTasksUnsafe(userID)
		if err != nil {
			continue
		}

		for _, record := range records {
			if record.Status == TaskStatusPending || record.Status == TaskStatusRunning {
				pendingTasks = append(pendingTasks, record)
			}
		}
	}

	logrus.WithField("task_count", len(pendingTasks)).Info("Successfully loaded pending tasks")
	return pendingTasks, nil
}

// GetUserTaskRecords 获取指定任务ID列表的记录
func (m *TaskRecordManager) GetUserTaskRecords(userID string, taskIDs []string) ([]TaskRecord, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	records, err := m.loadUserTasksUnsafe(userID)
	if err != nil {
		return nil, err
	}

	// 如果taskIDs为空，返回所有记录
	if len(taskIDs) == 0 {
		return records, nil
	}

	// 创建taskIDs的映射，用于快速查找
	taskIDMap := make(map[string]bool)
	for _, id := range taskIDs {
		taskIDMap[id] = true
	}

	// 筛选指定的任务记录
	var result []TaskRecord
	for _, record := range records {
		if taskIDMap[record.ID] {
			result = append(result, record)
		}
	}

	return result, nil
}

// DeleteUserTaskRecords 删除指定任务ID列表的记录
func (m *TaskRecordManager) DeleteUserTaskRecords(userID string, taskIDs []string) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	logrus.WithFields(logrus.Fields{
		"user_id":         userID,
		"tasks_to_delete": len(taskIDs),
	}).Info("Starting to delete user task records")
	records, err := m.loadUserTasksUnsafe(userID)
	if err != nil {
		logrus.WithFields(logrus.Fields{
			"user_id": userID,
			"error":   err,
		}).Error("Failed to load user task records")
		return err
	}

	// 如果taskIDs为空，不执行任何操作
	if len(taskIDs) == 0 {
		return nil
	}

	// 创建taskIDs的映射，用于快速查找
	taskIDMap := make(map[string]bool)
	for _, id := range taskIDs {
		taskIDMap[id] = true
	}

	// 筛选需要保留的记录
	var remainingRecords []TaskRecord
	for _, record := range records {
		// 不删除正在运行的任务记录
		if record.Status == TaskStatusRunning || !taskIDMap[record.ID] {
			remainingRecords = append(remainingRecords, record)
		}
	}

	// 保存更新后的记录
	data, err := json.MarshalIndent(remainingRecords, "", "  ")
	if err != nil {
		return err
	}

	filePath := m.getRecordFilePath(userID)
	if err := m.writeFileWithOwnership(filePath, userID, data); err != nil {
		logrus.WithFields(logrus.Fields{
			"file_path": filePath,
			"error":     err,
		}).Error("Failed to write task record file")
		return err
	}

	logrus.WithFields(logrus.Fields{
		"user_id":            userID,
		"deleted_task_count": len(taskIDs),
		"remaining_tasks":    len(remainingRecords),
	}).Info("Successfully deleted user task records")
	return nil
}

// CleanupCompletedAndTerminatedTasks 清理用户的已完成和已终止任务记录
func (m *TaskRecordManager) CleanupCompletedAndTerminatedTasks(userID string) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	logrus.WithField("user_id", userID).Info("Starting to cleanup completed and terminated task records")
	records, err := m.loadUserTasksUnsafe(userID)
	if err != nil {
		logrus.WithFields(logrus.Fields{
			"user_id": userID,
			"error":   err,
		}).Error("Failed to load user task records")
		return err
	}

	// 筛选需要保留的记录（只保留正在运行和等待中的任务）
	var remainingRecords []TaskRecord
	var cleanedCount int
	for _, record := range records {
		if record.Status == TaskStatusRunning || record.Status == TaskStatusPending {
			remainingRecords = append(remainingRecords, record)
		} else {
			cleanedCount++
		}
	}

	// 如果没有需要清理的记录，直接返回
	if cleanedCount == 0 {
		logrus.WithField("user_id", userID).Debug("No completed or terminated tasks to cleanup")
		return nil
	}

	// 保存更新后的记录
	data, err := json.MarshalIndent(remainingRecords, "", "  ")
	if err != nil {
		logrus.WithFields(logrus.Fields{
			"user_id": userID,
			"error":   err,
		}).Error("Failed to serialize remaining task records")
		return err
	}

	filePath := m.getRecordFilePath(userID)
	if err := m.writeFileWithOwnership(filePath, userID, data); err != nil {
		logrus.WithFields(logrus.Fields{
			"file_path": filePath,
			"error":     err,
		}).Error("Failed to write task record file")
		return err
	}

	logrus.WithFields(logrus.Fields{
		"user_id":         userID,
		"cleaned_count":   cleanedCount,
		"remaining_tasks": len(remainingRecords),
	}).Info("Successfully cleaned up completed and terminated task records")
	return nil
}
