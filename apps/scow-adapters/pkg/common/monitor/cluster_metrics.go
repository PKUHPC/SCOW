package monitor

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/sirupsen/logrus"
)

// MetricsCollectInterval 指标采集周期，系统指标和集群指标共用此间隔。
const MetricsCollectInterval = 30 * time.Second

// -------- Prometheus 指标变量 --------

var (
	// 按集群：节点
	ClusterNodesTotal = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "cluster_nodes_total",
		Help: "Total number of nodes in the cluster",
	}, []string{"cluster"})
	ClusterNodesRunning = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "cluster_nodes_running",
		Help: "Number of running (allocated/mix) nodes in the cluster",
	}, []string{"cluster"})
	ClusterNodesAvailable = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "cluster_nodes_available",
		Help: "Number of idle/available nodes in the cluster",
	}, []string{"cluster"})
	ClusterNodesUnavailable = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "cluster_nodes_unavailable",
		Help: "Number of unavailable (down/drain/fail) nodes in the cluster",
	}, []string{"cluster"})
	ClusterNodeAllocation = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "cluster_node_allocation_ratio",
		Help: "Node allocation ratio (running/total) in the cluster",
	}, []string{"cluster"})

	// 按集群：核心
	ClusterCoresTotal = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "cluster_cores_total",
		Help: "Total number of CPU cores in the cluster",
	}, []string{"cluster"})
	ClusterCoresRunning = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "cluster_cores_running",
		Help: "Number of allocated CPU cores in the cluster",
	}, []string{"cluster"})
	ClusterCoresAvailable = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "cluster_cores_available",
		Help: "Number of idle/available CPU cores in the cluster",
	}, []string{"cluster"})
	ClusterCoresUnavailable = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "cluster_cores_unavailable",
		Help: "Number of unavailable CPU cores in the cluster",
	}, []string{"cluster"})
	ClusterCoreAllocation = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "cluster_core_allocation_ratio",
		Help: "CPU core allocation ratio (running/total) in the cluster",
	}, []string{"cluster"})

	// 按集群：加速卡
	ClusterAcceleratorsTotal = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "cluster_accelerators_total",
		Help: "Total number of accelerators (GPUs/NPUs) in the cluster",
	}, []string{"cluster"})
	ClusterAcceleratorsRunning = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "cluster_accelerators_running",
		Help: "Number of allocated accelerators in the cluster",
	}, []string{"cluster"})
	ClusterAcceleratorsAvailable = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "cluster_accelerators_available",
		Help: "Number of idle/available accelerators in the cluster",
	}, []string{"cluster"})
	ClusterAcceleratorsUnavailable = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "cluster_accelerators_unavailable",
		Help: "Number of unavailable accelerators in the cluster",
	}, []string{"cluster"})
	ClusterAcceleratorAllocation = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "cluster_accelerator_allocation_ratio",
		Help: "Accelerator allocation ratio (running/total) in the cluster",
	}, []string{"cluster"})

	// 按集群：作业
	ClusterJobUsers = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "cluster_job_users",
		Help: "Number of distinct users with active jobs in the cluster",
	}, []string{"cluster"})
	ClusterJobsTotal = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "cluster_jobs_total",
		Help: "Total number of active jobs (running + pending) in the cluster",
	}, []string{"cluster"})
	ClusterJobsRunning = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "cluster_jobs_running",
		Help: "Number of running jobs in the cluster",
	}, []string{"cluster"})
	ClusterJobsPending = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "cluster_jobs_pending",
		Help: "Number of pending jobs in the cluster",
	}, []string{"cluster"})
	ClusterJobsRunningUsers = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "cluster_jobs_running_users",
		Help: "Number of distinct users with running jobs in the cluster",
	}, []string{"cluster"})
	ClusterJobsPendingUsers = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "cluster_jobs_pending_users",
		Help: "Number of distinct users with pending jobs in the cluster",
	}, []string{"cluster"})

	// 按分区：节点
	PartitionNodesTotal = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "partition_nodes_total",
		Help: "Total number of nodes in the partition",
	}, []string{"cluster", "partition"})
	PartitionNodesRunning = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "partition_nodes_running",
		Help: "Number of running nodes in the partition",
	}, []string{"cluster", "partition"})
	PartitionNodesAvailable = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "partition_nodes_available",
		Help: "Number of available (idle) nodes in the partition",
	}, []string{"cluster", "partition"})
	PartitionNodesUnavailable = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "partition_nodes_unavailable",
		Help: "Number of unavailable nodes in the partition",
	}, []string{"cluster", "partition"})
	PartitionNodeAllocation = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "partition_node_allocation_ratio",
		Help: "Node allocation ratio (running/total) in the partition",
	}, []string{"cluster", "partition"})

	// 按分区：核心
	PartitionCoresTotal = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "partition_cores_total",
		Help: "Total number of CPU cores in the partition",
	}, []string{"cluster", "partition"})
	PartitionCoresRunning = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "partition_cores_running",
		Help: "Number of allocated CPU cores in the partition",
	}, []string{"cluster", "partition"})
	PartitionCoresAvailable = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "partition_cores_available",
		Help: "Number of idle CPU cores in the partition",
	}, []string{"cluster", "partition"})
	PartitionCoresUnavailable = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "partition_cores_unavailable",
		Help: "Number of unavailable CPU cores in the partition",
	}, []string{"cluster", "partition"})
	PartitionCoreAllocation = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "partition_core_allocation_ratio",
		Help: "CPU core allocation ratio (running/total) in the partition",
	}, []string{"cluster", "partition"})

	// 按分区：加速卡
	PartitionAcceleratorsTotal = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "partition_accelerators_total",
		Help: "Total number of accelerators in the partition",
	}, []string{"cluster", "partition"})
	PartitionAcceleratorsRunning = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "partition_accelerators_running",
		Help: "Number of allocated accelerators in the partition",
	}, []string{"cluster", "partition"})
	PartitionAcceleratorsAvailable = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "partition_accelerators_available",
		Help: "Number of available accelerators in the partition",
	}, []string{"cluster", "partition"})
	PartitionAcceleratorsUnavailable = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "partition_accelerators_unavailable",
		Help: "Number of unavailable accelerators in the partition",
	}, []string{"cluster", "partition"})
	PartitionAcceleratorAllocation = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "partition_accelerator_allocation_ratio",
		Help: "Accelerator allocation ratio in the partition",
	}, []string{"cluster", "partition"})

	// 按分区：作业
	PartitionJobUsers = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "partition_job_users",
		Help: "Number of distinct users with active jobs in the partition",
	}, []string{"cluster", "partition"})
	PartitionJobsTotal = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "partition_jobs_total",
		Help: "Total number of active jobs in the partition",
	}, []string{"cluster", "partition"})
	PartitionJobsRunning = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "partition_jobs_running",
		Help: "Number of running jobs in the partition",
	}, []string{"cluster", "partition"})
	PartitionJobsPending = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "partition_jobs_pending",
		Help: "Number of pending jobs in the partition",
	}, []string{"cluster", "partition"})
	PartitionJobsPendingUsers = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "partition_jobs_pending_users",
		Help: "Number of distinct users with pending jobs in the partition",
	}, []string{"cluster", "partition"})
	PartitionJobsRunningUsers = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "partition_jobs_running_users",
		Help: "Number of distinct users with running jobs in the partition",
	}, []string{"cluster", "partition"})
)

// -------- 数据结构 --------

// PartitionSnapshot 单个分区的指标快照。
type PartitionSnapshot struct {
	Name string

	NodeTotal       int64
	NodeRunning     int64
	NodeAvailable   int64
	NodeUnavailable int64

	CoreTotal       int64
	CoreRunning     int64
	CoreAvailable   int64
	CoreUnavailable int64

	AcceleratorTotal       int64
	AcceleratorRunning     int64
	AcceleratorAvailable   int64
	AcceleratorUnavailable int64

	JobUserCount    int64
	JobTotal        int64
	JobRunning      int64
	JobPending      int64
	JobPendingUsers int64
	JobRunningUsers int64
}

// ClusterSnapshot 整个集群的指标快照（含按分区细分）。
type ClusterSnapshot struct {
	ClusterName string

	NodeTotal       int64
	NodeRunning     int64
	NodeAvailable   int64
	NodeUnavailable int64

	CoreTotal       int64
	CoreRunning     int64
	CoreAvailable   int64
	CoreUnavailable int64

	AcceleratorTotal       int64
	AcceleratorRunning     int64
	AcceleratorAvailable   int64
	AcceleratorUnavailable int64

	JobUserCount    int64
	JobTotal        int64
	JobRunning      int64
	JobPending      int64
	JobRunningUsers int64
	JobPendingUsers int64

	Partitions []PartitionSnapshot
}

// -------- 接口 --------

// ClusterMetricsCollector 由各适配器实现，负责采集调度器特有指标（包括 DB 指标）。
// Collect 直接更新共享 DB Prometheus 变量（DatabaseConnections/DatabaseSize），
// 并返回集群/分区快照供 StartClusterMetricsCollector 写入 Gauge。
type ClusterMetricsCollector interface {
	Collect() (*ClusterSnapshot, error)
}

// -------- 启动函数 --------

// StartClusterMetricsCollector 启动后台 goroutine，每 30 秒调用一次 collector.Collect()
// 并将结果写入所有集群/分区 Prometheus Gauge。
func StartClusterMetricsCollector(collector ClusterMetricsCollector) {
	go func() {
		ticker := time.NewTicker(MetricsCollectInterval)
		defer ticker.Stop()
		for range ticker.C {
			snapshot, err := collector.Collect()
			if err != nil {
				logrus.Warnf("[ClusterMetrics] collect failed: %v", err)
				continue
			}
			updateClusterMetrics(snapshot)
		}
	}()
}

// updateClusterMetrics 将快照数据写入所有 Prometheus Gauge。
func updateClusterMetrics(s *ClusterSnapshot) {
	c := s.ClusterName

	ClusterNodesTotal.WithLabelValues(c).Set(float64(s.NodeTotal))
	ClusterNodesRunning.WithLabelValues(c).Set(float64(s.NodeRunning))
	ClusterNodesAvailable.WithLabelValues(c).Set(float64(s.NodeAvailable))
	ClusterNodesUnavailable.WithLabelValues(c).Set(float64(s.NodeUnavailable))
	ClusterNodeAllocation.WithLabelValues(c).Set(utilRatio(s.NodeRunning, s.NodeTotal))

	ClusterCoresTotal.WithLabelValues(c).Set(float64(s.CoreTotal))
	ClusterCoresRunning.WithLabelValues(c).Set(float64(s.CoreRunning))
	ClusterCoresAvailable.WithLabelValues(c).Set(float64(s.CoreAvailable))
	ClusterCoresUnavailable.WithLabelValues(c).Set(float64(s.CoreUnavailable))
	ClusterCoreAllocation.WithLabelValues(c).Set(utilRatio(s.CoreRunning, s.CoreTotal))

	ClusterAcceleratorsTotal.WithLabelValues(c).Set(float64(s.AcceleratorTotal))
	ClusterAcceleratorsRunning.WithLabelValues(c).Set(float64(s.AcceleratorRunning))
	ClusterAcceleratorsAvailable.WithLabelValues(c).Set(float64(s.AcceleratorAvailable))
	ClusterAcceleratorsUnavailable.WithLabelValues(c).Set(float64(s.AcceleratorUnavailable))
	ClusterAcceleratorAllocation.WithLabelValues(c).Set(utilRatio(s.AcceleratorRunning, s.AcceleratorTotal))

	ClusterJobUsers.WithLabelValues(c).Set(float64(s.JobUserCount))
	ClusterJobsTotal.WithLabelValues(c).Set(float64(s.JobTotal))
	ClusterJobsRunning.WithLabelValues(c).Set(float64(s.JobRunning))
	ClusterJobsPending.WithLabelValues(c).Set(float64(s.JobPending))
	ClusterJobsRunningUsers.WithLabelValues(c).Set(float64(s.JobRunningUsers))
	ClusterJobsPendingUsers.WithLabelValues(c).Set(float64(s.JobPendingUsers))

	for _, p := range s.Partitions {
		pn := p.Name
		PartitionNodesTotal.WithLabelValues(c, pn).Set(float64(p.NodeTotal))
		PartitionNodesRunning.WithLabelValues(c, pn).Set(float64(p.NodeRunning))
		PartitionNodesAvailable.WithLabelValues(c, pn).Set(float64(p.NodeAvailable))
		PartitionNodesUnavailable.WithLabelValues(c, pn).Set(float64(p.NodeUnavailable))
		PartitionNodeAllocation.WithLabelValues(c, pn).Set(utilRatio(p.NodeRunning, p.NodeTotal))

		PartitionCoresTotal.WithLabelValues(c, pn).Set(float64(p.CoreTotal))
		PartitionCoresRunning.WithLabelValues(c, pn).Set(float64(p.CoreRunning))
		PartitionCoresAvailable.WithLabelValues(c, pn).Set(float64(p.CoreAvailable))
		PartitionCoresUnavailable.WithLabelValues(c, pn).Set(float64(p.CoreUnavailable))
		PartitionCoreAllocation.WithLabelValues(c, pn).Set(utilRatio(p.CoreRunning, p.CoreTotal))

		PartitionAcceleratorsTotal.WithLabelValues(c, pn).Set(float64(p.AcceleratorTotal))
		PartitionAcceleratorsRunning.WithLabelValues(c, pn).Set(float64(p.AcceleratorRunning))
		PartitionAcceleratorsAvailable.WithLabelValues(c, pn).Set(float64(p.AcceleratorAvailable))
		PartitionAcceleratorsUnavailable.WithLabelValues(c, pn).Set(float64(p.AcceleratorUnavailable))
		PartitionAcceleratorAllocation.WithLabelValues(c, pn).Set(utilRatio(p.AcceleratorRunning, p.AcceleratorTotal))

		PartitionJobUsers.WithLabelValues(c, pn).Set(float64(p.JobUserCount))
		PartitionJobsTotal.WithLabelValues(c, pn).Set(float64(p.JobTotal))
		PartitionJobsRunning.WithLabelValues(c, pn).Set(float64(p.JobRunning))
		PartitionJobsPending.WithLabelValues(c, pn).Set(float64(p.JobPending))
		PartitionJobsPendingUsers.WithLabelValues(c, pn).Set(float64(p.JobPendingUsers))
		PartitionJobsRunningUsers.WithLabelValues(c, pn).Set(float64(p.JobRunningUsers))
	}
}

func utilRatio(used, total int64) float64 {
	if total == 0 {
		return 0
	}
	return float64(used) / float64(total)
}
