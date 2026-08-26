package accountsync

import (
	"fmt"

	pb "scow-adapters/gen/go"
)

type Stats struct {
	UsersObserved  int
	UsersProcessed int
	UsersSkipped   int
}

type Summary struct {
	accountsRequested   int
	accountsProcessed   int
	accountsSkipped     int
	usersObserved       int
	usersProcessed      int
	usersSkipped        int
	accountsCreated     int
	accountBlockChanged int
	usersAdded          int
	usersRemoved        int
	userBlockChanged    int
	failedOperations    int
	touchedUsers        map[string]struct{}
}

func NewSummary(accountsRequested int) *Summary {
	return &Summary{
		accountsRequested: accountsRequested,
		touchedUsers:      make(map[string]struct{}),
	}
}

func (s *Summary) AccountsRequested() int {
	return s.accountsRequested
}

func (s *Summary) SkipAccount(account *pb.SyncAccountInfo) {
	s.accountsSkipped++
	if account != nil {
		s.usersObserved += len(account.GetUsers())
		s.usersSkipped += len(account.GetUsers())
	}
}

func (s *Summary) RecordAccount(results []*pb.SyncAccountUserInfoResponse_SyncOperationResult, stats Stats) {
	s.accountsProcessed++
	s.usersObserved += stats.UsersObserved
	s.usersProcessed += stats.UsersProcessed
	s.usersSkipped += stats.UsersSkipped
	for _, result := range results {
		if result == nil {
			continue
		}
		if !result.GetSuccess() {
			s.failedOperations++
		}
		switch operation := result.GetSyncOperation().(type) {
		case *pb.SyncAccountUserInfoResponse_SyncOperationResult_CreateAccount:
			if result.GetSuccess() {
				s.accountsCreated++
			}
		case *pb.SyncAccountUserInfoResponse_SyncOperationResult_BlockAccount,
			*pb.SyncAccountUserInfoResponse_SyncOperationResult_UnblockAccount:
			if result.GetSuccess() {
				s.accountBlockChanged++
			}
		case *pb.SyncAccountUserInfoResponse_SyncOperationResult_AddUserToAccount:
			s.recordUserOperation(operation.AddUserToAccount.GetAccountName(), operation.AddUserToAccount.GetUserId())
			if result.GetSuccess() {
				s.usersAdded++
			}
		case *pb.SyncAccountUserInfoResponse_SyncOperationResult_RemoveUserFromAccount:
			if result.GetSuccess() {
				s.usersRemoved++
			}
		case *pb.SyncAccountUserInfoResponse_SyncOperationResult_BlockUserInAccount:
			s.recordUserOperation(operation.BlockUserInAccount.GetAccountName(), operation.BlockUserInAccount.GetUserId())
			if result.GetSuccess() {
				s.userBlockChanged++
			}
		case *pb.SyncAccountUserInfoResponse_SyncOperationResult_UnblockUserInAccount:
			s.recordUserOperation(operation.UnblockUserInAccount.GetAccountName(), operation.UnblockUserInAccount.GetUserId())
			if result.GetSuccess() {
				s.userBlockChanged++
			}
		}
	}
}

func (s *Summary) recordUserOperation(account, user string) {
	if account == "" || user == "" {
		return
	}
	s.touchedUsers[account+"\x00"+user] = struct{}{}
}

func (s *Summary) unchangedUsers() int {
	unchanged := s.usersProcessed - len(s.touchedUsers)
	if unchanged < 0 {
		return 0
	}
	return unchanged
}

func (s *Summary) LogMessage(syncID string, completed bool, reason string, elapsedMs int64, timeoutMs uint32) string {
	return fmt.Sprintf(
		"SyncAccountUserInfo finished: syncId=%q accountsRequested=%d accountsProcessed=%d accountsSkipped=%d "+
			"usersObserved=%d usersProcessed=%d usersSkipped=%d accountsCreated=%d accountBlockChanged=%d "+
			"usersAdded=%d usersRemoved=%d userBlockChanged=%d unchangedUsers=%d failedOperations=%d "+
			"completed=%t reason=%q elapsedMs=%d timeoutMs=%d",
		syncID, s.accountsRequested, s.accountsProcessed, s.accountsSkipped,
		s.usersObserved, s.usersProcessed, s.usersSkipped, s.accountsCreated, s.accountBlockChanged,
		s.usersAdded, s.usersRemoved, s.userBlockChanged, s.unchangedUsers(), s.failedOperations,
		completed, reason, elapsedMs, timeoutMs,
	)
}
