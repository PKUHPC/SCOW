package monitor

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/prometheus/client_golang/api"
	"github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/utils"
)

const (
	Nvidia          = "nvidia.com/gpu"
	HuaweiAscend910 = "huawei.com/Ascend910"
	CPUUtil         = "CPUUtil"
	MemUtil         = "MemUtil"
	MemLimit        = "MemLimit"
	GPUUtil         = "GPUUtil"
	GPUMemUtil      = "GPUMemUtil"
	GPUPowerUsage   = "PowerUsage"
	GPUTemp         = "GPUTemp"
)

type PromethuesInfo struct {
	Api         v1.API
	Range       v1.Range
	Accelerator string
	QueryString map[string]map[string]string
	timeout     time.Duration
	PodName     string
	Address     string
}

type Option func(info *PromethuesInfo)

func WithAddress(addr string) Option {
	return func(pi *PromethuesInfo) {
		pi.Address = addr
	}
}

func WithAccelerator(accelerator string) Option {
	return func(pi *PromethuesInfo) {
		pi.Accelerator = accelerator
	}
}

func WithRangeStart(start time.Time) Option {
	return func(pi *PromethuesInfo) {
		pi.Range.Start = start
	}
}

func WithRangeEnd(end time.Time) Option {
	return func(pi *PromethuesInfo) {
		pi.Range.End = end
	}
}

func WithRangeStep(step time.Duration) Option {
	return func(pi *PromethuesInfo) {
		pi.Range.Step = step
	}
}

func NewPromethuesInfo(options ...Option) (pi *PromethuesInfo) {
	pi = &PromethuesInfo{
		timeout: 10 * time.Second,
	}
	for _, opt := range options {
		opt(pi)
	}
	// 创建 Prometheus 客户端
	client, err := api.NewClient(api.Config{
		Address: pi.Address,
	})
	if err != nil {
		//caller.Logger.Errorf("Error creating client: %v", err)
		fmt.Printf("Error creating client: %v", err)
		return nil
	}
	v1api := v1.NewAPI(client)
	pi.Api = v1api
	return pi
}

func (pi *PromethuesInfo) QueryWithTimeout(query string) (response []*pb.TimeSeriesData, err error) {
	ctx, cancel := context.WithTimeout(context.Background(), pi.timeout)
	defer cancel()
	return pi.Query(ctx, query)
}

func (pi *PromethuesInfo) Query(ctx context.Context, query string) (response []*pb.TimeSeriesData, err error) {
	result, warnings, err := pi.Api.QueryRange(ctx, query, pi.Range)
	if err != nil {
		//caller.Logger.Errorf("Error querying Prometheus range: %v", err)
		fmt.Printf("Error querying Prometheus range: %v", err)
		return nil, err
	}
	if len(warnings) > 0 {
		//caller.Logger.Infof("Warnings: %v", warnings)
		fmt.Printf("Warnings: %v\n", warnings)
		return nil, err
	}
	matrix, ok := result.(model.Matrix)
	if !ok {
		err = fmt.Errorf("Error converting result to model Matrix")
		return nil, err
	}
	for _, stream := range matrix {
		var values []*pb.TimeSeriesData_DataPoint
		for _, point := range stream.Values {
			value := &pb.TimeSeriesData_DataPoint{}
			value.Value = float64(point.Value)
			value.TimestampMillisecond = point.Timestamp.Time().Unix() * 1000
			values = append(values, value)
		}
		response = append(response, &pb.TimeSeriesData{
			Metrics: map[string]string{
				"pod": pi.PodName,
			},
			Values: values,
		})
	}
	return response, nil
}

func (pi *PromethuesInfo) GetCPUUtil() (response []*pb.TimeSeriesData, err error) {
	query := pi.QueryString[pi.Accelerator][CPUUtil]
	response, err = pi.QueryWithTimeout(query)
	if err != nil || len(response) == 0 {
		fmt.Printf("Error querying CPUUtils: %v\n", err)
		return
	}
	response[0].Metrics["name"] = CPUUtil
	return
}
func (pi *PromethuesInfo) GetMemUtil() (response []*pb.TimeSeriesData, err error) {
	query := pi.QueryString[pi.Accelerator][MemUtil]
	response, err = pi.QueryWithTimeout(query)
	if err != nil || len(response) == 0 {
		fmt.Printf("Error querying MemUtils: %v\n", err)
		return
	}
	response[0].Metrics["name"] = MemUtil
	return

}
func (pi *PromethuesInfo) GetMemLimit() (response []*pb.TimeSeriesData, err error) {
	query := pi.QueryString[pi.Accelerator][MemLimit]
	response, err = pi.QueryWithTimeout(query)
	if err != nil || len(response) == 0 {
		fmt.Printf("Error querying MemLimit: %v\n", err)
		return
	}
	response[0].Metrics["name"] = MemLimit
	return
}
func (pi *PromethuesInfo) GetGPUUtil() (response []*pb.TimeSeriesData, err error) {
	query := pi.QueryString[pi.Accelerator][GPUUtil]
	response, err = pi.QueryWithTimeout(query)
	if err != nil || len(response) == 0 {
		fmt.Printf("Error querying GPUUtils: %v\n", err)
		return
	}
	response[0].Metrics["name"] = GPUUtil
	return
}
func (pi *PromethuesInfo) GetGPUMemUtil() (response []*pb.TimeSeriesData, err error) {
	query := pi.QueryString[pi.Accelerator][GPUMemUtil]
	response, err = pi.QueryWithTimeout(query)
	if err != nil || len(response) == 0 {
		fmt.Printf("Error querying GPUMemUtils: %v\n", err)
		return
	}
	response[0].Metrics["name"] = GPUMemUtil
	return
}
func (pi *PromethuesInfo) GetGPUPowerUsage() (response []*pb.TimeSeriesData, err error) {
	query := pi.QueryString[pi.Accelerator][GPUPowerUsage]
	response, err = pi.QueryWithTimeout(query)
	if err != nil || len(response) == 0 {
		fmt.Printf("Error querying GPUPowerUsage: %v\n", err)
		return
	}
	response[0].Metrics["name"] = GPUPowerUsage
	return
}
func (pi *PromethuesInfo) GetGPUTemp() (response []*pb.TimeSeriesData, err error) {
	query := pi.QueryString[pi.Accelerator][GPUTemp]
	response, err = pi.QueryWithTimeout(query)
	if err != nil || len(response) == 0 {
		fmt.Printf("Error querying GPUTemp: %v\n", err)
		return
	}
	response[0].Metrics["name"] = GPUTemp
	return
}

func (pi *PromethuesInfo) SetPodQueryString(podName string) {
	Res := make(map[string]map[string]string, 3)
	cpuUtils := fmt.Sprintf(`sum(rate(container_cpu_usage_seconds_total{image!="",pod="%s"}[1m])) by (pod)/(sum(container_spec_cpu_quota{image!="",pod="%s"}/100000) by (pod)) * 100`, podName, podName)
	memUtils := fmt.Sprintf(`(container_memory_working_set_bytes{pod="%s",image=""}/container_spec_memory_limit_bytes{pod="%s",image=""}) * 100.00`, podName, podName)
	memLimit := fmt.Sprintf(`container_spec_memory_limit_bytes{pod="%s",image=""}`, podName)
	QueryString := make(map[string]string, 10)
	QueryString[CPUUtil] = cpuUtils
	QueryString[MemUtil] = memUtils
	QueryString[MemLimit] = memLimit
	if pi.Accelerator == Nvidia {
		QueryString[GPUUtil] = fmt.Sprintf(`avg(DCGM_FI_DEV_GPU_UTIL{pod="%s"}) by (pod)`, podName)
		QueryString[GPUMemUtil] = fmt.Sprintf(`avg (DCGM_FI_DEV_FB_USED{pod="%s"}/(DCGM_FI_DEV_FB_USED{pod="%s"} + DCGM_FI_DEV_FB_FREE{pod="%s"}) * 100) by (pod)`, podName, podName, podName)
		QueryString[GPUPowerUsage] = fmt.Sprintf(`avg(DCGM_FI_DEV_POWER_USAGE{pod="%s"}) by (pod)`, podName)
		QueryString[GPUTemp] = fmt.Sprintf(`avg (DCGM_FI_DEV_GPU_TEMP{pod="%s"}) by (pod)`, podName)
	} else if utils.AcceleratorIsAscend(pi.Accelerator) {
		QueryString[GPUUtil] = fmt.Sprintf(`avg (container_npu_used_memory{pod_name="%s"}) by (pod_name)`, podName)
		QueryString[GPUMemUtil] = fmt.Sprintf(`avg (container_npu_utilization{pod_name="%s"}) by (pod_name)`, podName)
	} else {
		err := fmt.Errorf("not support accelerator %s", pi.Accelerator)
		//caller.Logger.Errorf("%s", err.Error())
		fmt.Printf("%s\n", err.Error())
	}
	Res[pi.Accelerator] = QueryString
	pi.QueryString = Res
	pi.PodName = podName
}

func (pi *PromethuesInfo) GetAllMetrics() (response []*pb.TimeSeriesData) {
	var mu sync.Mutex
	var wg sync.WaitGroup
	// 需要执行的 Prometheus 查询函数
	queries := []func() ([]*pb.TimeSeriesData, error){
		pi.GetCPUUtil,
		pi.GetMemUtil,
		pi.GetMemLimit,
	}
	if utils.AcceleratorIsAscend(pi.Accelerator) {
		queries = append(queries, pi.GetGPUUtil, pi.GetGPUMemUtil)
	} else if pi.Accelerator == Nvidia {
		queries = append(queries, pi.GetGPUUtil, pi.GetGPUMemUtil, pi.GetGPUTemp, pi.GetGPUPowerUsage)
	}
	wg.Add(len(queries))
	for _, query := range queries {
		localQuery := query
		go func() {
			defer wg.Done()
			data, err := localQuery()
			if err != nil {
				return
			}
			mu.Lock()
			response = append(response, data...)
			mu.Unlock()
		}()
	}
	wg.Wait()
	return response
}
