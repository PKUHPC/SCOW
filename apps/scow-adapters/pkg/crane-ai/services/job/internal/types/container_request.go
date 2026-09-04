package types

// ContainerJobType 定义容器作业类型
type ContainerJobType int

const (
	JobTypeTraining ContainerJobType = iota
	JobTypeInference
	JobTypeDevHost
	JobTypeApp
	JobTypeUnknown
)

// String 实现 Stringer 接口
func (t ContainerJobType) String() string {
	switch t {
	case JobTypeTraining:
		return "training"
	case JobTypeInference:
		return "inference"
	case JobTypeDevHost:
		return "devhost"
	case JobTypeApp:
		return "app"
	default:
		return "unknown"
	}
}

// ContainerJobRequest 容器作业请求的统一接口
type ContainerJobRequest interface {
	// 基础元数据
	GetJobType() ContainerJobType
	GetUserId() string
	GetJobName() string
	GetAccount() string

	// 调度配置
	GetPartition() string
	GetQos() *string
	GetTimeLimit() *uint32

	// 资源需求
	GetNodeCount() uint32
	GetGpuCount() uint32
	GetMemoryMb() *uint64
	GetCoreCount() uint32

	// 容器配置
	GetImage() (string, error)
	GetScript() string
	GetWorkingDirectory() string
	GetContainerPort() []uint32
	GetAppProxyPort() int

	// 挂载配置
	GetMounts() (map[string]string, error)

	// 输出配置
	GetStdout() *string
	GetStderr() *string

	// 环境变量
	GetEnvVariables() []EnvVariable

	// 扩展选项
	GetExtraOptions() []string

	// 特殊字段
	GetGpuType() (string, error)
	GetAlgorithmPath() (string, error)
	GetDatasetPath() (string, error)
	GetModelPath() (string, error)
	GetFramework() (string, error)
	GetTensorBoardPath() *string

	// 开发主机特定
	GetVSCodeInfo() *VSCodeInfo
	GetJupyterLabInfo() *JupyterLabInfo

	// TensorFlow 特定
	GetPsNodeCount() *uint32
	GetWorkerNodeCount() *uint32
}

// 相关结构体定义
type EnvVariable struct {
	Name  string
	Value string
}

type VSCodeInfo struct {
	VscodeBinPath string
}

type JupyterLabInfo struct {
	ProxyBasePath string
	ProxyPort     int
}
