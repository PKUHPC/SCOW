package main

import (
	"testing"

	corev1 "k8s.io/api/core/v1"

	"scow-adapters/pkg/ai/db/models"
	"scow-adapters/pkg/ai/informer"
	"scow-adapters/pkg/ai/utils"
)

func TestBuildDeploymentStatusUpdatesKeepsExistingStartTimeWhenFailed(t *testing.T) {
	updates := informer.BuildDeploymentStatusUpdates(&models.JobTable{
		NewJobName: "inference-job",
		State:      utils.RunningStatus,
		TimeStart:  100,
	}, utils.FailedStatus, 200, 200, 300)

	if _, ok := updates["time_start"]; ok {
		t.Fatalf("failed update unexpectedly contains time_start: %#v", updates)
	}
	if updates["time_end"] != uint64(200) {
		t.Fatalf("time_end = %v, want 200", updates["time_end"])
	}
}

func TestBuildDeploymentStatusUpdatesSetsStartTimeWhenMissing(t *testing.T) {
	updates := informer.BuildDeploymentStatusUpdates(&models.JobTable{
		NewJobName: "inference-job",
	}, utils.FailedStatus, 200, 200, 300)

	if updates["time_start"] != uint64(200) {
		t.Fatalf("time_start = %v, want 200", updates["time_start"])
	}
}

func TestHasTerminalAbnormalPodIgnoresRestartableTermination(t *testing.T) {
	tests := []struct {
		name string
		pod  *corev1.Pod
	}{
		{
			name: "terminated container with always restart policy",
			pod: &corev1.Pod{
				Spec: corev1.PodSpec{RestartPolicy: corev1.RestartPolicyAlways},
				Status: corev1.PodStatus{
					Phase: corev1.PodPending,
					ContainerStatuses: []corev1.ContainerStatus{{
						State: corev1.ContainerState{Terminated: &corev1.ContainerStateTerminated{ExitCode: 1}},
					}},
				},
			},
		},
		{
			name: "crash loop backoff",
			pod: &corev1.Pod{Status: corev1.PodStatus{ContainerStatuses: []corev1.ContainerStatus{{
				State: corev1.ContainerState{Waiting: &corev1.ContainerStateWaiting{Reason: "CrashLoopBackOff"}},
			}}}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if informer.HasTerminalAbnormalPod([]*corev1.Pod{tt.pod}) {
				t.Fatal("restartable pod state must not fail the deployment immediately")
			}
		})
	}
}

func TestHasTerminalAbnormalPodDetectsTerminalFailures(t *testing.T) {
	tests := []struct {
		name string
		pod  *corev1.Pod
	}{
		{
			name: "failed pod phase",
			pod:  &corev1.Pod{Status: corev1.PodStatus{Phase: corev1.PodFailed}},
		},
		{
			name: "non-restartable terminated container",
			pod: &corev1.Pod{
				Spec: corev1.PodSpec{RestartPolicy: corev1.RestartPolicyNever},
				Status: corev1.PodStatus{ContainerStatuses: []corev1.ContainerStatus{{
					State: corev1.ContainerState{Terminated: &corev1.ContainerStateTerminated{ExitCode: 1}},
				}}},
			},
		},
		{
			name: "image pull failure",
			pod: &corev1.Pod{Status: corev1.PodStatus{ContainerStatuses: []corev1.ContainerStatus{{
				State: corev1.ContainerState{Waiting: &corev1.ContainerStateWaiting{Reason: "ImagePullBackOff"}},
			}}}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !informer.HasTerminalAbnormalPod([]*corev1.Pod{tt.pod}) {
				t.Fatal("expected terminal abnormal pod")
			}
		})
	}
}

func TestGetPodStatusKeepsCrashLoopBackOffPodInItsPhase(t *testing.T) {
	pod := &corev1.Pod{Status: corev1.PodStatus{
		Phase: corev1.PodRunning,
		ContainerStatuses: []corev1.ContainerStatus{{
			State: corev1.ContainerState{Waiting: &corev1.ContainerStateWaiting{Reason: "CrashLoopBackOff"}},
		}},
	}}

	if status := utils.GetPodStatus(pod); status != string(corev1.PodRunning) {
		t.Fatalf("pod status = %s, want %s", status, corev1.PodRunning)
	}
}
