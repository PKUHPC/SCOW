package utils

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/sirupsen/logrus"

	craneProtos "scow-adapters/gen/crane-ai"
)

var (
	globalPersistence  = NewFilePersistence(ProxyInfos)
	GlobalProxyManager = NewProxyManager(globalPersistence)
)

type SubmitJobProxyInfo struct {
	JobName     string            `json:"new_job_name"`
	JobId       uint32            `json:"job_id"`
	ForwardInfo []*JobForwardInfo `json:"forward_info,omitempty"`
}

// JobForwardInfo 作业端口转发的信息
type JobForwardInfo struct {
	ExecutionNode string `json:"execution_node"`
	StepId        uint32 `json:"step_id"`        // 用于构造 ccon exec {jobId}.{stepId} 查询容器IP
	ContainerPort int32  `json:"container_port"` // 容器内端口，代理目标地址使用此端口
	ContainerIP   string `json:"container_ip"`   // 容器IP，由调用方在创建代理前通过 GetContainerIP 填充
}

// ProxyManager 代理管理器
type ProxyManager struct {
	mu sync.Mutex
	// proxyMap 是运行时代理实例的内存索引，key 格式为 "{jobId}-{containerIP}-{containerPort}"。
	// 每条记录对应一个正在运行的反向代理服务（ProxyService），将外部请求转发到容器内的指定端口。
	// 同一作业若有多个容器端口（如 devHost 同时开 VSCode 和 Jupyter），则有多条记录。
	// 进程重启后该 map 为空；持久化状态由 proxy.json 保存，通过 CleanInvalidProxies 定时补偿清理。
	proxyMap    map[string]*ProxyService
	persistence *FilePersistence // 持久化实例
	ticker      *time.Ticker     // 定时巡检的Ticker
	stopChan    chan struct{}    // 停止定时任务的信号通道
}

// NewProxyManager 创建代理管理器
func NewProxyManager(persistence *FilePersistence) *ProxyManager {
	return &ProxyManager{
		proxyMap:    make(map[string]*ProxyService),
		persistence: persistence,
		stopChan:    make(chan struct{}),
	}
}

type ProxyService struct {
	ctx        context.Context
	cancel     context.CancelFunc
	listener   net.Listener
	proxyPort  int
	targetAddr string
	server     *http.Server
	JobId      uint32
}

// ProxyMeta 代理元信息
type ProxyMeta struct {
	JobName       string `json:"job_name"`       // 作业名
	JobId         uint32 `json:"job_id"`         // 作业ID
	ContainerPort int32  `json:"container_port"` // 容器内端口，用于按端口查找代理
	ProxyPort     int    `json:"proxy_port"`     // master上的代理端口
	TargetNode    string `json:"target_node"`    // 容器运行节点
	TargetAddr    string `json:"target_addr"`    // 容器目标地址（http://nodeIP:port）
}

// FilePersistence 文件持久化实现
type FilePersistence struct {
	filename string // 持久化文件路径
	mu       sync.Mutex
}

// NewFilePersistence 创建文件持久化实例
func NewFilePersistence(filename string) *FilePersistence {
	return &FilePersistence{
		filename: filename,
	}
}

// DeleteByJobId 删除指定作业的所有代理元信息（一个作业可能有多条记录）。
func (f *FilePersistence) DeleteByJobId(jobId uint32) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	metas, err := f.LoadAll()
	if err != nil {
		return fmt.Errorf("failed to load existing metadata: %w", err)
	}

	newMetas := make([]*ProxyMeta, 0)
	for _, m := range metas {
		if m.JobId != jobId {
			newMetas = append(newMetas, m)
		}
	}

	data, err := json.MarshalIndent(newMetas, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to serialize metadata: %w", err)
	}
	if err := ioutil.WriteFile(f.filename, data, 0644); err != nil {
		return fmt.Errorf("fail to write to file: %w", err)
	}

	logrus.Tracef("[job %d] Proxy metadata has been removed from persistent file", jobId)
	return nil
}

// LoadAll 加载所有代理元信息
func (f *FilePersistence) LoadAll() ([]*ProxyMeta, error) {
	data, err := ioutil.ReadFile(f.filename)
	if err != nil {
		if os.IsNotExist(err) {
			return []*ProxyMeta{}, nil // 文件不存在，返回空列表
		}
		return nil, fmt.Errorf("failed to read persistent file: %w", err)
	}

	var metas []*ProxyMeta
	if err := json.Unmarshal(data, &metas); err != nil {
		return nil, fmt.Errorf("failed to deserialize metadata: %w", err)
	}
	return metas, nil
}

// Save 保存代理元信息
func (f *FilePersistence) Save(meta *ProxyMeta) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	// 加载现有数据
	metas, err := f.LoadAll()
	if err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to load existing metadata: %w", err)
	}

	// 去重：唯一标识为 (JobId, ContainerPort)，同一作业+同一容器端口的记录只保留最新的一条
	newMetas := make([]*ProxyMeta, 0)
	found := false
	for _, m := range metas {
		if m.JobId == meta.JobId && m.ContainerPort == meta.ContainerPort {
			newMetas = append(newMetas, meta) // 用新记录覆盖旧记录
			found = true
		} else {
			newMetas = append(newMetas, m)
		}
	}
	if !found {
		newMetas = append(newMetas, meta)
	}

	// 原子写入
	tempFile := f.filename + ".tmp"
	data, err := json.MarshalIndent(newMetas, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to serialize metadata: %w", err)
	}
	tempDir := filepath.Dir(tempFile)
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		return fmt.Errorf("failed to create parent directory for temp file: %w", err)
	}
	if err := os.WriteFile(tempFile, data, 0644); err != nil {
		return fmt.Errorf("failed to write temporary file: %w", err)
	}
	if err := os.Rename(tempFile, f.filename); err != nil {
		return fmt.Errorf("failed to replace persistent file: %w", err)
	}

	logrus.Tracef("[job %s] Proxy metadata has been persisted to a file: %s", meta.JobName, f.filename)
	return nil
}

func NewProxyService(jobId uint32, targetAddr string) (*ProxyService, error) {
	_, err := url.Parse(targetAddr)
	if err != nil {
		return nil, fmt.Errorf("failed to parse target address: %w", err)
	}

	port, err := findAvailablePort()
	if err != nil {
		return nil, fmt.Errorf("failed to search for available ports: %w", err)
	}

	ctx, cancel := context.WithCancel(context.Background())

	return &ProxyService{
		ctx:        ctx,
		cancel:     cancel,
		proxyPort:  port,
		targetAddr: targetAddr,
		JobId:      jobId,
	}, nil
}

func (p *ProxyService) Start() error {
	targetURL, _ := url.Parse(p.targetAddr)
	proxy := httputil.NewSingleHostReverseProxy(targetURL)

	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		logrus.Errorf("[job %d] Proxy request failed: %v, destination address: %s", p.JobId, err, p.targetAddr)
		http.Error(w, "Proxy service temporarily unavailable", http.StatusBadGateway)
	}

	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Header.Set("X-Real-IP", req.RemoteAddr)
		req.Header.Set("X-Forwarded-Host", req.Host)
	}

	listenAddr := fmt.Sprintf("0.0.0.0:%d", p.proxyPort)
	listener, err := net.Listen("tcp", listenAddr)
	if err != nil {
		return fmt.Errorf("[job %d] Listening on port %d failed: %w", p.JobId, p.proxyPort, err)
	}
	p.listener = listener

	p.server = &http.Server{
		Handler:      proxy,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  30 * time.Second,
	}

	go func() {
		logrus.Tracef("[job %d] Proxy service started successfully: crane-master:%d -> %s", p.JobId, p.proxyPort, p.targetAddr)
		if err := p.server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logrus.Errorf("[job %d] Proxy service abnormal exit: %v", p.JobId, err)
		}
	}()

	return nil
}

func (p *ProxyService) Stop() error {
	logrus.Tracef("[job %d] Stop proxy service and release port %d", p.JobId, p.proxyPort)

	p.cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := p.server.Shutdown(shutdownCtx); err != nil {
		logrus.Errorf("[job %d] Elegant shutdown of HTTP service failed, forced shutdown: %v", p.JobId, err)
		if err := p.listener.Close(); err != nil {
			return fmt.Errorf("[job %d] Forcefully closing port %d failed: %w", p.JobId, p.proxyPort, err)
		}
		return nil
	}

	logrus.Tracef("[job %d] Proxy service has stopped, port %d has been released", p.JobId, p.proxyPort)
	return nil
}

// findAvailablePort 查找可用端口（支持指定固定端口恢复）
func findAvailablePort() (int, error) {
	for port := MinPort; port <= MaxPort; port++ {
		listenAddr := fmt.Sprintf("0.0.0.0:%d", port)
		listener, err := net.Listen("tcp", listenAddr)
		if err == nil {
			_ = listener.Close()
			return port, nil
		}
		logrus.Warnf("Port %d is already occupied, try the next one", port)
	}

	return 0, fmt.Errorf("no available ports found (%d-%d)", MinPort, MaxPort)
}

// RecoverProxies 程序启动时恢复所有代理服务（不依赖IsRunning，仅以作业/容器实际状态为准）
func (m *ProxyManager) RecoverProxies() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	logrus.Tracef("Start restoring the proxy service before restarting...")

	// 1. 加载所有持久化的代理元信息
	metas, err := m.persistence.LoadAll()
	if err != nil {
		return fmt.Errorf("failed to load persistent metadata: %w", err)
	}
	if len(metas) == 0 {
		logrus.Tracef("No persistent proxy metadata, no need for recovery")
		return nil
	}

	// 2. 逐个校验并恢复代理
	successCount := 0
	failCount := 0
	cleanCount := 0
	for _, meta := range metas {
		// 重新创建代理实例
		proxy, err := NewProxyService(meta.JobId, meta.TargetAddr)
		if err != nil {
			logrus.Errorf("[job %s] Failed to create proxy instance: %v", meta.JobName, err)
			failCount++
			continue
		}

		// 强制复用原有端口，保证Web服务调用地址不变
		proxy.proxyPort = meta.ProxyPort

		// 4. 启动代理服务
		if err := proxy.Start(); err != nil {
			logrus.Errorf("[job %s] Failed to start proxy service: %v", meta.JobName, err)
			failCount++
			continue
		}

		// 5. 将恢复的代理加入管理器（key 格式与 CreateAndStartProxy 保持一致）
		containerIP, containerPort, _ := ParseTargetAddr(proxy.targetAddr)
		name := proxyKey(proxy.JobId, containerIP, int32(containerPort))
		m.proxyMap[name] = proxy
		successCount++
		logrus.Tracef("[job %s] Proxy service restored successfully, port: %d", meta.JobName, meta.ProxyPort)
	}

	logrus.Tracef("Proxy service recovery completed: %d successful: %d failed: %d invalid cleanup, total %d",
		successCount, failCount, cleanCount, len(metas))
	return nil
}

// proxyKey 构造 proxyMap 的唯一 key，格式："{jobId}-{containerIP}-{containerPort}"。
// 所有对 proxyMap 的读写都必须通过此函数生成 key，确保格式统一。
func proxyKey(jobId uint32, containerIP string, containerPort int32) string {
	return strconv.Itoa(int(jobId)) + "-" + containerIP + "-" + strconv.Itoa(int(containerPort))
}

// CreateAndStartProxy 创建并启动代理。
// 代理目标地址为容器IP:容器端口，容器IP由调用方预先通过 GetContainerIP 填充到 ForwardNodes[i].ContainerIP。
func (m *ProxyManager) CreateAndStartProxy(proxyInfo *SubmitJobProxyInfo) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	jobName, jobId := proxyInfo.JobName, proxyInfo.JobId

	logrus.Infof("Creating proxy service for job %s-%d", jobName, jobId)
	for _, forwardInfo := range proxyInfo.ForwardInfo {
		if forwardInfo.ContainerIP == "" {
			return fmt.Errorf("container IP not set for forward node (job %d, step %d)", jobId, forwardInfo.StepId)
		}

		name := proxyKey(jobId, forwardInfo.ContainerIP, forwardInfo.ContainerPort)
		if _, exists := m.proxyMap[name]; exists {
			logrus.Infof("job %s proxy already exists", name)
			continue
		}

		// 构造代理目标地址：容器IP:容器端口
		targetAddr := fmt.Sprintf("http://%s:%d", forwardInfo.ContainerIP, forwardInfo.ContainerPort)

		// 创建代理实例
		proxy, err := NewProxyService(jobId, targetAddr)
		if err != nil {
			return fmt.Errorf("failed to create proxy: %v", err)
		}

		// 启动代理服务
		if err := proxy.Start(); err != nil {
			return fmt.Errorf("failed to start proxy: %v", err)
		}

		logrus.Infof("Create proxy service for job %s success, target: %s", name, targetAddr)
		m.proxyMap[name] = proxy

		// 持久化代理元信息，TargetNode 存储容器IP
		meta := &ProxyMeta{
			JobName:       jobName,
			JobId:         jobId,
			ContainerPort: forwardInfo.ContainerPort,
			ProxyPort:     proxy.proxyPort,
			TargetNode:    forwardInfo.ContainerIP,
			TargetAddr:    targetAddr,
		}
		if err := m.persistence.Save(meta); err != nil {
			// 持久化失败时停止刚启动的代理并返回错误，避免内存与文件状态不一致导致后续 nil 引用
			_ = proxy.Stop()
			delete(m.proxyMap, name)
			return fmt.Errorf("failed to persist proxy metadata for job %d port %d: %w", jobId, forwardInfo.ContainerPort, err)
		}
	}

	return nil
}

// StopAndRemoveProxy 停止并移除指定作业的所有代理（一个作业可能有多个端口的代理）。
func (m *ProxyManager) StopAndRemoveProxy(jobId uint32) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// proxyMap key 格式为 "{jobId}-{containerIP}-{containerPort}"，
	// 通过前缀 "{jobId}-" 匹配该作业的全部代理条目。
	prefix := strconv.Itoa(int(jobId)) + "-"
	for name, proxy := range m.proxyMap {
		if !strings.HasPrefix(name, prefix) {
			continue
		}
		if err := proxy.Stop(); err != nil {
			logrus.Errorf("[job %d] stop proxy %s failed: %v", jobId, name, err)
		}
		delete(m.proxyMap, name)
	}

	// 从持久化存储中删除该作业的所有代理记录
	if err := m.persistence.DeleteByJobId(jobId); err != nil {
		logrus.Errorf("[job %d] failed to delete persistent metadata: %v", jobId, err)
	}

	return nil
}

// StartPeriodicClean 启动定时清理任务（每30分钟执行一次）
// interval: 清理间隔（如30*time.Minute），便于测试可传更小值（如10*time.Second）
func (m *ProxyManager) StartPeriodicClean(interval time.Duration) {
	// 初始化Ticker
	m.ticker = time.NewTicker(interval)
	logrus.Tracef("The scheduled cleaning task has started, interval: %v", interval)

	// 异步执行定时任务
	go func() {
		for {
			select {
			case <-m.ticker.C:
				// 到达间隔，执行清理代理纪录信息
				if err := m.CleanInvalidProxies(); err != nil {
					logrus.Errorf("Timed cleaning of invalid agents failed: %v", err)
				}
			case <-m.stopChan:
				// 收到停止信号，关闭Ticker并退出
				m.ticker.Stop()
				logrus.Tracef("The scheduled cleaning task has stopped")
				return
			}
		}
	}()
}

// StopPeriodicClean 停止定时清理任务
func (m *ProxyManager) StopPeriodicClean() {
	close(m.stopChan)
}

// CleanInvalidProxies 核心逻辑：清理无效代理
func (m *ProxyManager) CleanInvalidProxies() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	logrus.Infof("Start executing scheduled cleaning of invalid proxy tasks...")

	// 加载所有持久化的代理元信息
	metas, err := m.persistence.LoadAll()
	if err != nil {
		return fmt.Errorf("failed to load persistent metadata: %w", err)
	}
	if len(metas) == 0 {
		logrus.Infof("No persistent proxy metadata, no need to clean up")
		return nil
	}

	// 逐个检查作业状态，清理无效代理
	cleanCount := 0
	skipCount := 0
	// 记录已从持久化文件删除过的 jobId，避免同一作业多个端口重复写文件
	cleanedJobIds := make(map[uint32]bool)
	for _, meta := range metas {
		jobId := meta.JobId
		jobName := meta.JobName

		// 查询作业真实状态
		jobInfo, err := GetJobById(jobId, "")
		if err != nil {
			logrus.Errorf("[job %s] Status query failed, skipping cleanup: %v", jobName, err)
			skipCount++
			continue
		}

		// 判断作业是否为有效状态（Running/Pending）
		jobStatus := jobInfo.Status
		if jobStatus == craneProtos.TaskStatus_Pending || jobStatus == craneProtos.TaskStatus_Running {
			logrus.Tracef("[job %s] Status is %v, keep proxy", jobName, jobStatus)
			skipCount++
			continue
		}

		// 无效状态：停止代理（用 proxyKey 精确定位该条记录对应的 proxyMap 条目）
		key := proxyKey(meta.JobId, meta.TargetNode, meta.ContainerPort)
		if proxy, exists := m.proxyMap[key]; exists {
			if err := proxy.Stop(); err != nil {
				logrus.Errorf("[job %s] Stop proxy failed: %v", jobName, err)
			} else {
				logrus.Tracef("[job %s] Invalid proxy stopped", jobName)
			}
			delete(m.proxyMap, key)
		}

		// 从持久化文件删除该作业的所有代理记录（同一 jobId 只删一次，避免多端口重复写文件）
		if !cleanedJobIds[jobId] {
			if err := m.persistence.DeleteByJobId(jobId); err != nil {
				logrus.Errorf("[job %s] Failed to delete persistent metadata: %v", jobName, err)
			} else {
				logrus.Tracef("[job %s] Persistent metadata has been deleted (job status:%v)", jobName, jobStatus)
				cleanedJobIds[jobId] = true
			}
		}

		cleanCount++
	}

	// 输出清理统计
	logrus.Tracef("cleaning completed: %d invalid agents were cleared, %d valid agents were retained, and a total of %d agents were checked",
		cleanCount, skipCount, len(metas))
	return nil
}

// ParseTargetAddr 从 targetAddr（http://xxx:port）中解析出节点地址和端口
// 参数：
//
//	targetAddr - 格式如 "http://192.168.1.100:8080" 或 "http://node01:9090"
//
// 返回：
//
//	executionNode - 节点IP/域名（如 "192.168.1.100"、"node01"）
//	port - 端口号（如 8080）
//	err - 解析错误（格式非法、端口非数字等）
func ParseTargetAddr(targetAddr string) (executionNode string, port int, err error) {
	// 1. 空值校验
	if strings.TrimSpace(targetAddr) == "" {
		return "", 0, fmt.Errorf("targetAddr is empty")
	}

	// 2. 解析URL（处理http/https协议）
	parsedURL, err := url.Parse(targetAddr)
	if err != nil {
		return "", 0, fmt.Errorf("parse url failed: %w (targetAddr: %s)", err, targetAddr)
	}

	// 3. 提取主机+端口（Host字段格式："host:port"）
	hostPort := parsedURL.Host
	if hostPort == "" {
		return "", 0, fmt.Errorf("invalid targetAddr: no host/port found (targetAddr: %s)", targetAddr)
	}

	// 4. 拆分主机和端口
	// 处理特殊情况：主机包含冒号（如IPv6地址 [::1]:8080）
	host, portStr, err := splitHostPort(hostPort)
	if err != nil {
		return "", 0, fmt.Errorf("split host:port failed: %w (hostPort: %s)", err, hostPort)
	}

	// 5. 端口转换为数字
	port, err = strconv.Atoi(portStr)
	if err != nil {
		return "", 0, fmt.Errorf("port is not a number: %s (hostPort: %s)", portStr, hostPort)
	}

	// 6. 端口合法性校验
	if port <= 0 || port > 65535 {
		return "", 0, fmt.Errorf("invalid port: %d (must 1<=port<=65535)", port)
	}

	return host, port, nil
}

// splitHostPort 安全拆分host:port（兼容IPv6）
// 替代标准库 net.SplitHostPort，避免IPv6地址解析失败
func splitHostPort(hostPort string) (host, port string, err error) {
	// 先尝试标准库拆分（处理IPv4/域名）
	host, port, err = net.SplitHostPort(hostPort)
	if err == nil {
		return host, port, nil
	}

	// 兼容IPv6（格式如 [::1]:8080）
	if strings.HasPrefix(hostPort, "[") && strings.Contains(hostPort, "]:") {
		parts := strings.SplitN(hostPort, "]:", 2)
		if len(parts) != 2 {
			return "", "", fmt.Errorf("invalid IPv6 format: %s", hostPort)
		}
		host = strings.TrimPrefix(parts[0], "[")
		port = parts[1]
		return host, port, nil
	}

	// 无端口的情况（非法）
	return "", "", fmt.Errorf("no port found in %s", hostPort)
}

// LoadJobProxyMetaByPort 从 proxy.json 读取并返回指定作业、指定容器端口的代理元信息。
// 一个作业可能有多个代理（每个容器端口对应一个），通过 ContainerPort 精确匹配。
func LoadJobProxyMetaByPort(jobId uint32, containerPort int32) (*ProxyMeta, error) {
	if jobId == 0 {
		return nil, fmt.Errorf("job id is empty")
	}

	path := filepath.Join(ProxyInfos)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil // 文件不存在，返回空
		}
		return nil, fmt.Errorf("read file %s: %w", path, err)
	}

	var metas []*ProxyMeta
	if err := json.Unmarshal(data, &metas); err != nil {
		return nil, fmt.Errorf("unmarshal json: %w", err)
	}

	for _, meta := range metas {
		if meta.JobId == jobId && meta.ContainerPort == containerPort {
			return meta, nil
		}
	}

	return nil, nil
}

func BuildJobForwardInfo(podMeta *craneProtos.PodTaskAdditionalMeta, stepList []*craneProtos.StepInfo) ([]*JobForwardInfo, error) {
	var jfi []*JobForwardInfo

	// 校验容器端口
	if len(podMeta.Ports) == 0 {
		return jfi, fmt.Errorf("no ports defined in podMeta")
	}
	for _, p := range podMeta.Ports {
		if p.ContainerPort <= 0 {
			return jfi, fmt.Errorf("container port %d in podMeta is invalid (must be > 0)", p.ContainerPort)
		}
	}

	var jobId uint32
	for _, step := range stepList {
		if step.StepType != craneProtos.StepType_PRIMARY {
			continue // 跳过DAEMON类型
		}

		// 所有PRIMARY step的job_id应一致，这里取第一个有效值即可
		if jobId == 0 {
			jobId = step.JobId
		} else if step.JobId != jobId {
			return jfi, fmt.Errorf("the job_id of step is inconsistent (existing: %d, new value: %d)", jobId, step.JobId)
		}

		if len(step.ExecutionNode) == 0 {
			return jfi, fmt.Errorf("the execution_node of PRIMARY step is empty")
		}

		// 为每个节点的每个容器端口各创建一个转发项
		for _, node := range step.ExecutionNode {
			for _, port := range podMeta.Ports {
				jfi = append(jfi, &JobForwardInfo{
					ExecutionNode: node,
					StepId:        step.StepId,
					ContainerPort: port.ContainerPort,
				})
			}
		}
	}

	return jfi, nil
}
