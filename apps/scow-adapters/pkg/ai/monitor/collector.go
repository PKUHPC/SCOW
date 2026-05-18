package monitor

import (
	"fmt"

	"github.com/sirupsen/logrus"
	k8sclient "k8s.io/client-go/kubernetes"

	aiclient "scow-adapters/pkg/ai/client"
	"scow-adapters/pkg/ai/db/models"
	"scow-adapters/pkg/ai/utils"
	"scow-adapters/pkg/common/monitor"
)

// AICollector 基于 K8s Node API 和 AI 适配器 DB 采集集群指标。
// 节点/资源数据复用 utils.GetSummaryClusterNodesInfo，
// 作业数据复用 utils.GetJobsStatusDistribution，
// 分区列表复用 utils.GetQueueList（Volcano Queue = 分区）。
type AICollector struct {
	k8sClient   *k8sclient.Clientset
	clusterName string
}

func NewCollector(k8sClient *k8sclient.Clientset, clusterName string) *AICollector {
	return &AICollector{
		k8sClient:   k8sClient,
		clusterName: clusterName,
	}
}

func (c *AICollector) Collect() (*monitor.ClusterSnapshot, error) {
	c.collectDB()

	// 1. 获取所有分区名（Volcano Queue）
	queues, err := utils.GetQueueList()
	if err != nil {
		return nil, fmt.Errorf("GetQueueList: %w", err)
	}
	allPartitions := make([]string, 0, len(queues))
	for _, q := range queues {
		allPartitions = append(allPartitions, q.Name)
	}

	// 2. 集群级节点/CPU/GPU/作业汇总
	clusterInfo, err := utils.GetSummaryClusterNodesInfo(c.k8sClient, allPartitions)
	if err != nil {
		return nil, fmt.Errorf("GetSummaryClusterNodesInfo: %w", err)
	}

	// 3. 按分区作业数量分布
	partitionJobDist, err := utils.GetJobsStatusDistribution(allPartitions)
	if err != nil {
		logrus.Warnf("[AICollector] GetJobsStatusDistribution: %v", err)
	}

	// 4. 集群级作业用户统计
	clusterUserCount, clusterRunningUsers, clusterPendingUsers := c.countClusterUsers()

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
		JobUserCount:           clusterUserCount,
		JobRunningUsers:        clusterRunningUsers,
		JobPendingUsers:        clusterPendingUsers,
	}

	// 5. 按分区快照（AI 适配器中 Queue 不绑定固定节点，节点/核心/加速卡指标不按分区细分）
	for _, q := range queues {
		jd := partitionJobDist[q.Name]
		us := c.countPartitionUsers(q.Name)

		var jobTotal, jobRunning, jobPending int64
		if jd != nil {
			jobTotal = int64(jd.JobCount)
			jobRunning = int64(jd.RunningJobCount)
			jobPending = int64(jd.PendingJobCount)
		}
		snap.Partitions = append(snap.Partitions, monitor.PartitionSnapshot{
			Name:            q.Name,
			JobUserCount:    us.userCount,
			JobTotal:        jobTotal,
			JobRunning:      jobRunning,
			JobPending:      jobPending,
			JobRunningUsers: us.runningUsers,
			JobPendingUsers: us.pendingUsers,
		})
	}

	return snap, nil
}

// -------- 用户统计 --------

type partitionUserStat struct {
	userCount    int64
	runningUsers int64
	pendingUsers int64
}

// countPartitionUsers 统计指定分区中有 RUNNING/PENDING 作业的去重用户数。
func (c *AICollector) countPartitionUsers(partition string) partitionUserStat {
	var runningNames, pendingNames []string
	aiclient.DB.Model(&models.JobTable{}).
		Where("`partition` = ? AND state = ?", partition, "RUNNING").
		Distinct("user_name").Pluck("user_name", &runningNames)
	aiclient.DB.Model(&models.JobTable{}).
		Where("`partition` = ? AND state = ?", partition, "PENDING").
		Distinct("user_name").Pluck("user_name", &pendingNames)

	userSet := make(map[string]struct{}, len(runningNames)+len(pendingNames))
	for _, u := range runningNames {
		userSet[u] = struct{}{}
	}
	for _, u := range pendingNames {
		userSet[u] = struct{}{}
	}
	return partitionUserStat{
		userCount:    int64(len(userSet)),
		runningUsers: int64(len(runningNames)),
		pendingUsers: int64(len(pendingNames)),
	}
}

// countClusterUsers 统计全集群中有 RUNNING/PENDING 作业的去重用户数。
func (c *AICollector) countClusterUsers() (total, running, pending int64) {
	var runningNames, pendingNames []string
	aiclient.DB.Model(&models.JobTable{}).
		Where("state = ?", "RUNNING").
		Distinct("user_name").Pluck("user_name", &runningNames)
	aiclient.DB.Model(&models.JobTable{}).
		Where("state = ?", "PENDING").
		Distinct("user_name").Pluck("user_name", &pendingNames)

	userSet := make(map[string]struct{}, len(runningNames)+len(pendingNames))
	for _, u := range runningNames {
		userSet[u] = struct{}{}
	}
	for _, u := range pendingNames {
		userSet[u] = struct{}{}
	}
	return int64(len(userSet)), int64(len(runningNames)), int64(len(pendingNames))
}

// -------- DB 指标 --------

func (c *AICollector) collectDB() {
	if aiclient.DB == nil {
		return
	}
	var count int64
	if err := aiclient.DB.Table("information_schema.processlist").Count(&count).Error; err == nil {
		monitor.DatabaseConnections.WithLabelValues("ai", "active").Set(float64(count))
	} else {
		logrus.Warnf("[AICollector] db connections: %v", err)
	}

	var results []struct {
		DatabaseName   string  `gorm:"column:DatabaseName"`
		TotalSizeBytes float64 `gorm:"column:TotalSizeBytes"`
	}
	err := aiclient.DB.Table("information_schema.tables").
		Select("table_schema AS DatabaseName, ROUND(SUM(data_length + index_length), 2) AS TotalSizeBytes").
		Where("table_schema NOT IN (?)", []string{"information_schema", "mysql", "performance_schema", "sys"}).
		Group("table_schema").
		Scan(&results).Error
	if err != nil {
		logrus.Warnf("[AICollector] db size: %v", err)
		return
	}
	for _, r := range results {
		monitor.DatabaseSize.WithLabelValues(r.DatabaseName).Set(r.TotalSizeBytes)
	}
}
