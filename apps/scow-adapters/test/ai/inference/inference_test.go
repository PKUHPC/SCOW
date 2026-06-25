package main

import (
	"encoding/json"
	"testing"

	corev1 "k8s.io/api/core/v1"

	"scow-adapters/pkg/ai/inference"
	"scow-adapters/pkg/ai/utils"
)

func TestSetInferenceEnvUsesMountTargetPath(t *testing.T) {
	env := inference.SetInferenceEnv(
		"/workdir",
		mountOptions(t, utils.MountModel{Path: "/source/model", Target: "/container/model"}),
		20000,
	)

	values := inferenceEnvValuesByName(env)

	if got := values[utils.ContainerEnvPrefix+utils.ModelPathEnv]; got != "/container/model" {
		t.Fatalf("model env = %q, want %q", got, "/container/model")
	}
}

func TestSetInferenceEnvFallsBackToPathWhenTargetEmpty(t *testing.T) {
	env := inference.SetInferenceEnv(
		"/workdir",
		mountOptions(t, utils.MountModel{Path: "/source/model"}),
		20000,
	)

	values := inferenceEnvValuesByName(env)

	if got := values[utils.ContainerEnvPrefix+utils.ModelPathEnv]; got != "/source/model" {
		t.Fatalf("model env = %q, want %q", got, "/source/model")
	}
}

func mountOptions(t *testing.T, mount utils.MountModel) string {
	t.Helper()

	mountBytes, err := json.Marshal(mount)
	if err != nil {
		t.Fatalf("marshal mount failed: %v", err)
	}

	optionsBytes, err := json.Marshal([]string{string(mountBytes)})
	if err != nil {
		t.Fatalf("marshal mount options failed: %v", err)
	}

	return string(optionsBytes)
}

func inferenceEnvValuesByName(env []corev1.EnvVar) map[string]string {
	values := map[string]string{}
	for _, item := range env {
		values[item.Name] = item.Value
	}
	return values
}
