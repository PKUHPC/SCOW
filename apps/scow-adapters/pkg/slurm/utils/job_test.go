package utils

import (
	"strings"
	"testing"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/slurm/config"
)

func TestIsFinishedJobState(t *testing.T) {
	tests := []struct {
		name     string
		state    int
		finished bool
	}{
		{name: "pending", state: 0, finished: false},
		{name: "running", state: 1, finished: false},
		{name: "suspended", state: 2, finished: false},
		{name: "completed", state: 3, finished: true},
		{name: "cancelled", state: 4, finished: true},
		{name: "failed", state: 5, finished: true},
		{name: "timeout", state: 6, finished: true},
		{name: "node fail", state: 7, finished: true},
		{name: "preempted", state: 8, finished: true},
		{name: "boot fail", state: 9, finished: true},
		{name: "deadline", state: 10, finished: true},
		{name: "out of memory", state: 11, finished: true},
		{name: "requeued", state: 0x0400, finished: false},
		{name: "resizing", state: 0x2000, finished: false},
		{name: "signaling", state: 0x800000, finished: false},
		{name: "stage out", state: 0x1000000, finished: false},
		{name: "invalid negative state", state: -1, finished: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isFinishedJobState(tt.state); got != tt.finished {
				t.Fatalf("isFinishedJobState(%d) = %t, want %t", tt.state, got, tt.finished)
			}
		})
	}
}

func TestGetSelectJobSqlUsesFinishedJobStates(t *testing.T) {
	originalConfig := config.SlurmValue
	config.SlurmValue = &config.SlurmConfig{
		MySQLConfig: config.MySQLConfig{ClusterName: "test_cluster"},
	}
	t.Cleanup(func() { config.SlurmValue = originalConfig })

	in := &pb.GetJobsRequest{
		Filter: &pb.GetJobsRequest_Filter{EndTime: &pb.TimeRange{}},
	}

	jobSQL, countSQL, _, _ := getSelectJobSql(in)
	wantCondition := "state IN (3,4,5,6,7,8,9,10,11)"
	for name, query := range map[string]string{"job SQL": jobSQL, "count SQL": countSQL} {
		if !strings.Contains(query, wantCondition) {
			t.Errorf("%s = %q, want condition %q", name, query, wantCondition)
		}
	}
}

func TestIsValidJobInfo(t *testing.T) {
	// 定义测试用例表
	tests := []struct {
		name     string
		jobInfo  string
		expected bool
	}{
		{
			name:     "空字符串应返回false",
			jobInfo:  "",
			expected: false,
		},
		{
			name:     "正常作业",
			jobInfo:  "N/A sxj_nuaa 339586 64 1 qq-3d-penyou-2 UNLIMITED 0 14-22:49:48 cpu normal 2025-09-25T15:19:19 RUNNING sz2302086 2025-09-25T15:19:19 /root/slurm-exporter cu2x175",
			expected: true,
		},
		{
			name:     "有一个参数为空的作业",
			jobInfo:  "N/A ly_nuaa 339167 2 1 yic UNLIMITED 0 16-04:05:53 cpu  2025-09-24T10:03:22 RUNNING hpc70203600 2025-09-24T10:03:21 /fs0/home/hpc70203600/lei8 cu2x181",
			expected: true,
		},
		{
			name:     "有多个参数为空的作业",
			jobInfo:  "N/A ly_nuaa 339167 2  yic UNLIMITED 0 16-04:05:53 cpu  2025-09-24T10:03:22 RUNNING  2025-09-24T10:03:21 /fs0/home/hpc70203600/lei8 cu2x181",
			expected: true,
		},
		{
			name:     "异常作业，作业名包含空格",
			jobInfo:  "N/A sxj_nuaa 339586 64 1 qq-3d-pen you-2 UNLIMITED 0 14-22:49:48 cpu normal 2025-09-25T15:19:19 RUNNING sz2302086 2025-09-25T15:19:19 /root/slurm-exporter cu2x175",
			expected: false,
		},
		{
			name:     "异常作业，有一个参数为空且作业名包含空格",
			jobInfo:  "N/A sxj_nuaa 339586 64 1 qq-3d-pen you-2 UNLIMITED 0 14-22:49:48 cpu  2025-09-25T15:19:19 RUNNING sz2302086 2025-09-25T15:19:19 /root/slurm-exporter cu2x175",
			expected: false,
		},
	}

	// 运行测试用例
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isValidJobInfo(tt.jobInfo, 17)
			if result != tt.expected {
				t.Errorf("输入: %q, 期望: %t, 实际: %t", tt.jobInfo, tt.expected, result)
			}
		})
	}
}
