package utils

import "testing"

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
