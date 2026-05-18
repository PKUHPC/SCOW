package utils

import (
	"archive/tar"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	re "k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/dynamic"
	k8sclient "k8s.io/client-go/kubernetes"
	restclient "k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/remotecommand"
	"k8s.io/client-go/util/flowcontrol"
	vc "volcano.sh/apis/pkg/apis/scheduling/v1beta1"
	volcanoclientset "volcano.sh/apis/pkg/client/clientset/versioned"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/config"
	"scow-adapters/pkg/ai/db/models"
)

type ClusterNodesInfo struct {
	NodeCount             uint32
	RunningNodeCount      uint32
	IdleNodeCount         uint32
	NotAvailableNodeCount uint32
	CpuCoreCount          uint32
	RunningCpuCount       uint32
	IdleCpuCount          uint32
	NotAvailableCpuCount  uint32
	GpuCoreCount          uint32
	RunningGpuCount       uint32
	IdleGpuCount          uint32
	NotAvailableGpuCount  uint32
	JobCount              uint32
	RunningJobCount       uint32
	PendingJobCount       uint32
	NodeUsage             float32
	CpuUsage              float32
	GpuUsage              float32
}

type InferenceStatus struct {
	Status    string    // 最终状态：Running, Pending, Failed, Success
	StartTime time.Time // 开始运行时间
	EndTime   time.Time // 结束时间
	Log       string
}

type Resource struct {
	CPU              int64
	Mem              int64
	Accelerator      string
	AcceleratorCount int64
}

type PodExec struct {
	Stdin  *io.PipeWriter // 写入到Pod的stdin
	Stdout *io.PipeReader // 读取Pod的stdout
	Stderr *io.PipeReader // 读取Pod的stderr
	closer func() error   // 关闭流的函数
}

// Close 关闭exec流
func (e *PodExec) Close() error {
	if e.closer != nil {
		return e.closer()
	}
	return nil
}

// GetClusterNodesInfo 获取集群中节点的信息
func GetClusterNodesInfo(cli *k8sclient.Clientset, parts []*pb.PartitionInfo, allPods []corev1.Pod, totalNodes, runningNodes, idleNodes, notAvailableNodes uint32) (*ClusterNodesInfo, error) {
	var (
		cpuCoreCount         uint32
		runningCpuCount      uint32
		idleCpuCount         uint32
		notAvailableCpuCount uint32
		gpuCoreCount         uint32
		runningGpuCount      uint32
		idleGpuCount         uint32
		notAvailableGpuCount uint32
		jobCount             uint32
		runningJobCount      uint32
		pendingJobCount      uint32
	)

	nodeList, err := GetWorkNodes(cli)
	if err != nil {
		logrus.Errorf("get all nodes error: %v", err)
		return nil, err
	}
	for _, node := range nodeList.Items {
		nodeTmp := node.DeepCopy()
		resource := GetResource(&node.Status.Capacity)
		allocCpuCount, allocMemCount, allocGpusCount, _ := GetNodeAllocatedResources(nodeTmp, allPods)
		idleMem := int(resource.Mem) - allocMemCount
		logrus.Tracef("node %s, idle mem: %d", node.Name, idleMem)

		cpuCoreCount += uint32(resource.CPU)
		gpuCoreCount += uint32(resource.AcceleratorCount)

		if !isReadyNode(&node) {
			notAvailableNodes += 1
			notAvailableCpuCount += uint32(resource.CPU)
			notAvailableGpuCount += uint32(resource.AcceleratorCount)
		}
		runningCpuCount += uint32(allocCpuCount)
		runningGpuCount += uint32(allocGpusCount)
	}

	idleCpuCount = cpuCoreCount - runningCpuCount - notAvailableCpuCount
	idleGpuCount = gpuCoreCount - runningGpuCount - notAvailableGpuCount

	for _, part := range parts {
		jobCount += part.JobCount
		runningJobCount += part.RunningJobCount
		pendingJobCount += part.PendingJobCount
	}

	return &ClusterNodesInfo{
		NodeCount:             totalNodes,
		RunningNodeCount:      runningNodes,
		IdleNodeCount:         idleNodes,
		NotAvailableNodeCount: notAvailableNodes,
		CpuCoreCount:          cpuCoreCount,
		RunningCpuCount:       runningCpuCount,
		IdleCpuCount:          idleCpuCount,
		NotAvailableCpuCount:  notAvailableCpuCount,
		GpuCoreCount:          gpuCoreCount,
		RunningGpuCount:       runningGpuCount,
		IdleGpuCount:          idleGpuCount,
		NotAvailableGpuCount:  notAvailableGpuCount,
		JobCount:              jobCount,
		RunningJobCount:       runningJobCount,
		PendingJobCount:       pendingJobCount,
	}, nil
}

func AllActivePods(clientSet *k8sclient.Clientset) ([]corev1.Pod, error) {
	podList, err := clientSet.CoreV1().Pods("").List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		logrus.Infof("failed to list pods: %s", err)
		return nil, err
	}
	var activePods []corev1.Pod
	queues, _ := GetQueueList()
	for _, pod := range podList.Items {
		if !IsQueue(queues, pod.Namespace) { //踢出非队列命名空间的pod
			continue
		}
		if pod.Status.Phase == corev1.PodSucceeded || pod.Status.Phase == corev1.PodFailed {
			continue
		}
		activePods = append(activePods, pod)
	}
	logrus.Infof("Running pod count: %d", len(activePods))
	return activePods, nil
}

// GetNodesInfo 获取节点信息，nodeNames列表为空时表示获取集群所有节点信息；不为空则获取nodeNames列表的节点信息
func GetNodesInfo(cli *k8sclient.Clientset, nodeName []string) ([]*pb.NodeInfo, error) {
	var nodesInfo []*pb.NodeInfo
	// 获取所有active pod
	allPods, err := AllActivePods(cli)
	if err != nil {
		return nil, err
	}

	if len(nodeName) == 0 {
		// 获取所有节点
		nodeList, err := GetWorkNodes(cli)
		if err != nil {
			return nil, err
		}
		for _, node := range nodeList.Items {
			nodeTmp := node
			nodeInfo, err := parseNodeInfo(&nodeTmp, allPods)
			if err != nil {
				return nil, err
			}
			nodesInfo = append(nodesInfo, nodeInfo)
		}
		return nodesInfo, nil
	}

	for _, n := range nodeName {
		node, err := GetNodeByName(cli, n)
		if err != nil {
			return nil, err
		}
		nodeInfo, err := parseNodeInfo(node, allPods)
		if err != nil {
			return nil, err
		}
		nodesInfo = append(nodesInfo, nodeInfo)
	}
	return nodesInfo, nil
}

func GetSummaryClusterNodesInfo(cli *k8sclient.Clientset, authorizedPartitions []string) (*ClusterNodesInfo, error) {
	var (
		cpuCoreCount         uint32
		runningCpuCount      uint32
		idleCpuCount         uint32
		notAvailableCpuCount uint32
		gpuCoreCount         uint32
		runningGpuCount      uint32
		idleGpuCount         uint32
		notAvailableGpuCount uint32
		totalJobCount        uint32
		runningJobCount      uint32
		pendingJobCount      uint32
	)

	nodeList, err := GetAuthorizedPartitionsNodes(cli, authorizedPartitions)
	if err != nil {
		logrus.Errorf("get all nodes error: %v", err)
		return nil, err
	}
	allpods, err := AllActivePods(cli)
	if err != nil {
		logrus.Errorf("get all pod failed")
		return nil, err
	}

	totalNodes, runningNodes, idleNodes, notAvailableNodes, err := GetClusterNodesStatus(cli, nodeList, allpods)
	logrus.Debugf("GetPartitionsInfo totalNodes: %v, runningNodes: %v, idleNodes: %v, notAvailableNodes: %v", totalNodes, runningNodes, idleNodes, notAvailableNodes)
	if err != nil {
		return nil, fmt.Errorf("failed get nodes: %v", err)
	}

	for _, node := range nodeList {
		nodeTmp := node.DeepCopy()
		resource := GetResource(&node.Status.Capacity)
		cpuCoreCount += uint32(resource.CPU)
		gpuCoreCount += uint32(resource.AcceleratorCount)

		allocCpuCount, _, allocGpusCount, _ := GetNodeAllocatedResources(nodeTmp, allpods)

		if !isReadyNode(node) {
			notAvailableCpuCount += uint32(resource.CPU)
			notAvailableGpuCount += uint32(resource.AcceleratorCount)
		}

		runningCpuCount += uint32(allocCpuCount)
		runningGpuCount += uint32(allocGpusCount)
	}

	idleCpuCount = cpuCoreCount - runningCpuCount - notAvailableCpuCount
	idleGpuCount = gpuCoreCount - runningGpuCount - notAvailableGpuCount

	distributionJobs, err := GetJobsStatusDistribution(authorizedPartitions)
	if err != nil {
		return nil, err
	}
	// 聚合作业统计信息
	for _, jobs := range distributionJobs {
		totalJobCount += jobs.JobCount
		runningJobCount += jobs.RunningJobCount
		pendingJobCount += jobs.PendingJobCount
	}

	var nodeUsage, cpuUsage, gpuUsage float32
	if totalNodes > 0 {
		resultRatio := float64(runningNodes) / float64(totalNodes)
		nodeUsage = float32(math.Round(float64(resultRatio)*100*100) / 100)
	}
	if cpuCoreCount > 0 {
		resultRatio := float64(runningCpuCount) / float64(cpuCoreCount)
		cpuUsage = float32(math.Round(float64(resultRatio)*100*100) / 100)
	}
	if gpuCoreCount > 0 {
		resultRatio := float64(runningGpuCount) / float64(gpuCoreCount)
		gpuUsage = float32(math.Round(float64(resultRatio)*100*100) / 100)
	}

	return &ClusterNodesInfo{
		NodeCount:             totalNodes,
		RunningNodeCount:      runningNodes,
		IdleNodeCount:         idleNodes,
		NotAvailableNodeCount: notAvailableNodes,
		CpuCoreCount:          cpuCoreCount,
		RunningCpuCount:       runningCpuCount,
		IdleCpuCount:          idleCpuCount,
		NotAvailableCpuCount:  notAvailableCpuCount,
		GpuCoreCount:          gpuCoreCount,
		RunningGpuCount:       runningGpuCount,
		IdleGpuCount:          idleGpuCount,
		NotAvailableGpuCount:  notAvailableGpuCount,
		JobCount:              totalJobCount,
		RunningJobCount:       runningJobCount,
		PendingJobCount:       pendingJobCount,
		NodeUsage:             nodeUsage,
		CpuUsage:              cpuUsage,
		GpuUsage:              gpuUsage,
	}, nil
}

// GetNodeByName retrieves one node object.
func GetNodeByName(cli *k8sclient.Clientset, nodeName string) (*corev1.Node, error) {
	// Get the node object using node name
	node, err := cli.CoreV1().Nodes().Get(context.TODO(), nodeName, metav1.GetOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil, nil
		}
		return nil, err
	}

	return node, nil
}

// GetALLNodes retrieves all the node objects.
func GetALLNodes(cli *k8sclient.Clientset) (*corev1.NodeList, error) {
	return cli.CoreV1().Nodes().List(context.TODO(), metav1.ListOptions{})
}

// GetWorkNodes retrieves all the work node objects.
func GetWorkNodes(cli *k8sclient.Clientset) (*corev1.NodeList, error) {
	allNodes, err := cli.CoreV1().Nodes().List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list nodes: %w", err)
	}
	// 过滤掉 Master 节点
	workerNodes := &corev1.NodeList{}
	for _, node := range allNodes.Items {
		if !isMasterNode(node) {
			workerNodes.Items = append(workerNodes.Items, node)
		}
	}

	return workerNodes, nil
}

// isMasterNode 判断节点是否为 Master 节点
func isMasterNode(node corev1.Node) bool {
	labels := node.Labels
	_, hasControlPlane := labels["node-role.kubernetes.io/control-plane"]
	_, hasMaster := labels["node-role.kubernetes.io/master"]
	_, hasWorker := labels["node-role.kubernetes.io/worker"]
	logrus.Tracef("[isMasterNode] hasControlPlane:%v, hasMaster:%v, hasWorker:%v", hasControlPlane, hasMaster, hasWorker)
	//  排除只有一个节点的场景
	if hasWorker {
		return false
	}
	return hasControlPlane || hasMaster
}

func GetPodsByNamespace(cli *k8sclient.Clientset, namespace string) (*corev1.PodList, error) {
	pods, err := cli.CoreV1().Pods(namespace).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	return pods, nil
}

func getPodResource(pod *corev1.Pod) (cpuCount, memCount, gpuCount int64) {
	containers := pod.Spec.Containers
	for _, container := range containers {
		res := GetResource(&container.Resources.Requests)
		cpuCount += res.CPU
		memCount += res.Mem
		gpuCount += res.AcceleratorCount
	}
	return
}

func GetNodeAllocatedResources(node *corev1.Node, pods []corev1.Pod) (cpuAlloc, memAlloc, gpuAlloc, vcJobCount int) {
	if node == nil {
		return
	}
	nodeName := node.ObjectMeta.Name
	for _, pod := range pods {
		if pod.Spec.NodeName != nodeName {
			continue
		}
		tmpPod := pod
		cpu, mem, gpu := getPodResource(&tmpPod)
		cpuAlloc += int(cpu)
		memAlloc += int(mem)
		gpuAlloc += int(gpu)
		if _, ok := pod.Labels["volcano.sh/job-name"]; ok {
			vcJobCount += 1
		}
	}
	logrus.Infof("node: %s, allcpu: %d, allmem: %d, allgpu: %d, vcjobCount: %d", nodeName, cpuAlloc, memAlloc, gpuAlloc, vcJobCount)
	return
}

func parseNodeInfo(node *corev1.Node, pods []corev1.Pod) (*pb.NodeInfo, error) {
	if node == nil {
		return nil, fmt.Errorf("node is nil")
	}
	nodeName := node.ObjectMeta.Name
	var nodeState pb.NodeInfo_NodeState

	allocCpuCoresInt, allocMemInt, allocGpusInt, vcJobCount := GetNodeAllocatedResources(node, pods)
	resource := GetResource(&node.Status.Capacity)
	idleCpuCount, idleMemCount, idleGpuCount := int(resource.CPU)-allocCpuCoresInt, int(resource.Mem)-allocMemInt, int(resource.AcceleratorCount)-allocGpusInt
	queueNames := GetNodeQueueNames(*node)
	if isReadyNode(node) {
		nodeState = pb.NodeInfo_IDLE
		if vcJobCount > 0 {
			nodeState = pb.NodeInfo_RUNNING
		}
	} else {
		nodeState = pb.NodeInfo_NOT_AVAILABLE
	}

	return &pb.NodeInfo{
		NodeName:          nodeName,
		Partitions:        queueNames,
		State:             nodeState,
		CpuCoreCount:      uint32(resource.CPU),
		AllocCpuCoreCount: uint32(allocCpuCoresInt),
		IdleCpuCoreCount:  uint32(idleCpuCount),
		TotalMemMb:        uint32(resource.Mem),
		AllocMemMb:        uint32(allocMemInt),
		IdleMemMb:         uint32(idleMemCount),
		GpuCount:          uint32(resource.AcceleratorCount),
		AllocGpuCount:     uint32(allocGpusInt),
		IdleGpuCount:      uint32(idleGpuCount),
		Removable:         vcJobCount == 0,
	}, nil
}

func isReadyNode(node *corev1.Node) bool {
	// 1. 检查节点是否正在被删除
	if node.DeletionTimestamp != nil {
		return false
	}

	// 2. 检查节点是否被标记为不可调度（Unschedulable）
	if node.Spec.Unschedulable {
		return false
	}

	// 3. 遍历节点的状态条件（Conditions）
	isReady := false
	for _, condition := range node.Status.Conditions {
		switch condition.Type {
		case corev1.NodeReady:
			// Ready 状态必须为 True
			if condition.Status != corev1.ConditionTrue {
				return false
			}
			isReady = true
		case corev1.NodeMemoryPressure, corev1.NodeDiskPressure, corev1.NodePIDPressure, corev1.NodeNetworkUnavailable:
			// 如果有资源压力（如内存、磁盘、进程数）或网络不可用，则节点不可用
			if condition.Status == corev1.ConditionTrue {
				return false
			}
		}
	}
	logrus.Tracef("[isReadyNode] status: %v", isReady)
	return isReady
}

func GetResource(resource *corev1.ResourceList) (res *Resource) {
	res = &Resource{}
	if resource == nil {
		return res
	}
	var (
		cpuCount, memCount, acceleratorCount int64
		accelerator                          string
	)
	for name, q := range resource.DeepCopy() {
		resName := name.String()
		switch {
		case resName == string(corev1.ResourceCPU):
			cpuCount += q.Value()
		case resName == string(corev1.ResourceMemory):
			memCount += getMemoryInMb(q)
		default:
			if !isAccelerator(resName) {
				continue
			}
			accelerator = resName
			acceleratorCount += q.Value()
		}
	}
	res.CPU = cpuCount
	res.Mem = memCount
	res.AcceleratorCount = acceleratorCount
	res.Accelerator = accelerator
	return res
}

func isAccelerator(name string) bool {
	// 格式验证：必须是 vendor-domain/type 格式
	for _, accelerator := range config.Value.Accelerator {
		if accelerator == name {
			return true
		}
	}
	logrus.Infof("accelerator: %s", name)
	return false
}

// 简易域名格式验证
func isValidDomain(domain string) bool {
	return strings.Contains(domain, ".") &&
		!strings.HasPrefix(domain, "kubernetes.io/") &&
		!strings.Contains(domain, "pod")
}

func GetDnsConfig() (corev1.DNSPolicy, corev1.PodDNSConfig) {
	var dnsPolicy corev1.DNSPolicy
	var dnsConfig corev1.PodDNSConfig
	var nameServers []string
	if config.Value.Dns.Enabled {
		dnsPolicy = corev1.DNSNone
		for _, server := range config.Value.Dns.NameServers {
			nameServers = append(nameServers, server)
		}
		dnsConfig.Nameservers = nameServers
	} else {
		dnsPolicy = corev1.DNSClusterFirst
		dnsConfig.Nameservers = []string{}
	}

	return dnsPolicy, dnsConfig
}

func GetRDMAConfig(partition string) (string, int, corev1.SecurityContext, map[string]string) {
	rdmaConfigMap := config.Value.RDMAConfig.Queues
	rdmaConfig, exists := rdmaConfigMap[partition]
	if exists {
		resourceName := ""
		resourceQuantity := 0
		for s, i := range rdmaConfig.RDMADevices {
			resourceName = s
			resourceQuantity = i
		}

		securityContext := corev1.SecurityContext{
			Capabilities: &corev1.Capabilities{
				Add: []corev1.Capability{IPCLOCK},
			},
		}
		annotations := map[string]string{
			RDMANetworkKey: rdmaConfig.CNINetworks,
		}
		return resourceName, resourceQuantity, securityContext, annotations
	}

	return "", 0, corev1.SecurityContext{}, map[string]string{}
}

// GetQueueNodes 获取所有队列下的所有节点
func GetQueueNodes(cli *k8sclient.Clientset) (map[string][]*corev1.Node, error) {
	queueMap := make(map[string][]*corev1.Node)
	nodeList, err := GetWorkNodes(cli)
	if err != nil {
		return nil, err
	}

	for i, node := range nodeList.Items {
		// 获取节点所属队列集合
		queueNames := GetNodeQueueNames(node)
		for _, queueName := range queueNames {
			// 初始化队列切片（如果尚未初始化）
			if _, exists := queueMap[queueName]; !exists {
				queueMap[queueName] = []*corev1.Node{}
			}
			// 添加节点到对应的队列
			queueMap[queueName] = append(queueMap[queueName], &nodeList.Items[i])
		}
	}

	return queueMap, nil
}

// getKubeConfig returns the kubeConfig for the cluster
func GetKubeConfig(path string) (*restclient.Config, error) {
	if path == "" {
		return restclient.InClusterConfig()
	}

	if _, err := os.Stat(path); os.IsNotExist(err) {
		return restclient.InClusterConfig()
	}

	return clientcmd.BuildConfigFromFlags("", path)
}

// GetK8sClient creates and returns a new K8sClient from given config
func GetK8sClient() (*k8sclient.Clientset, error) {
	kubeConfigFile := config.Value.KubeConfig
	kubeConfig, err := GetKubeConfig(kubeConfigFile)
	kubeConfig.RateLimiter = flowcontrol.NewTokenBucketRateLimiter(1000, 1000) // 突破k8s本身的访问速率限制
	if err != nil {
		return nil, err
	}
	clientSet, err := k8sclient.NewForConfig(kubeConfig)
	if err != nil {
		return nil, err
	}
	return clientSet, nil
}

// GetVolcanoClient creates and returns a new VolcanoClient from given config
func GetVolcanoClient() (*volcanoclientset.Clientset, error) {
	kubeConfigFile := config.Value.KubeConfig
	kubeConfig, err := GetKubeConfig(kubeConfigFile)
	kubeConfig.RateLimiter = flowcontrol.NewTokenBucketRateLimiter(1000, 1000) // 突破k8s本身的访问速率限制
	if err != nil {
		return nil, err
	}
	clientSet, err := volcanoclientset.NewForConfig(kubeConfig)
	if err != nil {
		return nil, err
	}
	return clientSet, nil
}

// GetCrdClient creates and returns a new CrdClient from given config
func GetCrdClient() (*dynamic.DynamicClient, error) {
	kubeConfigFile := config.Value.KubeConfig
	kubeConfig, err := GetKubeConfig(kubeConfigFile)
	kubeConfig.RateLimiter = flowcontrol.NewTokenBucketRateLimiter(1000, 1000) // 突破k8s本身的访问速率限制
	if err != nil {
		return nil, err
	}
	clientSet, err := dynamic.NewForConfig(kubeConfig)
	if err != nil {
		return nil, err
	}
	return clientSet, nil
}

func GetDeploymentStatus(pods []*corev1.Pod, cli *k8sclient.Clientset) *InferenceStatus {
	var (
		totalRunning   int
		totalPending   int
		totalFailed    int
		totalSucceeded int
		startTime      time.Time
		successEndTime time.Time
		log            string
	)

	logrus.Tracef("Get Deployment Status by pod: %s", pods)
	if len(pods) == 0 {
		return &InferenceStatus{
			Status: "Pending",
		}
	}

	// 遍历所有 Pod，统计状态
	for _, pod := range pods {
		switch pod.Status.Phase {
		case corev1.PodRunning:
			if isPodInAbnormalState(pod) {
				totalFailed++
				startTime = updateEarliestTime(startTime, pod.Status.StartTime)
				continue
			}
			totalRunning++
			startTime = updateEarliestTime(startTime, pod.Status.StartTime)
		case corev1.PodPending:
			totalPending++
		case corev1.PodSucceeded:
			totalSucceeded++
			startTime = updateEarliestTime(startTime, &pod.CreationTimestamp)
			successEndTime = updateLatestTime(successEndTime, getPodEndTime(pod))
		case corev1.PodFailed:
			totalFailed++
			startTime = updateEarliestTime(startTime, pod.Status.StartTime)
			podLog, err := GetPodLogByPodName(pod.Name, pod.Namespace, cli)
			if err != nil {
				continue
			}
			podLog = pod.Name + podLog + "\n"
			log = updateLog(log, podLog)
		}
	}

	// 判断状态优先级
	switch {
	case totalFailed > 0:
		// 如果有任意 Pod 失败，状态为 Failed
		return &InferenceStatus{
			Status:    "Failed",
			StartTime: startTime,
			Log:       log,
		}
	case totalPending > 0:
		// 如果有任意 Pod Pending，状态为 Pending
		return &InferenceStatus{
			Status: "Pending",
		}
	case totalRunning > 0:
		// 如果有任意 Pod Running，状态为 Running
		return &InferenceStatus{
			Status:    "Running",
			StartTime: startTime,
		}
	case totalSucceeded == len(pods):
		// 如果所有 Pod Succeeded，状态为 Succeeded
		return &InferenceStatus{
			Status:    "Succeeded",
			StartTime: startTime,
			EndTime:   successEndTime,
		}
	default:
		return &InferenceStatus{
			Status:    "Unknown",
			StartTime: startTime,
		}
	}
}

// 更新最早时间
func updateEarliestTime(current time.Time, candidate *metav1.Time) time.Time {
	if candidate == nil {
		return current
	}
	if current.IsZero() || candidate.Time.Before(current) {
		return candidate.Time
	}
	return current
}

// 更新最晚时间
func updateLatestTime(current time.Time, candidate time.Time) time.Time {
	if candidate.IsZero() {
		return current
	}
	if current.IsZero() || candidate.After(current) {
		return candidate
	}
	return current
}

// 更新log
func updateLog(current, candidate string) string {
	return current + candidate
}

// 获取 Pod 的结束时间
func getPodEndTime(pod *corev1.Pod) time.Time {
	for _, containerStatus := range pod.Status.ContainerStatuses {
		if containerStatus.State.Terminated != nil {
			return containerStatus.State.Terminated.FinishedAt.Time
		}
	}
	return time.Time{}
}

// isPodInAbnormalState 检查 pod 是否处于异常状态，如 CrashLoopBackOff 或其他等待/终止原因
func isPodInAbnormalState(pod *corev1.Pod) bool {
	for _, cond := range pod.Status.Conditions {
		if cond.Type == corev1.PodReady && cond.Status == corev1.ConditionFalse {
			return true
		}
		if cond.Type == corev1.ContainersReady && cond.Status == corev1.ConditionFalse {
			return true
		}
		if cond.Type == corev1.PodScheduled && cond.Status == corev1.ConditionFalse {
			return true
		}
	}

	for _, containerStatus := range pod.Status.ContainerStatuses {
		if containerStatus.State.Waiting != nil {
			switch containerStatus.State.Waiting.Reason {
			case "CrashLoopBackOff", "ImagePullBackOff", "ErrImagePull":
				return true
			}
		}
		if containerStatus.State.Terminated != nil {
			switch containerStatus.State.Terminated.Reason {
			case "Error", "OOMKilled":
				return true
			}
		}
	}
	return false
}

// GetNodeQueueNames 提取节点上的所有队列名称
func GetNodeQueueNames(node corev1.Node) []string {
	var queueNames []string
	// 正则表达式匹配标签格式 queue-[队列名称]=true
	queueLabelRegex := regexp.MustCompile(`^queue-(.+)$`)

	for labelKey, labelValue := range node.Labels {
		if labelValue == "true" {
			if matches := queueLabelRegex.FindStringSubmatch(labelKey); len(matches) == 2 {
				queueName := matches[1]
				queueNames = append(queueNames, queueName)
			}
		}
	}

	return queueNames
}

func GetPodExecutor(podName, namespace, containerName string, command []string, stdin, tty bool) (remotecommand.Executor, error) {
	clientSet, err := GetK8sClient()
	if err != nil {
		logrus.Errorf("Failed to get k8s client: %v", err)
		return nil, err
	}
	kubeConfigFile := config.Value.KubeConfig
	config, err := GetKubeConfig(kubeConfigFile)
	if err != nil {
		logrus.Errorf("Failed to get kube config: %v", err)
		return nil, err
	}
	// 创建请求
	req := clientSet.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(podName).
		Namespace(namespace).
		SubResource("exec")

	// 设置 Scheme
	scheme := runtime.NewScheme()
	if err := corev1.AddToScheme(scheme); err != nil {
		return nil, fmt.Errorf("error adding to scheme: %v", err)
	}
	// 参数编解码器
	parameterCodec := runtime.NewParameterCodec(scheme)
	PodExecOptions := &corev1.PodExecOptions{
		Command: command,
		Stdin:   stdin,
		Stdout:  true,
		Stderr:  true,
		TTY:     tty,
	}
	if containerName != "" {
		PodExecOptions.Container = containerName
	}
	req.VersionedParams(PodExecOptions, parameterCodec)
	exec, err := remotecommand.NewSPDYExecutor(config, "POST", req.URL())
	if err != nil {
		return nil, fmt.Errorf("error while creating Executor: %v", err)
	}
	return exec, nil
}

func ExecPodCMD(podName, namespace, containerName string, command []string, stdin io.Reader) (string, string, error) {
	var stdout, stderr bytes.Buffer
	exec, err := GetPodExecutor(podName, namespace, containerName, command, false, false)
	if err != nil {
		return "", "", fmt.Errorf("error while creating Executor: %v", err)
	}
	// 设置超时
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	// 执行命令
	err = exec.StreamWithContext(ctx, remotecommand.StreamOptions{
		Stdin:  stdin,
		Stdout: &stdout,
		Stderr: &stderr,
		Tty:    false,
	})
	if err != nil {
		return "", "", fmt.Errorf("%v,%v", stdout.String(), err)
	}

	return stdout.String(), stderr.String(), nil
}

// CopyFromPod copyFromPod 从 Pod 复制文件到本地
func CopyFromPod(podName, namespace, srcPath, localPath string) error {
	cmd := fmt.Sprintf("tar cf - %s", srcPath)
	exec, err := GetPodExecutor(podName, namespace, "", []string{"sh", "-c", cmd}, false, false)
	if err != nil {
		logrus.Errorf("get pod exec error: %v", err)
		return err
	}
	logrus.Infof("get pod exec successsful")

	// 创建本地文件
	localFile, err := os.Create(localPath)
	if err != nil {
		logrus.Errorf("create local file %s failed", localPath)
		return err
	}
	defer localFile.Close()
	// 设置超时
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 使用管道传输数据（Pod -> tar -> 本地文件）
	var stderr bytes.Buffer
	reader, writer := io.Pipe()
	go func() {
		defer writer.Close()
		err = exec.StreamWithContext(ctx, remotecommand.StreamOptions{
			Stdin:  nil,
			Stdout: writer,
			Stderr: &stderr,
			Tty:    false,
		})
		if err != nil {
			_ = writer.CloseWithError(err)
		}
	}()

	tr := tar.NewReader(reader)
	for {
		header, err := tr.Next()
		if err == io.EOF {
			break // 正常结束
		}
		if err != nil {
			return fmt.Errorf("failed to read tar header: %v", err)
		}

		// 只处理普通文件（跳过目录等）
		if header.Typeflag == tar.TypeReg {
			if _, err := io.Copy(localFile, tr); err != nil {
				return fmt.Errorf("failed to extract file: %v", err)
			}
			break // 只处理第一个文件
		}
	}
	return nil
}

// DeleteConfigmap 删除configmap
func DeleteConfigmap(configmapName, namespace string, cli *k8sclient.Clientset) error {
	err := cli.CoreV1().ConfigMaps(namespace).Delete(context.Background(), configmapName, metav1.DeleteOptions{})
	if err != nil {
		logrus.Errorf("delete configmap failed, configmap name: %v, error: %v", configmapName, err)
		return err
	}
	return nil
}

// CreateNameSpace 创建namespace
func CreateNameSpace(nameSpace string, cli *k8sclient.Clientset) (bool, error) { // 定义命名空间对象
	namespace := &corev1.Namespace{
		ObjectMeta: metav1.ObjectMeta{
			Name: nameSpace,
		},
	}

	_, err := cli.CoreV1().Namespaces().Create(context.TODO(), namespace, metav1.CreateOptions{})
	if err != nil {
		return false, err
	}
	return true, nil
}

// CheckNameSpace check 指定 namespace的信息
func CheckNameSpace(nameSpace string, cli *k8sclient.Clientset) (bool, error) {
	_, err := cli.CoreV1().Namespaces().Get(context.TODO(), nameSpace, metav1.GetOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return false, nil
		} else {
			return false, err
		}
	}
	return true, nil
}

// DeleteService 删除相应的svc
func DeleteService(serviceName, nameSpace string, cli *k8sclient.Clientset) error {
	// 构造Service的删除选项，例如是否级联删除
	deleteOptions := metav1.DeleteOptions{
		GracePeriodSeconds: &[]int64{0}[0], // 立即删除，根据实际情况调整
	}
	// 发起删除请求
	err := cli.CoreV1().Services(nameSpace).Delete(context.TODO(), serviceName, deleteOptions)
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil
		}
		return err
	}
	return nil
}

func GetSvcInfo(svcName, ns string, cli *k8sclient.Clientset) (int32, int32, error) {
	var targetPort, nodePort int32
	svc, err := cli.CoreV1().Services(ns).Get(context.Background(), svcName, metav1.GetOptions{})
	if err != nil {
		if os.IsNotExist(err) { // svc 不存在
			return 0, 0, err
		} else {
			return 0, 0, err // 查询出错
		}
	}
	for _, port := range svc.Spec.Ports {
		nodePort = port.NodePort
		targetPort = int32(port.TargetPort.IntValue())
		break
	}

	return nodePort, targetPort, nil
}

// GetSvcNodePort 获取已分配的nodePort 端口
func GetSvcNodePort(cli *k8sclient.Clientset) (string, error) {
	var nodePortStr string
	// 获取的是所有namespace的信息
	services, err := cli.CoreV1().Services("").List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return "", err
	}

	for _, svc := range services.Items {
		for _, port := range svc.Spec.Ports {
			if port.NodePort > 0 {
				if nodePortStr == "" {
					nodePortStr = strconv.Itoa(int(port.NodePort))
				} else {
					nodePortStr = nodePortStr + " " + strconv.Itoa(int(port.NodePort))
				}
			}
		}
	}
	return nodePortStr, nil
}

func GetQueues(VcClientSet *volcanoclientset.Clientset) []vc.Queue {
	queues, err := VcClientSet.SchedulingV1beta1().Queues().List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		logrus.Errorf("Failed to list queues: %v", err)
		return nil
	}
	logrus.Tracef("Found queues: %d", len(queues.Items))
	return queues.Items
}

func IsQueue(queues []models.PartitionTable, name string) bool {
	if queues == nil {
		return true
	}
	for _, queue := range queues {
		if queue.Name == name {
			return true
		}
	}
	return false
}

func getMemoryInMb(q re.Quantity) int64 {
	memStr := q.String()

	if q.IsZero() {
		return 0
	}

	if _, err := re.ParseQuantity(q.String()); err != nil {
		return 0
	}

	// 使用 switch 匹配不同单位
	switch {
	case strings.HasSuffix(memStr, "Ki"):
		// 已经是 KiB，直接提取数值
		kib, _ := strconv.ParseInt(strings.TrimSuffix(memStr, "Ki"), 10, 64)
		return kib / 1024
	case strings.HasSuffix(memStr, "Mi"):
		// 从 MiB 转换为 KiB：1 MiB = 1024 KiB
		mib, _ := strconv.ParseInt(strings.TrimSuffix(memStr, "Mi"), 10, 64)
		return mib
	case strings.HasSuffix(memStr, "Gi"):
		// 从 GiB 转换为 KiB：1 GiB = 1024 * 1024 KiB
		gib, _ := strconv.ParseInt(strings.TrimSuffix(memStr, "Gi"), 10, 64)
		return gib * 1024
	case strings.HasSuffix(memStr, "Ti"):
		// 从 TiB 转换为 KiB：1 TiB = 1024^3 KiB
		tib, _ := strconv.ParseInt(strings.TrimSuffix(memStr, "Ti"), 10, 64)
		return tib * 1024 * 1024
	default:
		// 默认无单位时，假设是字节（Bytes），转换为 KiB
		return q.Value() / 1024 / 1024
	}
}

func CheckPodRunning(client *k8sclient.Clientset, namespace, podName string) error {
	if namespace == "" {
		return errors.New("namespace cannot be empty")
	}
	if podName == "" {
		return errors.New("podName cannot be empty")
	}

	pod, err := client.CoreV1().Pods(namespace).Get(context.TODO(), podName, metav1.GetOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return fmt.Errorf("pod [%s/%s] not found", namespace, podName)
		}
		return fmt.Errorf("failed to get pod [%s/%s]: %w", namespace, podName, err)
	}

	if pod.Status.Phase != corev1.PodRunning {
		return fmt.Errorf("pod [%s/%s] status not running", namespace, podName)
	}

	return nil
}

func NewPodExec(namespace, podName string) (*PodExec, error) {
	// 1. 获取executor
	exec, err := GetPodExecutor(podName, namespace, "", []string{"/bin/sh"}, true, true)
	if err != nil {
		return nil, fmt.Errorf("create spdy executor failed: %w", err)
	}

	// 2. 创建Pipe
	stdinR, stdinW := io.Pipe()   // 用户写stdinW → kubectl的stdin
	stdoutR, stdoutW := io.Pipe() // kubectl的stdout → 用户读stdoutR
	stderrR, stderrW := io.Pipe() // kubectl的stderr → 用户读stderrR

	// 3. 启动流
	streamErr := make(chan error, 1)
	streamStarted := make(chan struct{})

	go func() {
		// 立即通知流已开始执行
		close(streamStarted)

		// 使用独立的context执行流
		err := exec.StreamWithContext(context.Background(), remotecommand.StreamOptions{
			Stdin:  stdinR,
			Stdout: stdoutW,
			Stderr: stderrW,
			Tty:    true,
		})

		// 关闭K8s侧Pipe
		_ = stdoutW.Close()
		_ = stderrW.Close()
		_ = stdinR.Close()

		if err != nil {
			streamErr <- fmt.Errorf("exec stream error: %w", err)
		}
	}()

	// 4. 等待流启动
	select {
	case <-streamStarted:
		// 流已启动，继续
		logrus.Tracef("NewPodExec: stream started successfully")
	case <-time.After(5 * time.Second):
		_ = stdinW.Close()
		_ = stdoutR.Close()
		_ = stderrR.Close()
		return nil, errors.New("exec stream start timeout")
	}

	// 5. 异步监控流错误
	go func() {
		if err := <-streamErr; err != nil {
			logrus.Errorf("Pod exec stream error: %v", err)
		}
	}()

	// 6. 返回结果
	return &PodExec{
		Stdin:  stdinW,
		Stdout: stdoutR,
		Stderr: stderrR,
		closer: func() error {
			_ = stdinW.Close()
			_ = stdoutR.Close()
			_ = stderrR.Close()
			return nil
		},
	}, nil
}

func CheckQueueAllocateResource(queueName string, reqCPU, reqMem, nodeCount int64) (err error) {
	var (
		cpuCount       int64
		memCount       int64
		allocatableCPU int64
		allocatableMem int64
		podReplicas    int64 // 可分配的pod 副本数
	)
	clientSet, _ := GetK8sClient()
	nodes, err := clientSet.CoreV1().Nodes().List(context.TODO(), metav1.ListOptions{
		LabelSelector: fmt.Sprintf("queue-%s=true", queueName),
	})
	if err != nil {
		// 请求节点失败，跳过校验
		logrus.Errorf("GetQueueAllocateResource get nodes error: %v", err)
		return nil
	}
	for _, node := range nodes.Items {
		// 节点可分配资源
		nodeAllocatableCPU := node.Status.Allocatable.Cpu().Value()
		nodeAllocatableMem := node.Status.Allocatable.Memory().Value() / 1048576 // 1024 * 1024 = 1048576
		if nodeAllocatableCPU > allocatableCPU {
			allocatableCPU = nodeAllocatableCPU
		}
		if nodeAllocatableMem > allocatableMem {
			allocatableMem = nodeAllocatableMem
		}
		cpuCount += nodeAllocatableCPU / reqCPU // 根据cpu申请资源，得到单节点可分配的pod数
		memCount += nodeAllocatableMem / reqMem // 根据mem申请资源，得到单节点可分配的pod数
	}
	if cpuCount > memCount {
		podReplicas = memCount
	} else {
		podReplicas = cpuCount
	}
	logrus.Infof("[GetQueueAllocateResource] queue: %s, allocatableCPU: %d, allocatableMem: %d, replicas: %d", queueName, allocatableCPU, allocatableMem, podReplicas)
	// 判断单节点申请的资源不超过队列节点的资源可分配值
	if allocatableCPU < reqCPU {
		return fmt.Errorf(" Request CPU exceeding the node's allocatable CPU: %d", allocatableCPU)
	}
	if allocatableMem < reqMem {
		return fmt.Errorf(" Request Memory exceeding the node's allocatable Memory: %d", allocatableMem)
	}
	// 判断申请的pod数不超过队列最大的pod上限
	if podReplicas < nodeCount {
		return fmt.Errorf(" The requested resource currently supports a maximum of %d pods in the queue", podReplicas)
	}
	return nil
}

func GetClusterMasterNodeInfo() (*corev1.Node, error) {
	clientSet, err := GetK8sClient()
	if err != nil {
		return nil, fmt.Errorf("failed to get k8s client: %v", err)
	}
	nodes, err := clientSet.CoreV1().Nodes().List(context.TODO(), metav1.ListOptions{
		LabelSelector: "node-role.kubernetes.io/control-plane",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list nodes: %v", err)
	}
	if len(nodes.Items) == 0 {
		return nil, fmt.Errorf("no master node found")
	}
	// 返回第一个 Master 节点
	return &nodes.Items[0], nil
}

func GetClusterMasterNodeHostname() (string, error) {
	masterNode, err := GetClusterMasterNodeInfo()
	if err != nil {
		logrus.Errorf("failed to get master node info: %v", err)
		return "", err
	}
	return masterNode.Name, nil
}
