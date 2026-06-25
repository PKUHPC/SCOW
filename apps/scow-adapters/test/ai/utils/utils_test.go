package main

import (
	"encoding/json"
	"testing"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/utils"
)

func TestSetContainerEnvUsesMountTargetPath(t *testing.T) {
	req := &pb.SubmitJobRequest{
		ExtraOptions: []string{
			"", "", "",
			mountOptions(t, utils.MountModel{Path: "/source/algorithm", Target: "/container/algorithm"}),
			mountOptions(t, utils.MountModel{Path: "/source/dataset", Target: "/container/dataset"}),
			mountOptions(t, utils.MountModel{Path: "/source/model", Target: "/container/model"}),
		},
	}

	env, err := utils.SetContainerEnv("", req)
	if err != nil {
		t.Fatalf("SetContainerEnv failed: %v", err)
	}

	values := envValuesByName(env)

	if got := values[utils.ContainerEnvPrefix+utils.AlgorithmPathEnv]; got != "/container/algorithm" {
		t.Fatalf("algorithm env = %q, want %q", got, "/container/algorithm")
	}
	if got := values[utils.ContainerEnvPrefix+utils.DataSetPathEnv]; got != "/container/dataset" {
		t.Fatalf("dataset env = %q, want %q", got, "/container/dataset")
	}
	if got := values[utils.ContainerEnvPrefix+utils.ModelPathEnv]; got != "/container/model" {
		t.Fatalf("model env = %q, want %q", got, "/container/model")
	}
}

func TestSetContainerEnvFallsBackToPathWhenTargetEmpty(t *testing.T) {
	req := &pb.SubmitJobRequest{
		ExtraOptions: []string{
			"", "", "",
			mountOptions(t, utils.MountModel{Path: "/source/algorithm"}),
			mountOptions(t, utils.MountModel{Path: "/source/dataset"}),
			mountOptions(t, utils.MountModel{Path: "/source/model"}),
		},
	}

	env, err := utils.SetContainerEnv("", req)
	if err != nil {
		t.Fatalf("SetContainerEnv failed: %v", err)
	}

	values := envValuesByName(env)

	if got := values[utils.ContainerEnvPrefix+utils.AlgorithmPathEnv]; got != "/source/algorithm" {
		t.Fatalf("algorithm env = %q, want %q", got, "/source/algorithm")
	}
	if got := values[utils.ContainerEnvPrefix+utils.DataSetPathEnv]; got != "/source/dataset" {
		t.Fatalf("dataset env = %q, want %q", got, "/source/dataset")
	}
	if got := values[utils.ContainerEnvPrefix+utils.ModelPathEnv]; got != "/source/model" {
		t.Fatalf("model env = %q, want %q", got, "/source/model")
	}
}

func TestSetAscendContainerEnvUsesMountTargetPath(t *testing.T) {
	req := &pb.SubmitJobRequest{
		JobName: "test-job",
		ExtraOptions: []string{
			"", "", "",
			mountOptions(t, utils.MountModel{Path: "/source/algorithm", Target: "/container/algorithm"}),
			mountOptions(t, utils.MountModel{Path: "/source/dataset", Target: "/container/dataset"}),
			mountOptions(t, utils.MountModel{Path: "/source/model", Target: "/container/model"}),
		},
	}

	env, err := utils.SetAscendContainerEnv("", req)
	if err != nil {
		t.Fatalf("SetAscendContainerEnv failed: %v", err)
	}

	values := envValuesByName(env)

	if got := values[utils.ContainerEnvPrefix+utils.AlgorithmPathEnv]; got != "/container/algorithm" {
		t.Fatalf("algorithm env = %q, want %q", got, "/container/algorithm")
	}
	if got := values[utils.ContainerEnvPrefix+utils.DataSetPathEnv]; got != "/container/dataset" {
		t.Fatalf("dataset env = %q, want %q", got, "/container/dataset")
	}
	if got := values[utils.ContainerEnvPrefix+utils.ModelPathEnv]; got != "/container/model" {
		t.Fatalf("model env = %q, want %q", got, "/container/model")
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

func envValuesByName(env []interface{}) map[string]string {
	values := map[string]string{}
	for _, item := range env {
		entry := item.(map[string]interface{})
		value, ok := entry["value"].(string)
		if !ok {
			continue
		}
		values[entry["name"].(string)] = value
	}
	return values
}
