package controller

import (
	"context"
	_ "embed"

	"github.com/sirupsen/logrus"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/yaml"
	"k8s.io/client-go/kubernetes"
	volcanoclient "volcano.sh/apis/pkg/client/clientset/versioned"

	"scow-adapters/pkg/ai/utils"
)

//go:embed config/devhost.yaml
var devhostConfigYAML []byte

func CheckDevHostConfigMap(k8sClient *kubernetes.Clientset, volcanoClientSet *volcanoclient.Clientset) {
	// 目前队列名就是命名空间
	queues, err := utils.GetVolcanoQueue(volcanoClientSet)
	if err != nil {
		logrus.Errorf("CheckDevHostConfigMap get queue failed err:%v", err)
	}
	for _, queue := range queues {
		EnsureConfigMap(k8sClient, queue.Name)
	}
	logrus.Infof("CheckDevHostConfigMap success")
}

func EnsureConfigMap(k8sClient *kubernetes.Clientset, namespace string) {
	// 判断是否存在
	cmName := "dev-tools-startup" // 必须与yaml的 name 保持一致
	_, err := k8sClient.CoreV1().ConfigMaps(namespace).Get(context.TODO(), cmName, metav1.GetOptions{})
	if err == nil {
		logrus.Tracef("ConfigMap %s already exists\n", cmName)
		return
	}
	cm := &corev1.ConfigMap{}
	if err = yaml.Unmarshal(devhostConfigYAML, cm); err != nil {
		logrus.Errorf("unmarshal devhost.yaml failed err:%v", err)
		return
	}
	_, err = k8sClient.CoreV1().ConfigMaps(namespace).Create(context.TODO(), cm, metav1.CreateOptions{})
	if err != nil {
		logrus.Errorf("Create namespace %s dev-tools-startup ConfigMap err:%v", namespace, err)
	}
	return
}
