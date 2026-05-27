package builder

import (
	"fmt"

	craneProtos "scow-adapters/gen/crane-ai"
	protos "scow-adapters/gen/go"
	"scow-adapters/pkg/crane-ai/services/job/internal/types"
)

// JobBuilderCoordinator 作业构建协调器
type JobBuilderCoordinator struct {
	factory *RequestAdapterFactory
	builder *ContainerJobBuilder
}

// NewJobBuilderCoordinator 创建协调器
func NewJobBuilderCoordinator() *JobBuilderCoordinator {
	return &JobBuilderCoordinator{
		factory: NewRequestAdapterFactory(),
		builder: NewContainerJobBuilder(),
	}
}

// BuildContainerJob 统一的构建函数
func (c *JobBuilderCoordinator) BuildContainerJob(req interface{}) (*craneProtos.JobToCtld, error) {
	// 1. 创建适配器
	adapter, err := c.factory.CreateAdapter(req)
	if err != nil {
		return nil, fmt.Errorf("request adapter creation failed: %v", err)
	}

	// 2. 验证请求
	if err = c.validateRequest(adapter); err != nil {
		return nil, fmt.Errorf("request verification failed: %v", err)
	}

	//err = utils.SaveJobSubmitInfoToFile(adapter.GetJobName(), adapter.GetJobType().String())
	//if err != nil {
	//	logrus.Warn("save job submit info failed: %v", err)
	//}

	// 3. 构建作业
	return c.builder.Build(adapter)
}

// validateRequest 验证请求
func (c *JobBuilderCoordinator) validateRequest(adapter types.ContainerJobRequest) error {
	// 验证用户ID
	if adapter.GetUserId() == "" {
		return fmt.Errorf("user id cannot be empty")
	}

	// 验证作业类型
	switch adapter.GetJobType() {
	case types.JobTypeTraining, types.JobTypeInference, types.JobTypeDevHost, types.JobTypeApp:
		// 合法类型
	default:
		return fmt.Errorf("unsupported job types")
	}

	// 验证资源限制
	if coreCount := adapter.GetCoreCount(); coreCount == 0 {
		return fmt.Errorf("the number of CPU cores cannot be 0")
	}

	return nil
}

func (c *JobBuilderCoordinator) BuildJob(req *protos.SubmitJobRequest) (*craneProtos.JobToCtld, error) {
	return c.BuildContainerJob(req)
}

func (c *JobBuilderCoordinator) BuildInferenceJob(req *protos.SubmitInferJobRequest) (*craneProtos.JobToCtld, error) {
	return c.BuildContainerJob(req)
}

func (c *JobBuilderCoordinator) BuildDevHostJob(req *protos.CreateDevHostRequest) (*craneProtos.JobToCtld, error) {
	return c.BuildContainerJob(req)
}
