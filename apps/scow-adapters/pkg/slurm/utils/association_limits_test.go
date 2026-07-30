package utils

import (
	"database/sql"
	"testing"

	"github.com/stretchr/testify/require"
)

// TestBlockLimitFieldsAreSeparatedBySource 保证账户封锁只修改 Grp*，用户封锁只修改 Max*。
// 这样同一 association 可以同时受到两种封锁，解除其中一种时不会清除另一种限制。
func TestBlockLimitFieldsAreSeparatedBySource(t *testing.T) {
	require.Equal(t, []string{"GrpJobs=0", "GrpSubmitJobs=0"}, accountPartitionBlockLimitArgs(true))
	require.Equal(t, []string{"MaxJobs=0", "MaxSubmitJobs=0"}, userBlockLimitArgs(true))
}

// TestScanLimitPairNormalizesNullToUnlimited 验证 SlurmDB 中的 NULL 会转换为 sacctmgr
// 用于清除限制的 -1，确保解封时能恢复为“未设置限制”。
func TestScanLimitPairNormalizesNullToUnlimited(t *testing.T) {
	limits := scanLimitPair(sql.NullInt64{}, sql.NullInt64{Valid: true, Int64: 12})

	require.Equal(t, associationLimitPair{Jobs: -1, SubmitJobs: 12}, limits)
}

// TestNormalizeOriginalLimitsDoesNotPersistBlockedValues 验证旧数据缺少恢复记录时，
// 双零和只修改成功一个字段的封锁值都不会被当成“封锁前原值”保存。
func TestNormalizeOriginalLimitsDoesNotPersistBlockedValues(t *testing.T) {
	tests := []struct {
		name     string
		actual   associationLimitPair
		expected associationLimitPair
	}{
		{name: "both fields blocked", actual: associationLimitPair{Jobs: 0, SubmitJobs: 0}, expected: associationLimitPair{Jobs: -1, SubmitJobs: -1}},
		{name: "jobs partially blocked", actual: associationLimitPair{Jobs: 0, SubmitJobs: 8}, expected: associationLimitPair{Jobs: -1, SubmitJobs: 8}},
		{name: "submit jobs partially blocked", actual: associationLimitPair{Jobs: 6, SubmitJobs: 0}, expected: associationLimitPair{Jobs: 6, SubmitJobs: -1}},
		{name: "custom limits unchanged", actual: associationLimitPair{Jobs: 6, SubmitJobs: 8}, expected: associationLimitPair{Jobs: 6, SubmitJobs: 8}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.expected, normalizeOriginalLimits(tt.actual))
		})
	}
}
