package utils

import (
	"testing"

	"github.com/stretchr/testify/assert"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"

	"scow-adapters/pkg/ai/config"
)

func TestGetRDMAConfig(t *testing.T) {
	configValue := config.Config{
		RDMAConfig: config.RDMAQueueConfig{
			Queues: map[string]config.RDMAConfig{
				"A100": {
					CNINetworks: "sriov-net-a100",
					RDMADevices: map[string]int{"nvidia.com/rdma": 1},
				},
				"compute": {
					CNINetworks: "sriov-net-compute",
					RDMADevices: map[string]int{"rdma/hca": 2},
				},
			},
		},
	}

	config.Value = &configValue

	t.Run("命中已配置分区 A100", func(t *testing.T) {
		resName, resQty, secCtx, anno := GetRDMAConfig("A100")

		assert.Equal(t, "nvidia.com/rdma", resName)
		assert.Equal(t, 1, resQty)
		assert.Equal(t, corev1.Capabilities{Add: []corev1.Capability{IPCLOCK}}, *secCtx.Capabilities)
		assert.Equal(t, "sriov-net-a100", anno[RDMANetworkKey])
	})

	t.Run("命中已配置分区 compute", func(t *testing.T) {
		resName, resQty, secCtx, anno := GetRDMAConfig("compute")

		assert.Equal(t, "rdma/hca", resName)
		assert.Equal(t, 2, resQty)
		assert.Equal(t, corev1.Capabilities{Add: []corev1.Capability{IPCLOCK}}, *secCtx.Capabilities)
		assert.Equal(t, "sriov-net-compute", anno[RDMANetworkKey])
	})

	t.Run("未命中分区返回零值", func(t *testing.T) {
		resName, resQty, secCtx, anno := GetRDMAConfig("not-exist")

		assert.Equal(t, "", resName)
		assert.Equal(t, 0, resQty)
		assert.Empty(t, secCtx.Capabilities)
		assert.Empty(t, anno)
	})
}

func TestGetMemoryInMib(t *testing.T) {
	tests := []struct {
		name     string
		input    string // 输入的 memory 字符串表示
		expected int64  // 期望输出的 KiB 值
	}{
		// 正常用例
		{
			name:     "KiB to MiB",
			input:    "32348132Ki",
			expected: 32348132 / 1024,
		},
		{
			name:     "MiB input",
			input:    "512Mi",
			expected: 512,
		},
		{
			name:     "GiB to MiB",
			input:    "2Gi",
			expected: 2 * 1024,
		},
		{
			name:     "TiB to MiB",
			input:    "1Ti",
			expected: 1 * 1024 * 1024,
		},
		{
			name:     "No unit (bytes to KiB)",
			input:    "1048576", // 1024 * 1024 bytes = 1024 KiB
			expected: 1,
		},
		// 边界用例
		{
			name:     "Zero value",
			input:    "0",
			expected: 0,
		},
		{
			name:     "Large GiB value",
			input:    "1024Gi", // 1 TiB
			expected: 1024 * 1024,
		},
		{
			name:     "Decimal value truncation",
			input:    "1.5Gi", // 1.5 GiB = 1536 MiB
			expected: 1536,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 1. 构造输入 Quantity
			q := resource.MustParse(tt.input)

			// 2. 调用被测函数
			actual := getMemoryInMb(q)

			// 3. 验证结果
			if actual != tt.expected {
				t.Errorf(
					"case %q failed: input %s, expected %d KiB, got %d KiB",
					tt.name,
					tt.input,
					tt.expected,
					actual,
				)
			}
		})
	}
}

func TestShouldRetainPodReason(t *testing.T) {
	tests := []struct {
		status string
		want   bool
	}{
		{status: string(corev1.PodPending), want: true},
		{status: string(corev1.PodFailed), want: true},
		{status: ContainerCreatingStatus, want: true},
		{status: FailedStatus, want: true},
		{status: string(corev1.PodRunning), want: false},
		{status: string(corev1.PodSucceeded), want: false},
		{status: RunningStatus, want: false},
		{status: CanceledStatus, want: false},
		{status: TimeOutStatus, want: false},
	}

	for _, tt := range tests {
		t.Run(tt.status, func(t *testing.T) {
			assert.Equal(t, tt.want, ShouldRetainPodReason(tt.status))
		})
	}
}
