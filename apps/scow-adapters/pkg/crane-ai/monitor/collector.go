package monitor

import (
	"context"
	"fmt"

	"github.com/sirupsen/logrus"
	"go.mongodb.org/mongo-driver/bson"

	craneProtos "scow-adapters/gen/crane-ai"
	"scow-adapters/pkg/common/monitor"
	"scow-adapters/pkg/crane-ai/client"
	"scow-adapters/pkg/crane-ai/utils"
)

// CraneAICollector 基于 CraneCtld gRPC API 采集集群指标，同时采集 MongoDB 指标。
// 与 crane 版本结构完全一致，但引用 crane-ai 的 client 和 utils 包。
type CraneAICollector struct {
	clusterName string
}

func NewCollector(clusterName string) *CraneAICollector {
	return &CraneAICollector{clusterName: clusterName}
}

func (c *CraneAICollector) Collect() (*monitor.ClusterSnapshot, error) {
	c.collectDB()

	allPartitions := utils.GetAllPartitions()

	clusterInfo, err := utils.GetSummaryClusterNodesInfo(allPartitions)
	if err != nil {
		return nil, fmt.Errorf("GetSummaryClusterNodesInfo: %w", err)
	}

	partitionSnaps, err := c.collectPartitions(allPartitions)
	if err != nil {
		logrus.Warnf("[CraneAICollector] collect partitions: %v", err)
	}

	snap := &monitor.ClusterSnapshot{
		ClusterName:            c.clusterName,
		NodeTotal:              int64(clusterInfo.NodeCount),
		NodeRunning:            int64(clusterInfo.RunningNodeCount),
		NodeAvailable:          int64(clusterInfo.IdleNodeCount),
		NodeUnavailable:        int64(clusterInfo.NotAvailableNodeCount),
		CoreTotal:              int64(clusterInfo.CpuCoreCount),
		CoreRunning:            int64(clusterInfo.RunningCpuCount),
		CoreAvailable:          int64(clusterInfo.IdleCpuCount),
		CoreUnavailable:        int64(clusterInfo.NotAvailableCpuCount),
		AcceleratorTotal:       int64(clusterInfo.GpuCoreCount),
		AcceleratorRunning:     int64(clusterInfo.RunningGpuCount),
		AcceleratorAvailable:   int64(clusterInfo.IdleGpuCount),
		AcceleratorUnavailable: int64(clusterInfo.NotAvailableGpuCount),
		JobTotal:               int64(clusterInfo.JobCount),
		JobRunning:             int64(clusterInfo.RunningJobCount),
		JobPending:             int64(clusterInfo.PendingJobCount),
		Partitions:             partitionSnaps,
	}
	snap.JobUserCount, snap.JobRunningUsers, snap.JobPendingUsers = c.countClusterJobUsers(allPartitions)
	return snap, nil
}

func (c *CraneAICollector) collectPartitions(allPartitions []string) ([]monitor.PartitionSnapshot, error) {
	var snaps []monitor.PartitionSnapshot
	for _, partName := range allPartitions {
		ps, err := c.collectOnePartition(partName)
		if err != nil {
			logrus.Errorf("[CraneAICollector] partition %s: %v", partName, err)
			continue
		}
		snaps = append(snaps, *ps)
	}
	return snaps, nil
}

func (c *CraneAICollector) collectOnePartition(partName string) (*monitor.PartitionSnapshot, error) {
	idleNodes, allocNodes, mixNodes, downNodes, err := utils.GetNodeByPartition([]string{partName})
	if err != nil {
		return nil, fmt.Errorf("GetNodeByPartition: %w", err)
	}
	runningNodes := int64(allocNodes + mixNodes)
	nodeTotal := int64(idleNodes + allocNodes + mixNodes + downNodes)

	partInfo, err := utils.GetPartitionByName(partName)
	if err != nil {
		return nil, fmt.Errorf("GetPartitionByName: %w", err)
	}
	totalCPU := int64(partInfo.GetResTotal().GetCpuCount())
	allocCPU := int64(partInfo.GetResAlloc().GetCpuCount())
	totalGPU := int64(utils.GetGpuNumsFromPartition(partInfo.GetResTotal().GetGresMap()))
	allocGPU := int64(utils.GetGpuNumsFromPartition(partInfo.GetResAlloc().GetGresMap()))

	runningTasks, err := utils.GetTaskByPartitionAndStatus(
		[]string{partName}, []craneProtos.JobStatus{craneProtos.JobStatus_Running})
	if err != nil {
		return nil, fmt.Errorf("get running tasks: %w", err)
	}
	pendingTasks, err := utils.GetTaskByPartitionAndStatus(
		[]string{partName}, []craneProtos.JobStatus{craneProtos.JobStatus_Pending})
	if err != nil {
		return nil, fmt.Errorf("get pending tasks: %w", err)
	}

	runningUsers := make(map[string]struct{})
	for _, t := range runningTasks {
		runningUsers[t.GetUsername()] = struct{}{}
	}
	pendingUsers := make(map[string]struct{})
	for _, t := range pendingTasks {
		pendingUsers[t.GetUsername()] = struct{}{}
	}
	allUsers := make(map[string]struct{})
	for u := range runningUsers {
		allUsers[u] = struct{}{}
	}
	for u := range pendingUsers {
		allUsers[u] = struct{}{}
	}

	return &monitor.PartitionSnapshot{
		Name:                   partName,
		NodeTotal:              nodeTotal,
		NodeRunning:            runningNodes,
		NodeAvailable:          int64(idleNodes),
		NodeUnavailable:        int64(downNodes),
		CoreTotal:              totalCPU,
		CoreRunning:            allocCPU,
		CoreAvailable:          totalCPU - allocCPU,
		CoreUnavailable:        0,
		AcceleratorTotal:       totalGPU,
		AcceleratorRunning:     allocGPU,
		AcceleratorAvailable:   totalGPU - allocGPU,
		AcceleratorUnavailable: 0,
		JobUserCount:           int64(len(allUsers)),
		JobTotal:               int64(len(runningTasks) + len(pendingTasks)),
		JobRunning:             int64(len(runningTasks)),
		JobPending:             int64(len(pendingTasks)),
		JobRunningUsers:        int64(len(runningUsers)),
		JobPendingUsers:        int64(len(pendingUsers)),
	}, nil
}

// countClusterJobUsers 查询全集群活跃作业并统计不同用户数（总计、运行中、排队中）。
func (c *CraneAICollector) countClusterJobUsers(allPartitions []string) (total, running, pending int64) {
	queryUsers := func(states []craneProtos.JobStatus) map[string]struct{} {
		req := &craneProtos.QueryJobsInfoRequest{
			FilterPartitions:            allPartitions,
			FilterStates:                states,
			OptionIncludeCompletedJobs: false,
		}
		resp, err := client.CraneCtld.QueryJobsInfo(context.Background(), req)
		if err != nil || !resp.GetOk() {
			return nil
		}
		users := make(map[string]struct{})
		for _, t := range resp.GetJobInfoList() {
			users[t.GetUsername()] = struct{}{}
		}
		return users
	}

	runningUsers := queryUsers([]craneProtos.JobStatus{craneProtos.JobStatus_Running})
	pendingUsers := queryUsers([]craneProtos.JobStatus{craneProtos.JobStatus_Pending})

	allUsers := make(map[string]struct{}, len(runningUsers)+len(pendingUsers))
	for u := range runningUsers {
		allUsers[u] = struct{}{}
	}
	for u := range pendingUsers {
		allUsers[u] = struct{}{}
	}
	return int64(len(allUsers)), int64(len(runningUsers)), int64(len(pendingUsers))
}

// -------- DB 指标 --------

func (c *CraneAICollector) collectDB() {
	if client.MongoDBClient == nil {
		return
	}
	var connResult struct {
		Connections struct {
			Current int `bson:"current"`
		} `bson:"connections"`
	}
	if err := client.MongoDBClient.Database("admin").RunCommand(
		context.Background(), bson.D{{Key: "serverStatus", Value: 1}},
	).Decode(&connResult); err == nil {
		monitor.DatabaseConnections.WithLabelValues("crane-ai", "active").Set(float64(connResult.Connections.Current))
	} else {
		logrus.Warnf("[CraneAICollector] mongo connections: %v", err)
	}

	if client.MongoDBConfig != nil {
		var sizeResult struct {
			TotalSize int64 `bson:"totalSize"`
		}
		if err := client.MongoDBClient.Database(client.MongoDBConfig.DbName).RunCommand(
			context.Background(), bson.D{{Key: "dbStats", Value: 1}},
		).Decode(&sizeResult); err == nil {
			monitor.DatabaseSize.WithLabelValues(client.MongoDBConfig.DbName).Set(float64(sizeResult.TotalSize))
		} else {
			logrus.Warnf("[CraneAICollector] mongo db size: %v", err)
		}
	}
}
