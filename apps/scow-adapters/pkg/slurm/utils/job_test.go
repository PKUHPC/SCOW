package utils

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/timestamppb"

	pb "scow-adapters/gen/go"
	slurmConfig "scow-adapters/pkg/slurm/config"
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
	originalConfig := slurmConfig.SlurmValue
	slurmConfig.SlurmValue = &slurmConfig.SlurmConfig{
		MySQLConfig: slurmConfig.MySQLConfig{ClusterName: "test_cluster"},
	}
	t.Cleanup(func() { slurmConfig.SlurmValue = originalConfig })

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

func TestResolveUnfinishedJobSubmitTime(t *testing.T) {
	squeueSubmitTime := "2025-09-25T15:19:19"
	parsedSqueueSubmitTime := time.Date(2025, 9, 25, 15, 19, 19, 0, time.Local).Unix()

	t.Run("prefer SlurmDB time", func(t *testing.T) {
		submitTime, exists := resolveUnfinishedJobSubmitTime(map[int]int64{1: 123}, 1, squeueSubmitTime)
		require.True(t, exists)
		require.Equal(t, int64(123), submitTime)
	})

	t.Run("fallback to squeue time when SlurmDB row is missing", func(t *testing.T) {
		submitTime, exists := resolveUnfinishedJobSubmitTime(map[int]int64{}, 1, squeueSubmitTime)
		require.True(t, exists)
		require.Equal(t, parsedSqueueSubmitTime, submitTime)
	})

	t.Run("fallback to squeue time when SlurmDB time is zero", func(t *testing.T) {
		submitTime, exists := resolveUnfinishedJobSubmitTime(map[int]int64{1: 0}, 1, squeueSubmitTime)
		require.True(t, exists)
		require.Equal(t, parsedSqueueSubmitTime, submitTime)
	})

	t.Run("report missing when neither source has a valid time", func(t *testing.T) {
		submitTime, exists := resolveUnfinishedJobSubmitTime(map[int]int64{}, 1, "N/A")
		require.False(t, exists)
		require.Zero(t, submitTime)
	})
}

func TestMatchesSubmitTimeRange(t *testing.T) {
	boundedRange := &pb.TimeRange{
		StartTime: timestamppb.New(time.Unix(100, 0)),
		EndTime:   timestamppb.New(time.Unix(200, 0)),
	}

	require.True(t, matchesSubmitTimeRange(0, false, nil))
	require.True(t, matchesSubmitTimeRange(0, false, &pb.TimeRange{}))
	require.False(t, matchesSubmitTimeRange(0, false, boundedRange))
	require.True(t, matchesSubmitTimeRange(100, true, boundedRange))
	require.True(t, matchesSubmitTimeRange(200, true, boundedRange))
	require.False(t, matchesSubmitTimeRange(99, true, boundedRange))
	require.False(t, matchesSubmitTimeRange(201, true, boundedRange))
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

func TestGetSelectJobSqlUsesParametersForAccounts(t *testing.T) {
	originalConfig := slurmConfig.SlurmValue
	slurmConfig.SlurmValue = &slurmConfig.SlurmConfig{
		MySQLConfig: slurmConfig.MySQLConfig{ClusterName: "cluster"},
	}
	t.Cleanup(func() {
		slurmConfig.SlurmValue = originalConfig
	})

	request := &pb.GetJobsRequest{
		Filter: &pb.GetJobsRequest_Filter{
			Accounts: []string{"account_1", "account') OR 1=1 #"},
		},
	}

	query, totalQuery, params, totalParams := getSelectJobSql(request)

	require.Contains(t, query, "account IN (?,?)")
	require.Contains(t, totalQuery, "account IN (?,?)")
	require.NotContains(t, query, "account_1")
	require.NotContains(t, totalQuery, "account_1")
	require.NotContains(t, query, "OR 1=1")
	require.NotContains(t, totalQuery, "OR 1=1")
	require.Equal(t, []interface{}{"account_1", "account') OR 1=1 #"}, params)
	require.Equal(t, []interface{}{"account_1", "account') OR 1=1 #"}, totalParams)
}

func TestCheckAccountRejectsIllegalAccountName(t *testing.T) {
	require.NoError(t, CheckAccount("account_1"))
	require.Error(t, CheckAccount("account') OR 1=1 #"))
}
