package utils

import (
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"sync"

	"github.com/sirupsen/logrus"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/slurm/config"
)

// 预编译正则表达式以提高性能
var (
	partitionNameRe = regexp.MustCompile(`PartitionName=(\S+)`)
	nodesRe         = regexp.MustCompile(` Nodes=(\S+)`)
	totalNodesRe    = regexp.MustCompile(`TotalNodes=(\S+)`)
	tresRe          = regexp.MustCompile(`TRES=(\S+)`)
	defCpuPerGPURe  = regexp.MustCompile(`DefCpuPerGPU=(\d+)`)
	defMemPerGPURe  = regexp.MustCompile(`DefMemPerGPU=(\d+)`)
	allocQosRe      = regexp.MustCompile(`AllowQos=(\S+)`)
	numberRegex     = regexp.MustCompile(`^\d+`)
	memRegex        = regexp.MustCompile(`(?i)^(\d+)([kmgt]?)$`)
)

type ClusterNodesInfo struct {
	NodeCount             uint32
	RunningNodeCount      uint32
	IdleNodeCount         uint32
	NotAvailableNodeCount uint32
	CpuCoreCount          uint32
	RunningCpuCount       uint32
	IdleCpuCount          uint32
	NotAvailableCpuCount  uint32
	GpuCoreCount          uint32
	RunningGpuCount       uint32
	IdleGpuCount          uint32
	NotAvailableGpuCount  uint32
	JobCount              uint32
	RunningJobCount       uint32
	PendingJobCount       uint32
	NodeUsage             float32
	CpuUsage              float32
	GpuUsage              float32
}

type TresResources struct {
	CPU            uint32
	MemMB          uint64
	Nodes          uint32
	Accelerators   map[string]uint32
	OtherResources map[string]uint32
}

type NodesJson struct {
	Nodes []RawNode `json:"nodes"`
}

type RawNode struct {
	Name       string   `json:"name"`
	Partitions []string `json:"partitions"`
	State      []string `json:"state"`
	Tres       string   `json:"tres"`      // "cpu=8,mem=14000M,billing=8,gres/gpu=1"
	TresUsed   string   `json:"tres_used"` // "cpu=1,mem=1750M,gres/gpu=0"
}

type tres struct {
	cpu uint32
	mem uint32 // MB
	gpu uint32
}

// GetClusterNodesInfo 获取集群中节点的信息
func GetClusterNodesInfo(parts []*pb.PartitionInfo) (*ClusterNodesInfo, error) {
	var (
		nodeCount             uint32
		runningNodeCount      uint32
		idleNodeCount         uint32
		notAvailableNodeCount uint32
		cpuCoreCount          uint32
		runningCpuCount       uint32
		idleCpuCount          uint32
		notAvailableCpuCount  uint32
		gpuCoreCount          uint32
		runningGpuCount       uint32
		idleGpuCount          uint32
		notAvailableGpuCount  uint32
		jobCount              uint32
		runningJobCount       uint32
		pendingJobCount       uint32
		nodeInfos             []*pb.NodeInfo
	)

	info, err := GetNodesJsonInfo(nil)
	if err == nil && config.SlurmValue.Json.Enabled {
		logrus.Tracef("parse node information using JSON parsing")
		jsonData := []byte(info)
		var nodesJson *NodesJson
		if err := json.Unmarshal(jsonData, &nodesJson); err != nil {
			return nil, fmt.Errorf("unmarshal nodes failed: %v", err)
		}

		nodeInfos = GetClusterNodeByJsonConcurrently(nodesJson)
	} else {
		logrus.Tracef("parse node information using command-line parsing")
		nodesResult, err := GetNodesInfo(nil)
		if err != nil {
			return nil, fmt.Errorf("get nodes info failed: %v", err)
		}

		nodeInfos = GetClusterNodeConcurrently(nodesResult)
	}

	// 聚合节点统计信息
	for _, nodeInfo := range nodeInfos {
		logrus.Tracef("GetClusterNodesInfo nodeName: %v, totalGpu: %v, allocGpus: %v, idleGpuCount: %v", nodeInfo.NodeName, nodeInfo.GpuCount, nodeInfo.AllocGpuCount, nodeInfo.IdleGpuCount)
		nodeCount++

		cpuCoreCount += nodeInfo.CpuCoreCount
		runningCpuCount += nodeInfo.AllocCpuCoreCount
		idleCpuCount += nodeInfo.IdleCpuCoreCount

		gpuCoreCount += nodeInfo.GpuCount
		idleGpuCount += nodeInfo.IdleGpuCount
		runningGpuCount += nodeInfo.AllocGpuCount

		switch nodeInfo.State {
		case pb.NodeInfo_IDLE:
			idleNodeCount++
		case pb.NodeInfo_RUNNING:
			runningNodeCount++
		case pb.NodeInfo_NOT_AVAILABLE:
			notAvailableNodeCount++
		default:
			logrus.Warnf("Unknown node state: %s", nodeInfo.State)
		}
	}

	// 计算不可用资源
	notAvailableCpuCount = cpuCoreCount - runningCpuCount - idleCpuCount
	notAvailableGpuCount = gpuCoreCount - runningGpuCount - idleGpuCount

	// 聚合作业统计信息
	for _, part := range parts {
		jobCount += part.JobCount
		runningJobCount += part.RunningJobCount
		pendingJobCount += part.PendingJobCount
	}

	result := &ClusterNodesInfo{
		NodeCount:             nodeCount,
		RunningNodeCount:      runningNodeCount,
		IdleNodeCount:         idleNodeCount,
		NotAvailableNodeCount: notAvailableNodeCount,
		CpuCoreCount:          cpuCoreCount,
		RunningCpuCount:       runningCpuCount,
		IdleCpuCount:          idleCpuCount,
		NotAvailableCpuCount:  notAvailableCpuCount,
		GpuCoreCount:          gpuCoreCount,
		RunningGpuCount:       runningGpuCount,
		IdleGpuCount:          idleGpuCount,
		NotAvailableGpuCount:  notAvailableGpuCount,
		JobCount:              jobCount,
		RunningJobCount:       runningJobCount,
		PendingJobCount:       pendingJobCount,
	}

	logrus.Tracef("GetClusterNodesInfo node Info: %v", result)
	return result, nil
}

func GetClusterNodeConcurrently(nodeInfoString string) []*pb.NodeInfo {
	lines := strings.Split(strings.TrimSpace(nodeInfoString), "\n")
	results := make(chan *pb.NodeInfo, len(lines))

	var wg sync.WaitGroup
	for _, line := range lines {
		wg.Add(1)
		go func(l string) {
			defer wg.Done()
			if strings.TrimSpace(l) != "" && strings.Contains(l, "Partitions") {
				nodeInfo := ExtractNodeInfo(l)
				results <- nodeInfo
			}
		}(line)
	}

	// 关闭通道的协程
	go func() {
		wg.Wait()
		close(results)
	}()

	nodesInfo := make([]*pb.NodeInfo, 0, len(lines))
	// 收集结果
	for result := range results {
		nodesInfo = append(nodesInfo, result)
	}

	return nodesInfo
}

func GetClusterNodeByJsonConcurrently(resp *NodesJson) []*pb.NodeInfo {
	results := make(chan *pb.NodeInfo, len(resp.Nodes))
	var wg sync.WaitGroup

	for _, n := range resp.Nodes {
		nodeItem := n
		wg.Add(1)
		go func() {
			defer wg.Done()

			// 过滤 partitions 为空的节点
			if nodeItem.Partitions == nil || len(nodeItem.Partitions) == 0 {
				return
			}

			total := parseTres(nodeItem.Tres)
			used := parseTres(nodeItem.TresUsed)

			// 转换节点状态
			var (
				nodeState                                 pb.NodeInfo_NodeState
				nodeRemovable                             bool
				idleGpuCount, idleCpuCoreCount, idleMemMb uint32
			)
			if len(nodeItem.State) == 0 {
				nodeState = pb.NodeInfo_NOT_AVAILABLE
			} else {
				state := strings.Join(nodeItem.State, "+")
				switch state {
				case "IDLE", "IDLE+PLANNED":
					nodeState = pb.NodeInfo_IDLE
				case "DOWN", "DOWN+NOT_RESPONDING", "ALLOCATED+DRAIN", "IDLE+DRAIN",
					"IDLE+DRAIN+NOT_RESPONDING", "DOWN+DRAIN+INVALID_REG", "IDLE+NOT_RESPONDING":
					nodeState = pb.NodeInfo_NOT_AVAILABLE
				case "ALLOCATED", "MIXED":
					nodeState = pb.NodeInfo_RUNNING
				default:
					nodeState = pb.NodeInfo_NOT_AVAILABLE
				}
			}

			if used.cpu == 0 {
				nodeRemovable = true
			}

			idleGpuCount = total.gpu - used.gpu
			idleCpuCoreCount = total.cpu - used.cpu
			idleMemMb = total.mem - used.mem

			if nodeState == pb.NodeInfo_NOT_AVAILABLE {
				idleGpuCount = 0
				idleCpuCoreCount = 0
				idleMemMb = 0
			}

			node := &pb.NodeInfo{
				NodeName:          nodeItem.Name,
				Partitions:        nodeItem.Partitions,
				State:             nodeState,
				CpuCoreCount:      total.cpu,
				AllocCpuCoreCount: used.cpu,
				IdleCpuCoreCount:  idleCpuCoreCount,
				TotalMemMb:        total.mem,
				AllocMemMb:        used.mem,
				IdleMemMb:         idleMemMb,
				GpuCount:          total.gpu,
				AllocGpuCount:     used.gpu,
				IdleGpuCount:      idleGpuCount,
				Removable:         nodeRemovable,
			}
			results <- node
		}()
	}

	go func() {
		wg.Wait()
		close(results)
	}()

	nodesInfo := make([]*pb.NodeInfo, 0, len(resp.Nodes))
	for result := range results {
		if result != nil {
			nodesInfo = append(nodesInfo, result)
		}
	}

	return nodesInfo
}

func ExtractPartitionInfo(info string, partitionInfo map[string]*PartitionInfo, qosList []string) *pb.Partition {
	var (
		qos                []string
		memMb              uint64
		cores, gpus, nodes uint32
	)

	partitionName := extractValue(info, partitionNameRe)
	comment := partitionName
	pi, ok := partitionInfo[partitionName]
	if ok && pi.Nodes > 0 {
		comment = pi.Describe
		nodes = pi.Nodes
		gpus = pi.GpuPerNode * nodes
		cores = pi.CpuPerNode * nodes
		memMb = pi.MemPerNode * uint64(nodes)
	} else {
		nodesName := extractValue(info, nodesRe)
		totalNodes := extractValue(info, totalNodesRe)
		totalNodeNumInt, _ := strconv.Atoi(totalNodes)
		nodes = uint32(totalNodeNumInt)
		tres := extractValue(info, tresRe)
		if tres != "" {
			logrus.Infof("get partition %v info by partition tres!", partitionName)
			memMb, cores, gpus = getResourceCountByPartitionTRES(tres)
		} else {
			logrus.Infof("get partition %v info by partition nodes!", partitionName)
			memMb, cores, gpus = getResourceCountByPartitionNodes(nodesName)
		}

		defCpuPerGPU := extractValue(info, defCpuPerGPURe)
		if defCpuPerGPU != "" {
			defCpuPerGPUInt, _ := strconv.Atoi(defCpuPerGPU)
			coresPer := gpus * uint32(defCpuPerGPUInt)
			if coresPer < cores {
				cores = coresPer
			}
		}

		defMemPerGPU := extractValue(info, defMemPerGPURe)
		if defMemPerGPU != "" {
			defMemPerGPUInt, _ := strconv.Atoi(defMemPerGPU)
			memMbPer := uint64(gpus) * uint64(defMemPerGPUInt)
			if memMbPer < memMb {
				memMb = memMbPer
			}
		}
	}

	allowQos := extractValue(info, allocQosRe)
	if allowQos == "ALL" {
		qos = qosList
	} else {
		qos = strings.Split(allowQos, ",")
	}

	return &pb.Partition{
		Name:    partitionName,
		Nodes:   nodes,
		MemMb:   memMb,
		Cores:   cores,
		Gpus:    gpus,
		Qos:     qos,
		Comment: &comment,
	}
}

func getResourceCountByPartitionTRES(tres string) (uint64, uint32, uint32) {
	tresResources := ParseTRES(tres)
	memMb := tresResources.MemMB
	cores := tresResources.CPU
	var gpus uint32
	for _, i := range tresResources.Accelerators {
		gpus += i
	}
	return memMb, cores, gpus
}

func getResourceCountByPartitionNodes(nodes string) (uint64, uint32, uint32) {
	var (
		memMb uint64
		cores uint32
		gpus  uint32
	)

	// 解析partition中包含的slurm节点名
	nodeList, ok := ParseHostList(nodes)
	if !ok {
		return 0, 0, 0
	}

	nodesResult, err := GetNodesInfo(nodeList)
	if err != nil {
		return 0, 0, 0
	}

	lines := strings.Split(nodesResult, "\n")
	// 预分配切片容量以减少内存重分配
	nodesInfo := make(map[string]*pb.NodeInfo, len(lines))

	for _, line := range lines {
		if strings.TrimSpace(line) != "" && strings.Contains(line, "Partitions") {
			nodeInfo := ExtractNodeInfo(line)
			nodesInfo[nodeInfo.NodeName] = nodeInfo
		}
	}

	for _, node := range nodeList {
		nodeInfo := nodesInfo[node]
		if nodeInfo != nil {
			memMb += uint64(nodeInfo.TotalMemMb)
			cores += nodeInfo.CpuCoreCount
			gpus += nodeInfo.GpuCount
		}
	}

	return memMb, cores, gpus
}

func ParseTRES(tres string) TresResources {
	total := TresResources{
		Accelerators:   make(map[string]uint32),
		OtherResources: make(map[string]uint32),
	}

	pairs := strings.Split(tres, ",")
	for _, pair := range pairs {
		kv := strings.SplitN(pair, "=", 2)
		if len(kv) != 2 {
			continue
		}
		key, value := strings.TrimSpace(kv[0]), strings.TrimSpace(kv[1])

		switch {
		case key == "cpu":
			total.CPU += extractNumber(value)
		case key == "mem":
			total.MemMB += parseMemory(value)
		case key == "node":
			total.Nodes += extractNumber(value)
		case strings.HasPrefix(key, "gres/"):
			// 提取加速卡类型（如 "gpu" 或 "dcu"）
			accelType := strings.TrimPrefix(key, "gres/")
			total.Accelerators[accelType] += extractNumber(value)
		default:
			total.OtherResources[key] += extractNumber(value)
		}
	}

	return total
}

func extractNumber(s string) uint32 {
	match := numberRegex.FindString(s)
	if match == "" {
		return 0
	}
	num, _ := strconv.Atoi(match)
	return uint32(num)
}

// 解析内存值, 将带单位的内存字符串转为 MB；支持 K, M, G, T 大小写
func parseMemory(s string) uint64 {
	s = strings.TrimSpace(s)
	matches := memRegex.FindStringSubmatch(s)
	if matches == nil {
		return 0
	}

	value, _ := strconv.ParseUint(matches[1], 10, 64)
	unit := matches[2]

	switch unit {
	case "K", "k":
		return value / 1024 // KB → MB
	case "M", "m":
		return value
	case "G", "g":
		return value * 1024 // GB → MB
	case "T", "t":
		return value * 1024 * 1024 // GB → MB
	default:
		return value // 默认为 MB
	}
}

// GetSummaryClusterNodesInfo 获取集群中节点的信息
func GetSummaryClusterNodesInfo(parts []*pb.PartitionInfo, authorizedPartitionsNodes, authorizedPartitions []string) (*ClusterNodesInfo, error) {
	var (
		nodeCount             uint32
		runningNodeCount      uint32
		idleNodeCount         uint32
		notAvailableNodeCount uint32
		cpuCoreCount          uint32
		runningCpuCount       uint32
		idleCpuCount          uint32
		notAvailableCpuCount  uint32
		gpuCoreCount          uint32
		runningGpuCount       uint32
		idleGpuCount          uint32
		notAvailableGpuCount  uint32
		jobCount              uint32
		runningJobCount       uint32
		pendingJobCount       uint32
	)

	nodesResult, err := GetNodesInfo(authorizedPartitionsNodes)
	if err != nil {
		return nil, err
	}

	nodeInfos := GetClusterNodeConcurrently(nodesResult)

	// 聚合节点统计信息
	for _, nodeInfo := range nodeInfos {
		logrus.Tracef("GetClusterNodesInfo nodeName: %v, totalGpu: %v, allocGpus: %v, idleGpuCount: %v", nodeInfo.NodeName, nodeInfo.GpuCount, nodeInfo.AllocGpuCount, nodeInfo.IdleGpuCount)
		nodeCount++

		cpuCoreCount += nodeInfo.CpuCoreCount
		runningCpuCount += nodeInfo.AllocCpuCoreCount
		idleCpuCount += nodeInfo.IdleCpuCoreCount

		gpuCoreCount += nodeInfo.GpuCount
		idleGpuCount += nodeInfo.IdleGpuCount
		runningGpuCount += nodeInfo.AllocGpuCount

		switch nodeInfo.State {
		case pb.NodeInfo_IDLE:
			idleNodeCount++
		case pb.NodeInfo_RUNNING:
			runningNodeCount++
		case pb.NodeInfo_NOT_AVAILABLE:
			notAvailableNodeCount++
		default:
			logrus.Warnf("Unknown node state: %s", nodeInfo.State)
		}
	}

	// 计算不可用资源
	notAvailableCpuCount = cpuCoreCount - runningCpuCount - idleCpuCount
	notAvailableGpuCount = gpuCoreCount - runningGpuCount - idleGpuCount

	// 聚合作业统计信息
	for _, part := range parts {
		if !slices.Contains(authorizedPartitions, part.PartitionName) {
			continue
		}
		jobCount += part.JobCount
		runningJobCount += part.RunningJobCount
		pendingJobCount += part.PendingJobCount
	}

	var nodeUsage, cpuUsage, gpuUsage float32
	if nodeCount > 0 {
		resultRatio := float32(runningNodeCount) / float32(nodeCount)
		nodeUsage = float32(math.Round(float64(resultRatio)*100*100) / 100)
	}
	if cpuCoreCount > 0 {
		resultRatio := float32(runningCpuCount) / float32(cpuCoreCount)
		cpuUsage = float32(math.Round(float64(resultRatio)*100*100) / 100)
	}
	if gpuCoreCount > 0 {
		resultRatio := float32(runningGpuCount) / float32(gpuCoreCount)
		gpuUsage = float32(math.Round(float64(resultRatio)*100*100) / 100)
	}

	result := &ClusterNodesInfo{
		NodeCount:             nodeCount,
		RunningNodeCount:      runningNodeCount,
		IdleNodeCount:         idleNodeCount,
		NotAvailableNodeCount: notAvailableNodeCount,
		CpuCoreCount:          cpuCoreCount,
		RunningCpuCount:       runningCpuCount,
		IdleCpuCount:          idleCpuCount,
		NotAvailableCpuCount:  notAvailableCpuCount,
		GpuCoreCount:          gpuCoreCount,
		RunningGpuCount:       runningGpuCount,
		IdleGpuCount:          idleGpuCount,
		NotAvailableGpuCount:  notAvailableGpuCount,
		JobCount:              jobCount,
		RunningJobCount:       runningJobCount,
		PendingJobCount:       pendingJobCount,
		NodeUsage:             nodeUsage,
		CpuUsage:              cpuUsage,
		GpuUsage:              gpuUsage,
	}

	logrus.Tracef("GetClusterNodesInfo node Info: %v", result)
	return result, nil
}

func GetSummaryPartitionInfo(parts []*pb.PartitionInfo, authorizedPartitions []string) []*pb.SummaryPartitionInfo {
	var summaryPartitions []*pb.SummaryPartitionInfo
	for _, partition := range parts {
		if !slices.Contains(authorizedPartitions, partition.PartitionName) {
			continue
		}
		var status pb.SummaryPartitionInfo_PartitionStatus
		switch partition.PartitionStatus {
		case pb.PartitionInfo_AVAILABLE:
			status = pb.SummaryPartitionInfo_AVAILABLE
		case pb.PartitionInfo_NOT_AVAILABLE:
			status = pb.SummaryPartitionInfo_NOT_AVAILABLE
		}

		var nodeUsage, cpuUsage, gpuUsage float32
		if partition.NodeCount > 0 {
			resultRatio := float32(partition.RunningNodeCount) / float32(partition.NodeCount)
			nodeUsage = float32(math.Round(float64(resultRatio)*100*100) / 100)
		}
		if partition.CpuCoreCount > 0 {
			resultRatio := float32(partition.RunningCpuCount) / float32(partition.CpuCoreCount)
			cpuUsage = float32(math.Round(float64(resultRatio)*100*100) / 100)
		}
		if partition.GpuCoreCount > 0 {
			resultRatio := float32(partition.RunningGpuCount) / float32(partition.GpuCoreCount)
			gpuUsage = float32(math.Round(float64(resultRatio)*100*100) / 100)
		}

		summaryPartitions = append(summaryPartitions, &pb.SummaryPartitionInfo{
			PartitionName:   partition.PartitionName,
			NodeCount:       partition.NodeCount,
			NodeUsage:       nodeUsage,
			CpuCoreCount:    partition.CpuCoreCount,
			CpuUsage:        cpuUsage,
			GpuCoreCount:    partition.GpuCoreCount,
			GpuUsage:        gpuUsage,
			PendingJobCount: partition.PendingJobCount,
			PartitionStatus: status,
		})
	}
	return summaryPartitions
}

func parseTres(s string) tres {
	var t tres
	if s == "" {
		return t
	}
	parts := strings.Split(s, ",")
	for _, p := range parts {
		kv := strings.SplitN(p, "=", 2)
		if len(kv) != 2 {
			continue
		}
		key, valStr := strings.TrimSpace(kv[0]), strings.TrimSpace(kv[1])
		switch {
		case key == "cpu":
			if v, err := strconv.ParseUint(valStr, 10, 32); err == nil {
				t.cpu = uint32(v)
			}
		case key == "mem":
			t.mem = uint32(parseMemory(valStr))
		case key == "gres/gpu" || key == "gpu":
			if v, err := strconv.ParseUint(valStr, 10, 32); err == nil {
				t.gpu = uint32(v)
			}
		}
	}
	return t
}
