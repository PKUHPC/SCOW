package logger

import (
	"compress/gzip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/PKUHPC/private-scow/apps/scowd/internal/config"

	"github.com/sirupsen/logrus"
)

// dailyRotateFileHook 是一个 Logrus 钩子，用于按日轮转日志文件
type dailyRotateFileHook struct {
	logPath       string
	logLink       string
	currentDay    string
	file          *os.File
	retentionDays int // 日志保留天数
	compressDays  int // 日志压缩天数
}

func newDailyRotateFileHook(logPath, logLink string, logConfig *config.Logger) *dailyRotateFileHook {
	hook := &dailyRotateFileHook{
		logPath:       logPath,
		logLink:       logLink,
		retentionDays: 90, // 默认保留90天（三个月）
		compressDays:  3,  // 默认3天后压缩
	}

	// 如果提供了配置且值大于0，则使用配置的值
	if logConfig != nil {
		logrus.Debugf("Received logger config - RetentionDays: %d, CompressDays: %d",
			logConfig.RetentionDays, logConfig.CompressDays)
		if logConfig.RetentionDays > 0 {
			hook.retentionDays = logConfig.RetentionDays
		}
		if logConfig.CompressDays > 0 {
			hook.compressDays = logConfig.CompressDays
		}
	} else {
		logrus.Debug("No logger config provided, using defaults")
	}

	logrus.Debugf("Final logger settings - RetentionDays: %d, CompressDays: %d",
		hook.retentionDays, hook.compressDays)

	hook.rotate() // 初始化时立即轮转一次，确保文件是最新的
	return hook
}

func (hook *dailyRotateFileHook) rotate() {
	currentDay := time.Now().Format("2006-01-02")
	if hook.currentDay == currentDay && hook.file != nil {
		// 如果已经是今天的文件，则不需要轮转
		return
	}
	hook.currentDay = currentDay

	// 关闭当前日志文件（如果已打开）
	if hook.file != nil {
		if err := hook.file.Close(); err != nil {
			logrus.WithError(err).Error("Failed to close current log file")
		}
	}

	logFileName := hook.logPath + currentDay + ".log"

	// 打开或创建日志文件，指定初始权限为 0666
	file, err := os.OpenFile(logFileName, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		logrus.WithError(err).Errorf("Failed to open log file: %s", logFileName)
		return
	}

	// 显式设置文件权限为 0600
	if err := os.Chmod(logFileName, 0600); err != nil {
		logrus.WithError(err).Errorf("Failed to set file permissions: %s", logFileName)
		if err := file.Close(); err != nil {
			logrus.WithError(err).Error("Failed to close log file after chmod failure")
		}
		return
	}

	hook.file = file

	// 更新软链接指向最新的日志文件
	if err := os.Remove(hook.logLink); err != nil && !os.IsNotExist(err) {
		logrus.WithError(err).Errorf("Failed to remove old symlink: %s", hook.logLink)
	}
	err = os.Symlink(logFileName, hook.logLink)
	if err != nil {
		logrus.WithError(err).Errorf("Failed to create symlink: %s", hook.logLink)
	}

	// 执行日志清理和压缩
	hook.cleanupOldLogs()
	hook.compressOldLogs()
}

func (hook *dailyRotateFileHook) Levels() []logrus.Level {
	return logrus.AllLevels
}

func (hook *dailyRotateFileHook) Fire(entry *logrus.Entry) error {
	hook.rotate()
	line, err := entry.String()
	if err != nil {
		return err
	}
	_, err = hook.file.Write([]byte(line))
	return err
}

// cleanupOldLogs 删除超过保留天数的日志文件
func (hook *dailyRotateFileHook) cleanupOldLogs() {
	if hook.retentionDays <= 0 {
		return // 如果保留天数为0或负数，不执行清理
	}

	// 获取日志目录
	logDir := filepath.Dir(hook.logPath)
	if logDir == "." {
		logDir = "./"
	}

	// 计算截止日期
	cutoffDate := time.Now().AddDate(0, 0, -hook.retentionDays)
	logrus.Debugf("Retention cutoff date: %s (files older than %d days will be deleted)",
		cutoffDate.Format("2006-01-02"), hook.retentionDays)

	// 遍历日志目录
	entries, err := os.ReadDir(logDir)
	if err != nil {
		logrus.WithError(err).Errorf("Failed to read log directory: %s", logDir)
		return
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		fileName := entry.Name()
		// 检查是否是日志文件（格式：YYYY-MM-DD.log 或 YYYY-MM-DD.log.gz）
		if !strings.HasSuffix(fileName, ".log") && !strings.HasSuffix(fileName, ".log.gz") {
			continue
		}

		// 提取日期部分
		dateStr := ""
		if strings.HasSuffix(fileName, ".log.gz") {
			nameWithoutExt := strings.TrimSuffix(fileName, ".log.gz")
			// 从logPath前缀中提取日期部分
			prefix := filepath.Base(hook.logPath)
			if strings.HasPrefix(nameWithoutExt, prefix) {
				dateStr = strings.TrimPrefix(nameWithoutExt, prefix)
			}
		} else if strings.HasSuffix(fileName, ".log") {
			nameWithoutExt := strings.TrimSuffix(fileName, ".log")
			// 从logPath前缀中提取日期部分
			prefix := filepath.Base(hook.logPath)
			if strings.HasPrefix(nameWithoutExt, prefix) {
				dateStr = strings.TrimPrefix(nameWithoutExt, prefix)
			}
		}

		// 如果无法提取日期字符串，跳过该文件
		if dateStr == "" {
			continue
		}

		// 解析日期
		fileDate, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			logrus.Errorf("Failed to parse date from filename %s (dateStr: %s): %v", fileName, dateStr, err)
			continue // 跳过无法解析日期的文件
		}

		logrus.Debugf("Processing file for cleanup %s: fileDate=%s, cutoffDate=%s",
			fileName, fileDate.Format("2006-01-02"), cutoffDate.Format("2006-01-02"))

		// 如果文件日期早于截止日期，删除文件
		if fileDate.Before(cutoffDate) {
			filePath := filepath.Join(logDir, fileName)
			if err := os.Remove(filePath); err != nil {
				logrus.WithError(err).Errorf("Failed to remove old log file: %s", filePath)
			} else {
				logrus.Infof("Removed old log file: %s", filePath)
			}
		}
	}
}

// compressOldLogs 压缩超过压缩天数的日志文件
func (hook *dailyRotateFileHook) compressOldLogs() {
	if hook.compressDays <= 0 {
		return // 如果压缩天数为0或负数，不执行压缩
	}

	// 获取日志目录
	logDir := filepath.Dir(hook.logPath)
	if logDir == "." {
		logDir = "./"
	}

	// 计算压缩截止日期
	compressCutoffDate := time.Now().AddDate(0, 0, -hook.compressDays)
	logrus.Debugf("Compress cutoff date: %s (files older than %d days will be compressed)",
		compressCutoffDate.Format("2006-01-02"), hook.compressDays)

	// 遍历日志目录
	entries, err := os.ReadDir(logDir)
	if err != nil {
		logrus.WithError(err).Errorf("Failed to read log directory for compression: %s", logDir)
		return
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		fileName := entry.Name()
		// 只处理未压缩的.log文件
		if !strings.HasSuffix(fileName, ".log") || strings.HasSuffix(fileName, ".log.gz") {
			continue
		}

		// 提取日期部分
		nameWithoutExt := strings.TrimSuffix(fileName, ".log")
		// 从logPath前缀中提取日期部分
		prefix := filepath.Base(hook.logPath)
		dateStr := ""
		if strings.HasPrefix(nameWithoutExt, prefix) {
			dateStr = strings.TrimPrefix(nameWithoutExt, prefix)
		}

		// 跳过空的日期字符串
		if dateStr == "" {
			continue
		}

		// 解析日期
		fileDate, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			logrus.Errorf("Failed to parse date from filename %s (dateStr: %s): %v", fileName, dateStr, err)
			continue // 跳过无法解析日期的文件
		}

		logrus.Debugf("Processing file %s: fileDate=%s, cutoffDate=%s, currentDay=%s",
			fileName, fileDate.Format("2006-01-02"), compressCutoffDate.Format("2006-01-02"), hook.currentDay)

		// 如果文件日期早于压缩截止日期，且不是当前正在使用的文件，进行压缩
		if fileDate.Before(compressCutoffDate) && dateStr != hook.currentDay {
			filePath := filepath.Join(logDir, fileName)
			compressedPath := filePath + ".gz"

			// 检查压缩文件是否已存在
			if _, err := os.Stat(compressedPath); err == nil {
				continue // 压缩文件已存在，跳过
			}

			if err := hook.compressFile(filePath, compressedPath); err != nil {
				logrus.WithError(err).Errorf("Failed to compress log file: %s", filePath)
			} else {
				logrus.Infof("Compressed log file: %s -> %s", filePath, compressedPath)
				// 压缩成功后删除原文件
				if err := os.Remove(filePath); err != nil {
					logrus.WithError(err).Errorf("Failed to remove original log file after compression: %s", filePath)
				}
			}
		}
	}
}

// compressFile 压缩单个文件
func (hook *dailyRotateFileHook) compressFile(srcPath, dstPath string) error {
	// 打开源文件
	srcFile, err := os.Open(srcPath)
	if err != nil {
		return fmt.Errorf("failed to open source file: %w", err)
	}
	defer func() {
		if err := srcFile.Close(); err != nil {
			fmt.Printf("Failed to close source file: %v\n", err)
		}
	}()

	// 创建目标压缩文件
	dstFile, err := os.Create(dstPath)
	if err != nil {
		return fmt.Errorf("failed to create compressed file: %w", err)
	}
	defer func() {
		if err := dstFile.Close(); err != nil {
			fmt.Printf("Failed to close destination file: %v\n", err)
		}
	}()

	// 创建gzip写入器
	gzipWriter := gzip.NewWriter(dstFile)
	defer func() {
		if err := gzipWriter.Close(); err != nil {
			fmt.Printf("Failed to close gzip writer: %v\n", err)
		}
	}()

	// 复制数据
	_, err = io.Copy(gzipWriter, srcFile)
	if err != nil {
		return fmt.Errorf("failed to compress file data: %w", err)
	}

	return nil
}
