package adapters

import (
	"fmt"

	"github.com/sirupsen/logrus"

	protos "scow-adapters/gen/go"
	"scow-adapters/pkg/crane-ai/services/job/internal/types"
	"scow-adapters/pkg/crane-ai/utils"
)

// JobAdapter SubmitJobRequest 的适配器
type JobAdapter struct {
	req *protos.SubmitJobRequest
}

func NewJobAdapter(req *protos.SubmitJobRequest) *JobAdapter {
	return &JobAdapter{req: req}
}

func (a *JobAdapter) GetJobType() types.ContainerJobType {
	if len(a.req.ExtraOptions) == 0 {
		return types.JobTypeUnknown
	}

	switch a.req.ExtraOptions[0] {
	case "app":
		return types.JobTypeApp
	case "train":
		return types.JobTypeTraining
	default:
		return types.JobTypeUnknown
	}
}

func (a *JobAdapter) GetUserId() string {
	return a.req.UserId
}

func (a *JobAdapter) GetJobName() string {
	return a.req.JobName
}

func (a *JobAdapter) GetAccount() string {
	return a.req.Account
}

func (a *JobAdapter) GetPartition() string {
	return a.req.Partition
}

func (a *JobAdapter) GetQos() *string {
	return a.req.Qos
}

func (a *JobAdapter) GetTimeLimit() *uint32 {
	return a.req.TimeLimitMinutes
}

func (a *JobAdapter) GetNodeCount() uint32 {
	return a.req.NodeCount
}

func (a *JobAdapter) GetGpuCount() uint32 {
	return a.req.GpuCount
}

func (a *JobAdapter) GetMemoryMb() *uint64 {
	return a.req.MemoryMb
}

func (a *JobAdapter) GetCoreCount() uint32 {
	return a.req.CoreCount
}

func (a *JobAdapter) GetImage() (string, error) {
	if len(a.req.ExtraOptions) < 3 {
		return "", fmt.Errorf("extra_options is too short to get image URL")
	}
	return a.req.ExtraOptions[2], nil
}

func (a *JobAdapter) GetScript() string {
	return a.req.Script
}

func (a *JobAdapter) GetWorkingDirectory() string {
	return a.req.WorkingDirectory
}

func (a *JobAdapter) GetContainerPort() []uint32 {
	if a.GetJobType() != types.JobTypeApp || len(a.req.ExtraOptions) < 2 {
		return []uint32{}
	}

	switch a.req.ExtraOptions[1] {
	case utils.AppTypeVNC:
		return []uint32{utils.AppVNCContainerPort}
	case utils.AppTypeWeb:
		return []uint32{utils.AppWebContainerPort}
	}

	return []uint32{} // 训练作业无固定端口
}

func (a *JobAdapter) GetMounts() (map[string]string, error) {
	mounts := make(map[string]string)

	jobType := a.GetJobType()
	if jobType == types.JobTypeApp {
		if len(a.req.ExtraOptions) < 9 {
			return nil, nil
		}
		// 用户自定义挂载支持单独指定容器内 target，只读挂载仍保持 path:path。
		userMounts, err := utils.ParseMountModelMap(a.req.ExtraOptions[6])
		if err != nil {
			return nil, fmt.Errorf("failed to parse user mounts: %v", err)
		}
		logrus.Tracef("user mounts: %v", userMounts)
		for source, target := range userMounts {
			mounts[source] = target
		}

		readOnlyMounts := utils.ParseCommaSeparatedMountMap(a.req.ExtraOptions[8])
		logrus.Tracef("readOnly mounts: %v", readOnlyMounts)
		for source, target := range readOnlyMounts {
			mounts[source] = target // + ":ro"
		}
	} else if jobType == types.JobTypeTraining {
		if len(a.req.ExtraOptions) < 10 {
			return nil, nil
		}

		// 用户自定义挂载支持单独指定容器内 target，只读挂载仍保持 path:path。
		userMounts, err := utils.ParseMountModelMap(a.req.ExtraOptions[6])
		if err != nil {
			return nil, fmt.Errorf("failed to parse user mounts: %v", err)
		}
		logrus.Tracef("user mounts: %v", userMounts)
		for source, target := range userMounts {
			mounts[source] = target
		}

		readOnlyMounts := utils.ParseCommaSeparatedMountMap(a.req.ExtraOptions[9])
		logrus.Tracef("readOnly mounts: %v", readOnlyMounts)
		for source, target := range readOnlyMounts {
			mounts[source] = target // + ":ro"
		}
	}
	return mounts, nil
}

func (a *JobAdapter) GetStdout() *string {
	return a.req.Stdout
}

func (a *JobAdapter) GetStderr() *string {
	return a.req.Stderr
}

func (a *JobAdapter) GetEnvVariables() []types.EnvVariable {
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

func (a *JobAdapter) GetExtraOptions() []string {
	return a.req.ExtraOptions
}

func (a *JobAdapter) GetGpuType() (string, error) {
	if len(a.req.ExtraOptions) < 8 {
		return "", fmt.Errorf("extra_options is too short to get GPU type")
	}
	return a.req.ExtraOptions[7], nil
}

func (a *JobAdapter) GetAlgorithmPath() (string, error) {
	if len(a.req.ExtraOptions) < 4 {
		return "", fmt.Errorf("extra_options is too short to get algorithm path")
	}
	return a.req.ExtraOptions[3], nil
}

func (a *JobAdapter) GetDatasetPath() (string, error) {
	if len(a.req.ExtraOptions) < 5 {
		return "", fmt.Errorf("extra_options is too short to get dataset path")
	}
	return a.req.ExtraOptions[4], nil
}

func (a *JobAdapter) GetModelPath() (string, error) {
	if len(a.req.ExtraOptions) < 6 {
		return "", fmt.Errorf("extra_options is too short to get model path")
	}
	return a.req.ExtraOptions[5], nil
}

func (a *JobAdapter) GetFramework() (string, error) {
	if a.GetJobType() != types.JobTypeTraining {
		return "", nil
	}
	if len(a.req.ExtraOptions) < 9 {
		return "", fmt.Errorf("extra_options is too short to get framework")
	}
	return a.req.ExtraOptions[8], nil
}

func (a *JobAdapter) GetTensorBoardPath() *string {
	return a.req.TensorBoardDataPath
}

func (a *JobAdapter) GetVSCodeInfo() *types.VSCodeInfo {
	return nil
}

func (a *JobAdapter) GetJupyterLabInfo() *types.JupyterLabInfo {
	return nil
}

func (a *JobAdapter) GetPsNodeCount() *uint32 {
	return a.req.PsNodeCount
}

func (a *JobAdapter) GetWorkerNodeCount() *uint32 {
	return a.req.WorkerNodeCount
}
