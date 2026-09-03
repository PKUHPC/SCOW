package utils

import (
	"testing"

	craneProtos "scow-adapters/gen/crane-ai"
)

func TestGetCraneStatesList(t *testing.T) {
	got := GetCraneStatesList([]string{"PENDING", "RUNNING", "QUEUED", "OUT_OF_MEMORY", "DEADLINE"})
	want := []craneProtos.JobStatus{
		craneProtos.JobStatus_Pending,
		craneProtos.JobStatus_Running,
		craneProtos.JobStatus_OutOfMemory,
		craneProtos.JobStatus_Configuring,
		craneProtos.JobStatus_Starting,
		craneProtos.JobStatus_Completing,
		craneProtos.JobStatus_Suspended,
		craneProtos.JobStatus_Deadline,
	}
	if len(got) != len(want) {
		t.Fatalf("GetCraneStatesList() = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("GetCraneStatesList()[%d] = %s, want %s", i, got[i], want[i])
		}
	}
}
