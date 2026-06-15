package controller

import (
	"context"
	_ "embed"
	"reflect"

	"github.com/sirupsen/logrus"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/yaml"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/util/retry"
	volcanoclient "volcano.sh/apis/pkg/client/clientset/versioned"

	"scow-adapters/pkg/ai/utils"
)

//go:embed config/devhost.yaml
var devhostConfigYAML []byte

const DevHostConfigMapName = "dev-tools-startup"

func CheckDevHostConfigMap(k8sClient *kubernetes.Clientset, volcanoClientSet *volcanoclient.Clientset) {
	// 目前队列名就是命名空间
	queues, err := utils.GetVolcanoQueue(volcanoClientSet)
	if err != nil {
		logrus.Errorf("CheckDevHostConfigMap get queue failed err:%v", err)
	}
	for _, queue := range queues {
		EnsureConfigMap(k8sClient, queue.Name)
	}
	logrus.Infof("CheckDevHostConfigMap finished, total %d queues", len(queues))
}

func EnsureConfigMap(k8sClient *kubernetes.Clientset, namespace string) {
	desired, err := DesiredDevHostConfigMap(namespace)
	if err != nil {
		logrus.Errorf("load devhost ConfigMap template failed err:%v", err)
		return
	}

	cmClient := k8sClient.CoreV1().ConfigMaps(namespace)
	err = retry.RetryOnConflict(retry.DefaultRetry, func() error {
		// update 前重新读取资源以处理 resourceVersion conflict
		existing, err := cmClient.Get(context.TODO(), DevHostConfigMapName, metav1.GetOptions{})
		if apierrors.IsNotFound(err) {
			_, err = cmClient.Create(context.TODO(), desired.DeepCopy(), metav1.CreateOptions{})
			if err == nil {
				logrus.Infof("Create namespace %s %s ConfigMap success", namespace, DevHostConfigMapName)
			}
			return err
		}
		if err != nil {
			return err
		}
		// 对比data字段是否相同
		if reflect.DeepEqual(existing.Data, desired.Data) {
			logrus.Tracef("ConfigMap %s/%s is up to date", namespace, DevHostConfigMapName)
			return nil
		}

		updated := existing.DeepCopy()
		updated.Data = desired.Data
		_, err = cmClient.Update(context.TODO(), updated, metav1.UpdateOptions{})
		if err == nil {
			logrus.Infof("Update namespace %s %s ConfigMap success", namespace, DevHostConfigMapName)
		}
		return err
	})
	if err != nil {
		logrus.Errorf("Ensure namespace %s %s ConfigMap err:%v", namespace, DevHostConfigMapName, err)
	}
}

// DesiredDevHostConfigMap loads the dev host startup ConfigMap template for the namespace.
func DesiredDevHostConfigMap(namespace string) (*corev1.ConfigMap, error) {
	cm := &corev1.ConfigMap{}
	if err := yaml.Unmarshal(devhostConfigYAML, cm); err != nil {
		return nil, err
	}
	cm.Namespace = namespace
	cm.Name = DevHostConfigMapName
	return cm, nil
}
