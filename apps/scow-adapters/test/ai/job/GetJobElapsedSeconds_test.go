package main

import (
	"testing"

	corev1 "k8s.io/api/core/v1"

	"github.com/stretchr/testify/assert"

	"scow-adapters/pkg/ai/db/models"
	"scow-adapters/pkg/ai/utils"
)

func TestGetJobElapsedSecondsInferenceDispatch(t *testing.T) {
	const base = int64(1_700_000_000)

	pods := []*models.PodTable{
		{Name: "worker-0", Status: string(corev1.PodSucceeded), StartTime: base, EndTime: base + 100},
		{Name: "worker-0", Status: string(corev1.PodSucceeded), StartTime: base + 150, EndTime: base + 250},
		{Name: "worker-1", Status: string(corev1.PodSucceeded), StartTime: base, EndTime: base + 120},
	}

	t.Run("single inference uses deployment interval merge", func(t *testing.T) {
		job := &models.JobTable{
			NewJobName: "single-infer",
			JobType:    utils.Inference,
			State:      utils.CompletedStatus,
			TimeStart:  uint64(base),
			TimeEnd:    uint64(base + 300),
			PODsReq:    1,
		}

		got := utils.GetJobElapsedSeconds(job, pods)

		assert.Equal(t, int64(220), got)
	})

	t.Run("distributed inference uses vcjob worker max duration", func(t *testing.T) {
		job := &models.JobTable{
			NewJobName: "distributed-infer",
			JobType:    utils.Inference,
			State:      utils.CompletedStatus,
			TimeStart:  uint64(base),
			TimeEnd:    uint64(base + 300),
			PODsReq:    2,
		}

		got := utils.GetJobElapsedSeconds(job, pods)

		assert.Equal(t, int64(200), got)
	})
}
