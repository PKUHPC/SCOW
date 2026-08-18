package train

import (
	"context"
	"testing"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8sfake "k8s.io/client-go/kubernetes/fake"
	batchv1alpha1 "volcano.sh/apis/pkg/apis/batch/v1alpha1"
	volcanofake "volcano.sh/apis/pkg/client/clientset/versioned/fake"

	"scow-adapters/pkg/ai/config"
	"scow-adapters/pkg/ai/db/models"
	"scow-adapters/pkg/ai/utils"
)

func TestDeleteVCJobResourcesDeletesAuxiliaryResources(t *testing.T) {
	originalConfig := config.Value
	config.Value = &config.Config{}
	t.Cleanup(func() { config.Value = originalConfig })

	const (
		namespace = "test-namespace"
		jobName   = "test-job"
	)
	job := &models.JobTable{
		NewJobName:          jobName,
		Partition:           namespace,
		JobType:             APP,
		GpuType:             utils.HuaweiAscend910,
		VscodeBinPath:       "/usr/bin/code",
		JupyterLabProxyPath: "/jupyter",
	}
	cli := k8sfake.NewSimpleClientset(
		&corev1.Service{ObjectMeta: metav1.ObjectMeta{Name: jobName, Namespace: namespace}},
		&corev1.Service{ObjectMeta: metav1.ObjectMeta{Name: vscode + "-" + jobName, Namespace: namespace}},
		&corev1.Service{ObjectMeta: metav1.ObjectMeta{Name: jupyterlab + "-" + jobName, Namespace: namespace}},
		&corev1.Secret{ObjectMeta: metav1.ObjectMeta{Name: jobName, Namespace: namespace}},
		&corev1.ConfigMap{ObjectMeta: metav1.ObjectMeta{Name: "rings-config-" + jobName, Namespace: namespace}},
	)
	volcanoCli := volcanofake.NewSimpleClientset(&batchv1alpha1.Job{ObjectMeta: metav1.ObjectMeta{Name: jobName, Namespace: namespace}})

	if err := DeleteVCJobResources(job, cli, volcanoCli); err != nil {
		t.Fatalf("DeleteVCJobResources failed: %v", err)
	}
	if _, err := volcanoCli.BatchV1alpha1().Jobs(namespace).Get(context.Background(), jobName, metav1.GetOptions{}); !apierrors.IsNotFound(err) {
		t.Fatalf("vcjob still exists or got unexpected error: %v", err)
	}
	for _, serviceName := range []string{jobName, vscode + "-" + jobName, jupyterlab + "-" + jobName} {
		if _, err := cli.CoreV1().Services(namespace).Get(context.Background(), serviceName, metav1.GetOptions{}); !apierrors.IsNotFound(err) {
			t.Fatalf("service %s still exists or got unexpected error: %v", serviceName, err)
		}
	}
	if _, err := cli.CoreV1().Secrets(namespace).Get(context.Background(), jobName, metav1.GetOptions{}); !apierrors.IsNotFound(err) {
		t.Fatalf("secret still exists or got unexpected error: %v", err)
	}
	if _, err := cli.CoreV1().ConfigMaps(namespace).Get(context.Background(), "rings-config-"+jobName, metav1.GetOptions{}); !apierrors.IsNotFound(err) {
		t.Fatalf("configmap still exists or got unexpected error: %v", err)
	}
}
