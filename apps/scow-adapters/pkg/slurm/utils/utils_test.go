package utils

import (
	"context"
	"errors"
	"testing"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"
)

func TestExecuteCommandContextStopsCommandWhenContextExpires(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()

	started := time.Now()
	exitCode, _, _, err := ExecuteCommandContext(ctx, "/bin/sleep", "10")
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("expected context deadline exceeded, got %v", err)
	}
	if exitCode != -1 {
		t.Fatalf("expected canceled command exit code -1, got %d", exitCode)
	}
	if elapsed := time.Since(started); elapsed > time.Second {
		t.Fatalf("command was not stopped promptly: %v", elapsed)
	}
}

func TestNormalizeAllowAcctList(t *testing.T) {
	// 定义测试用例表
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "空字符串应返回__NONE__",
			input:    "",
			expected: "__NONE__",
		},
		{
			name:     "空白字符串应返回__NONE__",
			input:    "   ",
			expected: "__NONE__",
		},
		{
			name:     "正常账户列表应保持不变",
			input:    "user1,user2,user3",
			expected: "user1,user2,user3",
		},
		{
			name:     "包含__NONE__应被移除",
			input:    "admin,__NONE__,guest",
			expected: "admin,guest",
		},
		{
			name:     "只有__NONE__应返回__NONE__",
			input:    "__NONE__",
			expected: "__NONE__",
		},
		{
			name:     "前后空格应被修剪",
			input:    "  user1, user2 , __NONE__  ",
			expected: "user1,user2",
		},
		{
			name:     "多个连续逗号应被处理",
			input:    "user1,,user2,,",
			expected: "user1,user2",
		},
	}

	// 运行测试用例
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := NormalizeAllowAcctList(tt.input)
			if result != tt.expected {
				t.Errorf("输入: %q, 期望: %q, 实际: %q", tt.input, tt.expected, result)
			}
		})
	}
}

func TestGetMemoryInMb(t *testing.T) {
	tests := []struct {
		name     string
		input    string // 输入的 memory 字符串表示
		expected int64  // 期望输出的 KiB 值
	}{
		// 正常用例
		{
			name:     "KB to MB",
			input:    "32348132K",
			expected: 32348132 / 1024,
		},
		{
			name:     "MB input",
			input:    "512M",
			expected: 512,
		},
		{
			name:     "GB to MB",
			input:    "2G",
			expected: 2 * 1024,
		},
		{
			name:     "TB to MB",
			input:    "1T",
			expected: 1 * 1024 * 1024,
		},
		{
			name:     "No unit",
			input:    "1024",
			expected: 1024,
		},
		// 边界用例
		{
			name:     "Zero value",
			input:    "0",
			expected: 0,
		},
		{
			name:     "Large GB value",
			input:    "1024G", // 1 TiB
			expected: 1024 * 1024,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 调用被测函数
			actual := GetMemoryInMb(tt.input)

			// 3. 验证结果
			if actual != tt.expected {
				t.Errorf(
					"case %q failed: input %s, expected %d MB, got %d MB",
					tt.name,
					tt.input,
					tt.expected,
					actual,
				)
			}
		})
	}
}

func TestConvertJobStartTime(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    *timestamppb.Timestamp
		wantErr bool
	}{
		{
			name:    "N/A value",
			input:   "N/A",
			want:    nil,
			wantErr: false,
		},
		{
			name:    "Lowercase n/a value",
			input:   "n/a",
			want:    nil,
			wantErr: false,
		},
		{
			name:    "Empty string",
			input:   "",
			want:    nil,
			wantErr: false,
		},
		{
			name:    "Valid timestamp without timezone",
			input:   "2025-10-29T09:03:21",
			want:    timestamppb.New(time.Date(2025, 10, 29, 9, 3, 21, 0, time.UTC)),
			wantErr: false,
		},
		{
			name:    "Valid timestamp with Z timezone",
			input:   "2025-10-29T09:03:21Z",
			want:    timestamppb.New(time.Date(2025, 10, 29, 9, 3, 21, 0, time.UTC)),
			wantErr: false,
		},
		{
			name:    "Valid timestamp with offset timezone",
			input:   "2025-10-29T09:03:21+08:00",
			want:    timestamppb.New(time.Date(2025, 10, 29, 1, 3, 21, 0, time.UTC)), // UTC时间 = 本地时间 - 8小时
			wantErr: false,
		},
		{
			name:    "Space separated format",
			input:   "2025-10-29 09:03:21",
			want:    timestamppb.New(time.Date(2025, 10, 29, 9, 3, 21, 0, time.UTC)),
			wantErr: false,
		},
		{
			name:    "Invalid timestamp",
			input:   "invalid-time",
			want:    nil,
			wantErr: false, // 函数内部处理错误，返回nil而不是错误
		},
		{
			name:    "RFC1123 format",
			input:   "Wed, 29 Oct 2025 09:03:21 GMT",
			want:    timestamppb.New(time.Date(2025, 10, 29, 9, 3, 21, 0, time.UTC)),
			wantErr: false,
		},
		{
			name:    "RFC822 format",
			input:   "29 Oct 25 09:03 GMT",
			want:    timestamppb.New(time.Date(2025, 10, 29, 9, 3, 0, 0, time.UTC)),
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ConvertJobStartTime(tt.input)

			// 处理nil情况
			if tt.want == nil {
				if got != nil {
					t.Errorf("ConvertJobStartTime(%q) = %v, want nil", tt.input, got)
				}
				return
			}

			// 处理非nil情况
			if got == nil {
				t.Errorf("ConvertJobStartTime(%q) = nil, want %v", tt.input, tt.want)
				return
			}

			// 比较时间值
			if !got.AsTime().Equal(tt.want.AsTime()) {
				t.Errorf("ConvertJobStartTime(%q) = %v, want %v",
					tt.input, got.AsTime(), tt.want.AsTime())
			}
		})
	}
}

func fixedZone(offset int) *time.Location {
	return time.FixedZone("CST", offset*3600)
}
