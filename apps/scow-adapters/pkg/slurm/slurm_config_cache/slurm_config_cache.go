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
	mu          sync.RWMutex
	cacheStore  map[Type]*Data
	stop        chan struct{}
	eventSource <-chan Info
}

var (
	defaultSlurmConfigPath = "/etc/slurm/slurm.conf"
	defaultRefreshInterval = 300 * time.Second
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
		case info := <-cs.eventSource:
			logrus.Tracef("event received, scanning... event %v", info.Event)
			cs.updateAllCache()

		case <-cs.stop:
			logrus.Tracef("shutting down cache system")
			return
		}
	}
}

// Stop 停止缓存系统
func (cs *System) Stop() {
	select {
	case cs.stop <- struct{}{}:
	default:
	}
}

// setCache 线程安全地设置缓存
func (cs *System) setCache(cacheType Type, data interface{}) {
	cs.mu.Lock()
	defer cs.mu.Unlock()
	cs.cacheStore[cacheType] = &Data{
		Timestamp: time.Now(),
		ChildData: data,
	}
}

// getCache 线程安全地获取缓存
func (cs *System) getCache(cacheType Type) *Data {
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
