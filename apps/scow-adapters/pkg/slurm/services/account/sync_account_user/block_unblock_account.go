package sync_account_user

import (
	"context"
	"fmt"
	"strings"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/slurm/utils"

	"github.com/sirupsen/logrus"
)

// 同步账户的封锁情况
func syncAccountBlockStatus(ctx context.Context, syncData *pb.SyncAccountInfo) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	var result *pb.SyncAccountUserInfoResponse_SyncOperationResult

	// 同步账户的封锁
	if syncData.BlockedInCluster {
		result = BlockAccount(ctx, syncData)
	} else {
		// 同步账户的解封
		result = UnBlockAccount(ctx, syncData)
	}

	return result
}

func BlockAccount(ctx context.Context, syncData *pb.SyncAccountInfo) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	if syncData.WhitelistId != nil {
		message := fmt.Sprintf("The account is in the whitelist and does not need to be blocked")
		logrus.Infof("[SyncAccountUser], %v", message)
		return BlockAccountFailedOperation(syncData.AccountName, message)
	}

	account := syncData.AccountName
	// 欠费封锁只改变账户父 association，不改变各分区叶子 association 上保存的资源权限。
	// 同步请求在 BlockedInCluster=true 时可能不携带完整分区授权；如果此时根据空的
	// AssignedPartitions 收敛分区，会错误地把账户原有的全部分区权限清除。
	parentBlocked, _, parentFound, err := utils.GetAccountGroupBlockState(account)
	if err != nil {
		message := fmt.Sprintf("block account %s failed to get account association status: %v", account, err)
		logrus.Errorf("[SyncAccountUser], %v", message)
		return BlockAccountFailedOperation(syncData.AccountName, message)
	}
	if !parentFound {
		message := fmt.Sprintf("block account failed, account association not found: %s", account)
		logrus.Errorf("[SyncAccountUser], %v", message)
		return BlockAccountFailedOperation(syncData.AccountName, message)
	}
	if parentBlocked {
		// Slurm 实际状态已经与 SCOW 一致，本轮没有发生修改，不向 SCOW 重复上报“封锁成功”。
		logrus.Infof("[SyncAccountUser], account %s is already blocked, no synchronization is required", account)
		return nil
	}

	// 把父 association 的 GrpJobs、GrpSubmitJobs 设为 0。父级限制会同时约束账户下
	// 现有和以后新增的 association，因此无需逐分区执行封锁。
	if err := utils.BlockWholeAccountUseAssociation(ctx, account); err != nil {
		message := fmt.Sprintf("block account %s failed: %v", account, err)
		logrus.Errorf("[SyncAccountUser], %v", message)
		return BlockAccountFailedOperation(syncData.AccountName, message)
	}

	message := fmt.Sprintf("block account: %v success", syncData.AccountName)
	logrus.Infof("[SyncAccountUser], %v", message)
	return BlockAccountSuccessOperation(syncData.AccountName)
}

func UnBlockAccount(ctx context.Context, syncData *pb.SyncAccountInfo) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	account := syncData.AccountName
	var message string
	// 必须先同步叶子分区权限，再解除父级欠费封锁。这样任何分区同步失败时，
	// 父 association 仍保持 Grp*=0，不会让账户在权限尚未收敛时运行作业。
	changed, err := reconcileAccountPartitions(ctx, syncData)
	if err != nil {
		message := fmt.Sprintf("unblock account %s failed to reconcile partition permissions: %v", account, err)
		logrus.Errorf("[SyncAccountUser], %v", message)
		return UnblockAccountFailedOperation(syncData.AccountName, message)
	}

	// 恢复记录用于找回原值，但不能作为是否解封的唯一依据：旧版本可能已经把
	// 父 association 设为 Grp*=0，却没有记录。
	wholeBlocked, err := utils.IsWholeAccountBlockRecorded(account)
	if err != nil {
		message = fmt.Sprintf("unblock account failed, get whole account status failed: %v", err)
		return UnblockAccountFailedOperation(syncData.AccountName, message)
	}
	_, parentHasBlockLimit, parentFound, err := utils.GetAccountGroupBlockState(account)
	if err != nil {
		message = fmt.Sprintf("unblock account failed, get account association status failed: %v", err)
		return UnblockAccountFailedOperation(syncData.AccountName, message)
	}
	if !parentFound {
		message = fmt.Sprintf("unblock account failed, account association not found: %s", account)
		return UnblockAccountFailedOperation(syncData.AccountName, message)
	}
	if wholeBlocked || parentHasBlockLimit {
		if err := utils.UnblockWholeAccountUseAssociation(ctx, account); err != nil {
			message = fmt.Sprintf("unblock account failed: %v", err)
			return UnblockAccountFailedOperation(syncData.AccountName, message)
		}
		changed = true
	}

	if !changed {
		return nil
	}

	message = fmt.Sprintf("unblock account: %v success", syncData.AccountName)
	logrus.Infof("[SyncAccountUser], %v", message)
	return UnblockAccountSuccessOperation(syncData.AccountName)
}

// needsPartitionReconciliation 比较 SCOW 的分区授权期望和 Slurm association 实际限制。
func needsPartitionReconciliation(shouldAllow bool, actual utils.AccountPartitionAssociationState) bool {
	if shouldAllow {
		return actual.HasAssociations && actual.HasBlockLimit
	}
	return !actual.HasAssociations || !actual.Blocked
}

// reconcileAccountPartitions 使用 SyncAccountInfo 中的完整分区权限收敛叶子 association。
// SCOW 是期望状态的唯一来源；assoc_table 的 Grp* 只表示 Slurm 当前实际状态。
func reconcileAccountPartitions(ctx context.Context, syncData *pb.SyncAccountInfo) (bool, error) {
	account := syncData.AccountName
	partitions, err := utils.GetPartitionsName()
	if err != nil {
		return false, fmt.Errorf("get cluster partitions failed: %w", err)
	}
	allowedPartitions, err := getUnblockPartition(syncData)
	if err != nil {
		return false, err
	}
	allowedPartitions, err = utils.NormalizePartitionNames(allowedPartitions)
	if err != nil {
		return false, fmt.Errorf("normalize partition names failed: %w", err)
	}
	desiredAllowed := make(map[string]struct{}, len(allowedPartitions))
	for _, partition := range allowedPartitions {
		desiredAllowed[strings.ToLower(partition)] = struct{}{}
	}
	// 补齐缺失 association 时直接使用 SCOW 的目标权限，避免先创建为可用状态再封锁。
	for _, partition := range partitions {
		_, shouldAllow := desiredAllowed[strings.ToLower(partition)]
		if err := utils.EnsureAccountUsersAssociationInPartition(ctx, account, partition, !shouldAllow); err != nil {
			return false, fmt.Errorf("ensure association failed in partition %s: %w", partition, err)
		}
	}

	associationStates, err := utils.GetAccountPartitionAssociationStates(account)
	if err != nil {
		return false, fmt.Errorf("get actual partition limits failed: %w", err)
	}
	actualByLowerName := make(map[string]utils.AccountPartitionAssociationState, len(associationStates))
	for partition, state := range associationStates {
		actualByLowerName[strings.ToLower(partition)] = state
	}

	changed := false
	for _, partition := range partitions {
		_, shouldAllow := desiredAllowed[strings.ToLower(partition)]
		actual := actualByLowerName[strings.ToLower(partition)]
		if !needsPartitionReconciliation(shouldAllow, actual) {
			continue
		}

		if shouldAllow {
			if err := utils.UnblockAccountUseAssociation(ctx, account, partition); err != nil {
				return changed, fmt.Errorf("unblock partition %s failed: %w", partition, err)
			}
		} else if err := utils.BlockAccountUseAssociation(ctx, account, partition); err != nil {
			return changed, fmt.Errorf("block partition %s failed: %w", partition, err)
		}
		changed = true
	}
	return changed, nil
}

func getUnblockPartition(syncData *pb.SyncAccountInfo) ([]string, error) {
	var partitions []string
	var err error

	if syncData.GetUseAllPartitions() {
		partitions, err = utils.GetPartitionsName()
		if err != nil {
			return nil, err
		}
	} else {
		assigned := syncData.GetAssignedPartitions()
		if assigned == nil {
			return nil, fmt.Errorf("sync account partition permissions are missing")
		}
		partitions = assigned.Partitions
	}

	return partitions, nil
}
