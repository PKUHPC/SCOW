package sync_account_user

import (
	"fmt"

	"github.com/sirupsen/logrus"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/crane/utils"
)

// 同步账户的封锁情况
func syncAccountBlockStatus(syncData *pb.SyncAccountInfo) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	var result *pb.SyncAccountUserInfoResponse_SyncOperationResult

	// 同步账户的封锁
	if syncData.BlockedInCluster {
		result = BlockAccount(syncData)
	} else {
		// 同步账户的解封
		result = UnBlockAccount(syncData)
	}

	return result
}

func BlockAccount(syncData *pb.SyncAccountInfo) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	if syncData.WhitelistId != nil {
		message := fmt.Sprintf("The account is in the whitelist and does not need to be blocked")
		logrus.Infof("[SyncAccountUser], %v", message)
		return BlockAccountFailedOperation(syncData.AccountName, message)
	}

	// 先查询账户
	account, err := utils.GetAccountByName(syncData.AccountName)
	if err != nil {
		message := fmt.Sprintf("get account: %v failed", syncData.AccountName)
		logrus.Errorf("[SyncAccountUser], %v", message)
		return BlockAccountFailedOperation(syncData.AccountName, message)
	}

	if account.Blocked {
		logrus.Infof("[SyncAccountUser] account %v is blocked, no need block", syncData.AccountName)
		return nil
	}

	if err := utils.BlockAccount(syncData.AccountName); err != nil {
		message := fmt.Sprintf("block account: %v failed", syncData.AccountName)
		logrus.Errorf("[SyncAccountUser], %v", message)
		return BlockAccountFailedOperation(syncData.AccountName, message)
	}

	message := fmt.Sprintf("block account: %v success", syncData.AccountName)
	logrus.Infof("[SyncAccountUser], %v", message)
	return BlockAccountSuccessOperation(syncData.AccountName)
}

func UnBlockAccount(syncData *pb.SyncAccountInfo) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	var message string

	// 获取unblockedPartitions分区，该分区需要解封, blockPartitions分区，该分区需要封锁
	unblockPartition, blockPartitions := getBlockAndUnblockPartition(syncData)
	logrus.Infof("unblock partitions: %v, block partitions: %v", unblockPartition, blockPartitions)

	// 解封分区
	// 先查询账户
	account, err := utils.GetAccountByName(syncData.AccountName)
	if err != nil {
		message = fmt.Sprintf("get account %v failed: %v", syncData.AccountName, err)
		logrus.Errorf("[SyncAccountUser] %v", message)
		return UnblockAccountFailedOperation(syncData.AccountName, message)
	}

	executeUnblock, executeBlock := false, false
	if account.Blocked {
		executeUnblock = true
		if err = utils.UnblockAccount(account.Name); err != nil {
			message = fmt.Sprintf("unblock account %v failed: %v", syncData.AccountName, err)
			logrus.Errorf("[SyncAccountUser] %v", message)
			return UnblockAccountFailedOperation(syncData.AccountName, message)
		}
	}

	// 获取账户的allowPartitions
	allowPartitions := account.GetAllowedPartitions()
	logrus.Infof("allow Partitions: %v", allowPartitions)

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
		logrus.Infof("need Unblock Partitions: %v", needUnblockPartitions)
		if err := utils.UnblockAccountWithPartition(syncData.AccountName, unblockPartition); err != nil {
			message = fmt.Sprintf("unblock account %v in partitions %v failed: %v", syncData.AccountName, unblockPartition, err)
			logrus.Errorf("[SyncAccountUser] %v", message)
			return UnblockAccountFailedOperation(syncData.AccountName, message)
		}
	}

	// 需要封锁的分区
	if len(needBlockPartitions) != 0 {
		executeBlock = true
		logrus.Infof("need Block Partitions: %v", needBlockPartitions)
		if err := utils.BlockAccountWithPartition(syncData.AccountName, blockPartitions); err != nil {
			message = fmt.Sprintf("block account %v in partitions %v failed: %v", syncData.AccountName, blockPartitions, err)
			logrus.Errorf("[SyncAccountUser] %v", message)
			return UnblockAccountFailedOperation(syncData.AccountName, message)
		}
	}

	if executeUnblock || executeBlock {
		message = fmt.Sprintf("unblock account: %v success", syncData.AccountName)
		logrus.Infof("[SyncAccountUser], %v", message)
		return UnblockAccountSuccessOperation(syncData.AccountName)
	}
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
