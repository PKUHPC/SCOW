package logger

import (
	"io/fs"
	"os"
	"path/filepath"

	"github.com/sirupsen/logrus"

	"github.com/PKUHPC/private-scow/apps/scowd/internal/config"
)

// 自定义的日志格式化器，在每条日志消息前添加一个前缀
type PrefixFormatter struct {
	Prefix           string // 要添加的前缀
	logrus.Formatter        // 继承自 Logrus 的 Formatter 接口
}

func (f *PrefixFormatter) Format(entry *logrus.Entry) ([]byte, error) {
	// 使用原始 Formatter 格式化消息
	formatted, err := f.Formatter.Format(entry)
	if err != nil {
		return nil, err
	}
	// 在格式化后的消息前加上前缀
	return append([]byte(f.Prefix), formatted...), nil
}

func InitLogger(userID string, prefix string, logConfig *config.Logger) {

	if prefix == "" {
		prefix = "[MAIN]"
	}

	// 设置日志目录，如果配置了目录则使用配置的目录，否则使用可执行文件路径下的logs目录
	var logDir string
	if logConfig != nil && logConfig.Directory != "" {
		logDir = logConfig.Directory
	} else {
		// 获取可执行文件路径下的logs目录
		executablePath, err := os.Executable()
		if err != nil {
			logrus.Println("Failed to get executable path, using default ./logs:", err)
			logDir = "./logs"
		} else {
			executableDir := filepath.Dir(executablePath)
			logDir = filepath.Join(executableDir, "logs")
		}
	}

	logPath := filepath.Join(logDir, userID, "app-")
	logLink := filepath.Join(logDir, userID, "current.log")
	// 确保文件的上级目录存在
	dir := filepath.Dir(logLink)
	var fileMode fs.FileMode
	// 日志根目录由主进程创建，权限要高一点，其他用户子进程方可在该目录下创建日志
	if userID == "" {
		fileMode = 0777
	} else {
		fileMode = 0700
	}
	if err := os.MkdirAll(dir, fileMode); err != nil {
		logrus.Fatalf("Failed to create directories: %v", err)
	}

	// 显式设置目录权限为 0700
	if err := os.Chmod(dir, fileMode); err != nil {
		logrus.Fatalf("Unable to set directory permissions: %v", err)
	}

	hook := newDailyRotateFileHook(logPath, logLink, logConfig)

	logrus.AddHook(hook)
	// 设置日志级别，如果配置了级别则使用配置的级别，否则使用默认的InfoLevel
	logLevel := logrus.InfoLevel
	if logConfig != nil && logConfig.Level != "" {
		if level, err := logrus.ParseLevel(logConfig.Level); err == nil {
			logLevel = level
		}
	}
	logrus.SetLevel(logLevel)
	logrus.SetFormatter(&PrefixFormatter{
		Prefix:    prefix + " ",
		Formatter: &logrus.TextFormatter{}, // 使用 TextFormatter 作为基础格式
	})
}
