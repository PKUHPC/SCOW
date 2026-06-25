package main

import (
	"testing"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/train"
)

func TestGetTensorboardPathPrefixAddsTrailingSlash(t *testing.T) {
	prefix := "/api/proxy/dev-k8s-c/absolute"
	vj := &train.VCJob{
		In: &pb.SubmitJobRequest{
			TensorboardProxyPathPrefix: &prefix,
		},
	}

	want := "/api/proxy/dev-k8s-c/absolute/master-01/30001/"
	if got := vj.GetTensorboardPathPrefix("master-01", 30001); got != want {
		t.Fatalf("tensorboard path prefix = %q, want %q", got, want)
	}
}

func TestGetTensorboardPathPrefixKeepsTrailingSlash(t *testing.T) {
	prefix := "/api/proxy/dev-k8s-c/absolute/"
	vj := &train.VCJob{
		In: &pb.SubmitJobRequest{
			TensorboardProxyPathPrefix: &prefix,
		},
	}

	want := "/api/proxy/dev-k8s-c/absolute/master-01/30001/"
	if got := vj.GetTensorboardPathPrefix("master-01", 30001); got != want {
		t.Fatalf("tensorboard path prefix = %q, want %q", got, want)
	}
}

func TestGetTensorboardPathPrefixAllowsEmptyPrefix(t *testing.T) {
	vj := &train.VCJob{
		In: &pb.SubmitJobRequest{},
	}

	want := "master-01/30001/"
	if got := vj.GetTensorboardPathPrefix("master-01", 30001); got != want {
		t.Fatalf("tensorboard path prefix = %q, want %q", got, want)
	}
}
