package job

import (
	"strings"
	"testing"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"
	craneProtos "scow-adapters/gen/crane-ai"
	protos "scow-adapters/gen/go"
)

func TestValidateCancelJobReply(t *testing.T) {
	tests := []struct {
		name    string
		reply   *craneProtos.CancelJobReply
		wantErr string
	}{
		{
			name: "cancelled",
			reply: &craneProtos.CancelJobReply{
				Cancelled: []*craneProtos.CancelledJobStep{{JobId: 288}},
			},
		},
		{
			name: "not cancelled",
			reply: &craneProtos.CancelJobReply{
				NotCancelled: []*craneProtos.NotCancelledJobStep{{JobId: 288, Reason: "Permission Denied"}},
			},
			wantErr: "Permission Denied",
		},
		{
			name:    "empty reply",
			reply:   &craneProtos.CancelJobReply{},
			wantErr: "did not report a cancellation result",
		},
		{
			name:    "nil reply",
			wantErr: "empty cancellation result",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateCancelJobReply(288, tt.reply)
			if tt.wantErr == "" {
				if err != nil {
					t.Fatalf("validateCancelJobReply() error = %v", err)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("validateCancelJobReply() error = %v, want error containing %q", err, tt.wantErr)
			}
		})
	}
}

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

func TestBuildCraneGetJobsRequest(t *testing.T) {
	jobID := uint32(260)
	request := buildCraneGetJobsRequest(&protos.GetJobsRequest{
		Filter: &protos.GetJobsRequest_Filter{
			JobId:  &jobID,
			States: []string{"RUNNING"},
			SubmitTime: &protos.TimeRange{
				StartTime: timestamppb.New(time.Unix(100, 0)),
				EndTime:   timestamppb.New(time.Unix(200, 0)),
			},
			EndTime: &protos.TimeRange{
				StartTime: timestamppb.New(time.Unix(300, 0)),
				EndTime:   timestamppb.New(time.Unix(400, 0)),
			},
		},
	})

	if !request.GetOptionIncludeCompletedJobs() {
		t.Fatal("end-time query should include completed jobs")
	}
	if request.GetNumLimit() != getJobsQueryLimit {
		t.Fatalf("query limit = %d, want %d", request.GetNumLimit(), getJobsQueryLimit)
	}
	if len(request.GetFilterJobIds()) != 1 || request.GetFilterJobIds()[0].GetJobId() != jobID {
		t.Fatalf("job id filter = %v, want %d", request.GetFilterJobIds(), jobID)
	}
	if got := request.GetFilterSubmitTimeInterval().GetLowerBound().GetSeconds(); got != 100 {
		t.Fatalf("submit lower bound = %d, want 100", got)
	}
	if got := request.GetFilterSubmitTimeInterval().GetUpperBound().GetSeconds(); got != 200 {
		t.Fatalf("submit upper bound = %d, want 200", got)
	}
	if got := request.GetFilterEndTimeInterval().GetLowerBound().GetSeconds(); got != 300 {
		t.Fatalf("end lower bound = %d, want 300", got)
	}
}

func TestShouldIncludeCompletedJobs(t *testing.T) {
	if shouldIncludeCompletedJobs(&protos.GetJobsRequest_Filter{States: []string{"RUNNING", "PENDING", "QUEUED"}}) {
		t.Fatal("active-only query should not include completed jobs")
	}
	if !shouldIncludeCompletedJobs(&protos.GetJobsRequest_Filter{States: []string{"COMPLETED"}}) {
		t.Fatal("completed-state query should include completed jobs")
	}
}

func TestGetScowJobState(t *testing.T) {
	tests := []struct {
		status craneProtos.JobStatus
		state  string
		reason string
		ended  bool
	}{
		{craneProtos.JobStatus_Configuring, "PENDING", "Configuring", false},
		{craneProtos.JobStatus_Completing, "RUNNING", "Completing", false},
		{craneProtos.JobStatus_OutOfMemory, "OUT_OF_MEMORY", "OutOfMemory", true},
		{craneProtos.JobStatus_Deadline, "DEADLINE", "Deadline", true},
		{craneProtos.JobStatus_Pending, "PENDING", "Resources", false},
	}
	for _, tt := range tests {
		state, reason, ended := getScowJobState(tt.status, func() string {
			if tt.status == craneProtos.JobStatus_Pending {
				return "Resources"
			}
			return ""
		}())
		if state != tt.state || reason != tt.reason || ended != tt.ended {
			t.Errorf("getScowJobState(%s) = (%q, %q, %t), want (%q, %q, %t)", tt.status, state, reason, ended, tt.state, tt.reason, tt.ended)
		}
	}
}
