package utils

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"

	"github.com/sirupsen/logrus"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// CreateImageRegistrySecret creates a docker-registry Secret
func CreateImageRegistrySecret(namespace, secretName, registry, username, password string) error {
	logrus.Infof("secretName: %s, username: %s, password: %s", secretName, username, password)
	clientSet, err := GetK8sClient()
	if err != nil {
		logrus.Errorf("GetK8sClient err: %v", err)
		return err
	}
	auth := base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%s:%s", username, password)))
	dockerConfig := map[string]interface{}{
		"auths": map[string]interface{}{
			registry: map[string]string{
				//				"username": username,
				//				"password": password,
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
			".dockerconfigjson": dockerConfigJSON,
		},
	}

	_, err = clientSet.CoreV1().Secrets(namespace).Create(context.Background(), secret, metav1.CreateOptions{})
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
	err = clientSet.CoreV1().Secrets(namespace).Delete(context.TODO(), secretName, metav1.DeleteOptions{})
	if err != nil {
		logrus.Errorf("Secret %s deleted failed", secretName)
		return fmt.Errorf("failed to delete secret: %v", err)
	}

	logrus.Infof("Secret %s deleted successfully", secretName)
	return nil
}
