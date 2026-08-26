package sync_account_user

import (
	"context"
	"fmt"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/common/accountsync"
	"scow-adapters/pkg/crane/utils"
)

// AddAndBlockUserInAccount 同步创建用户，然后需要的话封锁用户
func AddAndBlockUserInAccount(ctx context.Context, users []*pb.SyncAccountInfo_UserInAccount, accountName string) ([]*pb.SyncAccountUserInfoResponse_SyncOperationResult, int, int) {
	var (
		results        []*pb.SyncAccountUserInfoResponse_SyncOperationResult
		message        string
		usersProcessed int
		usersSkipped   int
	)

	userBlockedInfo, err := utils.GetAccountUserBlockedInfo(accountName)
	if err != nil {
		message = fmt.Sprintf("add user in account, get associate info in database failed: %v", err)
		accountsync.Errorf(ctx, "operation=addUser account=%s error=%v", accountName, err)
		results = append(results, accountsync.AddUserToAccountFailedOperation(accountName, "", message))
		return results, usersProcessed, usersSkipped
	}

	for _, user := range users {
		if *user.Deleted {
			usersSkipped++
			accountsync.Tracef(ctx, "account=%s user=%s expectedDeleted=true action=skip", accountName, user.UserId)
			continue
		}
		usersProcessed++
		blocked, exitAssociate := userBlockedInfo[user.UserId]
		if exitAssociate {
			// 存在关联关系，封锁或解封用户用户
			if result := blockOrUnblockUser(ctx, user, accountName, blocked); result != nil {
				results = append(results, result)
			}
		} else {
			// 不存在关联关系，先将用户加入账户
			accountsync.Tracef(ctx, "operation=addUser account=%s user=%s expectedAssociation=true actualAssociation=false action=add",
				accountName, user.UserId)
			if err = utils.AddUserToAccount(accountName, user.UserId); err != nil {
				message = fmt.Sprintf("add user %v to account %v failed: %v", user.UserId, accountName, err)
				accountsync.Errorf(ctx, "operation=addUser account=%s user=%s error=%v", accountName, user.UserId, err)
				results = append(results, accountsync.AddUserToAccountFailedOperation(accountName, user.UserId, message))
				continue
			}

			accountsync.Debugf(ctx, "operation=addUser account=%s user=%s action=add result=success", accountName, user.UserId)
			results = append(results, accountsync.AddUserToAccountSuccessOperation(accountName, user.UserId))

			// 封锁用户
			if user.Blocked {
				err = utils.BlockUserInAccount(user.UserId, accountName)
				if err != nil {
					message = fmt.Sprintf("add user success, but block user %v in account %v failed: %v", user.UserId, accountName, err)
					accountsync.Errorf(ctx, "operation=blockUser account=%s user=%s expectedBlocked=true actualBlocked=false error=%v",
						accountName, user.UserId, err)
					results = append(results, accountsync.BlockUserInAccountFailedOperation(accountName, user.UserId, message))
					continue
				}
				accountsync.Debugf(ctx, "operation=blockUser account=%s user=%s action=block result=success", accountName, user.UserId)
				results = append(results, accountsync.BlockUserInAccountSuccessOperation(accountName, user.UserId))
			}
		}
	}
	return results, usersProcessed, usersSkipped
}

func blockOrUnblockUser(ctx context.Context, user *pb.SyncAccountInfo_UserInAccount, accountName string, blocked bool) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	// 封锁用户
	if user.Blocked && !blocked {
		accountsync.Tracef(ctx, "operation=blockUser account=%s user=%s expectedBlocked=true actualBlocked=false action=block", accountName, user.UserId)
		if err := utils.BlockUserInAccount(user.UserId, accountName); err != nil {
			message := fmt.Sprintf("block user %v in account %v failed: %v", user.UserId, accountName, err)
			accountsync.Errorf(ctx, "operation=blockUser account=%s user=%s expectedBlocked=true actualBlocked=false error=%v", accountName, user.UserId, err)
			return accountsync.BlockUserInAccountFailedOperation(accountName, user.UserId, message)
		}
		accountsync.Debugf(ctx, "operation=blockUser account=%s user=%s action=block result=success", accountName, user.UserId)
		return accountsync.BlockUserInAccountSuccessOperation(accountName, user.UserId)
	}

	// 解封用户
	if !user.Blocked && blocked {
		accountsync.Tracef(ctx, "operation=unblockUser account=%s user=%s expectedBlocked=false actualBlocked=true action=unblock", accountName, user.UserId)
		if err := utils.UnblockUserInAccount(user.UserId, accountName); err != nil {
			message := fmt.Sprintf("unblock user %v in account %v failed: %v", user.UserId, accountName, err)
			accountsync.Errorf(ctx, "operation=unblockUser account=%s user=%s expectedBlocked=false actualBlocked=true error=%v", accountName, user.UserId, err)
			return accountsync.UnblockUserInAccountFailedOperation(accountName, user.UserId, message)
		}
		accountsync.Debugf(ctx, "operation=unblockUser account=%s user=%s action=unblock result=success", accountName, user.UserId)
		return accountsync.UnblockUserInAccountSuccessOperation(accountName, user.UserId)
	}

	accountsync.Tracef(ctx, "operation=syncUserBlock account=%s user=%s expectedBlocked=%t actualBlocked=%t action=none",
		accountName, user.UserId, user.Blocked, blocked)
	return nil
}
