package slurm_config_cache

import (
	"fmt"
	"sync"
	"time"

	"github.com/sirupsen/logrus"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/slurm/config"
	"scow-adapters/pkg/slurm/utils"
)

// Type 定义缓存数据类型
type Type string

const (
	PartitionCache Type = "partition"
)

// Data 表示缓存的数据结构
type Data struct {
	Timestamp time.Time
	ChildData interface{}
}

// System 统一的缓存系统
type System struct {
	// mu 保护 cacheStore。缓存刷新 goroutine 会写入缓存，gRPC 查询路径会读取缓存。
	mu sync.RWMutex
	// cacheStore 保存不同类型的缓存数据。
	cacheStore map[Type]*Data
	// stop 用于通知 Start 循环退出。缓冲为 1，避免重复 Stop 阻塞调用方。
	stop chan struct{}
	// eventSource 接收定时器和 fsnotify 产生的刷新事件。
	eventSource <-chan Info
	// fsRefreshMu 只保护 fsRefreshInProcess，避免同一时间启动多个 fs 更新探测窗口。
	fsRefreshMu sync.Mutex
	// fsRefreshInProcess 表示 slurm.conf 变更后的额外探测窗口正在运行。
	fsRefreshInProcess bool
}

var (
	defaultSlurmConfigPath = "/etc/slurm/slurm.conf"
	defaultRefreshInterval = 300 * time.Second
)

const (
	// fsUpdateRefreshWindow 是 slurm.conf 变更后的高频刷新窗口。
	// 文件变化后，管理员通常会很快执行 scontrol reconfigure，但文件变化本身不代表 Slurm 运行态已更新。
	// 因此在窗口内周期性刷新完整缓存，覆盖新增分区和已有分区配置变更两类场景。
	fsUpdateRefreshWindow = 5 * time.Minute
	// fsUpdateRefreshInterval 是 slurm.conf 变更后高频刷新完整缓存的间隔。
	fsUpdateRefreshInterval = 10 * time.Second
)

// NewSystem 创建新的缓存系统
func NewSystem() (*System, error) {
	var (
		refreshInterval time.Duration
		slurmConfigPath string
	)

	eventSource := make(chan Info)

	// 从配置获取参数或使用默认值
	if config.SlurmValue.SlurmConfCache.SlurmConfigPath != "" {
		slurmConfigPath = config.SlurmValue.SlurmConfCache.SlurmConfigPath
	} else {
		slurmConfigPath = defaultSlurmConfigPath
	}

	if config.SlurmValue.SlurmConfCache.RefreshInterval != 0 {
		refreshInterval = time.Duration(config.SlurmValue.SlurmConfCache.RefreshInterval) * time.Second
	} else {
		refreshInterval = defaultRefreshInterval
	}

	ntf, err := newNotifier(refreshInterval, eventSource, slurmConfigPath)
	if err != nil {
		return nil, err
	}
	go ntf.Run()

	cacheSystem := &System{
		cacheStore:  make(map[Type]*Data),
		stop:        make(chan struct{}, 1),
		eventSource: eventSource,
	}

	// 初始化所有缓存类型
	cacheSystem.cacheStore[PartitionCache] = &Data{}

	return cacheSystem, nil
}

// Start 启动缓存系统
func (cs *System) Start() {
	// 初始缓存加载
	cs.updateAllCache()

	for {
		select {
		case info, ok := <-cs.eventSource:
			if !ok {
				logrus.Warnf("cache event source closed, shutting down cache system")
				return
			}

			logrus.Tracef("event received, scanning... event %v", info.Event)
			switch info.Event {
			case IntervalBased:
				cs.updateAllCache()
			case FSUpdate:
				cs.startFSUpdateRefreshWindow()
			}

		case <-cs.stop:
			logrus.Tracef("shutting down cache system")
			return
		}
	}
}

func (cs *System) startFSUpdateRefreshWindow() {
	// 这里不复用 cacheStore 的读写锁：fsRefreshInProcess 是独立状态，
	// 单独加锁可避免窗口控制和缓存读写互相阻塞。
	cs.fsRefreshMu.Lock()
	if cs.fsRefreshInProcess {
		cs.fsRefreshMu.Unlock()
		logrus.Tracef("fs update refresh window is already running, skip")
		return
	}
	// fsnotify 对一次文件保存可能产生多个事件，窗口运行中只保留一个探测任务。
	cs.fsRefreshInProcess = true
	cs.fsRefreshMu.Unlock()

	go func() {
		defer func() {
			if r := recover(); r != nil {
				logrus.Errorf("fs update refresh window panic recovered: %v", r)
			}

			// 探测窗口结束后释放运行标记，让后续新的 fsnotify 事件可以启动新窗口。
			cs.fsRefreshMu.Lock()
			cs.fsRefreshInProcess = false
			cs.fsRefreshMu.Unlock()
		}()

		cs.refreshAfterFSUpdate()
	}()
}

// refreshAfterFSUpdate 在 slurm.conf 变更后的 5 分钟内高频刷新完整缓存。
// 文件变更不代表 slurmctld 已完成 reconfigure，因此窗口内持续刷新，确保管理员执行 reconfigure 后缓存能尽快更新。
func (cs *System) refreshAfterFSUpdate() {
	cs.updateAllCache()

	ticker := time.NewTicker(fsUpdateRefreshInterval)
	defer ticker.Stop()

	timeout := time.NewTimer(fsUpdateRefreshWindow)
	defer timeout.Stop()

	for {
		select {
		case <-ticker.C:
			logrus.Tracef("refreshing cache after slurm.conf update")
			cs.updateAllCache()
		case <-timeout.C:
			logrus.Tracef("fs update refresh window ended")
			return
		}
	}
}

// Stop 停止缓存系统
func (cs *System) Stop() {
	select {
	case cs.stop <- struct{}{}:
	default:
		// stop 通道已存在待处理信号时直接返回，保证 Stop 可重复调用且不阻塞。
	}
}

// setCache 线程安全地设置缓存
func (cs *System) setCache(cacheType Type, data interface{}) {
	// 写锁保护整个 map 项替换过程，避免查询侧读到部分更新状态。
	cs.mu.Lock()
	defer cs.mu.Unlock()
	cs.cacheStore[cacheType] = &Data{
		Timestamp: time.Now(),
		ChildData: data,
	}
}

// getCache 线程安全地获取缓存
func (cs *System) getCache(cacheType Type) *Data {
	// 读锁允许多个查询并发读取缓存，但会与 setCache 的写入互斥。
	cs.mu.RLock()
	defer cs.mu.RUnlock()
	return cs.cacheStore[cacheType]
}

// updateAllCache 更新所有缓存数据
func (cs *System) updateAllCache() {
	cs.updatePartitionCache()
	// 可以添加其他缓存更新函数
}

// updatePartitionCache 更新分区缓存
func (cs *System) updatePartitionCache() {
	data, err := utils.GetSlurmPartitionInfo()
	if err != nil {
		logrus.Errorf("GetSlurmPartitionInfo failed: %v", err)
		return
	}

	m := make(map[string]*pb.Partition, len(data))
	for _, item := range data {
		m[item.Name] = item
	}

	cs.setCache(PartitionCache, m)
}

// GetPartitions 获取分区缓存信息
func (cs *System) GetPartitions(whitelist []string) ([]*pb.Partition, error) {
	cacheData := cs.getCache(PartitionCache)
	if cacheData == nil || cacheData.ChildData == nil {
		return nil, fmt.Errorf("partition cache is empty")
	}

	partitions, ok := cacheData.ChildData.(map[string]*pb.Partition)
	if !ok {
		return nil, fmt.Errorf("invalid partition cache type")
	}

	results := make([]*pb.Partition, 0, len(partitions))
	if whitelist == nil {
		for _, v := range partitions {
			results = append(results, v)
		}
	} else {
		for _, name := range whitelist {
			if p, ok := partitions[name]; ok {
				results = append(results, p)
			}
		}
	}

	return results, nil
}
