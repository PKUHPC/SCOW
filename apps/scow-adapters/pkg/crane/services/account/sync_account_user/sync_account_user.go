package sync_account_user

import (
	"github.com/sirupsen/logrus"

	protos "scow-adapters/gen/go"
)

func SyncAccountUser(syncData *protos.SyncAccountInfo) []*protos.SyncAccountUserInfoResponse_SyncOperationResult {
	var results []*protos.SyncAccountUserInfoResponse_SyncOperationResult
	logrus.Tracef("SyncAccountUser, sync data is: %v", syncData)

	// 同步创建账户, 若账户创建失败，后续操作都没必要执行了
	result, err := createAccount(syncData)
	results = append(results, result)
	if err != nil {
		logrus.Errorf("[SyncAccountUser] create account failed： %v", err)
		return results
	}

	// 同步账户的用户
	results = append(results, syncUserInAccount(syncData)...)

	// 同步账户的封锁状态
	results = append(results, syncAccountBlockStatus(syncData))

	return results
}

// 同步账户用户的存在情况，然后判断创建用户以及删除用户
func syncUserInAccount(syncData *protos.SyncAccountInfo) []*protos.SyncAccountUserInfoResponse_SyncOperationResult {
	var results []*protos.SyncAccountUserInfoResponse_SyncOperationResult

	if len(syncData.Users) != 0 {
		// syncData中存在user，创建及封锁用户(若需要)
		results = append(results, AddAndBlockUserInAccount(syncData.Users, syncData.AccountName)...)
	}

	// 删除集群中该账户的其他用户(集群中有但是不属于syncData中该账户包含的user)
	results = append(results, DeleteUserInAccount(syncData.Users, syncData.AccountName)...)

	return results
}
