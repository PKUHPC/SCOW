package adapters

import (
	"fmt"
	"strings"

	"github.com/sirupsen/logrus"

	protos "scow-adapters/gen/go"
	"scow-adapters/pkg/crane-ai/services/job/internal/types"
)

// JobAdapter SubmitJobRequest 的适配器
type JobAdapter struct {
	req *protos.SubmitJobRequest
}

func NewJobAdapter(req *protos.SubmitJobRequest) *JobAdapter {
	return &JobAdapter{req: req}
}

func (a *JobAdapter) GetJobType() types.ContainerJobType {
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
		return "", fmt.Errorf("extra_options 长度不足，无法获取镜像地址")
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
	return []uint32{} // 训练作业无固定端口
}

func (a *JobAdapter) GetMounts() (map[string]string, error) {
	mounts := make(map[string]string)

	jobType := a.GetJobType()
	if jobType == types.JobTypeApp {
		if len(a.req.ExtraOptions) < 9 {
			return nil, nil
		}
		if a.req.ExtraOptions[6] != "[]" {
			publicPaths := strings.Split(a.req.ExtraOptions[6], ",")
			logrus.Tracef("public paths: %v", publicPaths)
			for _, mount := range publicPaths {
				if mount != "" {
					mounts[mount] = mount // + ":rw"
				}
			}
		}

		if a.req.ExtraOptions[8] != "[]" {
			readOnlyPaths := strings.Split(a.req.ExtraOptions[8], ",")
			logrus.Tracef("readOnly paths: %v", readOnlyPaths)
			for _, mount := range readOnlyPaths {
				if mount != "" {
					mounts[mount] = mount // + ":ro"
				}
			}
		}
	} else if jobType == types.JobTypeTraining {
		if len(a.req.ExtraOptions) < 10 {
			return nil, nil
		}

		if a.req.ExtraOptions[6] != "[]" {
			publicPaths := strings.Split(a.req.ExtraOptions[6], ",")
			logrus.Tracef("public paths: %v", publicPaths)
			for _, mount := range publicPaths {
				if mount != "" {
					mounts[mount] = mount // + ":rw"
				}
			}
		}

		if a.req.ExtraOptions[9] != "[]" {
			readOnlyPaths := strings.Split(a.req.ExtraOptions[9], ",")
			logrus.Tracef("readOnly paths: %v", readOnlyPaths)
			for _, mount := range readOnlyPaths {
				if mount != "" {
					mounts[mount] = mount // + ":ro"
				}
			}
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
		return "", fmt.Errorf("extra_options 长度不足，无法获取 GPU 类型")
	}
	return a.req.ExtraOptions[7], nil
}

func (a *JobAdapter) GetAlgorithmPath() (string, error) {
	if len(a.req.ExtraOptions) < 4 {
		return "", fmt.Errorf("extra_options 长度不足，无法获取算法路径")
	}
	return a.req.ExtraOptions[3], nil
}

func (a *JobAdapter) GetDatasetPath() (string, error) {
	if len(a.req.ExtraOptions) < 5 {
		return "", fmt.Errorf("extra_options 长度不足，无法获取数据集路径")
	}
	return a.req.ExtraOptions[4], nil
}

func (a *JobAdapter) GetModelPath() (string, error) {
	if len(a.req.ExtraOptions) < 6 {
		return "", fmt.Errorf("extra_options 长度不足，无法获取模型路径")
	}
	return a.req.ExtraOptions[5], nil
}

func (a *JobAdapter) GetFramework() (string, error) {
	if a.GetJobType() != types.JobTypeTraining {
		return "", nil
	}
	if len(a.req.ExtraOptions) < 9 {
		return "", fmt.Errorf("extra_options 长度不足，无法获取框架")
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
