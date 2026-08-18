package utils

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"

	"github.com/sirupsen/logrus"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8sclient "k8s.io/client-go/kubernetes"
)

// CreateImageRegistrySecret creates a docker-registry Secret
func CreateImageRegistrySecret(namespace, secretName, registry, username, password string) error {
	clientSet, err := GetK8sClient()
	if err != nil {
		logrus.Errorf("GetK8sClient err: %v", err)
		return err
	}
	return CreateImageRegistrySecretWithClient(namespace, secretName, registry, username, password, clientSet)
}

func CreateImageRegistrySecretWithClient(namespace, secretName, registry, username, password string, cli k8sclient.Interface) error {
	if cli == nil {
		return fmt.Errorf("k8s client is nil")
	}

	auth := base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%s:%s", username, password)))
	dockerConfig := map[string]interface{}{
		"auths": map[string]interface{}{
			registry: map[string]string{
				"auth": auth,
			},
		},
	}

	dockerConfigJSON, err := json.Marshal(dockerConfig)
	if err != nil {
		logrus.Errorf("Marshal docker config err: %v", err)
		return fmt.Errorf("failed to marshal docker config: %v", err)
	}

	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      secretName,
			Namespace: namespace,
		},
		Type: corev1.SecretTypeDockerConfigJson,
		Data: map[string][]byte{
			corev1.DockerConfigJsonKey: dockerConfigJSON,
		},
	}

	_, err = cli.CoreV1().Secrets(namespace).Create(context.Background(), secret, metav1.CreateOptions{})
	if err != nil {
		logrus.Errorf("failed to create secret: %v", err)
		return fmt.Errorf("failed to create secret: %v", err)
	}
	logrus.Infof("secret %s created successfully", secretName)
	return nil
}

// DeleteImageRegistrySecret deletes the specified Secret if it exists
func DeleteImageRegistrySecret(namespace, secretName string) error {
	clientSet, err := GetK8sClient()
	if err != nil {
		logrus.Errorf("GetK8sClient err: %v", err)
		return err
	}
	return DeleteImageRegistrySecretWithClient(namespace, secretName, clientSet)
}

func DeleteImageRegistrySecretWithClient(namespace, secretName string, cli k8sclient.Interface) error {
	if cli == nil {
		return fmt.Errorf("k8s client is nil")
	}

	err := cli.CoreV1().Secrets(namespace).Delete(context.TODO(), secretName, metav1.DeleteOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil
		}
		logrus.Errorf("Secret %s deleted failed", secretName)
		return fmt.Errorf("failed to delete secret: %v", err)
	}

	logrus.Infof("Secret %s deleted successfully", secretName)
	return nil
}
