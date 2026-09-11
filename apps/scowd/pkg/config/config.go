package config

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
	"gopkg.in/yaml.v2"
)

type ServerTLS struct {
	Enabled              bool   `yaml:"enabled"`
	CaCertPath           string `yaml:"caCertPath"`
	ServerCertPath       string `yaml:"serverCertPath"`
	ServerPrivateKeyPath string `yaml:"serverPrivateKeyPath"`
}

type ClientTLS struct {
	Enabled              bool   `yaml:"enabled"`
	CaCertPath           string `yaml:"caCertPath"`
	ClientCertPath       string `yaml:"clientCertPath"`
	ClientPrivateKeyPath string `yaml:"clientPrivateKeyPath"`
}

type AdapaterProxy struct {
	Enabled bool `yaml:"enabled"`
	// scowd 适配器代理监听地址
	Host string `yaml:"host"`
	Port int    `yaml:"port"`
	// 目标代理地址
	AdapterAddress string `yaml:"adapterAddress"`
	// AdapterTLS 为 scowd 与适配器的 TLS 配置
	// scow 与 scowd 适配器代理的 TLS 配置直接复用
	// scow 与 scowd 连接到 TLS 配置即可
	AdapterTLS ClientTLS `yaml:"adapterTLS"`
}

type AppProxy struct {
	Enabled bool   `yaml:"enabled"`
	Host    string `yaml:"host"`
	Port    int    `yaml:"port"`
}

type Proxy struct {
	AdapaterProxy `yaml:"adapterProxy"`
	AppProxy      `yaml:"appProxy"`
}

type Logger struct {
	Level     string `yaml:"level"`
	Directory string `yaml:"directory"`
	// 日志清理配置
	RetentionDays int `yaml:"retentionDays"` // 日志保留天数，超过此天数的日志文件将被自动删除
	// 日志压缩配置
	CompressDays int `yaml:"compressDays"` // 压缩天数，超过此天数的日志文件将被自动压缩
}

// ResourceLimits 资源限制配置
type ResourceLimits struct {
	Enabled  bool  `yaml:"enabled"`  // 是否启用资源限制
	CPUCores int   `yaml:"cpuCores"` // CPU核数限制
	MemoryMB int64 `yaml:"memoryMB"` // 内存限制（MB）
}

// ChildProcess 子进程配置
type ChildProcess struct {
	ResourceLimits          ResourceLimits `yaml:"resourceLimits"`
	ShellIdleTimeoutMinutes int            `yaml:"shellIdleTimeoutMinutes"`
}

type AIConfig struct {
	// AI模式标志
	Enabled bool `yaml:"enabled"`
	// AI模式下的共享文件夹路径
	SharedFolderPath string `yaml:"sharedFolderPath"`
	// AI模型下的ContainerRuntime
	ContainerRuntime ContainerRuntime `yaml:"containerRuntime"`
}

// ContainerRuntime 表示容器运行时类型
type ContainerRuntime string

const (
	ContainerRuntimeDocker     ContainerRuntime = "docker"
	ContainerRuntimeContainerd ContainerRuntime = "containerd"
)

// UnmarshalYAML ensures only allowed runtime values are accepted
func (c *ContainerRuntime) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var runtime string
	if err := unmarshal(&runtime); err != nil {
		return err
	}
	if runtime == "" {
		*c = ""
		return nil
	}
	switch runtime {
	case string(ContainerRuntimeDocker), string(ContainerRuntimeContainerd):
		*c = ContainerRuntime(runtime)
		return nil
	default:
		return fmt.Errorf("invalid containerRuntime: %s", runtime)
	}
}

type SlurmConfig struct {
	// Slurm 命令路径配置
	BinPath string `yaml:"binPath"`
}

// ScowdConfig 定义配置结构体
type ScowdConfig struct {
	Server struct {
		Host string `yaml:"host"`
		Port int    `yaml:"port"`
	} `yaml:"server"`

	ServerTLS `yaml:"TLS"`

	Proxy `yaml:"proxy"`

	Logger `yaml:"logger"`

	ChildProcess ChildProcess `yaml:"childProcess"`

	AI AIConfig `yaml:"ai"`

	Slurm SlurmConfig `yaml:"slurm"`

	FileTransfer FileTransfer `yaml:"fileTransfer"`
}

type FileTransfer struct {
	ChunkSizeMB int64 `yaml:"chunkSizeMB"`
}

const DefaultNonShellIdleDurationMinutes = 10
const DefaultShellIdleDurationMinutes = 60

// 分块太大，进度更新太慢用户体验差
// 分块太小，小文件传输太慢
// 40MB是一个折中方案
const DefaultChunkSizeMB = 40

var (
	scowdConfigMu      sync.RWMutex
	scowdConfigPath    string
	scowdConfigModTime time.Time
	scowdConfigCached  *ScowdConfig
)

func GetShellIdleTimeout() time.Duration {
	scowdConfig, err := GetScowdConfig()
	if err != nil {
		return time.Duration(DefaultShellIdleDurationMinutes) * time.Minute
	}
	if scowdConfig.ChildProcess.ShellIdleTimeoutMinutes <= 0 {
		return time.Duration(DefaultShellIdleDurationMinutes) * time.Minute
	}
	return time.Duration(scowdConfig.ChildProcess.ShellIdleTimeoutMinutes) * time.Minute
}

func GetChunkSizeByte() int {
	scowdConfig, err := GetScowdConfig()
	if err != nil {
		return int(DefaultChunkSizeMB * (1 << 20))
	}
	if scowdConfig.FileTransfer.ChunkSizeMB <= 0 {
		return int(DefaultChunkSizeMB * (1 << 20))
	}
	return int(scowdConfig.FileTransfer.ChunkSizeMB * (1 << 20))
}

func GetScowdConfig() (*ScowdConfig, error) {

	// 获取当前可执行文件的目录
	executablePath, err := os.Executable()
	if err != nil {
		logrus.Println("Failed to get executable path:", err)
		return nil, err
	}
	executableDir := filepath.Dir(executablePath)

	// 构建目标文件的路径
	filePath := filepath.Join(executableDir, ScowdConfigFilePath)
	fileInfo, statErr := os.Stat(filePath)
	if statErr != nil {
		scowdConfigMu.RLock()
		cached := scowdConfigCached
		cachedPath := scowdConfigPath
		scowdConfigMu.RUnlock()
		if cached != nil && cachedPath == filePath {
			logrus.Warnf("Failed to stat config file from %s: %v, falling back to cached config", filePath, statErr)
			return cached, nil
		}
		logrus.Errorf("Failed to stat config file from %s: %v", filePath, statErr)
		return nil, statErr
	}

	scowdConfigMu.RLock()
	cached := scowdConfigCached
	cachedPath := scowdConfigPath
	cachedModTime := scowdConfigModTime
	scowdConfigMu.RUnlock()
	if cached != nil && cachedPath == filePath && fileInfo.ModTime().Equal(cachedModTime) {
		return cached, nil
	}

	logrus.Infof("Attempting to load config from: %s", filePath)

	// 读取配置文件
	file, err := os.ReadFile(filePath)
	if err != nil {
		logrus.Errorf("Failed to read config file from %s: %v", filePath, err)
		return nil, err
	}

	// 解析配置文件
	config := ScowdConfig{}
	err = yaml.Unmarshal(file, &config)
	if err != nil {
		logrus.Println("Failed to parse config file:", err)
		return nil, err
	}

	// 输出logger配置信息用于调试
	logrus.Debugf("Loaded logger config - RetentionDays: %d, CompressDays: %d",
		config.RetentionDays, config.CompressDays)

	// 验证配置
	if config.AI.Enabled && config.AI.SharedFolderPath == "" {
		logrus.Println("AI is enabled but sharedFolderPath is not configured")
		return nil, fmt.Errorf("sharedFolderPath under 'ai' section is required when AI is enabled")
	}

	logrus.Println("Loaded config:", config)

	scowdConfigMu.Lock()
	scowdConfigCached = &config
	scowdConfigPath = filePath
	scowdConfigModTime = fileInfo.ModTime()
	scowdConfigMu.Unlock()

	return scowdConfigCached, nil
}
