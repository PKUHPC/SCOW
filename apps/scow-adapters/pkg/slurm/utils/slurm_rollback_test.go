package utils

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"
)

func TestRollbackAddedUserToAccountIgnoresRequestCancellation(t *testing.T) {
	requestCtx, cancel := context.WithCancel(context.Background())
	cancel()

	var calls []string
	cause := errors.New("create allowed partitions failed")
	err := rollbackAddedUserToAccount(
		requestCtx,
		"user1",
		"account1",
		cause,
		func(ctx context.Context, user, account string) error {
			if ctx.Err() != nil {
				t.Fatalf("rollback context inherited request cancellation: %v", ctx.Err())
			}
			calls = append(calls, "association:"+account+":"+user)
			return nil
		},
		func(account, user string) error {
			calls = append(calls, "records:"+account+":"+user)
			return nil
		},
	)

	if !errors.Is(err, cause) {
		t.Fatalf("expected original error, got %v", err)
	}
	expected := []string{"association:account1:user1", "records:account1:user1"}
	if !reflect.DeepEqual(calls, expected) {
		t.Fatalf("unexpected rollback order: got %v, want %v", calls, expected)
	}
}

func TestRollbackAddedUserToAccountKeepsRecordsWhenAssociationDeleteFails(t *testing.T) {
	cause := errors.New("modify qos failed")
	deleteErr := errors.New("sacctmgr delete failed")
	recordsDeleted := false

	err := rollbackAddedUserToAccount(
		context.Background(),
		"user1",
		"account1",
		cause,
		func(context.Context, string, string) error { return deleteErr },
		func(string, string) error {
			recordsDeleted = true
			return nil
		},
	)

	if recordsDeleted {
		t.Fatal("block records were deleted after association rollback failed")
	}
	if !errors.Is(err, cause) || !strings.Contains(err.Error(), deleteErr.Error()) {
		t.Fatalf("rollback error does not preserve both errors: %v", err)
	}
}
