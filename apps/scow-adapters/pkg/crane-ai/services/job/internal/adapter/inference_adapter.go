package adapters

import (
	"fmt"

	"github.com/sirupsen/logrus"

	protos "scow-adapters/gen/go"
	"scow-adapters/pkg/crane-ai/services/job/internal/types"
	"scow-adapters/pkg/crane-ai/utils"
)

// InferenceJobAdapter SubmitInferJobRequest 的适配器
type InferenceJobAdapter struct {
	req *protos.SubmitInferJobRequest
}

func NewInferenceJobAdapter(req *protos.SubmitInferJobRequest) *InferenceJobAdapter {
	return &InferenceJobAdapter{req: req}
}

func (a *InferenceJobAdapter) GetJobType() types.ContainerJobType {
	return types.JobTypeInference
}

func (a *InferenceJobAdapter) GetUserId() string {
	return a.req.UserId
}

func (a *InferenceJobAdapter) GetJobName() string {
	return a.req.JobName
}

func (a *InferenceJobAdapter) GetAccount() string {
	return a.req.Account
}

func (a *InferenceJobAdapter) GetPartition() string {
	return a.req.Partition
}

func (a *InferenceJobAdapter) GetQos() *string {
	return a.req.Qos
}

func (a *InferenceJobAdapter) GetTimeLimit() *uint32 {
	return a.req.TimeLimitMinutes
}

func (a *InferenceJobAdapter) GetNodeCount() uint32 {
	return a.req.NodeCount
}

func (a *InferenceJobAdapter) GetGpuCount() uint32 {
	return a.req.GpuCount
}

func (a *InferenceJobAdapter) GetMemoryMb() *uint64 {
	return a.req.MemoryMb
}

func (a *InferenceJobAdapter) GetCoreCount() uint32 {
	return a.req.CoreCount
}

func (a *InferenceJobAdapter) GetImage() (string, error) {
	if len(a.req.ExtraOptions) < 1 {
		return "", fmt.Errorf("extra_options 长度不足，无法获取镜像地址")
	}
	return a.req.ExtraOptions[0], nil
}

func (a *InferenceJobAdapter) GetScript() string {
	return a.req.Script
}

func (a *InferenceJobAdapter) GetWorkingDirectory() string {
	return a.req.WorkingDirectory
}

func (a *InferenceJobAdapter) GetContainerPort() []uint32 {
	port := a.req.ContainerServicePort
	return []uint32{port}
}

func (a *InferenceJobAdapter) GetMounts() (map[string]string, error) {
	if len(a.req.ExtraOptions) < 5 {
		return nil, nil
	}

	logrus.Infof("public paths: %v, readOnly paths: %v", a.req.ExtraOptions[2], a.req.ExtraOptions[4])
	mounts := make(map[string]string)
	// 用户自定义挂载支持单独指定容器内 target，只读挂载仍保持 path:path。
	userMounts, err := utils.ParseMountModelMap(a.req.ExtraOptions[2])
	if err != nil {
		return nil, fmt.Errorf("failed to parse user mounts: %v", err)
	}
	for source, target := range userMounts {
		mounts[source] = target // + ":rw"   目前鹤思还不支持挂载模式
	}

	readOnlyMounts := utils.ParseCommaSeparatedMountMap(a.req.ExtraOptions[4])
	for source, target := range readOnlyMounts {
		mounts[source] = target // + ":ro"  目前鹤思还不支持挂载模式
	}

	return mounts, nil
}

func (a *InferenceJobAdapter) GetStdout() *string {
	return a.req.Stdout
}

func (a *InferenceJobAdapter) GetStderr() *string {
	return a.req.Stderr
}

func (a *InferenceJobAdapter) GetEnvVariables() []types.EnvVariable {
	var envs []types.EnvVariable
	for _, env := range a.req.EnvVariables {
		if env != nil {
			envs = append(envs, types.EnvVariable{
				Name:  env.Key,
				Value: env.Value,
			})
		}
	}
	return envs
}

func (a *InferenceJobAdapter) GetExtraOptions() []string {
	return a.req.ExtraOptions
}

func (a *InferenceJobAdapter) GetGpuType() (string, error) {
	if len(a.req.ExtraOptions) < 4 {
		return "", fmt.Errorf("extra_options 长度不足，无法获取 GPU 类型")
	}
	return a.req.ExtraOptions[3], nil
}

func (a *InferenceJobAdapter) GetAlgorithmPath() (string, error) {
	return "", nil
}

func (a *InferenceJobAdapter) GetDatasetPath() (string, error) {
	return "", nil
}

func (a *InferenceJobAdapter) GetModelPath() (string, error) {
	if len(a.req.ExtraOptions) < 2 {
		return "", fmt.Errorf("extra_options 长度不足，无法获取模型路径")
	}
	return a.req.ExtraOptions[1], nil
}

func (a *InferenceJobAdapter) GetFramework() (string, error) {
	return "", nil
}

func (a *InferenceJobAdapter) GetTensorBoardPath() *string {
	return nil
}

func (a *InferenceJobAdapter) GetVSCodeInfo() *types.VSCodeInfo {
	return nil
}

func (a *InferenceJobAdapter) GetJupyterLabInfo() *types.JupyterLabInfo {
	return nil
}

func (a *InferenceJobAdapter) GetPsNodeCount() *uint32 {
	return nil
}

func (a *InferenceJobAdapter) GetWorkerNodeCount() *uint32 {
	return nil
}
