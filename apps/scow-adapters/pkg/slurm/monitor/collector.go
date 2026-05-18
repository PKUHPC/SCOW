package monitor

import (
	"bufio"
	"bytes"
	"database/sql"
	"fmt"
	"os/exec"
	"strconv"
	"strings"

	"github.com/sirupsen/logrus"

	"scow-adapters/pkg/common/monitor"
	"scow-adapters/pkg/slurm/utils"
)

// SlurmCollector 基于 sinfo/squeue 采集 Slurm 集群指标，同时采集 Slurm MySQL DB 指标。
type SlurmCollector struct {
	sinfo, squeue string
	db            *sql.DB
	clusterName   string
}

func NewCollector(sinfo, squeue string, db *sql.DB, clusterName string) *SlurmCollector {
	return &SlurmCollector{
		sinfo:       sinfo,
		squeue:      squeue,
		db:          db,
		clusterName: clusterName,
	}
}

func (c *SlurmCollector) Collect() (*monitor.ClusterSnapshot, error) {
	logrus.Tracef("[SlurmCollector] Collect start, cluster=%s", c.clusterName)

	c.collectDB()

	// 一次 sinfo 同时得到集群级（去重节点）和分区级数据
	clusterNodes, partitionNodes, err := c.collectNodeStats()
	if err != nil {
		return nil, fmt.Errorf("sinfo nodes: %w", err)
	}
	logrus.Tracef("[SlurmCollector] collectNodeStats done: nodeTotal=%d nodeRunning=%d nodeAvailable=%d nodeUnavailable=%d coreTotal=%d gpuTotal=%d partitions=%d",
		clusterNodes.nodeTotal, clusterNodes.nodeRunning, clusterNodes.nodeAvailable, clusterNodes.nodeUnavailable,
		clusterNodes.coreTotal, clusterNodes.gpuTotal, len(partitionNodes))

	// 作业信息：按分区和用户统计
	partitionJobs, clusterUsers, err := c.collectJobs()
	if err != nil {
		return nil, fmt.Errorf("squeue jobs: %w", err)
	}
	logrus.Tracef("[SlurmCollector] collectJobs done: partitions=%d clusterUsers=%d",
		len(partitionJobs), len(clusterUsers))

	// 组装快照
	snap := &monitor.ClusterSnapshot{
		ClusterName:            c.clusterName,
		NodeTotal:              clusterNodes.nodeTotal,
		NodeRunning:            clusterNodes.nodeRunning,
		NodeAvailable:          clusterNodes.nodeAvailable,
		NodeUnavailable:        clusterNodes.nodeUnavailable,
		CoreTotal:              clusterNodes.coreTotal,
		CoreRunning:            clusterNodes.coreRunning,
		CoreAvailable:          clusterNodes.coreAvailable,
		CoreUnavailable:        clusterNodes.coreUnavailable,
		AcceleratorTotal:       clusterNodes.gpuTotal,
		AcceleratorRunning:     clusterNodes.gpuRunning,
		AcceleratorAvailable:   clusterNodes.gpuAvailable,
		AcceleratorUnavailable: clusterNodes.gpuUnavailable,
	}

	// 集群级作业聚合
	snap.JobUserCount = int64(len(clusterUsers))
	clusterRunningUsers := make(map[string]struct{})
	clusterPendingUsers := make(map[string]struct{})
	for _, pj := range partitionJobs {
		snap.JobTotal += pj.total
		snap.JobRunning += pj.running
		snap.JobPending += pj.pending
		for u := range pj.runningUsers {
			clusterRunningUsers[u] = struct{}{}
		}
		for u := range pj.pendingUsers {
			clusterPendingUsers[u] = struct{}{}
		}
	}
	snap.JobRunningUsers = int64(len(clusterRunningUsers))
	snap.JobPendingUsers = int64(len(clusterPendingUsers))
	logrus.Tracef("[SlurmCollector] cluster jobs: total=%d running=%d pending=%d users=%d runningUsers=%d pendingUsers=%d",
		snap.JobTotal, snap.JobRunning, snap.JobPending, snap.JobUserCount, snap.JobRunningUsers, snap.JobPendingUsers)

	// 按分区快照
	allPartitions := mergePartitionKeys(partitionNodes, partitionJobs)
	logrus.Tracef("[SlurmCollector] mergePartitionKeys: %v", allPartitions)
	for _, pname := range allPartitions {
		pn := partitionNodes[pname]
		if pn == nil {
			logrus.Tracef("[SlurmCollector] partition %q has no node stats, using zero value", pname)
			pn = &nodeStats{}
		}
		pj := partitionJobs[pname]
		if pj == nil {
			logrus.Tracef("[SlurmCollector] partition %q has no job stats, using zero value", pname)
			pj = &partitionJobStats{}
		}
		users := pj.users
		userCount := int64(len(users))

		psnap := monitor.PartitionSnapshot{
			Name:                   pname,
			NodeTotal:              pn.nodeTotal,
			NodeRunning:            pn.nodeRunning,
			NodeAvailable:          pn.nodeAvailable,
			NodeUnavailable:        pn.nodeUnavailable,
			CoreTotal:              pn.coreTotal,
			CoreRunning:            pn.coreRunning,
			CoreAvailable:          pn.coreAvailable,
			CoreUnavailable:        pn.coreUnavailable,
			AcceleratorTotal:       pn.gpuTotal,
			AcceleratorRunning:     pn.gpuRunning,
			AcceleratorAvailable:   pn.gpuAvailable,
			AcceleratorUnavailable: pn.gpuUnavailable,
			JobUserCount:           userCount,
			JobTotal:               pj.total,
			JobRunning:             pj.running,
			JobPending:             pj.pending,
			JobRunningUsers:        int64(len(pj.runningUsers)),
			JobPendingUsers:        int64(len(pj.pendingUsers)),
		}
		logrus.Tracef("[SlurmCollector] partition %q: nodes(total=%d run=%d avail=%d unavail=%d) cores(total=%d run=%d avail=%d) gpus(total=%d run=%d avail=%d) jobs(total=%d run=%d pend=%d users=%d)",
			pname,
			psnap.NodeTotal, psnap.NodeRunning, psnap.NodeAvailable, psnap.NodeUnavailable,
			psnap.CoreTotal, psnap.CoreRunning, psnap.CoreAvailable,
			psnap.AcceleratorTotal, psnap.AcceleratorRunning, psnap.AcceleratorAvailable,
			psnap.JobTotal, psnap.JobRunning, psnap.JobPending, psnap.JobUserCount)
		snap.Partitions = append(snap.Partitions, psnap)
	}

	logrus.Tracef("[SlurmCollector] Collect done, partitions=%d", len(snap.Partitions))
	return snap, nil
}

// -------- 节点结构 --------

type nodeStats struct {
	nodeTotal, nodeRunning, nodeAvailable, nodeUnavailable int64
	coreTotal, coreRunning, coreAvailable, coreUnavailable int64
	gpuTotal, gpuRunning, gpuAvailable, gpuUnavailable     int64
}

// collectNodeStats 执行一次 sinfo -N --noheader -o "%n|%P|%t|%C|%G"
// 格式：节点名|分区名|节点状态|cpu "allocated/idle/other/total"|gres
// 同时返回集群级统计（按节点去重）和分区级统计（每行计入所属分区）。
func (c *SlurmCollector) collectNodeStats() (*nodeStats, map[string]*nodeStats, error) {
	args := []string{"-N", "--noheader", "-o", "%n|%P|%t|%C|%G"}
	logrus.Tracef("[SlurmCollector] collectNodeStats: exec %s %v", c.sinfo, args)
	out, err := exec.Command(c.sinfo, args...).Output()
	if err != nil {
		return nil, nil, err
	}
	logrus.Tracef("[SlurmCollector] sinfo output: %d bytes", len(out))

	gpuAllocPerNode := c.collectGPUAllocPerNode()
	logrus.Tracef("[SlurmCollector] gpuAllocPerNode: %d nodes with GPU alloc", len(gpuAllocPerNode))

	// 集群级：以节点名去重，同一节点只计一次
	type nodeEntry struct {
		state     string
		coreAlloc int64
		coreIdle  int64
		coreOther int64
		coreTotal int64
		gpuTotal  int64
	}
	seenNodes := make(map[string]*nodeEntry)

	// 分区级：每行计入对应分区
	partStats := make(map[string]*nodeStats)

	scanner := bufio.NewScanner(bytes.NewReader(out))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		parts := strings.Split(line, "|")
		if len(parts) < 5 {
			logrus.Tracef("[SlurmCollector] sinfo: skip malformed line %q", line)
			continue
		}
		nodeName := parts[0]
		partition := strings.TrimSuffix(parts[1], "*")
		state := strings.ToLower(strings.TrimSuffix(parts[2], "*"))
		cAlloc, cIdle, cOther, cTotal := parseCPUField(parts[3])
		gpuTotal := parseGRES(parts[4])
		gpuAlloc := gpuAllocPerNode[nodeName]

		logrus.Tracef("[SlurmCollector] sinfo line: node=%s partition=%s state=%s cpu=%s(%d/%d/%d/%d) gres=%s(total=%d) gpuAlloc=%d",
			nodeName, partition, state, parts[3], cAlloc, cIdle, cOther, cTotal, parts[4], gpuTotal, gpuAlloc)

		// ---- 分区级（每行都累加）----
		ps := partStats[partition]
		if ps == nil {
			ps = &nodeStats{}
			partStats[partition] = ps
		}
		gpuDown := int64(0)
		if classifyState(state) == "unavailable" {
			gpuDown = gpuTotal
		}
		gpuIdle := gpuTotal - gpuAlloc - gpuDown
		if gpuIdle < 0 {
			gpuIdle = 0
		}
		ps.nodeTotal++
		switch classifyState(state) {
		case "running":
			ps.nodeRunning++
		case "available":
			ps.nodeAvailable++
		default:
			ps.nodeUnavailable++
		}
		ps.coreTotal += cTotal
		ps.coreRunning += cAlloc
		ps.coreAvailable += cIdle
		ps.coreUnavailable += cOther
		ps.gpuTotal += gpuTotal
		ps.gpuRunning += gpuAlloc
		ps.gpuAvailable += gpuIdle
		ps.gpuUnavailable += gpuDown

		// ---- 集群级（同一节点只记第一次出现）----
		if _, ok := seenNodes[nodeName]; !ok {
			seenNodes[nodeName] = &nodeEntry{
				state:     state,
				coreAlloc: cAlloc,
				coreIdle:  cIdle,
				coreOther: cOther,
				coreTotal: cTotal,
				gpuTotal:  gpuTotal,
			}
		} else {
			logrus.Tracef("[SlurmCollector] sinfo: node %s in multiple partitions, skipping duplicate for cluster stats", nodeName)
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, nil, err
	}

	logrus.Tracef("[SlurmCollector] sinfo parsed: seenNodes=%d partitions=%d", len(seenNodes), len(partStats))

	// 集群级汇总
	cluster := &nodeStats{}
	for nodeName, e := range seenNodes {
		cluster.coreTotal += e.coreTotal
		cluster.coreRunning += e.coreAlloc
		cluster.coreAvailable += e.coreIdle
		cluster.coreUnavailable += e.coreOther

		cluster.gpuTotal += e.gpuTotal
		gpuAlloc := gpuAllocPerNode[nodeName]
		cluster.gpuRunning += gpuAlloc
		gpuDown := int64(0)
		if classifyState(e.state) == "unavailable" {
			gpuDown = e.gpuTotal
		}
		cluster.gpuUnavailable += gpuDown
		gpuIdle := e.gpuTotal - gpuAlloc - gpuDown
		if gpuIdle < 0 {
			gpuIdle = 0
		}
		cluster.gpuAvailable += gpuIdle

		cluster.nodeTotal++
		switch classifyState(e.state) {
		case "running":
			cluster.nodeRunning++
		case "available":
			cluster.nodeAvailable++
		default:
			cluster.nodeUnavailable++
		}
	}
	return cluster, partStats, nil
}

// collectGPUAllocPerNode 通过 squeue 统计各节点正在使用的 GPU 数。
// 格式：%N|%b  (分配给作业的节点列表 | gres/per-node)
// %b 给出的是每节点 GRES 数，因此展开节点列表后每个节点各加 gpuCount。
// 此查询在不支持 %b 的旧版 Slurm 上可能失败，失败时静默返回空 map。
func (c *SlurmCollector) collectGPUAllocPerNode() map[string]int64 {
	result := make(map[string]int64)
	args := []string{"--noheader", "--states=R", "-o", "%N|%b"}
	logrus.Tracef("[SlurmCollector] collectGPUAllocPerNode: exec %s %v", c.squeue, args)
	out, err := exec.Command(c.squeue, args...).Output()
	if err != nil {
		logrus.Tracef("[SlurmCollector] squeue %%b not supported (old Slurm?): %v", err)
		return result // 旧版 Slurm 不支持 %b，忽略错误
	}
	logrus.Tracef("[SlurmCollector] squeue %%b output: %d bytes", len(out))
	scanner := bufio.NewScanner(bytes.NewReader(out))
	for scanner.Scan() {
		parts := strings.SplitN(strings.TrimSpace(scanner.Text()), "|", 2)
		if len(parts) < 2 {
			continue
		}
		gpuCount := parseGRES(parts[1])
		if gpuCount == 0 {
			continue
		}
		// 用 ParseHostList 将 "node[01-03,05]" 或 "node01,node02" 展开为具体节点名列表
		nodes, ok := utils.ParseHostList(parts[0])
		if !ok || len(nodes) == 0 {
			logrus.Tracef("[SlurmCollector] ParseHostList failed or empty for %q, skip", parts[0])
			continue
		}
		logrus.Tracef("[SlurmCollector] gpuAlloc: hostlist=%q gpuCount=%d nodes=%v", parts[0], gpuCount, nodes)
		for _, node := range nodes {
			result[node] += gpuCount
		}
	}
	logrus.Tracef("[SlurmCollector] collectGPUAllocPerNode result: %d nodes", len(result))
	return result
}

// -------- 作业结构 --------

type partitionJobStats struct {
	total, running, pending int64
	users                   map[string]struct{}
	runningUsers            map[string]struct{}
	pendingUsers            map[string]struct{}
}

// collectJobs 调用 squeue，返回 per-partition 作业统计和集群级用户集合。
// 格式：%P|%u|%T 分区|用户|作业状态
// 只查询 RUNNING 和 PENDING 两种状态，保证 total = running + pending 始终一致。
// 其他过渡状态（COMPLETING、SUSPENDED 等）生命周期极短且不代表用户主动排队/运行意图，不计入。
func (c *SlurmCollector) collectJobs() (map[string]*partitionJobStats, map[string]struct{}, error) {
	args := []string{"--noheader", "--states=RUNNING,PENDING", "-o", "%P|%u|%T"}
	logrus.Tracef("[SlurmCollector] collectJobs: exec %s %v", c.squeue, args)
	out, err := exec.Command(c.squeue, args...).Output()
	if err != nil {
		return nil, nil, err
	}
	logrus.Tracef("[SlurmCollector] squeue jobs output: %d bytes", len(out))

	partJobs := make(map[string]*partitionJobStats)
	clusterUsers := make(map[string]struct{})

	scanner := bufio.NewScanner(bytes.NewReader(out))
	for scanner.Scan() {
		parts := strings.Split(strings.TrimSpace(scanner.Text()), "|")
		if len(parts) < 3 {
			logrus.Tracef("[SlurmCollector] squeue jobs: skip malformed line %q", scanner.Text())
			continue
		}
		partition := parts[0]
		user := parts[1]
		state := strings.ToUpper(parts[2])

		logrus.Tracef("[SlurmCollector] squeue job: partition=%s user=%s state=%s", partition, user, state)

		pj := partJobs[partition]
		if pj == nil {
			pj = &partitionJobStats{
				users:        make(map[string]struct{}),
				runningUsers: make(map[string]struct{}),
				pendingUsers: make(map[string]struct{}),
			}
			partJobs[partition] = pj
		}
		pj.total++
		pj.users[user] = struct{}{}
		clusterUsers[user] = struct{}{}

		switch state {
		case "RUNNING":
			pj.running++
			pj.runningUsers[user] = struct{}{}
		case "PENDING":
			pj.pending++
			pj.pendingUsers[user] = struct{}{}
		}
	}

	for pname, pj := range partJobs {
		logrus.Tracef("[SlurmCollector] partition %q jobs: total=%d running=%d pending=%d users=%d",
			pname, pj.total, pj.running, pj.pending, len(pj.users))
	}

	return partJobs, clusterUsers, scanner.Err()
}

// -------- DB 指标 --------

func (c *SlurmCollector) collectDB() {
	if c.db == nil {
		logrus.Tracef("[SlurmCollector] collectDB: db is nil, skip")
		return
	}
	logrus.Tracef("[SlurmCollector] collectDB: querying active connections")
	var count int64
	if err := c.db.QueryRow(`SELECT COUNT(*) FROM information_schema.processlist WHERE command != 'Sleep'`).Scan(&count); err == nil {
		logrus.Tracef("[SlurmCollector] collectDB: active connections=%d", count)
		monitor.DatabaseConnections.WithLabelValues("slurm", "active").Set(float64(count))
	} else {
		logrus.Warnf("[SlurmCollector] db connections: %v", err)
	}

	logrus.Tracef("[SlurmCollector] collectDB: querying db sizes")
	rows, err := c.db.Query(`
		SELECT table_schema, ROUND(SUM(data_length + index_length)) AS size
		FROM information_schema.tables
		WHERE table_schema NOT IN ('information_schema','mysql','performance_schema','sys')
		GROUP BY table_schema`)
	if err != nil {
		logrus.Warnf("[SlurmCollector] db size: %v", err)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var dbName string
		var size float64
		if err := rows.Scan(&dbName, &size); err == nil {
			logrus.Tracef("[SlurmCollector] collectDB: db=%s size=%.0f bytes", dbName, size)
			monitor.DatabaseSize.WithLabelValues(dbName).Set(size)
		}
	}
}

// -------- 辅助函数 --------

// classifyState 将 Slurm 节点状态归类为 running / available / unavailable。
//
// Slurm 节点状态完整映射（参考 sinfo(1) man page）：
//
//	running   – 节点当前有作业占用资源
//	  alloc/allocated  – 资源已被完全分配
//	  mix/mixed        – 资源被部分分配
//	  comp/completing  – 作业处于 COMPLETING 阶段，资源尚未释放
//	  drng/draining    – 节点标记排干，但仍有作业运行
//
//	available – 节点空闲且接受新作业
//	  idle（无修饰符）
//
//	unavailable – 节点不可调度（所有其余状态）
//	  down                  – 节点宕机
//	  drain/drained         – 已排干，不接受新作业
//	  idle+drain/idle+resv  – 空闲但带有限制修饰符
//	  fail/failing          – 故障中
//	  maint                 – 维护模式
//	  resv/reserved         – 为特定预留使用
//	  futr/future           – 未来节点，尚未上线
//	  plnd/planned          – 计划中，尚未上线
//	  pow_dn/pow_up         – 电源状态切换中
//	  block/blocked         – 已被屏蔽
//	  npc/perfctrs          – 性能计数模式
//	  unk/unknown           – 状态未知
func classifyState(state string) string {
	s := strings.ToLower(state)
	// running：节点有活跃作业，资源被占用
	if strings.Contains(s, "alloc") || strings.Contains(s, "mix") ||
		strings.Contains(s, "comp") || strings.Contains(s, "drng") {
		return "running"
	}
	// available：纯 idle，无任何修饰符
	if s == "idle" {
		return "available"
	}
	// unavailable：其余所有状态（down、drain、idle+drain、idle+resv、maint、resv、futr、plnd、pow_dn、pow_up、fail、block、npc、unk 等）
	return "unavailable"
}

// parseCPUField 解析 sinfo %C 格式 "alloc/idle/other/total"。
func parseCPUField(s string) (alloc, idle, other, total int64) {
	parts := strings.Split(s, "/")
	if len(parts) != 4 {
		return
	}
	alloc, _ = strconv.ParseInt(parts[0], 10, 64)
	idle, _ = strconv.ParseInt(parts[1], 10, 64)
	other, _ = strconv.ParseInt(parts[2], 10, 64)
	total, _ = strconv.ParseInt(parts[3], 10, 64)
	return
}

// parseGRES 从 sinfo %G 或 squeue %b 字段中提取 GPU 总数。
// 支持逗号分隔的多段 GRES，每段由 utils.ValidateGres 解析，自动处理 socket 亲和标记（如 gpu:4(S:0-1)）。
func parseGRES(s string) int64 {
	s = strings.TrimSpace(s)
	if s == "" || s == "(null)" || s == "N/A" {
		return 0
	}
	var total int64
	for _, entry := range strings.Split(s, ",") {
		entry = strings.TrimSpace(entry)
		// squeue %b 输出格式为 "gres/gpu:N"，sinfo %G 输出格式为 "gpu:N"，统一去除 "gres/" 前缀
		entry = strings.TrimPrefix(entry, "gres/")
		name, _, _, countStr, err := utils.ValidateGres(entry)
		if err != nil || name != "gpu" {
			continue
		}
		// countStr 格式为纯数字或带 K/M/G/T 后缀，GPU 通常为纯数字
		n, _ := strconv.ParseInt(strings.TrimRight(countStr, "KkMmGgTt"), 10, 64)
		total += n
	}
	return total
}

// mergePartitionKeys 返回两个 map 中所有键的去重合并列表。
//
// 用于将"有节点记录的分区"与"有作业记录的分区"合并，确保任意一侧独有的分区
// 都能出现在最终快照中。
//
// 例如：
//
//	a（来自 sinfo）= {"gpu": ..., "cpu": ...}
//	b（来自 squeue）= {"cpu": ..., "debug": ...}
//	→ 返回 ["gpu", "cpu", "debug"]（顺序不定，由 map 遍历决定）
//
// 注意：调用方在使用返回的键从 a/b 取值时，需自行处理键不存在（值为 nil）的情况。
func mergePartitionKeys(a map[string]*nodeStats, b map[string]*partitionJobStats) []string {
	seen := make(map[string]struct{})
	for k := range a {
		seen[k] = struct{}{}
	}
	for k := range b {
		seen[k] = struct{}{}
	}
	result := make([]string, 0, len(seen))
	for k := range seen {
		result = append(result, k)
	}
	return result
}
