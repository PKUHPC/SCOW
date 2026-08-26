package sync_account_user

import (
	"context"
	"fmt"
	"strings"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/common/accountsync"
	"scow-adapters/pkg/slurm/utils"
)

// AddAndBlockUserInAccount 同步创建用户，然后需要的话封锁用户
func AddAndBlockUserInAccount(ctx context.Context, syncData *pb.SyncAccountInfo) ([]*pb.SyncAccountUserInfoResponse_SyncOperationResult, int, int) {
	var (
		results        []*pb.SyncAccountUserInfoResponse_SyncOperationResult
		message        string
		usersProcessed int
		usersSkipped   int
	)
	users := syncData.Users
	accountName := syncData.AccountName
	partitions, err := utils.GetPartitionsName()
	if err != nil || len(partitions) == 0 {
		message = fmt.Sprintf("add user to account %v, get partition failed: %v", accountName, err)
		accountsync.Errorf(ctx, "operation=addUser account=%s error=%s", accountName, message)
		results = append(results, accountsync.AddUserToAccountFailedOperation(accountName, "", message))
		return results, usersProcessed, usersSkipped
	}
	allowedPartitions, err := getUnblockPartition(syncData)
	if err != nil {
		message = fmt.Sprintf("add user to account %v, get partition permissions failed: %v", accountName, err)
		accountsync.Errorf(ctx, "operation=addUser account=%s error=%s", accountName, message)
		results = append(results, accountsync.AddUserToAccountFailedOperation(accountName, "", message))
		return results, usersProcessed, usersSkipped
	}
	allowedPartitions, err = utils.NormalizePartitionNames(allowedPartitions)
	if err != nil {
		message = fmt.Sprintf("add user to account %v, normalize partition permissions failed: %v", accountName, err)
		accountsync.Errorf(ctx, "operation=addUser account=%s error=%s", accountName, message)
		results = append(results, accountsync.AddUserToAccountFailedOperation(accountName, "", message))
		return results, usersProcessed, usersSkipped
	}

	// 获取系统中Qos
	qosList, err := utils.GetQosList()
	if err != nil {
		message = fmt.Sprintf("add user to account %v, get qos list failed: %v", accountName, err)
		accountsync.Errorf(ctx, "operation=addUser account=%s error=%s", accountName, message)
		results = append(results, accountsync.AddUserToAccountFailedOperation(accountName, "", message))
		return results, usersProcessed, usersSkipped
	}

	baseQos := strings.Join(qosList, ",")

	actualAssociateInfo, err := utils.GetAccountAssociateInfoInDatabase(accountName)
	if err != nil {
		message = fmt.Sprintf("add user in account, get associate info in database failed: %v", err)
		accountsync.Errorf(ctx, "operation=addUser account=%s error=%s", accountName, message)
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
		associateInfo, exitAssociate := actualAssociateInfo[user.UserId]
		if exitAssociate {
			// 存在关联关系，封锁或解封用户用户
			if result := blockOrUnblockUser(ctx, user, accountName, associateInfo); result != nil {
				results = append(results, result)
			}
		} else {
			// 不存在关联关系，先将用户加入账户
			accountsync.Tracef(ctx, "operation=addUser account=%s user=%s expectedAssociation=true actualAssociation=false action=add",
				accountName, user.UserId)
			if err = utils.AddUserToAccount(ctx, user.UserId, accountName, baseQos, partitions, allowedPartitions); err != nil {
				message = fmt.Sprintf("add user %v to account %v failed: %v", user.UserId, accountName, err)
				accountsync.Errorf(ctx, "operation=addUser account=%s user=%s expectedAssociation=true actualAssociation=false error=%v",
					accountName, user.UserId, err)
				results = append(results, accountsync.AddUserToAccountFailedOperation(accountName, user.UserId, message))
				continue
			}

			accountsync.Debugf(ctx, "operation=addUser account=%s user=%s action=add result=success", accountName, user.UserId)
			results = append(results, accountsync.AddUserToAccountSuccessOperation(accountName, user.UserId))

			// 封锁用户
			if user.Blocked {
				err = utils.BlockUserInAccount(ctx, user.UserId, accountName)
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

func blockOrUnblockUser(ctx context.Context, user *pb.SyncAccountInfo_UserInAccount, accountName string, actual *utils.AssociateInfo) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	// SCOW 要求封锁时，所有 association 的 MaxJobs、MaxSubmitJobs 都必须为 0。
	// 任一分区未满足双零（包括只改成功一个字段）都需要重新执行封锁命令。
	if user.Blocked && !actual.Blocked {
		accountsync.Tracef(ctx, "operation=blockUser account=%s user=%s expectedBlocked=true actualBlocked=%t actualHasBlockLimit=%t action=block",
			accountName, user.UserId, actual.Blocked, actual.HasBlockLimit)
		if err := utils.BlockUserInAccount(ctx, user.UserId, accountName); err != nil {
			message := fmt.Sprintf("block user %v in account %v failed: %v", user.UserId, accountName, err)
			accountsync.Errorf(ctx, "operation=blockUser account=%s user=%s expectedBlocked=true actualBlocked=%t actualHasBlockLimit=%t error=%v",
				accountName, user.UserId, actual.Blocked, actual.HasBlockLimit, err)
			return accountsync.BlockUserInAccountFailedOperation(accountName, user.UserId, message)
		}
		accountsync.Debugf(ctx, "operation=blockUser account=%s user=%s action=block result=success", accountName, user.UserId)
		return accountsync.BlockUserInAccountSuccessOperation(accountName, user.UserId)
	}

	// SCOW 要求解封时，只要任一 association 仍带有 Max*=0，就需要恢复。
	// 恢复记录缺失时底层函数会回退到 -1，使实际状态仍能收敛到 SCOW。
	if !user.Blocked && actual.HasBlockLimit {
		accountsync.Tracef(ctx, "operation=unblockUser account=%s user=%s expectedBlocked=false actualBlocked=%t actualHasBlockLimit=%t action=unblock",
			accountName, user.UserId, actual.Blocked, actual.HasBlockLimit)
		if err := utils.UnblockUserInAccount(ctx, user.UserId, accountName); err != nil {
			message := fmt.Sprintf("unblock user %v in account %v failed: %v", user.UserId, accountName, err)
			accountsync.Errorf(ctx, "operation=unblockUser account=%s user=%s expectedBlocked=false actualBlocked=%t actualHasBlockLimit=%t error=%v",
				accountName, user.UserId, actual.Blocked, actual.HasBlockLimit, err)
			return accountsync.UnblockUserInAccountFailedOperation(accountName, user.UserId, message)
		}
		accountsync.Debugf(ctx, "operation=unblockUser account=%s user=%s action=unblock result=success", accountName, user.UserId)
		return accountsync.UnblockUserInAccountSuccessOperation(accountName, user.UserId)
	}

	accountsync.Tracef(ctx, "operation=syncUserBlock account=%s user=%s expectedBlocked=%t actualBlocked=%t actualHasBlockLimit=%t action=none",
		accountName, user.UserId, user.Blocked, actual.Blocked, actual.HasBlockLimit)
	return nil
}
