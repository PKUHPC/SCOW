package main

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"scow-adapters/pkg/ai/db/models"
	"scow-adapters/pkg/ai/utils"
)

func TestGetElapsedSecondsByDeployPods(t *testing.T) {
	const (
		jobName = "infer-test"
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
				TimeEnd:    uint64(base + 120),
				PODsReq:    1,
			},
			pods: nil,
			want: 120,
		},
		{
			name: "pod count equals node count falls back to job duration",
			job: &models.JobTable{
				NewJobName: jobName,
				State:      utils.CompletedStatus,
				TimeStart:  uint64(base),
				TimeEnd:    uint64(base + 240),
				PODsReq:    1,
			},
			pods: []*models.PodTable{
				{Name: "pod-0", StartTime: base + 10, EndTime: base + 20},
			},
			want: 240,
		},
		{
			name: "overlapping pod intervals are counted once",
			job: &models.JobTable{
				NewJobName: jobName,
				State:      utils.CompletedStatus,
				TimeStart:  uint64(base),
				TimeEnd:    uint64(base + 400),
				PODsReq:    1,
			},
			pods: []*models.PodTable{
				{Name: "pod-0", StartTime: base, EndTime: base + 100},
				{Name: "pod-1", StartTime: base + 50, EndTime: base + 150},
			},
			want: 150,
		},
		{
			name: "separate pod intervals are summed",
			job: &models.JobTable{
				NewJobName: jobName,
				State:      utils.CompletedStatus,
				TimeStart:  uint64(base),
				TimeEnd:    uint64(base + 400),
				PODsReq:    1,
			},
			pods: []*models.PodTable{
				{Name: "pod-0", StartTime: base, EndTime: base + 100},
				{Name: "pod-1", StartTime: base + 150, EndTime: base + 250},
			},
			want: 200,
		},
		{
			name: "invalid pod intervals fall back to job duration",
			job: &models.JobTable{
				NewJobName: jobName,
				State:      utils.FailedStatus,
				TimeStart:  uint64(base),
				TimeEnd:    uint64(base + 180),
				PODsReq:    1,
			},
			pods: []*models.PodTable{
				{Name: "pod-no-start", StartTime: 0, EndTime: base + 20},
				{Name: "pod-no-end", StartTime: base + 40, EndTime: 0},
				{Name: "pod-invalid", StartTime: base + 90, EndTime: base + 80},
			},
			want: 180,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := utils.GetElapsedSecondsByDeployPods(tt.job, tt.pods)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestGetElapsedSecondsByDeployPodsRunningPodUsesNow(t *testing.T) {
	now := time.Now().Unix()
	start := now - 30
	job := &models.JobTable{
		NewJobName: "running-infer-test",
		State:      utils.RunningStatus,
		TimeStart:  uint64(now - 300),
		PODsReq:    1,
	}
	pods := []*models.PodTable{
		{Name: "old-pod", StartTime: now - 120, EndTime: now - 90},
		{Name: "running-pod", StartTime: start},
	}

	got := utils.GetElapsedSecondsByDeployPods(job, pods)

	assert.GreaterOrEqual(t, got, int64(60))
	assert.LessOrEqual(t, got, int64(65))
}
