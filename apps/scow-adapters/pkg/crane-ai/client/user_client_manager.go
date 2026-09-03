package client

import (
	"fmt"
	"os/user"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc"

	craneProtos "scow-adapters/gen/crane-ai"
)

const (
	// 用户连接使用有界缓存，避免长期运行的适配器为每个访问过的 UID
	// 永久保留一个 gRPC 连接。达到上限且所有连接都在使用时，新连接不
	// 写入缓存，在当前 RPC 结束后关闭。
	defaultUserClientMaxEntries = 256
	// 连接只有在没有活动 RPC 的情况下才会按空闲时间清理。gRPC 自身也
	// 使用该值作为底层 transport 的 idle timeout。
	defaultUserClientIdleTimeout = 30 * time.Minute
	// 清理不要求实时发生，空闲连接最多会比 TTL 多存活一个巡检周期。
	defaultUserClientCleanupInterval = 5 * time.Minute
)

// craneCtldClientEntry 表示一代用户证书对应的连接。证书轮换时，旧 entry
// 会先退出 UID 缓存；如果还有活动 RPC，则继续保留到最后一次 release。
type craneCtldClientEntry struct {
	client          craneProtos.CraneCtldClient
	conn            *grpc.ClientConn
	certFingerprint string
	active          int
	lastUsed        time.Time
	cached          bool
	closed          bool
}

// craneCtldClientManager 负责用户连接的缓存、引用计数和清理。
// clients 是当前按 UID 可复用的连接；allEntries 还包括已经失效但仍被活动
// RPC 使用的旧连接。所有字段都由 mu 保护，实际 Close 在锁外执行。
type craneCtldClientManager struct {
	mu              sync.Mutex
	clients         map[uint32]*craneCtldClientEntry
	allEntries      map[*craneCtldClientEntry]struct{}
	maxEntries      int
	idleTimeout     time.Duration
	now             func() time.Time
	lookupUser      func(string) (*user.User, error)
	fingerprintCert func(string) (string, error)
	newClient       func(*CraneConfig, string, *uint32) (craneProtos.CraneCtldClient, *grpc.ClientConn, error)
	closeConn       func(*grpc.ClientConn) error
	cleanupStop     chan struct{}
	cleanupDone     chan struct{}
}

func newCraneCtldClientManager() *craneCtldClientManager {
	return &craneCtldClientManager{
		clients:         make(map[uint32]*craneCtldClientEntry),
		allEntries:      make(map[*craneCtldClientEntry]struct{}),
		maxEntries:      defaultUserClientMaxEntries,
		idleTimeout:     defaultUserClientIdleTimeout,
		now:             time.Now,
		lookupUser:      user.LookupId,
		fingerprintCert: fingerprintCertificateFiles,
		newClient:       newCraneCtldClient,
		closeConn: func(conn *grpc.ClientConn) error {
			if conn == nil {
				return nil
			}
			return conn.Close()
		},
	}
}

// acquire 返回可用于当前 RPC 的客户端、对应 entry 和幂等 release。
// 调用者必须执行 release，管理器才能正确维护活动计数并关闭已淘汰连接。
func (m *craneCtldClientManager) acquire(config *CraneConfig, uid uint32) (
	craneProtos.CraneCtldClient, *craneCtldClientEntry, func(), error,
) {
	certDir, err := m.userCertDir(uid)
	if err != nil {
		return nil, nil, nil, err
	}
	fingerprint, err := m.fingerprintCert(certDir)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("fingerprint Crane TLS certificate for UID %d using %s: %w", uid, certDir, err)
	}

	m.mu.Lock()
	now := m.now()
	connectionsToClose := m.removeIdleEntriesLocked(now)
	if entry, ok := m.clients[uid]; ok && entry.certFingerprint == fingerprint {
		entry.active++
		release := m.releaseFunc(entry)
		m.mu.Unlock()
		m.closeConnections(connectionsToClose)
		return entry.client, entry, release, nil
	}

	// 先创建新客户端，再替换旧缓存。证书文件轮换期间暂时不完整时，
	// 创建失败不会破坏仍然可用的旧连接。
	ctldClient, conn, err := m.newClient(config, certDir, &uid)
	if err != nil {
		m.mu.Unlock()
		m.closeConnections(connectionsToClose)
		return nil, nil, nil, fmt.Errorf("create CraneCtld client for UID %d using %s: %w", uid, certDir, err)
	}
	connectionsToClose = append(connectionsToClose, m.replaceCachedEntryLocked(uid)...)

	cacheEntry := m.maxEntries > 0
	if cacheEntry && len(m.clients) >= m.maxEntries {
		if oldConn, removed := m.removeLeastRecentlyUsedEntryLocked(); removed {
			connectionsToClose = append(connectionsToClose, oldConn)
		} else {
			// 缓存已满且所有 entry 都有活动 RPC。新连接只服务本次调用，
			// 避免为扩容缓存而关闭正在使用的连接。
			cacheEntry = false
		}
	}

	entry := &craneCtldClientEntry{
		client: ctldClient, conn: conn, certFingerprint: fingerprint,
		active: 1, lastUsed: now, cached: cacheEntry,
	}
	m.allEntries[entry] = struct{}{}
	if cacheEntry {
		m.clients[uid] = entry
	}
	release := m.releaseFunc(entry)
	m.mu.Unlock()
	m.closeConnections(connectionsToClose)
	return ctldClient, entry, release, nil
}

func (m *craneCtldClientManager) userCertDir(uid uint32) (string, error) {
	osUser, err := m.lookupUser(strconv.FormatUint(uint64(uid), 10))
	if err != nil {
		return "", fmt.Errorf("lookup system user for UID %d: %w", uid, err)
	}
	if osUser.HomeDir == "" {
		return "", fmt.Errorf("system user for UID %d has no home directory", uid)
	}
	return filepath.Join(osUser.HomeDir, ".config", "crane"), nil
}

// replaceCachedEntryLocked 将旧一代连接移出 UID 缓存。活动连接不会立即
// 关闭，而是在最后一个 RPC release 后由 closeEntryIfUnusedLocked 回收。
func (m *craneCtldClientManager) replaceCachedEntryLocked(uid uint32) []*grpc.ClientConn {
	oldEntry, ok := m.clients[uid]
	if !ok {
		return nil
	}
	delete(m.clients, uid)
	oldEntry.cached = false
	if conn := m.closeEntryIfUnusedLocked(oldEntry); conn != nil {
		return []*grpc.ClientConn{conn}
	}
	return nil
}

// releaseFunc 使用 sync.Once 保证重复调用不会重复减引用计数或关闭连接。
func (m *craneCtldClientManager) releaseFunc(entry *craneCtldClientEntry) func() {
	var once sync.Once
	return func() {
		once.Do(func() {
			var conn *grpc.ClientConn
			m.mu.Lock()
			if !entry.closed && entry.active > 0 {
				entry.active--
				entry.lastUsed = m.now()
				if !entry.cached {
					conn = m.closeEntryIfUnusedLocked(entry)
				}
			}
			m.mu.Unlock()
			m.closeConnections([]*grpc.ClientConn{conn})
		})
	}
}

// invalidate 只失效发生错误的那一代连接，防止并发请求已经建立的新连接
// 被旧请求误删。仍有活动 RPC 时，关闭动作延迟到 release。
func (m *craneCtldClientManager) invalidate(uid uint32, entry *craneCtldClientEntry) {
	m.mu.Lock()
	if current, ok := m.clients[uid]; ok && current == entry {
		delete(m.clients, uid)
		entry.cached = false
	}
	conn := m.closeEntryIfUnusedLocked(entry)
	m.mu.Unlock()
	m.closeConnections([]*grpc.ClientConn{conn})
}

func (m *craneCtldClientManager) removeIdleEntriesLocked(now time.Time) []*grpc.ClientConn {
	if m.idleTimeout <= 0 {
		return nil
	}
	var connections []*grpc.ClientConn
	for uid, entry := range m.clients {
		if entry.active != 0 || now.Sub(entry.lastUsed) < m.idleTimeout {
			continue
		}
		delete(m.clients, uid)
		entry.cached = false
		if conn := m.closeEntryIfUnusedLocked(entry); conn != nil {
			connections = append(connections, conn)
		}
	}
	return connections
}

// removeLeastRecentlyUsedEntryLocked 只淘汰没有活动 RPC 的连接。返回 false
// 表示缓存虽然已满，但没有可以安全关闭的连接。
func (m *craneCtldClientManager) removeLeastRecentlyUsedEntryLocked() (*grpc.ClientConn, bool) {
	var lruUID uint32
	var lruEntry *craneCtldClientEntry
	for uid, entry := range m.clients {
		if entry.active != 0 || (lruEntry != nil && !entry.lastUsed.Before(lruEntry.lastUsed)) {
			continue
		}
		lruUID, lruEntry = uid, entry
	}
	if lruEntry == nil {
		return nil, false
	}
	delete(m.clients, lruUID)
	lruEntry.cached = false
	return m.closeEntryIfUnusedLocked(lruEntry), true
}

// closeEntryIfUnusedLocked 是连接关闭的唯一状态门卫。它只标记并返回可以
// 关闭的底层连接；真正的 Close 在锁外执行，避免慢 I/O 阻塞其他 RPC。
func (m *craneCtldClientManager) closeEntryIfUnusedLocked(entry *craneCtldClientEntry) *grpc.ClientConn {
	if entry == nil || entry.closed || entry.cached || entry.active != 0 {
		return nil
	}
	entry.closed = true
	delete(m.allEntries, entry)
	return entry.conn
}

func (m *craneCtldClientManager) closeConnections(connections []*grpc.ClientConn) {
	for _, conn := range connections {
		if conn == nil {
			continue
		}
		if err := m.closeConn(conn); err != nil {
			logrus.Warnf("Close cached CraneCtld connection failed: %v", err)
		}
	}
}

func (m *craneCtldClientManager) cleanupIdleEntries() {
	m.mu.Lock()
	connections := m.removeIdleEntriesLocked(m.now())
	m.mu.Unlock()
	m.closeConnections(connections)
}

func (m *craneCtldClientManager) startCleaner(interval time.Duration) {
	if interval <= 0 {
		return
	}
	m.mu.Lock()
	if m.cleanupStop != nil {
		m.mu.Unlock()
		return
	}
	stop, done := make(chan struct{}), make(chan struct{})
	m.cleanupStop, m.cleanupDone = stop, done
	m.mu.Unlock()
	go func() {
		defer close(done)
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				m.cleanupIdleEntries()
			case <-stop:
				return
			}
		}
	}()
}

func (m *craneCtldClientManager) stopCleaner() {
	m.mu.Lock()
	stop, done := m.cleanupStop, m.cleanupDone
	if stop == nil {
		m.mu.Unlock()
		return
	}
	m.cleanupStop, m.cleanupDone = nil, nil
	close(stop)
	m.mu.Unlock()
	<-done
}
