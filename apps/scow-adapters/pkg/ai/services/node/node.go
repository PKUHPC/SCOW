package node

import (
	"context"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	corev1 "k8s.io/api/core/v1"
	policyv1 "k8s.io/api/policy/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/util/retry"
	"k8s.io/utils/pointer"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/utils"
)

type QueueSpec struct {
	CardType string `yaml:"card-type,omitempty"`
	CPU      string `yaml:"cpu,omitempty"`
	Memory   string `yaml:"memory,omitempty"`
	Nodes    string `yaml:"nodes,omitempty"`
}

type ServerNode struct {
	pb.UnimplementedNodeServiceServer
	K8sClient *kubernetes.Clientset
}

func (s *ServerNode) checkNodeExists(nodeName string) (*corev1.Node, error) {
	node, err := s.K8sClient.CoreV1().Nodes().Get(context.Background(), nodeName, metav1.GetOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get node: %v", err)
	}
	return node, nil
}

func (s *ServerNode) checkRunningPods(nodeName string) (bool, error) {
	// 获取所有运行的作业
	runningJobs, err := utils.GetJobsByStatus([]string{"RUNNING"})
	if err != nil {
		return false, err
	}

	// 如果没有运行的作业，直接返回即可
	if len(runningJobs) == 0 {
		return false, nil
	}

	podList, err := utils.GetPodByNodeName(nodeName, []string{string(corev1.PodRunning)})
	if err != nil {
		logrus.Errorf("Get running pod by nodeName failed: %v", err)
		return false, err
	}

	return len(podList) > 0, nil
}

func (s *ServerNode) RemoveNodeFromCluster(ctx context.Context, req *pb.RemoveNodeFromClusterRequest) (*pb.RemoveNodeFromClusterResponse, error) {
	logrus.Infof("Start remove node from cluster, node name: %v", req.NodeName)
	node, err := s.checkNodeExists(req.NodeName)
	if err != nil {
		logrus.Errorf("Remove node failed, error: %v", err)
		return nil, status.Error(codes.Internal, err.Error())
	}
	if node == nil {
		logrus.Errorf("Remove node failed, node %v not found", req.NodeName)
		return nil, status.Errorf(codes.NotFound, "node %s not found", req.NodeName)
	}

	if err := markNodeUnschedulable(s.K8sClient, req.NodeName); err != nil {
		return nil, fmt.Errorf("mark node unschedulable failed: %v", err)
	}

	hasPods, err := s.checkRunningPods(req.NodeName)
	if err != nil {
		// 恢复节点调度
		if err = s.unCordonNode(s.K8sClient, req.NodeName); err != nil {
			logrus.Errorf("uncordon node failed: %v", err)
			return nil, status.Errorf(codes.Internal, "uncordon failed: %v", err)
		}
		logrus.Errorf("Remove node failed, get job error: %v", err)
		return nil, status.Error(codes.Internal, err.Error())
	}
	if hasPods {
		// 恢复节点调度
		if err = s.unCordonNode(s.K8sClient, req.NodeName); err != nil {
			logrus.Errorf("uncordon node failed: %v", err)
			return nil, status.Errorf(codes.Internal, "uncordon failed: %v", err)
		}
		logrus.Errorf("Remove node failed, node %v have running job", req.NodeName)
		return nil, status.Errorf(codes.FailedPrecondition, "node %s has running pods", req.NodeName)
	}

	err = s.drainNode(s.K8sClient, req.NodeName, true)
	if err != nil {
		logrus.Errorf("Remove node failed: %v", err)
		return nil, status.Error(codes.Internal, err.Error())
	}

	success := s.checkNodeState(5, req.NodeName, true)
	if !success {
		err = fmt.Errorf("unschedulable node %s failed", req.NodeName)
		logrus.Errorf("Remove node failed: %v", err)
		return nil, status.Errorf(codes.Internal, "remove node failed: %v", err)
	}

	logrus.Infof("remove node success, node name: %v", req.NodeName)
	return &pb.RemoveNodeFromClusterResponse{}, nil
}

func (s *ServerNode) AddNodeToCluster(ctx context.Context, req *pb.AddNodeToClusterRequest) (*pb.AddNodeToClusterResponse, error) {
	logrus.Infof("Start add node to cluster, node name: %v", req.NodeName)
	node, err := s.checkNodeExists(req.NodeName)
	if err != nil {
		logrus.Errorf("Add node failed, error: %v", err)
		return nil, status.Error(codes.Internal, err.Error())
	}
	if node == nil {
		logrus.Errorf("Add node failed, node %v not found", req.NodeName)
		return nil, status.Errorf(codes.NotFound, "node %s not found", req.NodeName)
	}

	// 恢复节点调度
	if err = s.unCordonNode(s.K8sClient, req.NodeName); err != nil {
		logrus.Errorf("Add node failed: %v", err)
		return nil, status.Errorf(codes.Internal, "uncordon failed: %v", err)
	}

	success := s.checkNodeState(5, req.NodeName, false)
	if !success {
		err = fmt.Errorf("schedulable node %s failed", req.NodeName)
		logrus.Errorf("Add node failed: %v", err)
		return nil, status.Errorf(codes.Internal, "add node failed: %v", err)
	}

	logrus.Infof("add node success, node name: %v", req.NodeName)
	return &pb.AddNodeToClusterResponse{}, nil
}

func (s *ServerNode) drainNode(k8sClient *kubernetes.Clientset, nodeName string, deleteEmptyDirData bool) error {
	// 1. 获取节点上的所有 Pod
	pods, err := k8sClient.CoreV1().Pods("").List(context.TODO(), metav1.ListOptions{
		FieldSelector: fields.SelectorFromSet(fields.Set{"spec.nodeName": nodeName}).String(),
	})
	if err != nil {
		return fmt.Errorf("get pod on node failed: %v", err)
	}

	// 2. 过滤需要驱逐的 Pod
	podsToEvict := filterPodsToEvict(pods.Items)

	// 3. 驱逐 Pod (failed状态的pod)
	for _, pod := range podsToEvict {
		if err := evictPod(k8sClient, &pod, deleteEmptyDirData); err != nil {
			return fmt.Errorf("evict Pod %s/%s failed: %v", pod.Namespace, pod.Name, err)
		}
	}

	return nil
}

func (s *ServerNode) unCordonNode(k8sClient *kubernetes.Clientset, nodeName string) error {
	// 构造 Patch 数据
	patchData := []byte(`{"spec":{"unschedulable":false}}`)

	// 发送 PATCH 请求
	_, err := k8sClient.CoreV1().Nodes().Patch(
		context.TODO(),
		nodeName,
		types.StrategicMergePatchType, // 使用 Strategic Merge Patch
		patchData,
		metav1.PatchOptions{},
	)

	if err != nil {
		return err
	}

	return nil
}

func (s *ServerNode) checkNodeState(maxAttempts int, nodeName string, flag bool) bool {
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		logrus.Tracef("check node status for the %v time", attempt)
		node, err := s.K8sClient.CoreV1().Nodes().Get(context.TODO(), nodeName, metav1.GetOptions{})
		if err != nil {
			return false
		}

		// 检查节点状态
		if node.Spec.Unschedulable == flag {
			return true
		}

		// 递增延迟
		delay := attempt
		time.Sleep(time.Duration(delay) * time.Second)
	}
	return false
}

func markNodeUnschedulable(k8sClient *kubernetes.Clientset, nodeName string) error {
	return retry.RetryOnConflict(retry.DefaultRetry, func() error {
		node, err := k8sClient.CoreV1().Nodes().Get(context.TODO(), nodeName, metav1.GetOptions{})
		if err != nil {
			return err
		}

		if node.Spec.Unschedulable {
			return nil // 已标记为不可调度
		}

		node.Spec.Unschedulable = true
		_, err = k8sClient.CoreV1().Nodes().Update(context.TODO(), node, metav1.UpdateOptions{})
		return err
	})
}

func filterPodsToEvict(pods []corev1.Pod) []corev1.Pod {
	var podsToEvict []corev1.Pod

	for _, pod := range pods {
		// 排除静态 Pod（Mirror Pod）
		if pod.Annotations["kubernetes.io/config.source"] == "file" {
			continue
		}

		// 排除 DaemonSet 管理的 Pod
		isDaemonSetPod := false
		for _, owner := range pod.OwnerReferences {
			if owner.Kind == "DaemonSet" {
				isDaemonSetPod = true
				break
			}
		}
		if isDaemonSetPod {
			continue
		}

		podsToEvict = append(podsToEvict, pod)
	}

	return podsToEvict
}

func evictPod(k8sClient *kubernetes.Clientset, pod *corev1.Pod, deleteEmptyDirData bool) error {
	eviction := &policyv1.Eviction{
		ObjectMeta: metav1.ObjectMeta{
			Name:      pod.Name,
			Namespace: pod.Namespace,
		},
	}

	// 如果启用 --delete-emptydir-data，设置优雅终止时间为 0
	if deleteEmptyDirData {
		eviction.DeleteOptions = &metav1.DeleteOptions{
			GracePeriodSeconds: pointer.Int64Ptr(0),
		}
	}

	return k8sClient.PolicyV1().Evictions(pod.Namespace).Evict(context.TODO(), eviction)
}
