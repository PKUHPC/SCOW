package main

import (
	"testing"

	"scow-adapters/pkg/ai/db/models"
	jobservice "scow-adapters/pkg/ai/services/job"
)

func TestCreateJobWithGpuQuotaCheckRejectsNilInput(t *testing.T) {
	if _, err := jobservice.CreateJobWithGpuQuotaCheck(nil, &jobservice.SubmitJobReq{}); err == nil {
		t.Fatal("expected nil job table to return an error")
	}
	if _, err := jobservice.CreateJobWithGpuQuotaCheck(&models.JobTable{}, nil); err == nil {
		t.Fatal("expected nil submit job info to return an error")
	}
}

func TestDeleteJobSubmitInfoFileRejectsEmptyJobName(t *testing.T) {
	if err := jobservice.DeleteJobSubmitInfoFile(""); err == nil {
		t.Fatal("expected empty job name to return an error")
	}
}
