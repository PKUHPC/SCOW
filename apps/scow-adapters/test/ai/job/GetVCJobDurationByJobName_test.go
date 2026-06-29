package main

import (
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"

	"github.com/stretchr/testify/assert"

	"scow-adapters/pkg/ai/db/models"
	"scow-adapters/pkg/ai/utils"
)

func TestGetVCJobDurationByJobName(t *testing.T) {
	const (
		jobName = "vcjob-test"
		base    = int64(1_700_000_000)
	)

	tests := []struct {
		name string
		job  *models.JobTable
		pods []*models.PodTable
		want int64
	}{
		{
			name: "no pods falls back to finished job duration",
			job: &models.JobTable{
				NewJobName: jobName,
				State:      utils.CompletedStatus,
				TimeStart:  uint64(base),
				TimeEnd:    uint64(base + 100),
				PODsReq:    1,
			},
			pods: nil,
			want: 100,
		},
		{
			name: "pod count equals node count falls back to job duration",
			job: &models.JobTable{
				NewJobName: jobName,
				State:      utils.CompletedStatus,
				TimeStart:  uint64(base),
				TimeEnd:    uint64(base + 200),
				PODsReq:    1,
			},
			pods: []*models.PodTable{
				{Name: "worker-0", Status: string(corev1.PodSucceeded), StartTime: base + 10, EndTime: base + 40},
			},
			want: 200,
		},
		{
			name: "recreated pods with the same name are summed",
			job: &models.JobTable{
				NewJobName: jobName,
				State:      utils.CompletedStatus,
				TimeStart:  uint64(base),
				TimeEnd:    uint64(base + 400),
				PODsReq:    1,
			},
			pods: []*models.PodTable{
				{Name: "worker-0", Status: string(corev1.PodFailed), StartTime: base, EndTime: base + 100},
				{Name: "worker-0", Status: string(corev1.PodSucceeded), StartTime: base + 150, EndTime: base + 250},
				{Name: "worker-1", Status: string(corev1.PodSucceeded), StartTime: base, EndTime: base + 120},
			},
			want: 200,
		},
		{
			name: "duration uses the longest worker",
			job: &models.JobTable{
				NewJobName: jobName,
				State:      utils.CompletedStatus,
				TimeStart:  uint64(base),
				TimeEnd:    uint64(base + 400),
				PODsReq:    1,
			},
			pods: []*models.PodTable{
				{Name: "worker-0", Status: string(corev1.PodSucceeded), StartTime: base, EndTime: base + 80},
				{Name: "worker-1", Status: string(corev1.PodSucceeded), StartTime: base + 10, EndTime: base + 150},
			},
			want: 140,
		},
		{
			name: "pending and invalid pods are skipped",
			job: &models.JobTable{
				NewJobName: jobName,
				State:      utils.CompletedStatus,
				TimeStart:  uint64(base),
				TimeEnd:    uint64(base + 400),
				PODsReq:    1,
			},
			pods: []*models.PodTable{
				{Name: "pending", Status: string(corev1.PodPending), StartTime: base, EndTime: base + 100},
				{Name: "no-start", Status: string(corev1.PodSucceeded), StartTime: 0, EndTime: base + 100},
				{Name: "no-end", Status: string(corev1.PodSucceeded), StartTime: base, EndTime: 0},
				{Name: "valid", Status: string(corev1.PodSucceeded), StartTime: base + 20, EndTime: base + 90},
			},
			want: 70,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := utils.GetVCJobDurationByJobName(tt.job, tt.pods)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestGetVCJobDurationByJobNameRunningPodUsesNow(t *testing.T) {
	now := time.Now().Unix()
	start := now - 40
	job := &models.JobTable{
		NewJobName: "running-vcjob-test",
		State:      utils.RunningStatus,
		TimeStart:  uint64(now - 300),
		PODsReq:    1,
	}
	pods := []*models.PodTable{
		{Name: "old-worker", Status: string(corev1.PodSucceeded), StartTime: now - 100, EndTime: now - 80},
		{Name: "running-worker", Status: string(corev1.PodRunning), StartTime: start},
	}

	got := utils.GetVCJobDurationByJobName(job, pods)

	assert.GreaterOrEqual(t, got, int64(40))
	assert.LessOrEqual(t, got, int64(45))
}
