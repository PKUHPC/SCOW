package informer

import (
	"context"
	"time"

	"github.com/sirupsen/logrus"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
)

const (
	ResourceGPU       = "gpu"
	NvidiaGPUResource = "nvidia.com/gpu"
)

func (i *K8sInformer) clusterSync() {
	for {
		if i.stopCh == nil {
			return
		}
		select {
		case <-i.stopCh:
			return
		default:
			if i.checkDisconnected() {
				time.Sleep(10 * time.Second)
				continue
			}
			nodes, err := i.NodeLister.List(labels.Everything())
			if err != nil {
				logrus.Errorf("[clusterSync] NodeLister failed, %s", err)
				time.Sleep(5 * time.Second)
				continue
			}
			resources := make(map[corev1.ResourceName]map[string]int64)
			for _, node := range nodes {
				for k, v := range node.Status.Capacity {
					if k == NvidiaGPUResource {
						k = ResourceGPU
					}
					if !isKnownLabel(string(k)) {
						continue
					}
					if resources[k] == nil {
						resources[k] = make(map[string]int64)
					}
					resources[k]["capacity"] += v.Value()
				}
			}

			namespaces, err := i.NamespaceLister.List(labels.Everything())
			if err != nil {
				logrus.Errorf("[clusterSync] NamespaceLister failed, %s", err)
				time.Sleep(5 * time.Second)
				continue
			}

			for _, namespace := range namespaces {
				pods, err := i.PodLister.Pods(namespace.GetName()).List(labels.Everything())
				if err != nil {
					logrus.Error("[clusterSync] PodLister failed", err)
					continue
				}

				for _, pod := range pods {
					if pod.Status.Phase != corev1.PodRunning {
						continue
					}

					if len(pod.Spec.Containers) == 0 {
						continue
					}
					for _, container := range pod.Spec.Containers {
						for k, v := range container.Resources.Requests {
							if k == NvidiaGPUResource {
								k = ResourceGPU
							}
							if !isKnownLabel(string(k)) {
								continue
							}
							if resources[k] == nil {
								resources[k] = make(map[string]int64)
							}
							resources[k]["request"] += v.Value()
						}
					}
				}
			}
			if _, ok := resources[ResourceGPU]; !ok {
				resources[ResourceGPU] = make(map[string]int64)
				resources[ResourceGPU]["request"] = 0
				resources[ResourceGPU]["capacity"] = 0
			}
			logrus.Infof("resource: %v", resources)
			time.Sleep(5 * time.Second)
		}
	}
}

func (i *K8sInformer) checkDisconnected() bool {
	var certErr error
	data, nodeErr := i.NodeLister.List(labels.Everything())
	_, certErr = i.clientSet.CertificatesV1().CertificateSigningRequests().Watch(context.TODO(), metav1.ListOptions{})
	if nodeErr == nil && len(data) != 0 && certErr == nil {
		return false
	}
	logrus.Errorf("[checkDisconnected] NodeLister failed, %s", nodeErr)
	logrus.Infof("[checkDisconnected] Completed")
	return true
}

func isKnownLabel(label string) bool {
	KnownLabels := []string{string(corev1.ResourceMemory), ResourceGPU, string(corev1.ResourceCPU)}
	for _, knownLabel := range KnownLabels {
		if label == knownLabel {
			return true
		}
	}
	return false
}
