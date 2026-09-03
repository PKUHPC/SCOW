package client

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"

	craneProtos "scow-adapters/gen/crane-ai"
)

var (
	// craneCtldConn 是适配器启动身份（通常为 root）使用的系统连接。
	// 用户级请求在 TLS 开启且 UID 不同时，必须通过 userClients 获取对应证书连接。
	craneCtldConn *grpc.ClientConn
	userClients   = newCraneCtldClientManager()
)

// currentUserCertDir 返回适配器启动身份的证书目录。
// 用户级证书不使用该路径，而是由 user_client_manager.go 根据 UID 查找用户 home。
func currentUserCertDir(config *CraneConfig) (string, error) {
	if !config.TLS.Enabled || config.TLS.UserTlsCertPath != "" {
		return config.TLS.UserTlsCertPath, nil
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".config", "crane"), nil
}

// CallCraneCtldForUID 使用与 UID 匹配的证书执行一次 CraneCtld RPC。
//
// TLS 开启时，适配器不能让所有用户复用启动时的 root 客户端，否则
// CraneCtld 会因证书 CN UID 与请求 UID 不一致返回 Uid mismatch。只有
// 请求 UID 等于适配器进程 UID 时，才可以复用全局 CraneCtld 客户端。
// TLS 未开启时不存在客户端证书身份，UID 由 RPC 请求字段承担，因此
// 所有用户可以复用全局连接。
func CallCraneCtldForUID[T any](uid uint32, call func(craneProtos.CraneCtldClient) (T, error)) (T, error) {
	var zero T
	if CConfig == nil || CraneCtld == nil {
		return zero, fmt.Errorf("CraneCtld client is not initialized")
	}
	if !CConfig.TLS.Enabled || uid == uint32(os.Getuid()) {
		return call(CraneCtld)
	}
	return callWithUserCraneCtldClient(userClients, CConfig, uid, call)
}

// callWithUserCraneCtldClient 对 Unauthenticated 做一次证书重新加载重试。
// 证书轮换期间旧连接可能仍在缓存中；失效当前连接后再获取会重新计算
// 指纹并创建新连接，最多重试一次，避免服务端持续拒绝时形成重试风暴。
func callWithUserCraneCtldClient[T any](m *craneCtldClientManager, config *CraneConfig, uid uint32, call func(craneProtos.CraneCtldClient) (T, error)) (T, error) {
	var zero T
	for attempt := 0; attempt < 2; attempt++ {
		ctldClient, entry, release, err := m.acquire(config, uid)
		if err != nil {
			return zero, err
		}
		result, callErr := call(ctldClient)
		if status.Code(callErr) != codes.Unauthenticated || attempt == 1 {
			release()
			return result, callErr
		}
		m.invalidate(uid, entry)
		release()
		logrus.Warnf("CraneCtld rejected cached client certificate for UID %d; reloading certificate and retrying once", uid)
	}
	return zero, fmt.Errorf("CraneCtld call for UID %d failed after certificate reload", uid)
}

// newCraneCtldClient 创建一个连接。TLS 开启时，certDir 中的 user.pem/user.key
// 决定 CraneCtld 识别到的用户身份；expectedUID 用于在连接建立前校验证书 CN。
func newCraneCtldClient(config *CraneConfig, certDir string, expectedUID *uint32) (craneProtos.CraneCtldClient, *grpc.ClientConn, error) {
	host := strings.TrimSuffix(strings.TrimSpace(config.ControlMachine), ".")
	transportCredentials := insecure.NewCredentials()
	if config.TLS.Enabled {
		domainSuffix := strings.Trim(strings.TrimSpace(config.TLS.DomainSuffix), ".")
		if domainSuffix != "" && !strings.HasSuffix(host, "."+domainSuffix) {
			host += "." + domainSuffix
		}
		tlsConfig, err := readTLSConfig(config, certDir, expectedUID)
		if err != nil {
			return nil, nil, err
		}
		transportCredentials = credentials.NewTLS(tlsConfig)
	}
	serverAddr := fmt.Sprintf("%s:%s", host, config.CraneCtldListenPort)

	conn, err := grpc.NewClient(serverAddr,
		grpc.WithTransportCredentials(transportCredentials),
		grpc.WithKeepaliveParams(clientKeepAliveParams),
		grpc.WithConnectParams(clientConnectParams),
		grpc.WithIdleTimeout(defaultUserClientIdleTimeout),
	)
	if err != nil {
		return nil, nil, err
	}
	// grpc.NewClient 创建懒连接；连接失败时由 gRPC 按 clientConnectParams 在后台持续重试。
	// 这里不等待 READY，避免 CraneCtld 短暂不可用时让整个 adapter 反复退出和重启。
	return craneProtos.NewCraneCtldClient(conn), conn, nil
}

// CloseCraneCtldClients 停止清理协程并关闭系统客户端及所有用户连接。
// 关闭前先从缓存和活动集合摘除 entry，确保后续 release 不会重复关闭。
func CloseCraneCtldClients() error {
	var closeErrors []error
	userClients.stopCleaner()
	userClients.mu.Lock()
	var userConnections []*grpc.ClientConn
	for entry := range userClients.allEntries {
		if entry.closed {
			continue
		}
		entry.closed, entry.cached = true, false
		userConnections = append(userConnections, entry.conn)
	}
	clear(userClients.clients)
	clear(userClients.allEntries)
	userClients.mu.Unlock()
	for _, conn := range userConnections {
		if err := userClients.closeConn(conn); err != nil {
			closeErrors = append(closeErrors, fmt.Errorf("close cached CraneCtld client: %w", err))
		}
	}
	if craneCtldConn != nil {
		if err := craneCtldConn.Close(); err != nil {
			closeErrors = append(closeErrors, fmt.Errorf("close system CraneCtld client: %w", err))
		}
		craneCtldConn = nil
	}
	return errors.Join(closeErrors...)
}
