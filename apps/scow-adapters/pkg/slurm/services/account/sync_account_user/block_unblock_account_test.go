package sync_account_user

import (
	"testing"

	"github.com/stretchr/testify/require"

	"scow-adapters/pkg/slurm/utils"
)

// TestNeedsPartitionReconciliation 验证同步直接比较 SCOW 期望状态和 Slurm 实际值。
func TestNeedsPartitionReconciliation(t *testing.T) {
	tests := []struct {
		name        string
		shouldAllow bool
		actual      utils.AccountPartitionAssociationState
		expected    bool
	}{
		{name: "authorized and actually unblocked", shouldAllow: true, expected: false},
		{name: "authorized but actual limits drifted", shouldAllow: true, actual: utils.AccountPartitionAssociationState{HasAssociations: true, HasBlockLimit: true}, expected: true},
		{name: "unauthorized and fully blocked", actual: utils.AccountPartitionAssociationState{HasAssociations: true, Blocked: true, HasBlockLimit: true}, expected: false},
		{name: "unauthorized association missing", expected: true},
		{name: "unauthorized but actual limits drifted", actual: utils.AccountPartitionAssociationState{HasAssociations: true}, expected: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.expected, needsPartitionReconciliation(tt.shouldAllow, tt.actual))
		})
	}
}
