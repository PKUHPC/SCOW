package controller

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
	"gopkg.in/yaml.v3"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"
	"k8s.io/utils/strings/slices"
	"volcano.sh/apis/pkg/apis/scheduling/v1beta1"
	volcanoclient "volcano.sh/apis/pkg/client/clientset/versioned"

	"scow-adapters/pkg/ai/utils"
)

const PartitionCmName = "partition-info"

type QueueLabelController struct {
	stopChan      chan struct{}
	k8sClient     *kubernetes.Clientset
	volcanoClient *volcanoclient.Clientset
	cmInformer    cache.SharedIndexInformer
}

type QueueSpec struct {
	CardType                string `yaml:"card-type,omitempty"`
	CPU                     string `yaml:"cpu,omitempty"`
	Memory                  string `yaml:"memory,omitempty"`
	Nodes                   string `yaml:"nodes,omitempty"`
	AcceleratorDescriptions string `yaml:"accelerator_descriptions,omitempty"`
	GPUModel                string `yaml:"gpu_model,omitempty"`
	VramMb                  int64  `yaml:"vram_mb,omitempty"`
	CPUModel                string `yaml:"cpu_model,omitempty"`
	MaxAcceleratorsPerPod   int    `yaml:"max_accelerators_per_pod,omitempty"`
}

func NewQueueAndLabelController(k8sClient *kubernetes.Clientset, volcanoClient *volcanoclient.Clientset) *QueueLabelController {
	stop := make(chan struct{})
	// 创建ConfigMap和Node的Informer
	cmInformer := createConfigMapInformer(k8sClient)

	controller := &QueueLabelController{
		stopChan:      stop,
		k8sClient:     k8sClient,
		volcanoClient: volcanoClient,
		cmInformer:    cmInformer,
	}

	cmInformer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    controller.handleConfigMap,
		UpdateFunc: controller.handleUpdateConfigMap,
	})

	return controller
}

func (c *QueueLabelController) Start() {
	go c.cmInformer.Run(c.stopChan)

	if !cache.WaitForCacheSync(c.stopChan, c.cmInformer.HasSynced) {
		logrus.Errorf("[queueLabelController] Timed out waiting for caches to sync")
		return
	}

	// 启动一致性检查协程
	go func() {
		ticker := time.NewTicker(10 * time.Minute) // 每10分钟检查一次
		defer ticker.Stop()

		// 立即执行一次检查
		if err := c.checkLabelConsistency(); err != nil {
			logrus.Errorf("[queueLabelController] Initial consistency check failed: %v", err)
		}

		for {
			select {
			case <-ticker.C:
				if err := c.checkLabelConsistency(); err != nil {
					logrus.Errorf("[queueLabelController] Consistency check failed: %v", err)
				}
			case <-c.stopChan:
				return
			}
		}
	}()

	<-c.stopChan
	logrus.Infof("[queueLabelController] stopping job controller server")
	return
}

func (c *QueueLabelController) handleConfigMap(obj interface{}) {
	cm, ok := obj.(*corev1.ConfigMap)
	if !ok || cm.Name != PartitionCmName {
		return
	}

	for key, value := range cm.Data {
		var spec QueueSpec
		if err := yaml.Unmarshal([]byte(value), &spec); err != nil {
			logrus.Errorf("[queueLabelController] Failed to parse QueueSpec for %s: %v", key, err)
			continue
		}
		logrus.Tracef("[handleConfigMap]data: %v", spec)
		nodeList, ok := utils.ParseHostList(spec.Nodes)
		if !ok {
			logrus.Errorf("[queueLabelController] invalid node range format: %s", spec.Nodes)
			continue
		}

		totalCPU, totalMemory, cardResources, err := calculateTotalResources(&spec, len(nodeList))
		if err != nil {
			logrus.Errorf("[queueLabelController] Error calculating resources for %s: %v", key, err)
			continue
		}

		if err := c.createOrUpdateVolcanoQueue(spec, key, totalCPU, totalMemory, cardResources); err != nil {
			logrus.Errorf("[queueLabelController] Error managing queue %s: %v", key, err)
			continue
		}

		if err := c.processNodeLabels(key, nodeList); err != nil {
			logrus.Errorf("[queueLabelController] Error updating node labels for %s: %v", key, err)
		}
	}
}

func (c *QueueLabelController) handleUpdateConfigMap(oldObj, newObj interface{}) {
	c.handleConfigMap(newObj)

	oldCm := oldObj.(*corev1.ConfigMap)
	newCm := newObj.(*corev1.ConfigMap)

	// 提取新旧队列名称集合
	oldQueues := getQueueNamesFromCM(oldCm)
	newQueues := getQueueNamesFromCM(newCm)

	// 计算需要清理的队列
	removedQueues := setDifference(oldQueues, newQueues)
	for q := range removedQueues {
		logrus.Infof("[queueLabelController] the queue %v is remove in configmap: %v", q, PartitionCmName)
		if err := c.volcanoClient.SchedulingV1beta1().Queues().Delete(
			context.TODO(), q, metav1.DeleteOptions{}); err != nil && !errors.IsNotFound(err) {
			logrus.Errorf("[queueLabelController] failed delete queue %s, error: %v", q, err)
		}
		// 清理节点标签
		if err := c.cleanQueueLabels(q); err != nil {
			logrus.Errorf("[queueLabelController] clean node labels %s: %v", q, err)
		}
	}
}

func (c *QueueLabelController) createOrUpdateVolcanoQueue(QueueInfo QueueSpec, name, cpu, memory string, cardResources map[string]string) error {
	logrus.Tracef("[createOrUpdateVolcanoQueue]: %v", QueueInfo)
	reclaim := true
	queueClient := c.volcanoClient.SchedulingV1beta1().Queues()
	annoLabels := map[string]string{}
	if QueueInfo.MaxAcceleratorsPerPod != 0 {
		annoLabels["max_accelerators_per_pod"] = strconv.Itoa(QueueInfo.MaxAcceleratorsPerPod)
	} else {
		annoLabels["max_accelerators_per_pod"] = strconv.Itoa(utils.DefaultAcceleratorsPerPod)
	}
	if len(QueueInfo.AcceleratorDescriptions) != 0 {
		annoLabels["accelerator_descriptions"] = QueueInfo.AcceleratorDescriptions
	}
	if QueueInfo.GPUModel != "" {
		annoLabels["gpu_model"] = QueueInfo.GPUModel
	}
	if QueueInfo.VramMb != 0 {
		annoLabels["vram_mb"] = fmt.Sprintf("%d", QueueInfo.VramMb)
	}
	if QueueInfo.CPUModel != "" {
		annoLabels["cpu_model"] = QueueInfo.CPUModel
	}
	go func() { //新的队列要提前创建命名空间
		clientSet, _ := utils.GetK8sClient()
		exist, err := utils.CheckNameSpace(name, clientSet)
		if err != nil {
			logrus.Errorf("check namespace failed: %v", err)
			return
		}
		// ns 不存在的时候创建ns
		if !exist {
			_, err = utils.CreateNameSpace(name, clientSet)
			if err != nil {
				logrus.Errorf("create namespace failed: %v", err)
				return
			}
		}
	}()
	existing, err := queueClient.Get(context.TODO(), name, metav1.GetOptions{})
	if errors.IsNotFound(err) {
		queue := &v1beta1.Queue{
			ObjectMeta: metav1.ObjectMeta{
				Name:        name,
				Annotations: annoLabels,
			},
			Spec: v1beta1.QueueSpec{
				Weight: 1,
				Capability: corev1.ResourceList{
					corev1.ResourceCPU:    resource.MustParse(cpu),
					corev1.ResourceMemory: resource.MustParse(memory),
				},
				Reclaimable: &reclaim,
			},
		}
		for res, val := range cardResources {
			queue.Spec.Capability[corev1.ResourceName(res)] = resource.MustParse(val)
		}
		_, err = queueClient.Create(context.TODO(), queue, metav1.CreateOptions{})
		return err
	} else if err == nil {
		existing.Spec.Capability = corev1.ResourceList{
			corev1.ResourceCPU:    resource.MustParse(cpu),
			corev1.ResourceMemory: resource.MustParse(memory),
		}
		existing.ObjectMeta.Annotations = annoLabels
		for res, val := range cardResources {
			existing.Spec.Capability[corev1.ResourceName(res)] = resource.MustParse(val)
		}
		_, err = queueClient.Update(context.TODO(), existing, metav1.UpdateOptions{})
		return err
	}
	return err
}

// 节点标签清理
func (c *QueueLabelController) cleanQueueLabels(queueName string) error {
	labelKey := fmt.Sprintf("queue-%s", queueName)

	// 获取所有带有该标签的节点
	nodes, err := c.k8sClient.CoreV1().Nodes().List(context.TODO(), metav1.ListOptions{
		LabelSelector: fmt.Sprintf("%s=true", labelKey),
	})
	if err != nil {
		return err
	}

	var wg sync.WaitGroup
	errChan := make(chan error, len(nodes.Items))

	for _, node := range nodes.Items {
		wg.Add(1)
		go func(name string) {
			defer wg.Done()
			if err := c.removeLabelFromNode(name, labelKey); err != nil {
				errChan <- err
			}
		}(node.Name)
	}

	wg.Wait()
	close(errChan)

	for err := range errChan {
		if err != nil {
			return err
		}
	}

	return nil
}

func (c *QueueLabelController) processNodeLabels(queueName string, nodeList []string) error {
	labelKey := fmt.Sprintf("queue-%s", queueName)
	var wg sync.WaitGroup
	errChan := make(chan error, len(nodeList))

	for _, nodeName := range nodeList {
		wg.Add(1)
		go func(name string) {
			defer wg.Done()
			if err := c.addLabelToNode(name, labelKey); err != nil {
				errChan <- err
			}
		}(nodeName)
	}

	wg.Wait()
	close(errChan)

	for err := range errChan {
		if err != nil {
			return err
		}
	}

	return nil
}

// checkLabelConsistency 定期检查节点标签与配置的一致性
func (c *QueueLabelController) checkLabelConsistency() error {
	logrus.Tracef("[queueLabelController] Starting label consistency check")
	defer logrus.Tracef("[queueLabelController] Completed label consistency check")

	// 1. 获取当前的 partition-info ConfigMap
	cm, err := c.k8sClient.CoreV1().ConfigMaps("default").Get(context.TODO(), PartitionCmName, metav1.GetOptions{})
	if errors.IsNotFound(err) {
		logrus.Warnf("[queueLabelController] ConfigMap %s not found, skipping consistency check", PartitionCmName)
		return nil
	}
	if err != nil {
		logrus.Errorf("[queueLabelController] Failed to get ConfigMap %s: %v", PartitionCmName, err)
		return err
	}

	// 2. 构建预期的队列节点映射
	expectedQueueNodes := make(map[string][]string)
	for queueName, specYaml := range cm.Data {
		var spec QueueSpec
		if err := yaml.Unmarshal([]byte(specYaml), &spec); err != nil {
			logrus.Errorf("[queueLabelController] Failed to parse QueueSpec for %s: %v", queueName, err)
			continue
		}

		nodeList, ok := utils.ParseHostList(spec.Nodes)
		if !ok {
			logrus.Errorf("[queueLabelController] Invalid node range format for queue %s: %s", queueName, spec.Nodes)
			continue
		}
		expectedQueueNodes[queueName] = nodeList
	}

	// 3. 获取所有节点
	nodes, err := c.k8sClient.CoreV1().Nodes().List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		logrus.Errorf("[queueLabelController] Failed to list nodes: %v", err)
		return err
	}

	// 4. 检查每个节点的标签是否与配置匹配
	repairCount := 0
	for _, node := range nodes.Items {
		// 检查节点上的所有队列标签
		for labelKey, labelValue := range node.Labels {
			if !strings.HasPrefix(labelKey, "queue-") || labelValue != "true" {
				continue
			}

			queueName := strings.TrimPrefix(labelKey, "queue-")
			expectedNodes, exists := expectedQueueNodes[queueName]

			// Case 1: 队列已不存在于配置中
			if !exists {
				logrus.Infof("[queueLabelController] Found orphaned label %s on node %s (queue no longer exists)", labelKey, node.Name)
				if err := c.removeLabelFromNode(node.Name, labelKey); err != nil {
					logrus.Errorf("[queueLabelController] Failed to remove orphaned label %s from node %s: %v", labelKey, node.Name, err)
					continue
				}
				repairCount++
				continue
			}

			// Case 2: 节点不应属于该队列
			if !slices.Contains(expectedNodes, node.Name) {
				logrus.Infof("[queueLabelController] Found mismatched label %s on node %s (node not in queue config)", labelKey, node.Name)
				if err := c.removeLabelFromNode(node.Name, labelKey); err != nil {
					logrus.Errorf("[queueLabelController] Failed to remove mismatched label %s from node %s: %v", labelKey, node.Name, err)
					continue
				}
				repairCount++
			}
		}
	}

	// 5. 检查配置中的节点是否都有正确标签
	for queueName, expectedNodes := range expectedQueueNodes {
		labelKey := fmt.Sprintf("queue-%s", queueName)
		for _, nodeName := range expectedNodes {
			node, err := c.k8sClient.CoreV1().Nodes().Get(context.TODO(), nodeName, metav1.GetOptions{})
			if errors.IsNotFound(err) {
				logrus.Warnf("[queueLabelController] Configured node %s for queue %s not found in cluster", nodeName, queueName)
				continue
			}
			if err != nil {
				logrus.Errorf("[queueLabelController] Failed to get node %s: %v", nodeName, err)
				continue
			}

			if node.Labels[labelKey] != "true" {
				logrus.Infof("[queueLabelController] Missing label %s on node %s (should be in queue)", labelKey, nodeName)
				if err := c.addLabelToNode(nodeName, labelKey); err != nil {
					logrus.Errorf("[queueLabelController] Failed to add missing label %s to node %s: %v", labelKey, nodeName, err)
					continue
				}
				repairCount++
			}
		}
	}

	if repairCount > 0 {
		logrus.Infof("[queueLabelController] Label consistency check completed, repaired %d inconsistencies", repairCount)
	} else {
		logrus.Info("[queueLabelController] All node labels are consistent with configuration")
	}

	return nil
}

// removeLabelFromNode 从节点移除指定标签
func (c *QueueLabelController) removeLabelFromNode(nodeName, labelKey string) error {
	logrus.Infof("[queueLabelController] Start remove label %v on node %v", labelKey, nodeName)
	node, err := c.k8sClient.CoreV1().Nodes().Get(context.TODO(), nodeName, metav1.GetOptions{})
	if err != nil {
		logrus.Errorf("[queueLabelController] get node %v fialed: %v", nodeName, err)
		return err
	}

	if _, exists := node.Labels[labelKey]; !exists {
		return nil
	}

	newNode := node.DeepCopy()
	delete(newNode.Labels, labelKey)
	_, err = c.k8sClient.CoreV1().Nodes().Update(context.TODO(), newNode, metav1.UpdateOptions{})
	logrus.Errorf("[queueLabelController] update node %v fialed: %v", nodeName, err)
	return err
}

// addLabelToNode 向节点添加指定标签
func (c *QueueLabelController) addLabelToNode(nodeName, labelKey string) error {
	logrus.Infof("[queueLabelController] Start add label %v on node %v", labelKey, nodeName)
	node, err := c.k8sClient.CoreV1().Nodes().Get(context.TODO(), nodeName, metav1.GetOptions{})
	if err != nil {
		logrus.Errorf("[queueLabelController] get node %v fialed: %v", nodeName, err)
		return err
	}

	if node.Labels[labelKey] == "true" {
		return nil
	}

	newNode := node.DeepCopy()
	if newNode.Labels == nil {
		newNode.Labels = make(map[string]string)
	}
	newNode.Labels[labelKey] = "true"
	_, err = c.k8sClient.CoreV1().Nodes().Update(context.TODO(), newNode, metav1.UpdateOptions{})
	logrus.Errorf("[queueLabelController] update node %v fialed: %v", nodeName, err)
	return err
}

func (c *QueueLabelController) Stop() {
	close(c.stopChan)
}

func createConfigMapInformer(k8sClient *kubernetes.Clientset) cache.SharedIndexInformer {
	return cache.NewSharedIndexInformer(
		&cache.ListWatch{
			ListFunc: func(options metav1.ListOptions) (runtime.Object, error) {
				return k8sClient.CoreV1().ConfigMaps("default").List(context.TODO(), options)
			},
			WatchFunc: func(options metav1.ListOptions) (watch.Interface, error) {
				return k8sClient.CoreV1().ConfigMaps("default").Watch(context.TODO(), options)
			},
		},
		&corev1.ConfigMap{},
		300*time.Second,
		cache.Indexers{},
	)
}

func getQueueNamesFromCM(cm *corev1.ConfigMap) map[string]bool {
	queues := make(map[string]bool)
	for key := range cm.Data {
		queues[key] = true
	}
	return queues
}

func setDifference(oldSet, newSet map[string]bool) map[string]bool {
	diff := make(map[string]bool)
	for k := range oldSet {
		if !newSet[k] {
			diff[k] = true
		}
	}
	return diff
}

func calculateTotalResources(spec *QueueSpec, nodeCounts int) (string, string, map[string]string, error) {
	cpuPerNode, err := resource.ParseQuantity(spec.CPU)
	if err != nil {
		return "", "", nil, fmt.Errorf("invalid CPU value: %s", spec.CPU)
	}
	// 计算总 CPU（节点数 * 单节点 CPU）
	totalCPUMilli := cpuPerNode.MilliValue() * int64(nodeCounts)
	totalCPU := resource.NewMilliQuantity(totalCPUMilli, cpuPerNode.Format).String()

	// 处理 Memory
	memPerNode, err := resource.ParseQuantity(spec.Memory)
	if err != nil {
		return "", "", nil, fmt.Errorf("invalid memory value: %s", spec.Memory)
	}

	// 计算总 Memory（节点数 * 单节点 Memory）
	totalMemValue := memPerNode.Value() * int64(nodeCounts)
	totalMem := resource.NewQuantity(totalMemValue, memPerNode.Format).String()

	if spec.CardType == "" {
		return totalCPU, totalMem, nil, nil
	}
	cardParts := strings.Split(spec.CardType, ":")
	if len(cardParts) != 2 {
		return "", "", nil, fmt.Errorf("invalid card-type format: %s", spec.CardType)
	}
	resourceName := strings.TrimSpace(cardParts[0])
	resourcePerNode, _ := strconv.Atoi(cardParts[1])
	totalResource := resourcePerNode * nodeCounts

	return totalCPU, totalMem, map[string]string{resourceName: strconv.Itoa(totalResource)}, nil
}
