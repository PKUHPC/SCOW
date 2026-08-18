package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"testing"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8sfake "k8s.io/client-go/kubernetes/fake"

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

func TestCreateImageRegistrySecretWithClient(t *testing.T) {
	const (
		namespace  = "test-namespace"
		secretName = "test-secret"
		registry   = "registry.example.com"
		username   = "demo-user"
		password   = "demo-password"
	)
	cli := k8sfake.NewSimpleClientset(&corev1.Namespace{
		ObjectMeta: metav1.ObjectMeta{Name: namespace},
	})

	if err := utils.CreateImageRegistrySecretWithClient(namespace, secretName, registry, username, password, cli); err != nil {
		t.Fatalf("CreateImageRegistrySecretWithClient failed: %v", err)
	}

	secret, err := cli.CoreV1().Secrets(namespace).Get(context.Background(), secretName, metav1.GetOptions{})
	if err != nil {
		t.Fatalf("get secret failed: %v", err)
	}
	if secret.Type != corev1.SecretTypeDockerConfigJson {
		t.Fatalf("secret type = %s, want %s", secret.Type, corev1.SecretTypeDockerConfigJson)
	}

	var dockerConfig struct {
		Auths map[string]struct {
			Auth string `json:"auth"`
		} `json:"auths"`
	}
	if err := json.Unmarshal(secret.Data[corev1.DockerConfigJsonKey], &dockerConfig); err != nil {
		t.Fatalf("unmarshal docker config failed: %v", err)
	}
	auth, ok := dockerConfig.Auths[registry]
	if !ok {
		t.Fatalf("registry %s not found in docker config: %v", registry, dockerConfig.Auths)
	}
	wantAuth := base64.StdEncoding.EncodeToString([]byte(username + ":" + password))
	if auth.Auth != wantAuth {
		t.Fatalf("auth = %q, want %q", auth.Auth, wantAuth)
	}
}

func TestDeleteImageRegistrySecretWithClient(t *testing.T) {
	const (
		namespace  = "test-namespace"
		secretName = "test-secret"
	)
	cli := k8sfake.NewSimpleClientset(
		&corev1.Namespace{
			ObjectMeta: metav1.ObjectMeta{Name: namespace},
		},
		&corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{
				Name:      secretName,
				Namespace: namespace,
			},
		},
	)

	if err := utils.DeleteImageRegistrySecretWithClient(namespace, secretName, cli); err != nil {
		t.Fatalf("DeleteImageRegistrySecretWithClient failed: %v", err)
	}
	_, err := cli.CoreV1().Secrets(namespace).Get(context.Background(), secretName, metav1.GetOptions{})
	if !apierrors.IsNotFound(err) {
		t.Fatalf("secret still exists or got unexpected error: %v", err)
	}

	if err := utils.DeleteImageRegistrySecretWithClient(namespace, secretName, cli); err != nil {
		t.Fatalf("DeleteImageRegistrySecretWithClient should ignore not found, got: %v", err)
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
