package adapters

import (
	protos "scow-adapters/gen/go"
	"scow-adapters/pkg/crane-ai/services/job/internal/types"
	"scow-adapters/pkg/crane-ai/utils"
)

// DevHostJobAdapter CreateDevHostRequest 的适配器
type DevHostJobAdapter struct {
	req *protos.CreateDevHostRequest
}

func NewDevHostJobAdapter(req *protos.CreateDevHostRequest) *DevHostJobAdapter {
	return &DevHostJobAdapter{req: req}
}

func (a *DevHostJobAdapter) GetJobType() types.ContainerJobType {
	return types.JobTypeDevHost
}

func (a *DevHostJobAdapter) GetUserId() string {
	return a.req.UserId
}

func (a *DevHostJobAdapter) GetJobName() string {
	return a.req.JobName
}

func (a *DevHostJobAdapter) GetAccount() string {
	return a.req.Account
}

func (a *DevHostJobAdapter) GetPartition() string {
	return a.req.Partition
}

func (a *DevHostJobAdapter) GetQos() *string {
	qos := a.req.Qos
	return &qos
}

func (a *DevHostJobAdapter) GetTimeLimit() *uint32 {
	return a.req.TimeLimitMinutes
}

func (a *DevHostJobAdapter) GetNodeCount() uint32 {
	return 1 // 开发主机固定为1个节点
}

func (a *DevHostJobAdapter) GetGpuCount() uint32 {
	return a.req.GpuCount
}

func (a *DevHostJobAdapter) GetMemoryMb() *uint64 {
	return a.req.MemoryMb
}

func (a *DevHostJobAdapter) GetCoreCount() uint32 {
	return a.req.CoreCount
}

func (a *DevHostJobAdapter) GetImage() (string, error) {
	return a.req.Image, nil
}

func (a *DevHostJobAdapter) GetScript() string {
	// 开发主机无脚本，返回启动服务的命令
	return ""
}

func (a *DevHostJobAdapter) GetWorkingDirectory() string {
	return a.req.WorkingDirectory
}

func (a *DevHostJobAdapter) GetContainerPort() []uint32 {
	var ports []uint32
	// 检查是否有 VSCode 或 JupyterLab
	if a.req.VscodeInfo != nil {
		port := uint32(utils.VscodePort)
		ports = append(ports, port)
	}
	if a.req.JupyterLabInfo != nil {
		port := uint32(utils.JupyterPort)
		ports = append(ports, port)
	}
	return ports
}

func (a *DevHostJobAdapter) GetMounts() (map[string]string, error) {
	mounts := make(map[string]string)
	for _, mount := range a.req.Mounts {
		if mount.Path != "" {
			mounts[mount.Path] = mount.Target // + ":ro"
		}
	}
	for _, mount := range a.req.PublicMounts {
		if mount != "" {
			mounts[mount] = mount // + ":rw"
		}
	}
	return mounts, nil
}

func (a *DevHostJobAdapter) GetStdout() *string {
	// 开发主机无标准输出重定向
	return nil
}

func (a *DevHostJobAdapter) GetStderr() *string {
	// 开发主机无标准错误重定向
	return nil
}

func (a *DevHostJobAdapter) GetEnvVariables() []types.EnvVariable {
	var envs []types.EnvVariable
	// 添加开发环境相关环境变量
	if a.req.VscodeInfo != nil {
		envs = append(envs, types.EnvVariable{
			Name:  "VSCODE_ENABLED",
			Value: "true",
		})
	}
	if a.req.JupyterLabInfo != nil {
		envs = append(envs, types.EnvVariable{
			Name:  "JUPYTER_ENABLED",
			Value: "true",
		})
	}
	return envs
}

func (a *DevHostJobAdapter) GetExtraOptions() []string {
	// 开发主机无 extra_options
	return nil
}

func (a *DevHostJobAdapter) GetGpuType() (string, error) {
	// 开发主机 GPU 类型从分区配置中获取
	return "", nil
}

func (a *DevHostJobAdapter) GetAlgorithmPath() (string, error) {
	return "", nil
}

func (a *DevHostJobAdapter) GetDatasetPath() (string, error) {
	return "", nil
}

func (a *DevHostJobAdapter) GetModelPath() (string, error) {
	return "", nil
}

func (a *DevHostJobAdapter) GetFramework() (string, error) {
	return "", nil
}

func (a *DevHostJobAdapter) GetTensorBoardPath() *string {
	return nil
}

func (a *DevHostJobAdapter) GetVSCodeInfo() *types.VSCodeInfo {
	if a.req.VscodeInfo == nil {
		return nil
	}
	return &types.VSCodeInfo{
		VscodeBinPath: a.req.VscodeInfo.VscodeBinPath,
	}
}

func (a *DevHostJobAdapter) GetJupyterLabInfo() *types.JupyterLabInfo {
	if a.req.JupyterLabInfo == nil {
		return nil
	}
	return &types.JupyterLabInfo{
		ProxyBasePath: a.req.JupyterLabInfo.ProxyBasePath,
	}
}

func (a *DevHostJobAdapter) GetPsNodeCount() *uint32 {
	return nil
}

func (a *DevHostJobAdapter) GetWorkerNodeCount() *uint32 {
	return nil
}
