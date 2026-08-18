package controller

import (
	"context"
	_ "embed"
	"fmt"
	"reflect"

	"github.com/sirupsen/logrus"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/yaml"
	k8sclient "k8s.io/client-go/kubernetes"
	"k8s.io/client-go/util/retry"
	volcanoclient "volcano.sh/apis/pkg/client/clientset/versioned"

	"scow-adapters/pkg/ai/utils"
)

//go:embed config/vllm_ray_scripts.yaml
var vllmRayScriptsConfigYAML []byte

func CheckVLLMRayScriptsConfigMap(k8sClient k8sclient.Interface, volcanoClientSet volcanoclient.Interface) {
	// 目前队列名就是命名空间
	queues, err := utils.GetVolcanoQueue(volcanoClientSet)
	if err != nil {
		logrus.Errorf("CheckVLLMRayScriptsConfigMap get queue failed err:%v", err)
		return
	}
	for _, queue := range queues {
		if err := EnsureVLLMRayScriptsConfigMap(k8sClient, queue.Name); err != nil {
			logrus.Errorf("Ensure namespace %s %s ConfigMap err:%v", queue.Name, utils.VLLMRayScriptsConfigMapName, err)
		}
	}
	logrus.Infof("CheckVLLMRayScriptsConfigMap finished, total %d queues", len(queues))
}

func EnsureVLLMRayScriptsConfigMap(k8sClient k8sclient.Interface, namespace string) error {
	desired, err := DesiredVLLMRayScriptsConfigMap(namespace)
	if err != nil {
		return fmt.Errorf("load vllm ray scripts ConfigMap template: %w", err)
	}

	cmClient := k8sClient.CoreV1().ConfigMaps(namespace)
	err = retry.RetryOnConflict(retry.DefaultRetry, func() error {
		// update 前重新读取资源以处理 resourceVersion conflict
		existing, err := cmClient.Get(context.TODO(), utils.VLLMRayScriptsConfigMapName, metav1.GetOptions{})
		if apierrors.IsNotFound(err) {
			_, err = cmClient.Create(context.TODO(), desired.DeepCopy(), metav1.CreateOptions{})
			if err == nil {
				logrus.Infof("Create namespace %s %s ConfigMap success", namespace, utils.VLLMRayScriptsConfigMapName)
			}
			return err
		}
		if err != nil {
			return err
		}
		// 对比data字段是否相同
		if reflect.DeepEqual(existing.Data, desired.Data) {
			logrus.Tracef("ConfigMap %s/%s is up to date", namespace, utils.VLLMRayScriptsConfigMapName)
			return nil
		}

		updated := existing.DeepCopy()
		updated.Data = desired.Data
		_, err = cmClient.Update(context.TODO(), updated, metav1.UpdateOptions{})
		if err == nil {
			logrus.Infof("Update namespace %s %s ConfigMap success", namespace, utils.VLLMRayScriptsConfigMapName)
		}
		return err
	})
	if err != nil {
		return fmt.Errorf("ensure namespace %s %s ConfigMap: %w", namespace, utils.VLLMRayScriptsConfigMapName, err)
	}
	return nil
}

// DesiredVLLMRayScriptsConfigMap loads the vLLM Ray scripts ConfigMap template for the namespace.
func DesiredVLLMRayScriptsConfigMap(namespace string) (*corev1.ConfigMap, error) {
	cm := &corev1.ConfigMap{}
	if err := yaml.Unmarshal(vllmRayScriptsConfigYAML, cm); err != nil {
		return nil, err
	}
	cm.Namespace = namespace
	cm.Name = utils.VLLMRayScriptsConfigMapName
	return cm, nil
}
