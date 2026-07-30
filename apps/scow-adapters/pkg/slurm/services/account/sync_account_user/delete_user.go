package sync_account_user

import (
	"context"
	"fmt"

	"github.com/sirupsen/logrus"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/slurm/utils"
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
		logrus.Errorf("[SyncAccountUser] %v", message)
		responseInfo = append(responseInfo, RemoveUserFromAccountFailedOperation(accountName, "", message))
		return responseInfo
	}

	// 删除用户
	for _, user := range deleteUsers {
		// 查询用户uid
		uid, _, err := utils.GetUserUidGid(user)
		if err != nil {
			message = fmt.Sprintf("remove user %v from account %v failed, get user uid failed(This user exists in slurm but does not exist in linux): %v", user, accountName, err)
			logrus.Errorf("[SyncAccountUser] %v", message)
			responseInfo = append(responseInfo, RemoveUserFromAccountFailedOperation(accountName, user, message))
			continue
		}

		// 获取用户未结束的作业列表
		jobList, err := utils.GetNotCompletedJobsByUserAndAccount(uid, accountName)
		if err != nil {
			message = fmt.Sprintf("remove user %v from account %v, get not completed jobs failed: %v", user, accountName, err)
			logrus.Errorf("[SyncAccountUser] %v", message)
			responseInfo = append(responseInfo, RemoveUserFromAccountFailedOperation(accountName, user, message))
			continue
		}

		// 有作业不允许删用户
		if len(jobList) != 0 {
			err = fmt.Errorf("the user %s have running jobs", user)
			message = fmt.Sprintf("remove user %v from account %v failed: %v", user, accountName, err)
			logrus.Errorf("[SyncAccountUser] %v", message)
			responseInfo = append(responseInfo, RemoveUserFromAccountFailedOperation(accountName, user, message))
			continue
		}
		// 查询用户除当前账户外关联的其他账户
		acctList, err := utils.GetAccountsAssocWithUserWithoutAccountInDatabase(user, accountName)
		if err != nil {
			message = fmt.Sprintf("remove user %v from account %v, get associate failed: %v", user, accountName, err)
			logrus.Errorf("[SyncAccountUser] %v", message)
			responseInfo = append(responseInfo, RemoveUserFromAccountFailedOperation(accountName, user, message))
			continue
		}

		// 用户只关联这个账户的情况, 直接删除用户
		if len(acctList) == 0 {
			if err = utils.DeleteUser(ctx, user); err != nil {
				message = fmt.Sprintf("remove user %v from account %v, delete user failed: %v", user, accountName, err)
				logrus.Errorf("[SyncAccountUser] %v", message)
				responseInfo = append(responseInfo, RemoveUserFromAccountFailedOperation(accountName, user, message))
				continue
			}
			if err = utils.DeleteUserBlockRecords(user); err != nil {
				message = fmt.Sprintf("remove user %v from account %v succeeded, but cleanup block records failed: %v", user, accountName, err)
				logrus.Errorf("[SyncAccountUser] %v", message)
				responseInfo = append(responseInfo, RemoveUserFromAccountFailedOperation(accountName, user, message))
				continue
			}
			message = fmt.Sprintf("remove user %v from account %v sucess", user, accountName)
			logrus.Infof("[SyncAccountUser] %v", message)
			responseInfo = append(responseInfo, RemoveUserFromAccountSuccessOperation(accountName, user))
			continue
		}

		// 用户还关联其他账户的情况，还需更改默认账号并删除用户
		if err = utils.DeleteUserWithAccount(ctx, user, accountName, acctList); err != nil {
			message = fmt.Sprintf("remove user %v from account %v failed(user associate other account): %v", user, accountName, err)
			logrus.Errorf("[SyncAccountUser] %v", message)
			responseInfo = append(responseInfo, RemoveUserFromAccountFailedOperation(accountName, user, message))
			continue
		}
		if err = utils.DeleteUserAssociationBlockRecords(accountName, user); err != nil {
			message = fmt.Sprintf("remove user %v from account %v succeeded, but cleanup block records failed: %v", user, accountName, err)
			logrus.Errorf("[SyncAccountUser] %v", message)
			responseInfo = append(responseInfo, RemoveUserFromAccountFailedOperation(accountName, user, message))
			continue
		}
		message = fmt.Sprintf("remove user %v from account %v sucess(user associate other account)", user, accountName)
		logrus.Infof("[SyncAccountUser] %v", message)
		responseInfo = append(responseInfo, RemoveUserFromAccountSuccessOperation(accountName, user))
	}

	return responseInfo
}
