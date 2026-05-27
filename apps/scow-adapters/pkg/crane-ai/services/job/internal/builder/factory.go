package builder

import (
	"fmt"

	protos "scow-adapters/gen/go"
	adapters "scow-adapters/pkg/crane-ai/services/job/internal/adapter"
	"scow-adapters/pkg/crane-ai/services/job/internal/types"
)

// RequestAdapterFactory 请求适配器工厂
type RequestAdapterFactory struct{}

// NewRequestAdapterFactory 创建工厂实例
func NewRequestAdapterFactory() *RequestAdapterFactory {
	return &RequestAdapterFactory{}
}

// CreateAdapter 根据请求类型创建适配器
func (f *RequestAdapterFactory) CreateAdapter(req interface{}) (types.ContainerJobRequest, error) {
	switch r := req.(type) {
	case *protos.SubmitJobRequest:
		return adapters.NewJobAdapter(r), nil
	case *protos.SubmitInferJobRequest:
		return adapters.NewInferenceJobAdapter(r), nil
	case *protos.CreateDevHostRequest:
		return adapters.NewDevHostJobAdapter(r), nil
	default:
		return nil, fmt.Errorf("不支持的请求类型: %T", req)
	}
}
