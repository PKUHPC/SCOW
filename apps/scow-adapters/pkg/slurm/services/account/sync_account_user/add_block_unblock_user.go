package sync_account_user

import (
	"context"
	"fmt"
	"strings"

	"github.com/sirupsen/logrus"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/slurm/utils"
)

// AddAndBlockUserInAccount 同步创建用户，然后需要的话封锁用户
func AddAndBlockUserInAccount(ctx context.Context, syncData *pb.SyncAccountInfo) []*pb.SyncAccountUserInfoResponse_SyncOperationResult {
	var (
		results []*pb.SyncAccountUserInfoResponse_SyncOperationResult
		message string
	)
	users := syncData.Users
	accountName := syncData.AccountName
	partitions, err := utils.GetPartitionsName()
	if err != nil || len(partitions) == 0 {
		message = fmt.Sprintf("add user to account %v, get partition failed: %v", accountName, err)
		logrus.Errorf("[SyncAccountUser] %v", message)
		results = append(results, AddUserToAccountFailedOperation(accountName, "", message))
		return results
	}
	allowedPartitions, err := getUnblockPartition(syncData)
	if err != nil {
		message = fmt.Sprintf("add user to account %v, get partition permissions failed: %v", accountName, err)
		logrus.Errorf("[SyncAccountUser] %v", message)
		results = append(results, AddUserToAccountFailedOperation(accountName, "", message))
		return results
	}
	allowedPartitions, err = utils.NormalizePartitionNames(allowedPartitions)
	if err != nil {
		message = fmt.Sprintf("add user to account %v, normalize partition permissions failed: %v", accountName, err)
		logrus.Errorf("[SyncAccountUser] %v", message)
		results = append(results, AddUserToAccountFailedOperation(accountName, "", message))
		return results
	}

	// 获取系统中Qos
	qosList, err := utils.GetQosList()
	if err != nil {
		message = fmt.Sprintf("add user to account %v, get qos list failed: %v", accountName, err)
		logrus.Errorf("[SyncAccountUser] %v", message)
		results = append(results, AddUserToAccountFailedOperation(accountName, "", message))
		return results
	}

	baseQos := strings.Join(qosList, ",")

	actualAssociateInfo, err := utils.GetAccountAssociateInfoInDatabase(accountName)
	if err != nil {
		message = fmt.Sprintf("add user in account, get associate info in database failed: %v", err)
		logrus.Errorf("[SyncAccountUser] %v", message)
		results = append(results, AddUserToAccountFailedOperation(accountName, "", message))
		return results
	}

	for _, user := range users {
		if *user.Deleted {
			message = fmt.Sprintf("user %v id deleted status", user.UserId)
			logrus.Infof("BlockUser %v", message)
			continue
		}
		associateInfo, exitAssociate := actualAssociateInfo[user.UserId]
		if exitAssociate {
			// 存在关联关系，封锁或解封用户用户
			if result := blockOrUnblockUser(ctx, user, accountName, associateInfo); result != nil {
				results = append(results, result)
			}
		} else {
			// 不存在关联关系，先将用户加入账户
			if err = utils.AddUserToAccount(ctx, user.UserId, accountName, baseQos, partitions, allowedPartitions); err != nil {
				message = fmt.Sprintf("add user %v to account %v failed: %v", user.UserId, accountName, err)
				logrus.Errorf("[SyncAccountUser] %v", message)
				results = append(results, AddUserToAccountFailedOperation(accountName, user.UserId, message))
				continue
			}

			message = fmt.Sprintf("add user %v to account %v success", user.UserId, accountName)
			logrus.Infof("[SyncAccountUser] %v", message)
			results = append(results, AddUserToAccountSuccessOperation(accountName, user.UserId))

			// 封锁用户
			if user.Blocked {
				err = utils.BlockUserInAccount(ctx, user.UserId, accountName)
				if err != nil {
					message = fmt.Sprintf("add user success, but block user %v in account %v failed: %v", user.UserId, accountName, err)
					logrus.Errorf("[SyncAccountUser]: %v", message)
					results = append(results, BlockUserInAccountFailedOperation(accountName, user.UserId, message))
					continue
				}
				message = fmt.Sprintf("add user success, and block user %v in account %v success", user.UserId, accountName)
				logrus.Infof("[SyncAccountUser], %v", message)
				results = append(results, BlockUserInAccountSuccessOperation(accountName, user.UserId))
			}
		}
	}
	return results
}

func blockOrUnblockUser(ctx context.Context, user *pb.SyncAccountInfo_UserInAccount, accountName string, actual *utils.AssociateInfo) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	// SCOW 要求封锁时，所有 association 的 MaxJobs、MaxSubmitJobs 都必须为 0。
	// 任一分区未满足双零（包括只改成功一个字段）都需要重新执行封锁命令。
	if user.Blocked && !actual.Blocked {
		if err := utils.BlockUserInAccount(ctx, user.UserId, accountName); err != nil {
			message := fmt.Sprintf("block user %v in account %v failed: %v", user.UserId, accountName, err)
			logrus.Errorf("[SyncAccountUser]: %v", message)
			return BlockUserInAccountFailedOperation(accountName, user.UserId, message)
		}
		message := fmt.Sprintf("block user %v in account %v success", user.UserId, accountName)
		logrus.Infof("[SyncAccountUser], %v", message)
		return BlockUserInAccountSuccessOperation(accountName, user.UserId)
	}

	// SCOW 要求解封时，只要任一 association 仍带有 Max*=0，就需要恢复。
	// 恢复记录缺失时底层函数会回退到 -1，使实际状态仍能收敛到 SCOW。
	if !user.Blocked && actual.HasBlockLimit {
		if err := utils.UnblockUserInAccount(ctx, user.UserId, accountName); err != nil {
			message := fmt.Sprintf("unblock user %v in account %v failed: %v", user.UserId, accountName, err)
			logrus.Errorf("[SyncAccountUser]: %v", message)
			return UnblockUserInAccountFailedOperation(accountName, user.UserId, message)
		}
		message := fmt.Sprintf("unblock user %v in account %v success", user.UserId, accountName)
		logrus.Infof("[SyncAccountUser], %v", message)
		return UnblockUserInAccountSuccessOperation(accountName, user.UserId)
	}

	logrus.Infof("[SyncAccountUser], the user %v no need block or unblock", user.UserId)
	return nil
}
