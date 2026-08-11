package utils

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseStepIdListReturnsJobIdSelectors(t *testing.T) {
	selectors, err := ParseStepIdList("42.2,7,42.3", ",")
	require.NoError(t, err)
	require.Len(t, selectors, 2)
	require.Equal(t, uint32(7), selectors[0].GetJobId())
	require.Empty(t, selectors[0].GetSteps())
	require.Equal(t, uint32(42), selectors[1].GetJobId())
	require.Equal(t, []uint32{2, 3}, selectors[1].GetSteps())
}
