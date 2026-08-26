package sync_account_user

import (
	"context"

	protos "scow-adapters/gen/go"
	"scow-adapters/pkg/common/accountsync"
)

func SyncAccountUser(ctx context.Context, syncData *protos.SyncAccountInfo) ([]*protos.SyncAccountUserInfoResponse_SyncOperationResult, accountsync.Stats) {
	var results []*protos.SyncAccountUserInfoResponse_SyncOperationResult
	stats := accountsync.Stats{UsersObserved: len(syncData.GetUsers())}
	assignedPartitions := 0
	if assigned := syncData.GetAssignedPartitions(); assigned != nil {
		assignedPartitions = len(assigned.GetPartitions())
	}
	accountsync.Tracef(ctx, "account=%s users=%d expectedDeleted=%t expectedBlocked=%t useAllPartitions=%t assignedPartitions=%d",
		syncData.GetAccountName(), len(syncData.GetUsers()), syncData.GetDeleted(), syncData.GetBlockedInCluster(),
		syncData.GetUseAllPartitions(), assignedPartitions)

	// 同步创建账户, 若账户创建失败，后续操作都没必要执行了
	result, err := createAccount(ctx, syncData)
	results = append(results, result)
	if err != nil {
		return results, stats
	}

	// 同步账户的用户
	userResults, usersProcessed, usersSkipped := syncUserInAccount(ctx, syncData)
	results = append(results, userResults...)
	stats.UsersProcessed = usersProcessed
	stats.UsersSkipped = usersSkipped

	// 同步账户的封锁状态
	results = append(results, syncAccountBlockStatus(ctx, syncData))

	return results, stats
}

// 同步账户用户的存在情况，然后判断创建用户以及删除用户
func syncUserInAccount(ctx context.Context, syncData *protos.SyncAccountInfo) ([]*protos.SyncAccountUserInfoResponse_SyncOperationResult, int, int) {
	var results []*protos.SyncAccountUserInfoResponse_SyncOperationResult
	usersProcessed := 0
	usersSkipped := 0

	if len(syncData.Users) != 0 {
		// syncData中存在user，创建及封锁用户(若需要)
		var addResults []*protos.SyncAccountUserInfoResponse_SyncOperationResult
		addResults, usersProcessed, usersSkipped = AddAndBlockUserInAccount(ctx, syncData.Users, syncData.AccountName)
		results = append(results, addResults...)
	}

	// 删除集群中该账户的其他用户(集群中有但是不属于syncData中该账户包含的user)
	results = append(results, DeleteUserInAccount(ctx, syncData.Users, syncData.AccountName)...)

	return results, usersProcessed, usersSkipped
}
