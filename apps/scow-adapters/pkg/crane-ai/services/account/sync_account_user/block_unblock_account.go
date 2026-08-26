package sync_account_user

import (
	"context"
	"fmt"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/common/accountsync"
	"scow-adapters/pkg/crane-ai/utils"
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
		accountsync.Tracef(ctx, "operation=blockAccount account=%s whitelisted=true action=skip", syncData.AccountName)
		return accountsync.BlockAccountFailedOperation(syncData.AccountName, message)
	}

	// 先查询账户
	account, err := utils.GetAccountByName(syncData.AccountName)
	if err != nil {
		message := fmt.Sprintf("get account: %v failed", syncData.AccountName)
		accountsync.Errorf(ctx, "operation=blockAccount account=%s expectedBlocked=true error=%v", syncData.AccountName, err)
		return accountsync.BlockAccountFailedOperation(syncData.AccountName, message)
	}

	if account.Blocked {
		accountsync.Tracef(ctx, "operation=blockAccount account=%s expectedBlocked=true actualBlocked=true action=none", syncData.AccountName)
		return nil
	}

	accountsync.Tracef(ctx, "operation=blockAccount account=%s expectedBlocked=true actualBlocked=false action=block", syncData.AccountName)
	if err := utils.BlockAccount(syncData.AccountName); err != nil {
		message := fmt.Sprintf("block account: %v failed", syncData.AccountName)
		accountsync.Errorf(ctx, "operation=blockAccount account=%s expectedBlocked=true actualBlocked=false error=%v", syncData.AccountName, err)
		return accountsync.BlockAccountFailedOperation(syncData.AccountName, message)
	}

	accountsync.Debugf(ctx, "operation=blockAccount account=%s action=block result=success", syncData.AccountName)
	return accountsync.BlockAccountSuccessOperation(syncData.AccountName)
}

func UnBlockAccount(ctx context.Context, syncData *pb.SyncAccountInfo) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	var message string

	// 获取unblockedPartitions分区，该分区需要解封, blockPartitions分区，该分区需要封锁
	unblockPartition, blockPartitions := getBlockAndUnblockPartition(syncData)
	accountsync.Tracef(ctx, "operation=reconcileAccountPartitions account=%s unblockPartitions=%v blockPartitions=%v",
		syncData.AccountName, unblockPartition, blockPartitions)

	// 解封分区
	// 先查询账户
	account, err := utils.GetAccountByName(syncData.AccountName)
	if err != nil {
		message = fmt.Sprintf("get account %v failed: %v", syncData.AccountName, err)
		accountsync.Errorf(ctx, "operation=unblockAccount account=%s expectedBlocked=false error=%v", syncData.AccountName, err)
		return accountsync.UnblockAccountFailedOperation(syncData.AccountName, message)
	}

	executeUnblock, executeBlock := false, false
	if account.Blocked {
		executeUnblock = true
		accountsync.Tracef(ctx, "operation=unblockAccount account=%s expectedBlocked=false actualBlocked=true action=unblock", syncData.AccountName)
		if err = utils.UnblockAccount(account.Name); err != nil {
			message = fmt.Sprintf("unblock account %v failed: %v", syncData.AccountName, err)
			accountsync.Errorf(ctx, "operation=unblockAccount account=%s expectedBlocked=false actualBlocked=true error=%v", syncData.AccountName, err)
			return accountsync.UnblockAccountFailedOperation(syncData.AccountName, message)
		}
	}

	// 获取账户的allowPartitions
	allowPartitions := account.GetAllowedPartitions()
	accountsync.Tracef(ctx, "operation=reconcileAccountPartitions account=%s actualAllowedPartitions=%v", syncData.AccountName, allowPartitions)

	var needUnblockPartitions []string
	// 需要解封的分区不在账户的allowPartitions内，表示账户在该分区是封锁状态，需进行解封
	for _, partition := range unblockPartition {
		if !utils.Contains(allowPartitions, partition) {
			needUnblockPartitions = append(needUnblockPartitions, partition)
		}
	}

	var needBlockPartitions []string
	// 请求的分区在账户的allowPartitions内需要进行封锁，若不在allowPartitions内，表示账户在该分区本来就是封锁状态，无需进行封锁了
	for _, partition := range blockPartitions {
		if allowPartitions != nil && utils.Contains(allowPartitions, partition) {
			needBlockPartitions = append(needBlockPartitions, partition)
		}
	}

	if len(needUnblockPartitions) != 0 {
		executeUnblock = true
		accountsync.Tracef(ctx, "operation=unblockAccountPartitions account=%s partitions=%v action=unblock", syncData.AccountName, needUnblockPartitions)
		if err := utils.UnblockAccountWithPartition(syncData.AccountName, unblockPartition); err != nil {
			message = fmt.Sprintf("unblock account %v in partitions %v failed: %v", syncData.AccountName, unblockPartition, err)
			accountsync.Errorf(ctx, "operation=unblockAccountPartitions account=%s partitions=%v error=%v", syncData.AccountName, unblockPartition, err)
			return accountsync.UnblockAccountFailedOperation(syncData.AccountName, message)
		}
	}

	// 需要封锁的分区
	if len(needBlockPartitions) != 0 {
		executeBlock = true
		accountsync.Tracef(ctx, "operation=blockAccountPartitions account=%s partitions=%v action=block", syncData.AccountName, needBlockPartitions)
		if err := utils.BlockAccountWithPartition(syncData.AccountName, blockPartitions); err != nil {
			message = fmt.Sprintf("block account %v in partitions %v failed: %v", syncData.AccountName, blockPartitions, err)
			accountsync.Errorf(ctx, "operation=blockAccountPartitions account=%s partitions=%v error=%v", syncData.AccountName, blockPartitions, err)
			return accountsync.UnblockAccountFailedOperation(syncData.AccountName, message)
		}
	}

	if executeUnblock || executeBlock {
		accountsync.Debugf(ctx, "operation=unblockAccount account=%s action=reconcile result=success", syncData.AccountName)
		return accountsync.UnblockAccountSuccessOperation(syncData.AccountName)
	}
	accountsync.Tracef(ctx, "operation=unblockAccount account=%s expectedBlocked=false actualBlocked=false action=none", syncData.AccountName)
	return nil
}

func getBlockAndUnblockPartition(syncData *pb.SyncAccountInfo) ([]string, []string) {
	var (
		blockPartitions   []string
		unblockPartitions []string
	)

	partitions := utils.GetAllPartitions()
	if syncData.GetUseAllPartitions() {
		unblockPartitions = partitions
		blockPartitions = []string{}
	} else {
		unblockPartitions = syncData.GetUnblockedPartitions().(*pb.SyncAccountInfo_AssignedPartitions_).AssignedPartitions.Partitions
		blockPartitions = utils.SliceSubtract(partitions, unblockPartitions)
	}

	return unblockPartitions, blockPartitions
}
