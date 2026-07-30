package sync_account_user

import (
	"context"

	"github.com/sirupsen/logrus"

	pb "scow-adapters/gen/go"
)

// SyncAccountUser 同步账户用户的业务逻辑函数
func SyncAccountUser(ctx context.Context, syncData *pb.SyncAccountInfo) []*pb.SyncAccountUserInfoResponse_SyncOperationResult {
	var results []*pb.SyncAccountUserInfoResponse_SyncOperationResult
	logrus.Tracef("SyncAccountUser, sync data is: %v", syncData)

	// 同步创建账户, 若账户创建失败，后续操作都没必要执行了
	result, err := createAccount(ctx, syncData)
	results = append(results, result)
	if err != nil {
		logrus.Errorf("[SyncAccountUser] create account failed： %v", err)
		return results
	}

	// 同步账户的用户
	results = append(results, syncUserInAccount(ctx, syncData)...)

	// 同步账户的封锁状态
	results = append(results, syncAccountBlockStatus(ctx, syncData))

	return results
}

// 同步账户的用户：先创建及封锁解封用户，然后删除用户
func syncUserInAccount(ctx context.Context, syncData *pb.SyncAccountInfo) []*pb.SyncAccountUserInfoResponse_SyncOperationResult {
	var results []*pb.SyncAccountUserInfoResponse_SyncOperationResult

	if len(syncData.Users) != 0 {
		// syncData中存在user，创建及封锁解封用户(若需要)
		results = append(results, AddAndBlockUserInAccount(ctx, syncData)...)
	}

	// 删除集群中该账户的其他用户(集群中有但是不属于syncData中该账户包含的user)
	results = append(results, DeleteUserInAccount(ctx, syncData.Users, syncData.AccountName)...)

	return results
}
