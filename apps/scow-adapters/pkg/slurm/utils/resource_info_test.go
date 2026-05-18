package utils

import (
	"reflect"
	"testing"

	"github.com/stretchr/testify/assert"

	pb "scow-adapters/gen/go"
)

// 在测试中使用
// 辅助函数，用于创建字符串指针
func strPtr(s string) *string {
	return &s
}

func TestExtractPartitionInfo(t *testing.T) {
	// 准备测试数据
	partitionInfo := map[string]*PartitionInfo{
		"compute": {
			Describe:   "这是普通的cpu计算分区",
			Nodes:      50,
			CpuPerNode: 32,
			GpuPerNode: 0,
			MemPerNode: 64 * 1024, // 64GB转换为MB
		},
		"GPU": {
			Describe:   "这是英伟达3090加速卡分区",
			Nodes:      10,
			CpuPerNode: 32,
			GpuPerNode: 1,
			MemPerNode: 64 * 1024, // 128GB转换为MB
		},
		"A100": {
			Describe:   "这是英伟达A100加速卡分区",
			Nodes:      100,
			CpuPerNode: 32,
			GpuPerNode: 8,
			MemPerNode: 128 * 1024, // 128GB转换为MB
		},
		"memTest": {
			Describe:   "各种单位测试",
			Nodes:      1,
			CpuPerNode: 1,
			GpuPerNode: 0,
			MemPerNode: 1024 * 1024, // 1TB转换为MB
		},
	}

	qosList := []string{"normal", "cpu_qos"}

	tests := []struct {
		name     string
		info     string
		expected *pb.Partition
	}{
		{
			name: "GPU分区-预定义分区信息",
			info: "PartitionName=GPU AllowGroups=ALL AllowAccounts=a_admin AllowQos=ALL AllocNodes=ALL Default=NO QoS=N/A DefaultTime=NONE DisableRootJobs=NO ExclusiveUser=NO GraceTime=0 Hidden=NO MaxNodes=UNLIMITED MaxTime=UNLIMITED MinNodes=0 LLN=NO MaxCPUsPerNode=UNLIMITED Nodes=cn01 PriorityJobFactor=1 PriorityTier=1 RootOnly=NO ReqResv=NO OverSubscribe=NO OverTimeLimit=NONE PreemptMode=OFF State=UP TotalCPUs=8 TotalNodes=1 SelectTypeParameters=NONE JobDefaults=(null) DefMemPerNode=UNLIMITED MaxMemPerNode=UNLIMITED TRES=cpu=8,mem=14000M,node=1,billing=8,gres/gpu=1",
			expected: &pb.Partition{
				Name:    "GPU",
				Nodes:   10,
				MemMb:   640 * 1024,
				Cores:   320,
				Gpus:    10,
				Qos:     qosList,
				Comment: strPtr("这是英伟达3090加速卡分区"),
			},
		},
		{
			name: "GPU分区-DefCpuPerGPU、DefMemPerGPU",
			info: "PartitionName=GPU-Per AllowGroups=ALL AllowAccounts=a_admin AllowQos=ALL AllocNodes=ALL Default=NO QoS=N/A DefaultTime=NONE DisableRootJobs=NO ExclusiveUser=NO GraceTime=0 Hidden=NO MaxNodes=UNLIMITED MaxTime=UNLIMITED MinNodes=0 LLN=NO MaxCPUsPerNode=UNLIMITED Nodes=[gpu02-14,18] PriorityJobFactor=1 PriorityTier=1 RootOnly=NO ReqResv=NO OverSubscribe=NO OverTimeLimit=NONE PreemptMode=OFF State=UP TotalCPUs=8 TotalNodes=14 SelectTypeParameters=NONE JobDefaults=(null) DefMemPerNode=UNLIMITED MaxMemPerNode=UNLIMITED DefMemPerCPU=16106 MaxMemPerCPU=16106 DefCpuPerGPU=16 DefMemPerGPU=257718 TRES=cpu=512,mem=9633792M,node=14,billing=8,gres/gpu=28",
			expected: &pb.Partition{
				Name:    "GPU-Per",
				Nodes:   14,
				MemMb:   7216104,
				Cores:   448,
				Gpus:    28,
				Qos:     qosList,
				Comment: strPtr("GPU-Per"),
			},
		},
		{
			name: "CPU分区-TRES解析",
			info: "PartitionName=CPU AllowGroups=ALL AllowAccounts=a_admin AllowQos=ALL AllocNodes=ALL Default=YES QoS=N/A DefaultTime=NONE DisableRootJobs=NO ExclusiveUser=NO GraceTime=0 Hidden=NO MaxNodes=UNLIMITED MaxTime=UNLIMITED MinNodes=0 LLN=NO MaxCPUsPerNode=UNLIMITED Nodes=cn02 PriorityJobFactor=1 PriorityTier=1 RootOnly=NO ReqResv=NO OverSubscribe=NO OverTimeLimit=NONE PreemptMode=OFF State=UP TotalCPUs=8 TotalNodes=1 SelectTypeParameters=NONE JobDefaults=(null) DefMemPerNode=UNLIMITED MaxMemPerNode=UNLIMITED TRES=cpu=8,mem=14000M,node=1,billing=8",
			expected: &pb.Partition{
				Name:    "CPU",
				Nodes:   1,
				MemMb:   14000,
				Cores:   8,
				Gpus:    0,
				Qos:     qosList, // AllowQos=ALL
				Comment: strPtr("CPU"),
			},
		},
		{
			name: "compute分区-预定义分区信息",
			info: "PartitionName=compute AllowGroups=ALL AllowAccounts=root,a_admin AllowQos=cpu_qos AllocNodes=ALL Default=NO QoS=N/A DefaultTime=NONE DisableRootJobs=NO ExclusiveUser=NO GraceTime=0 Hidden=NO MaxNodes=UNLIMITED MaxTime=UNLIMITED MinNodes=0 LLN=NO MaxCPUsPerNode=UNLIMITED Nodes=cn02 PriorityJobFactor=1 PriorityTier=1 RootOnly=NO ReqResv=NO OverSubscribe=NO OverTimeLimit=NONE PreemptMode=OFF State=UP TotalCPUs=8 TotalNodes=1 SelectTypeParameters=NONE JobDefaults=(null) DefMemPerNode=UNLIMITED MaxMemPerNode=UNLIMITED TRES=cpu=8,mem=14000M,node=1,billing=8",
			expected: &pb.Partition{
				Name:    "compute",
				Nodes:   50,                  // 来自partitionInfo
				MemMb:   50 * 64 * 1024,      // 50 nodes * 64GB
				Cores:   50 * 32,             // 50 nodes * 32 cores
				Gpus:    0,                   // 无GPU
				Qos:     []string{"cpu_qos"}, // AllowQos=cpu_qos
				Comment: strPtr("这是普通的cpu计算分区"),
			},
		},
		{
			name: "k8s分区-TRES解析",
			info: "PartitionName=k8s AllowGroups=ALL AllowAccounts=a_admin AllowQos=ALL AllocNodes=ALL Default=NO QoS=N/A DefaultTime=NONE DisableRootJobs=NO ExclusiveUser=NO GraceTime=0 Hidden=NO MaxNodes=UNLIMITED MaxTime=UNLIMITED MinNodes=0 LLN=NO MaxCPUsPerNode=UNLIMITED Nodes=k8s-node[01-02] PriorityJobFactor=1 PriorityTier=1 RootOnly=NO ReqResv=NO OverSubscribe=NO OverTimeLimit=NONE PreemptMode=OFF State=UP TotalCPUs=16 TotalNodes=2 SelectTypeParameters=NONE JobDefaults=(null) DefMemPerNode=UNLIMITED MaxMemPerNode=UNLIMITED TRES=cpu=16,mem=28000M,node=2,billing=16",
			expected: &pb.Partition{
				Name:    "k8s",
				Nodes:   2,
				MemMb:   28000,
				Cores:   16,
				Gpus:    0,
				Qos:     qosList, // AllowQos=ALL
				Comment: strPtr("k8s"),
			},
		},
		{
			name: "A100分区-预定义分区信息",
			info: "PartitionName=A100 AllowGroups=ALL AllowAccounts=a_admin AllowQos=ALL AllocNodes=ALL Default=NO QoS=N/A DefaultTime=NONE DisableRootJobs=NO ExclusiveUser=NO GraceTime=0 Hidden=NO MaxNodes=UNLIMITED MaxTime=UNLIMITED MinNodes=0 LLN=NO MaxCPUsPerNode=UNLIMITED Nodes=A100-node[01-10] PriorityJobFactor=1 PriorityTier=1 RootOnly=NO ReqResv=NO OverSubscribe=NO OverTimeLimit=NONE PreemptMode=OFF State=UP TotalCPUs=320 TotalNodes=10 SelectTypeParameters=NONE JobDefaults=(null) DefMemPerNode=UNLIMITED MaxMemPerNode=UNLIMITED TRES=cpu=320,mem=1280G,node=10,gres/gpu=80",
			expected: &pb.Partition{
				Name:    "A100",
				Nodes:   100,              // 来自partitionInfo
				MemMb:   100 * 128 * 1024, // 100 nodes * 128GB
				Cores:   100 * 32,         // 100 nodes * 32 cores
				Gpus:    100 * 8,          // 100 nodes * 8 GPUs
				Qos:     qosList,          // AllowQos=ALL
				Comment: strPtr("这是英伟达A100加速卡分区"),
			},
		},
		{
			name: "memTest分区-大内存单位解析",
			info: "PartitionName=memTest AllowGroups=ALL AllowAccounts=a_admin AllowQos=ALL AllocNodes=ALL Default=NO QoS=N/A DefaultTime=NONE DisableRootJobs=NO ExclusiveUser=NO GraceTime=0 Hidden=NO MaxNodes=UNLIMITED MaxTime=UNLIMITED MinNodes=0 LLN=NO MaxCPUsPerNode=UNLIMITED Nodes=mem-node PriorityJobFactor=1 PriorityTier=1 RootOnly=NO ReqResv=NO OverSubscribe=NO OverTimeLimit=NONE PreemptMode=OFF State=UP TotalCPUs=1 TotalNodes=1 SelectTypeParameters=NONE JobDefaults=(null) DefMemPerNode=UNLIMITED MaxMemPerNode=UNLIMITED TRES=cpu=1,mem=1T,node=1",
			expected: &pb.Partition{
				Name:    "memTest",
				Nodes:   1,           // 来自partitionInfo
				MemMb:   1024 * 1024, // 1TB
				Cores:   1,           // 1 core
				Gpus:    0,           // 无GPU
				Qos:     qosList,     // AllowQos=ALL
				Comment: strPtr("各种单位测试"),
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ExtractPartitionInfo(tt.info, partitionInfo, qosList)

			// 比较基本字段
			if got.Name != tt.expected.Name {
				t.Errorf("Name 不匹配: got %q, want %q", got.Name, tt.expected.Name)
			}
			if got.Nodes != tt.expected.Nodes {
				t.Errorf("Nodes 不匹配: got %d, want %d", got.Nodes, tt.expected.Nodes)
			}
			if got.MemMb != tt.expected.MemMb {
				t.Errorf("MemMb 不匹配: got %d, want %d", got.MemMb, tt.expected.MemMb)
			}
			if got.Cores != tt.expected.Cores {
				t.Errorf("Cores 不匹配: got %d, want %d", got.Cores, tt.expected.Cores)
			}
			if got.Gpus != tt.expected.Gpus {
				t.Errorf("Gpus 不匹配: got %d, want %d", got.Gpus, tt.expected.Gpus)
			}

			// 比较QoS列表
			if !reflect.DeepEqual(got.Qos, tt.expected.Qos) {
				t.Errorf("Qos 不匹配: got %v, want %v", got.Qos, tt.expected.Qos)
			}

			// 比较Comment
			if got.Comment == nil && tt.expected.Comment != nil {
				t.Errorf("Comment 不匹配: got nil, want %q", *tt.expected.Comment)
			} else if got.Comment != nil && tt.expected.Comment == nil {
				t.Errorf("Comment 不匹配: got %q, want nil", *got.Comment)
			} else if got.Comment != nil && tt.expected.Comment != nil && *got.Comment != *tt.expected.Comment {
				t.Errorf("Comment 不匹配: got %q, want %q", *got.Comment, *tt.expected.Comment)
			}
		})
	}
}

func TestParseTRES(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected TresResources
	}{
		{
			name:  "基础资源分配",
			input: "cpu=16,mem=28000M,node=2,billing=16",
			expected: TresResources{
				CPU:   16,
				MemMB: 28000,
				Nodes: 2,
				OtherResources: map[string]uint32{
					"billing": 16,
				},
				Accelerators: make(map[string]uint32),
			},
		},
		{
			name:  "包含GPU资源",
			input: "cpu=8,mem=14000M,node=1,billing=8,gres/gpu=1",
			expected: TresResources{
				CPU:   8,
				MemMB: 14000,
				Nodes: 1,
				OtherResources: map[string]uint32{
					"billing": 8,
				},
				Accelerators: map[string]uint32{
					"gpu": 1,
				},
			},
		},
		{
			name:  "无加速器资源",
			input: "cpu=8,mem=14000M,node=1,billing=8",
			expected: TresResources{
				CPU:   8,
				MemMB: 14000,
				Nodes: 1,
				OtherResources: map[string]uint32{
					"billing": 8,
				},
				Accelerators: make(map[string]uint32),
			},
		},
		{
			name:  "重复资源累加",
			input: "cpu=16,mem=28000M,node=2,billing=16,cpu=8,mem=14000M,node=1,billing=8",
			expected: TresResources{
				CPU:   24,
				MemMB: 42000,
				Nodes: 3,
				OtherResources: map[string]uint32{
					"billing": 24,
				},
				Accelerators: make(map[string]uint32),
			},
		},
		{
			name:  "空字符串",
			input: "",
			expected: TresResources{
				Accelerators:   make(map[string]uint32),
				OtherResources: make(map[string]uint32),
			},
		},
		{
			name:  "无效格式",
			input: "cpu=16,invalid,mem=28000M",
			expected: TresResources{
				CPU:            16,
				MemMB:          28000,
				Accelerators:   make(map[string]uint32),
				OtherResources: make(map[string]uint32),
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ParseTRES(tt.input)

			// 比较基本字段
			if got.CPU != tt.expected.CPU {
				t.Errorf("CPU 不匹配: got %d, want %d", got.CPU, tt.expected.CPU)
			}
			if got.MemMB != tt.expected.MemMB {
				t.Errorf("MemMB 不匹配: got %d, want %d", got.MemMB, tt.expected.MemMB)
			}
			if got.Nodes != tt.expected.Nodes {
				t.Errorf("Nodes 不匹配: got %d, want %d", got.Nodes, tt.expected.Nodes)
			}

			// 比较加速器资源
			if !reflect.DeepEqual(got.Accelerators, tt.expected.Accelerators) {
				t.Errorf("Accelerators 不匹配: got %v, want %v", got.Accelerators, tt.expected.Accelerators)
			}

			// 比较其他资源
			if !reflect.DeepEqual(got.OtherResources, tt.expected.OtherResources) {
				t.Errorf("OtherResources 不匹配: got %v, want %v", got.OtherResources, tt.expected.OtherResources)
			}
		})
	}
}

func TestExtractNumber(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected uint32
	}{
		// 正常数字情况
		{"纯数字", "12345", 12345},
		{"长数字", "987654321", 987654321},
		{"最大uint32", "4294967295", 4294967295}, // uint32最大值

		// 数字开头但包含其他字符
		{"数字开头带字母", "123abc", 123},
		{"数字开头带符号", "456-789", 456},
		{"数字开头带空格", "789 123", 789},

		// 非数字情况
		{"空字符串", "", 0},
		{"纯字母", "abc", 0},
		{"符号开头", "-123", 0},
		{"小数点开头", ".123", 0},
		{"空格开头", " 123", 0},

		// 边界情况
		{"零", "0", 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractNumber(tt.input)
			if got != tt.expected {
				t.Errorf("extractNumber(%q) = %v, want %v", tt.input, got, tt.expected)
			}
		})
	}
}

func TestParseMemory(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected uint64
	}{
		{"纯数字无单位", "1024", 1024},
		{"小写k", "512k", 512 / 1024},
		{"大写K", "512K", 512 / 1024},
		{"大写M", "256M", 256},
		{"大写G", "2G", 2 * 1024},
		{"带空格", "  4G  ", 4 * 1024}, // 正则匹配失败
		{"大写T", "1T", 1 * 1024 * 1024},
		{"零值", "0M", 0},
		{"超大值", "8192G", 8192 * 1024},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseMemory(tt.input)
			assert.Equal(t, tt.expected, got)
		})
	}
}
