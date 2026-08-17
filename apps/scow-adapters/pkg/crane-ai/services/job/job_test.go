package job

import (
	"testing"

	craneProtos "scow-adapters/gen/crane-ai"
)

func TestIsFinishedJobStatus(t *testing.T) {
	tests := []struct {
		name     string
		status   craneProtos.JobStatus
		finished bool
	}{
		{name: "completed", status: craneProtos.JobStatus_Completed, finished: true},
		{name: "failed", status: craneProtos.JobStatus_Failed, finished: true},
		{name: "cancelled", status: craneProtos.JobStatus_Cancelled, finished: true},
		{name: "exceed time limit", status: craneProtos.JobStatus_ExceedTimeLimit, finished: true},
		{name: "out of memory", status: craneProtos.JobStatus_OutOfMemory, finished: true},
		{name: "deadline", status: craneProtos.JobStatus_Deadline, finished: true},
		{name: "pending", status: craneProtos.JobStatus_Pending, finished: false},
		{name: "running", status: craneProtos.JobStatus_Running, finished: false},
		{name: "configuring", status: craneProtos.JobStatus_Configuring, finished: false},
		{name: "starting", status: craneProtos.JobStatus_Starting, finished: false},
		{name: "completing", status: craneProtos.JobStatus_Completing, finished: false},
		{name: "suspended", status: craneProtos.JobStatus_Suspended, finished: false},
		{name: "invalid", status: craneProtos.JobStatus_Invalid, finished: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isFinishedJobStatus(tt.status); got != tt.finished {
				t.Fatalf("isFinishedJobStatus(%s) = %t, want %t", tt.status, got, tt.finished)
			}
		})
	}
}
