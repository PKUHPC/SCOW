package main

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/util/yaml"

	"scow-adapters/pkg/ai/controller"
)

func TestDesiredDevHostConfigMap(t *testing.T) {
	namespace := "test-queue"
	expected := loadDevHostConfigMap(t)

	cm, err := controller.DesiredDevHostConfigMap(namespace)

	assert.NoError(t, err)
	assert.Equal(t, "v1", cm.APIVersion)
	assert.Equal(t, "ConfigMap", cm.Kind)
	assert.Equal(t, namespace, cm.Namespace)
	assert.Equal(t, controller.DevHostConfigMapName, cm.Name)
	assert.Equal(t, expected.Data, cm.Data)
}

func loadDevHostConfigMap(t *testing.T) *corev1.ConfigMap {
	t.Helper()

	_, filename, _, ok := runtime.Caller(0)
	require.True(t, ok)

	path := filepath.Join(filepath.Dir(filename), "../../../pkg/ai/controller/config/devhost.yaml")
	content, err := os.ReadFile(path)
	require.NoError(t, err)

	cm := &corev1.ConfigMap{}
	require.NoError(t, yaml.Unmarshal(content, cm))

	return cm
}
