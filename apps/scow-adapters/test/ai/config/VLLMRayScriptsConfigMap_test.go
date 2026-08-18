package main

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/yaml"
	k8sfake "k8s.io/client-go/kubernetes/fake"

	"scow-adapters/pkg/ai/controller"
	"scow-adapters/pkg/ai/utils"
)

func TestDesiredVLLMRayScriptsConfigMap(t *testing.T) {
	namespace := "test-queue"
	expected := loadVLLMRayScriptsConfigMap(t)

	cm, err := controller.DesiredVLLMRayScriptsConfigMap(namespace)

	assert.NoError(t, err)
	assert.Equal(t, "v1", cm.APIVersion)
	assert.Equal(t, "ConfigMap", cm.Kind)
	assert.Equal(t, namespace, cm.Namespace)
	assert.Equal(t, utils.VLLMRayScriptsConfigMapName, cm.Name)
	assert.Equal(t, expected.Data, cm.Data)
}

func TestEnsureVLLMRayScriptsConfigMapCreatesAndRestoresData(t *testing.T) {
	const namespace = "test-queue"
	cli := k8sfake.NewSimpleClientset()

	require.NoError(t, controller.EnsureVLLMRayScriptsConfigMap(cli, namespace))
	created, err := cli.CoreV1().ConfigMaps(namespace).Get(
		context.Background(), utils.VLLMRayScriptsConfigMapName, metav1.GetOptions{},
	)
	require.NoError(t, err)
	require.NotEmpty(t, created.Data["multi-node-serving.sh"])

	created.Data = map[string]string{"multi-node-serving.sh": "modified"}
	_, err = cli.CoreV1().ConfigMaps(namespace).Update(context.Background(), created, metav1.UpdateOptions{})
	require.NoError(t, err)
	require.NoError(t, controller.EnsureVLLMRayScriptsConfigMap(cli, namespace))

	restored, err := cli.CoreV1().ConfigMaps(namespace).Get(
		context.Background(), utils.VLLMRayScriptsConfigMapName, metav1.GetOptions{},
	)
	require.NoError(t, err)
	assert.Equal(t, loadVLLMRayScriptsConfigMap(t).Data, restored.Data)
}

func loadVLLMRayScriptsConfigMap(t *testing.T) *corev1.ConfigMap {
	t.Helper()

	_, filename, _, ok := runtime.Caller(0)
	require.True(t, ok)

	path := filepath.Join(filepath.Dir(filename), "../../../pkg/ai/controller/config/vllm_ray_scripts.yaml")
	content, err := os.ReadFile(path)
	require.NoError(t, err)

	cm := &corev1.ConfigMap{}
	require.NoError(t, yaml.Unmarshal(content, cm))

	return cm
}
