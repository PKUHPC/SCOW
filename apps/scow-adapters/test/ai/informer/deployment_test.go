package main

import (
	"context"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8sfake "k8s.io/client-go/kubernetes/fake"

	"scow-adapters/pkg/ai/inference"
	"scow-adapters/pkg/ai/utils"
)

func TestSingleInferenceDeleteCleansDeploymentInformerResources(t *testing.T) {
	const (
		namespace = "unit-test-partition"
		jobName   = "single-inference-job"
	)
	cli := k8sfake.NewSimpleClientset(
		&appsv1.Deployment{ObjectMeta: metav1.ObjectMeta{Name: jobName, Namespace: namespace}},
		&corev1.Service{ObjectMeta: metav1.ObjectMeta{Name: jobName, Namespace: namespace}},
		&corev1.Secret{ObjectMeta: metav1.ObjectMeta{Name: jobName, Namespace: namespace}},
		&corev1.ConfigMap{ObjectMeta: metav1.ObjectMeta{Name: "rings-config-" + jobName, Namespace: namespace}},
	)

	if err := inference.DeleteInferenceJob(jobName, utils.HuaweiAscend910, namespace, 1, cli, nil); err != nil {
		t.Fatalf("DeleteInferenceJob failed: %v", err)
	}

	assertDeploymentNotFound(t, cli, namespace, jobName)
	assertServiceNotFound(t, cli, namespace, jobName)
	assertSecretNotFound(t, cli, namespace, jobName)
	assertConfigMapNotFound(t, cli, namespace, "rings-config-"+jobName)
}

func assertDeploymentNotFound(t *testing.T, cli *k8sfake.Clientset, namespace, deploymentName string) {
	t.Helper()

	_, err := cli.AppsV1().Deployments(namespace).Get(context.Background(), deploymentName, metav1.GetOptions{})
	if !apierrors.IsNotFound(err) {
		t.Fatalf("deployment %s still exists or got unexpected error: %v", deploymentName, err)
	}
}

func assertServiceNotFound(t *testing.T, cli *k8sfake.Clientset, namespace, serviceName string) {
	t.Helper()

	_, err := cli.CoreV1().Services(namespace).Get(context.Background(), serviceName, metav1.GetOptions{})
	if !apierrors.IsNotFound(err) {
		t.Fatalf("service %s still exists or got unexpected error: %v", serviceName, err)
	}
}

func assertSecretNotFound(t *testing.T, cli *k8sfake.Clientset, namespace, secretName string) {
	t.Helper()

	_, err := cli.CoreV1().Secrets(namespace).Get(context.Background(), secretName, metav1.GetOptions{})
	if !apierrors.IsNotFound(err) {
		t.Fatalf("secret %s still exists or got unexpected error: %v", secretName, err)
	}
}

func assertConfigMapNotFound(t *testing.T, cli *k8sfake.Clientset, namespace, configMapName string) {
	t.Helper()

	_, err := cli.CoreV1().ConfigMaps(namespace).Get(context.Background(), configMapName, metav1.GetOptions{})
	if !apierrors.IsNotFound(err) {
		t.Fatalf("configmap %s still exists or got unexpected error: %v", configMapName, err)
	}
}
