package accountsync

import (
	"testing"

	"github.com/stretchr/testify/assert"

	pb "scow-adapters/gen/go"
)

func TestSummaryCountsOperationsAndUsers(t *testing.T) {
	deleted := true
	accounts := []*pb.SyncAccountInfo{
		{
			AccountName: "account-a",
			Users: []*pb.SyncAccountInfo_UserInAccount{
				{UserId: "user-1"},
				{UserId: "user-2"},
				{UserId: "user-skipped", Deleted: &deleted},
			},
		},
		{
			AccountName: "account-skipped",
			Users:       []*pb.SyncAccountInfo_UserInAccount{{UserId: "user-3"}},
		},
	}
	summary := NewSummary(len(accounts))
	summary.SkipAccount(accounts[1])
	summary.RecordAccount([]*pb.SyncAccountUserInfoResponse_SyncOperationResult{
		CreateAccountSuccessOperation("account-a"),
		BlockAccountSuccessOperation("account-a"),
		AddUserToAccountSuccessOperation("account-a", "user-1"),
		BlockUserInAccountSuccessOperation("account-a", "user-1"),
		UnblockUserInAccountFailedOperation("account-a", "user-2", "failed"),
		RemoveUserFromAccountSuccessOperation("account-a", "removed-user"),
	}, Stats{UsersObserved: 3, UsersProcessed: 2, UsersSkipped: 1})

	assert.Equal(t, 2, summary.accountsRequested)
	assert.Equal(t, 1, summary.accountsProcessed)
	assert.Equal(t, 1, summary.accountsSkipped)
	assert.Equal(t, 4, summary.usersObserved)
	assert.Equal(t, 2, summary.usersProcessed)
	assert.Equal(t, 2, summary.usersSkipped)
	assert.Equal(t, 1, summary.accountsCreated)
	assert.Equal(t, 1, summary.accountBlockChanged)
	assert.Equal(t, 1, summary.usersAdded)
	assert.Equal(t, 1, summary.usersRemoved)
	assert.Equal(t, 1, summary.userBlockChanged)
	assert.Equal(t, 1, summary.failedOperations)
	assert.Equal(t, 0, summary.unchangedUsers())
}

func TestSummaryCountsUnchangedUsers(t *testing.T) {
	summary := NewSummary(1)
	summary.RecordAccount(nil, Stats{UsersObserved: 2, UsersProcessed: 2})

	assert.Equal(t, 2, summary.unchangedUsers())
}

func TestSummaryDoesNotCountUnprocessedUsersAsUnchanged(t *testing.T) {
	tests := []struct {
		name   string
		result *pb.SyncAccountUserInfoResponse_SyncOperationResult
	}{
		{name: "account creation failure", result: CreateAccountFailedOperation("account-a", "failed")},
		{name: "account-wide user sync failure", result: AddUserToAccountFailedOperation("account-a", "", "failed")},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			summary := NewSummary(1)
			summary.RecordAccount([]*pb.SyncAccountUserInfoResponse_SyncOperationResult{tt.result}, Stats{UsersObserved: 1})

			assert.Equal(t, 0, summary.usersProcessed)
			assert.Equal(t, 0, summary.unchangedUsers())
			assert.Equal(t, 1, summary.failedOperations)
		})
	}
}
