package main

import (
	"testing"
	"time"

	appv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"scow-adapters/pkg/ai/informer"
	"scow-adapters/pkg/ai/utils"
)

func TestParseDeployStatus(t *testing.T) {
	creationTime := time.Unix(1_700_000_000, 0)
	availableTime := creationTime.Add(2 * time.Minute)
	failureTime := creationTime.Add(3 * time.Minute)
	zeroReplicas := int32(0)
	oneReplica := int32(1)

	tests := []struct {
		name      string
		deploy    *appv1.Deployment
		wantState string
		wantStart uint64
		wantEnd   uint64
	}{
		{
			name: "pending while no replicas are ready",
			deploy: &appv1.Deployment{
				ObjectMeta: metav1.ObjectMeta{CreationTimestamp: metav1.NewTime(creationTime)},
				Spec:       appv1.DeploymentSpec{Replicas: &oneReplica},
			},
			wantState: utils.PendingStatus,
		},
		{
			name: "running uses available condition transition time",
			deploy: &appv1.Deployment{
				ObjectMeta: metav1.ObjectMeta{CreationTimestamp: metav1.NewTime(creationTime)},
				Spec:       appv1.DeploymentSpec{Replicas: &oneReplica},
				Status: appv1.DeploymentStatus{
					ReadyReplicas: 1,
					Conditions: []appv1.DeploymentCondition{
						{
							Type:               appv1.DeploymentAvailable,
							Status:             corev1.ConditionTrue,
							LastTransitionTime: metav1.NewTime(availableTime),
						},
					},
				},
			},
			wantState: utils.RunningStatus,
			wantStart: uint64(availableTime.Unix()),
		},
		{
			name: "ready replicas take precedence over progress deadline exceeded",
			deploy: &appv1.Deployment{
				ObjectMeta: metav1.ObjectMeta{CreationTimestamp: metav1.NewTime(creationTime)},
				Spec:       appv1.DeploymentSpec{Replicas: &oneReplica},
				Status: appv1.DeploymentStatus{
					ReadyReplicas: 1,
					Conditions: []appv1.DeploymentCondition{
						{
							Type:               appv1.DeploymentProgressing,
							Status:             corev1.ConditionFalse,
							Reason:             "ProgressDeadlineExceeded",
							LastTransitionTime: metav1.NewTime(failureTime),
						},
					},
				},
			},
			wantState: utils.RunningStatus,
			wantStart: uint64(creationTime.Unix()),
		},
		{
			name: "progress deadline exceeded remains pending",
			deploy: &appv1.Deployment{
				ObjectMeta: metav1.ObjectMeta{CreationTimestamp: metav1.NewTime(creationTime)},
				Spec:       appv1.DeploymentSpec{Replicas: &oneReplica},
				Status: appv1.DeploymentStatus{
					Conditions: []appv1.DeploymentCondition{
						{
							Type:               appv1.DeploymentProgressing,
							Status:             corev1.ConditionFalse,
							Reason:             "ProgressDeadlineExceeded",
							LastTransitionTime: metav1.NewTime(failureTime),
						},
					},
				},
			},
			wantState: utils.PendingStatus,
		},
		{
			name: "replica failure is failed",
			deploy: &appv1.Deployment{
				ObjectMeta: metav1.ObjectMeta{CreationTimestamp: metav1.NewTime(creationTime)},
				Spec:       appv1.DeploymentSpec{Replicas: &oneReplica},
				Status: appv1.DeploymentStatus{
					Conditions: []appv1.DeploymentCondition{
						{
							Type:               appv1.DeploymentReplicaFailure,
							Status:             corev1.ConditionTrue,
							LastTransitionTime: metav1.NewTime(failureTime),
						},
					},
				},
			},
			wantState: utils.FailedStatus,
			wantStart: uint64(failureTime.Unix()),
			wantEnd:   uint64(failureTime.Unix()),
		},
		{
			name: "replica failure takes precedence regardless of condition order",
			deploy: &appv1.Deployment{
				ObjectMeta: metav1.ObjectMeta{CreationTimestamp: metav1.NewTime(creationTime)},
				Spec:       appv1.DeploymentSpec{Replicas: &oneReplica},
				Status: appv1.DeploymentStatus{
					Conditions: []appv1.DeploymentCondition{
						{
							Type:   appv1.DeploymentProgressing,
							Status: corev1.ConditionFalse,
							Reason: "ProgressDeadlineExceeded",
						},
						{
							Type:               appv1.DeploymentReplicaFailure,
							Status:             corev1.ConditionTrue,
							Reason:             "FailedCreate",
							LastTransitionTime: metav1.NewTime(failureTime),
						},
					},
				},
			},
			wantState: utils.FailedStatus,
			wantStart: uint64(failureTime.Unix()),
			wantEnd:   uint64(failureTime.Unix()),
		},
		{
			name: "zero desired replicas remain pending",
			deploy: &appv1.Deployment{
				ObjectMeta: metav1.ObjectMeta{CreationTimestamp: metav1.NewTime(creationTime)},
				Spec:       appv1.DeploymentSpec{Replicas: &zeroReplicas},
			},
			wantState: utils.PendingStatus,
		},
		{
			name: "running falls back to creation time when available transition time is zero",
			deploy: &appv1.Deployment{
				ObjectMeta: metav1.ObjectMeta{CreationTimestamp: metav1.NewTime(creationTime)},
				Spec:       appv1.DeploymentSpec{Replicas: &oneReplica},
				Status: appv1.DeploymentStatus{
					ReadyReplicas: 1,
					Conditions: []appv1.DeploymentCondition{{
						Type:   appv1.DeploymentAvailable,
						Status: corev1.ConditionTrue,
					}},
				},
			},
			wantState: utils.RunningStatus,
			wantStart: uint64(creationTime.Unix()),
		},
		{
			name: "ready replicas take precedence over replica failure",
			deploy: &appv1.Deployment{
				ObjectMeta: metav1.ObjectMeta{CreationTimestamp: metav1.NewTime(creationTime)},
				Spec:       appv1.DeploymentSpec{Replicas: &oneReplica},
				Status: appv1.DeploymentStatus{
					ReadyReplicas: 1,
					Conditions: []appv1.DeploymentCondition{{
						Type:   appv1.DeploymentReplicaFailure,
						Status: corev1.ConditionTrue,
					}},
				},
			},
			wantState: utils.RunningStatus,
			wantStart: uint64(creationTime.Unix()),
		},
		{
			name: "replica failure false remains pending",
			deploy: &appv1.Deployment{
				ObjectMeta: metav1.ObjectMeta{CreationTimestamp: metav1.NewTime(creationTime)},
				Spec:       appv1.DeploymentSpec{Replicas: &oneReplica},
				Status: appv1.DeploymentStatus{Conditions: []appv1.DeploymentCondition{{
					Type:   appv1.DeploymentReplicaFailure,
					Status: corev1.ConditionFalse,
				}}},
			},
			wantState: utils.PendingStatus,
		},
		{
			name: "progressing true with deadline reason remains pending",
			deploy: &appv1.Deployment{
				ObjectMeta: metav1.ObjectMeta{CreationTimestamp: metav1.NewTime(creationTime)},
				Spec:       appv1.DeploymentSpec{Replicas: &oneReplica},
				Status: appv1.DeploymentStatus{Conditions: []appv1.DeploymentCondition{{
					Type:   appv1.DeploymentProgressing,
					Status: corev1.ConditionTrue,
					Reason: "ProgressDeadlineExceeded",
				}}},
			},
			wantState: utils.PendingStatus,
		},
		{
			name: "nil replicas defaults to one",
			deploy: &appv1.Deployment{
				ObjectMeta: metav1.ObjectMeta{CreationTimestamp: metav1.NewTime(creationTime)},
				Status:     appv1.DeploymentStatus{ReadyReplicas: 1},
			},
			wantState: utils.RunningStatus,
			wantStart: uint64(creationTime.Unix()),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotState, gotStart, gotEnd := informer.ParseDeployStatus(tt.deploy)
			if gotState != tt.wantState || gotStart != tt.wantStart || gotEnd != tt.wantEnd {
				t.Fatalf(
					"ParseDeployStatus() = (%q, %d, %d), want (%q, %d, %d)",
					gotState, gotStart, gotEnd, tt.wantState, tt.wantStart, tt.wantEnd,
				)
			}
		})
	}
}
