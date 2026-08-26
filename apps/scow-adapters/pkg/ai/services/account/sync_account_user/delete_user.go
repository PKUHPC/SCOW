package sync_account_user

import (
	"context"
	"fmt"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/utils"
	"scow-adapters/pkg/common/accountsync"
)

// DeleteUserInAccount 同步删除用户
func DeleteUserInAccount(ctx context.Context, users []*pb.SyncAccountInfo_UserInAccount, accountName string) []*pb.SyncAccountUserInfoResponse_SyncOperationResult {
	var (
		responseInfo    []*pb.SyncAccountUserInfoResponse_SyncOperationResult
		message         string
		excludeUserList []string
	)

	for _, user := range users {
		excludeUserList = append(excludeUserList, user.UserId)
	}

	// 得到实际环境有而同步数据中没有的用户
	deleteUsers, err := utils.GetAccountAssociatedUserInDatabase(accountName, excludeUserList)
	if err != nil {
		message = fmt.Sprintf("remove user from account, get need delete user failed: %v", err)
		accountsync.Errorf(ctx, "operation=removeUser account=%s error=%v", accountName, err)
		responseInfo = append(responseInfo, accountsync.RemoveUserFromAccountFailedOperation(accountName, "", message))
		return responseInfo
	}

	// 删除用户
	for _, user := range deleteUsers {
		accountsync.Tracef(ctx, "operation=removeUser account=%s user=%s expectedAssociation=false actualAssociation=true action=remove", accountName, user)
		// 获取用户未结束的作业列表
		jobList, err := utils.GetUnfinishedJobsByUserAndAccount(user, accountName)
		if err != nil {
			message = fmt.Sprintf("remove user %v from account %v, get not completed jobs failed: %v", user, accountName, err)
			accountsync.Errorf(ctx, "operation=removeUser account=%s user=%s error=%v", accountName, user, err)
			responseInfo = append(responseInfo, accountsync.RemoveUserFromAccountFailedOperation(accountName, user, message))
			continue
		}

		// 有作业不允许删用户
		if len(jobList) != 0 {
			err = fmt.Errorf("the user %s have running jobs", user)
			message = fmt.Sprintf("remove user %v from account %v failed: %v", user, accountName, err)
			accountsync.Errorf(ctx, "operation=removeUser account=%s user=%s runningJobs=%d error=%v", accountName, user, len(jobList), err)
			responseInfo = append(responseInfo, accountsync.RemoveUserFromAccountFailedOperation(accountName, user, message))
			continue
		}

		// 删除用户
		if err = utils.UpdateUserDeletedInAccount(accountName, user, 1); err != nil {
			message = fmt.Sprintf("remove user %v from account %v, delete associate failed: %v", user, accountName, err)
			accountsync.Errorf(ctx, "operation=removeUser account=%s user=%s error=%v", accountName, user, err)
			responseInfo = append(responseInfo, accountsync.RemoveUserFromAccountFailedOperation(accountName, user, message))
			continue
		}

		accountsync.Debugf(ctx, "operation=removeUser account=%s user=%s action=remove result=success", accountName, user)
		responseInfo = append(responseInfo, accountsync.RemoveUserFromAccountSuccessOperation(accountName, user))
	}

	return responseInfo
}
