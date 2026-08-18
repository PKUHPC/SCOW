package main

import (
	"testing"

	corev1 "k8s.io/api/core/v1"

	"scow-adapters/pkg/ai/informer"
)

func TestClassifyEventError(t *testing.T) {
	tests := []struct {
		name    string
		reason  string
		message string
		want    string
	}{
		{
			name:    "image pull back-off is an image pull error",
			reason:  "BackOff",
			message: "Back-off pulling image \"registry.example.com/image:latest\"",
			want:    informer.ImagePullError,
		},
		{
			name:   "err image pull reason is an image pull error",
			reason: "ErrImagePull",
			want:   informer.ImagePullError,
		},
		{
			name:   "image pull back-off reason is an image pull error",
			reason: "ImagePullBackOff",
			want:   informer.ImagePullError,
		},
		{
			name:    "pulling reason is image pulling",
			reason:  "Pulling",
			message: "Pulling image \"registry.example.com/image:latest\"",
			want:    informer.ImagePulling,
		},
		{
			name:    "pulling image message is image pulling fallback",
			message: "Pulling image \"registry.example.com/image:latest\"",
			want:    informer.ImagePulling,
		},
		{
			name:   "failed mount reason is mount error",
			reason: "FailedMount",
			want:   informer.MountError,
		},
		{
			name:    "mount setup failure is mount error fallback",
			message: "MountVolume.SetUp failed for volume \"data\"",
			want:    informer.MountError,
		},
		{
			name:    "failed scheduling with insufficient resources is resource error",
			reason:  "FailedScheduling",
			message: "0/3 nodes are available: 3 Insufficient nvidia.com/gpu.",
			want:    informer.ResourceError,
		},
		{
			name:    "unschedulable with unavailable nodes is resource error",
			reason:  "Unschedulable",
			message: "0/3 nodes are unavailable",
			want:    informer.ResourceError,
		},
		{
			name:    "other scheduling failures are not resource errors",
			reason:  "FailedScheduling",
			message: "pod has unbound immediate PersistentVolumeClaims",
			want:    "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := informer.ClassifyEventError(&corev1.Event{
				Reason:  tt.reason,
				Message: tt.message,
			})
			if got != tt.want {
				t.Errorf("ClassifyEventError() = %q, want %q", got, tt.want)
			}
		})
	}
}
