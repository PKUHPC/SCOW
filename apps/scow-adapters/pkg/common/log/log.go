package log

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/sirupsen/logrus"
	"gopkg.in/natefinch/lumberjack.v2"
)

type Formatter struct{}

func (m *Formatter) Format(entry *logrus.Entry) ([]byte, error) {
	var b *bytes.Buffer
	if entry.Buffer != nil {
		b = entry.Buffer
	} else {
		b = &bytes.Buffer{}
	}

	timestamp := entry.Time.Format("2006-01-02 15:04:05")
	var newLog string

	// HasCaller()为true才会有调用信息
	if entry.HasCaller() {
		fName := filepath.Base(entry.Caller.File)
		newLog = fmt.Sprintf("[%s] [%s] [%s:%d %s] %s\n",
			timestamp, entry.Level, fName, entry.Caller.Line, entry.Caller.Function, entry.Message)
	} else {
		newLog = fmt.Sprintf("[%s] [%s] %s\n", timestamp, entry.Level, entry.Message)
	}

	b.WriteString(newLog)
	return b.Bytes(), nil
}

func ParseLogLevel(level string) logrus.Level {
	lvl, err := logrus.ParseLevel(level)
	if err != nil {
		logrus.Warnf("Invalid log level '%s', defaulting to 'info'", level)
		return logrus.InfoLevel
	}

	return lvl
}

func InitLogger(level logrus.Level) {
	logrus.SetReportCaller(true)
	// 设置日志输出格式为JSON
	logrus.SetFormatter(&Formatter{})
	// 设置日志级别
	logrus.SetLevel(level)

	// 创建一个 lumberjack.Logger，用于日志轮转配置
	logFile := &lumberjack.Logger{
		Filename:   "server.log", // 日志文件路径
		MaxSize:    100,          // 日志文件的最大大小（以MB为单位）
		MaxBackups: 5,            // 保留的旧日志文件数量
		MaxAge:     50,           // 保留的旧日志文件的最大天数
		LocalTime:  true,         // 使用本地时间戳
		Compress:   true,         // 是否压缩旧日志文件
	}
	logrus.SetOutput(io.MultiWriter(os.Stdout, logFile))
	defer logFile.Close()
}
