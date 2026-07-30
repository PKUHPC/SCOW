package account

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"
)

func TestRollbackWholeAccountAndPartitionsRestoresWholeAccountFirst(t *testing.T) {
	requestCtx, cancel := context.WithCancel(context.Background())
	cancel()

	var calls []string
	originalErr := errors.New("unblock gpu failed")
	err := rollbackWholeAccountAndPartitions(
		requestCtx,
		"teamA",
		[]string{"cpu", "gpu"},
		true,
		func(ctx context.Context, account string) error {
			if ctx.Err() != nil {
				t.Fatalf("rollback context must not inherit request cancellation: %v", ctx.Err())
			}
			calls = append(calls, "whole:"+account)
			return nil
		},
		func(ctx context.Context, account, partition string) error {
			if ctx.Err() != nil {
				t.Fatalf("rollback context must not inherit request cancellation: %v", ctx.Err())
			}
			calls = append(calls, account+":"+partition)
			return nil
		},
		originalErr,
	)

	if !errors.Is(err, originalErr) {
		t.Fatalf("expected original error, got %v", err)
	}
	expectedCalls := []string{"whole:teamA", "teamA:cpu", "teamA:gpu"}
	if !reflect.DeepEqual(calls, expectedCalls) {
		t.Fatalf("unexpected rollback order: got %v, want %v", calls, expectedCalls)
	}
}

func TestRollbackWholeAccountAndPartitionsContinuesAfterWholeAccountFailure(t *testing.T) {
	originalErr := errors.New("unblock gpu failed")
	wholeRollbackErr := errors.New("reblock whole account failed")
	partitionRolledBack := false

	err := rollbackWholeAccountAndPartitions(
		context.Background(),
		"teamA",
		[]string{"cpu"},
		true,
		func(context.Context, string) error { return wholeRollbackErr },
		func(context.Context, string, string) error {
			partitionRolledBack = true
			return nil
		},
		originalErr,
	)

	if !partitionRolledBack {
		t.Fatal("partition rollback was skipped after whole account rollback failed")
	}
	if !errors.Is(err, originalErr) {
		t.Fatalf("expected original error, got %v", err)
	}
	if !strings.Contains(err.Error(), wholeRollbackErr.Error()) {
		t.Fatalf("whole account rollback error missing from result: %v", err)
	}
}
