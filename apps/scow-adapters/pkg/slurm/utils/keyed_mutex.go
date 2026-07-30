package utils

import (
	"context"
	"sync"
	"time"

	"golang.org/x/sync/semaphore"
)

const (
	keyedMutexShardCount = 64
	// associationMutationMaxWait 是服务端对锁等待时间的保护上限。
	// 请求 context 有更早的截止时间时，以请求的截止时间为准。
	associationMutationMaxWait = 5 * time.Minute
)

// KeyedMutex 将不同 key 分散到固定数量的互斥锁中。
// 相同 key 始终使用同一把锁；固定分片避免为大量账户或用户永久保存独立锁对象。
type KeyedMutex struct {
	once   sync.Once
	shards [keyedMutexShardCount]*semaphore.Weighted
}

var (
	// accountAssociationMutationGate 的总权重与分片数相同。常规账户操作占用 1，
	// DeleteUser 等全局操作占用全部权重，因此可以等待所有账户操作结束后独占执行。
	accountAssociationMutationGate = semaphore.NewWeighted(keyedMutexShardCount)
	accountAssociationMutationLock KeyedMutex
)

func (m *KeyedMutex) initialize() {
	m.once.Do(func() {
		for i := range m.shards {
			m.shards[i] = semaphore.NewWeighted(1)
		}
	})
}

func keyedMutexShard(key string) uint32 {
	// 直接实现 FNV-1a，避免每次获取锁时创建 hash.Hash 对象。
	var hash uint32 = 2166136261
	for i := 0; i < len(key); i++ {
		hash ^= uint32(key[i])
		hash *= 16777619
	}
	return hash % keyedMutexShardCount
}

// Lock 锁定 key 对应的分片，并返回解锁函数。
func (m *KeyedMutex) Lock(key string) func() {
	unlock, err := m.LockContext(context.Background(), key)
	if err != nil {
		panic(err)
	}
	return unlock
}

// LockContext 等待 key 对应的分片锁；context 取消后立即停止等待，不产生残留 goroutine。
func (m *KeyedMutex) LockContext(ctx context.Context, key string) (func(), error) {
	m.initialize()
	shard := m.shards[keyedMutexShard(key)]
	if err := shard.Acquire(ctx, 1); err != nil {
		return nil, err
	}
	return func() { shard.Release(1) }, nil
}

// LockAccountAssociationMutation 锁定指定账户的 association 修改。
// 所有修改同一账户 association 或封锁恢复记录的服务入口都必须使用这把共享锁。
// 先取得账户分片，再申请全局权重；等待同一账户的请求不会提前占用全局权重，
// 因此全局操作不需要等待一长串尚未开始执行的同账户请求。
func LockAccountAssociationMutation(ctx context.Context, account string) (func(), error) {
	waitCtx, cancel := context.WithTimeout(ctx, associationMutationMaxWait)
	defer cancel()
	unlockAccount, err := accountAssociationMutationLock.LockContext(waitCtx, account)
	if err != nil {
		return nil, err
	}
	if err := accountAssociationMutationGate.Acquire(waitCtx, 1); err != nil {
		unlockAccount()
		return nil, err
	}
	return func() {
		accountAssociationMutationGate.Release(1)
		unlockAccount()
	}, nil
}

// LockAllAssociationMutations 独占所有账户的 association 修改。
// 仅用于无法限定到单个账户的操作，例如按用户名删除其全部 Slurm association。
func LockAllAssociationMutations(ctx context.Context) (func(), error) {
	waitCtx, cancel := context.WithTimeout(ctx, associationMutationMaxWait)
	defer cancel()
	if err := accountAssociationMutationGate.Acquire(waitCtx, keyedMutexShardCount); err != nil {
		return nil, err
	}
	return func() { accountAssociationMutationGate.Release(keyedMutexShardCount) }, nil
}
