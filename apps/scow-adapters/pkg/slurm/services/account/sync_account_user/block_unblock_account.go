package sync_account_user

import (
	"fmt"
	"slices"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/slurm/utils"

	"github.com/sirupsen/logrus"
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

	account := syncData.AccountName

	partitions, err := utils.GetPartitionsName()
	if err != nil {
		message := fmt.Sprintf("block account: get cluster partitions failed: %v", err)
		logrus.Errorf("[SyncAccountUser], %v", message)
		return BlockAccountFailedOperation(syncData.AccountName, message)
	}
	if err = ensureAccountUsersAssociationInPartitions(account, partitions); err != nil {
		message := fmt.Sprintf("block account: ensure associations failed: %v", err)
		logrus.Errorf("[SyncAccountUser], %v", message)
		return BlockAccountFailedOperation(syncData.AccountName, message)
	}

	// 只封锁当前尚未封锁的分区，避免对已封锁分区的 no-op 操作被误计为同步变更
	needToBlock, err := utils.GetAccountAssociatedAllowedPartitionInDatabase(account)
	if err != nil {
		message := fmt.Sprintf("block account: get allowed partitions failed: %v", err)
		logrus.Errorf("[SyncAccountUser], %v", message)
		return BlockAccountFailedOperation(syncData.AccountName, message)
	}
	if len(needToBlock) == 0 {
		// 所有分区已封锁，无需操作
		logrus.Infof("[SyncAccountUser], block account: %v already fully blocked, skip", account)
		return nil
	}

	blockFailedPartitions, blockSuccessPartitions := blockAccount(syncData, needToBlock)

	if len(blockFailedPartitions) > 0 {
		message := fmt.Sprintf("block account: %v failed, failed partition: %v", syncData.AccountName, blockFailedPartitions)
		logrus.Errorf("[SyncAccountUser], %v", message)
		return BlockAccountFailedOperation(syncData.AccountName, message)
	}

	if len(blockSuccessPartitions) == 0 {
		return nil
	}

	message := fmt.Sprintf("block account: %v success", syncData.AccountName)
	logrus.Infof("[SyncAccountUser], %v", message)
	return BlockAccountSuccessOperation(syncData.AccountName)
}

func UnBlockAccount(syncData *pb.SyncAccountInfo) *pb.SyncAccountUserInfoResponse_SyncOperationResult {
	var (
		message                  string
		unBlockFailedPartitions  []string
		unBlockSuccessPartitions []string
	)

	account := syncData.AccountName
	partitions, err := utils.GetPartitionsName()
	if err != nil {
		message = fmt.Sprintf("unblock account failed, get cluster partitions failed: %v", err)
		logrus.Errorf("[SyncAccountUser] %v", message)
		return UnblockAccountFailedOperation(syncData.AccountName, message)
	}
	if err = ensureAccountUsersAssociationInPartitions(account, partitions); err != nil {
		message = fmt.Sprintf("unblock account failed, ensure associations failed: %v", err)
		logrus.Errorf("[SyncAccountUser] %v", message)
		return UnblockAccountFailedOperation(syncData.AccountName, message)
	}

	// 获取unblockedPartitions分区，该分区需要解封
	unblockPartition, err := getUnblockPartition(syncData)
	if err != nil {
		message = fmt.Sprintf("unblock account failed, get partition failed: %v", err)
		logrus.Errorf("[SyncAccountUser] %v", message)
		return UnblockAccountFailedOperation(syncData.AccountName, message)
	}

	// 获取账户的授权分区
	AllowedPartitions, err := utils.GetAccountAssociatedAllowedPartitionInDatabase(account)
	if err != nil {
		message = fmt.Sprintf("unblock account failed, get account block partition failed: %v", err)
		logrus.Errorf("[SyncAccountUser] %v", message)
		return UnblockAccountFailedOperation(syncData.AccountName, message)
	}
	// DB 中存储的分区名大小写可能与 scontrol 返回的不一致，统一规范化后再比较
	AllowedPartitions, err = utils.NormalizePartitionNames(AllowedPartitions)
	if err != nil {
		message = fmt.Sprintf("unblock account failed, normalize partition names failed: %v", err)
		logrus.Errorf("[SyncAccountUser] %v", message)
		return UnblockAccountFailedOperation(syncData.AccountName, message)
	}

	for _, partition := range unblockPartition {
		if slices.Contains(AllowedPartitions, partition) {
			logrus.Infof("[SyncAccountUser]: account %v no need unblock in partition %v", account, partition)
			continue
		}

		err = utils.EnsureAccountUsersAssociationInPartition(account, partition)
		if err != nil {
			unBlockFailedPartitions = append(unBlockFailedPartitions, partition)
			message = fmt.Sprintf("unblock account: %v ensure association failed in partition %v, error: %v", account, partition, err)
			logrus.Errorf("[SyncAccountUser] %v", message)
			continue
		}

		err = utils.UnblockAccountUseAssociation(account, partition)
		if err != nil {
			unBlockFailedPartitions = append(unBlockFailedPartitions, partition)
			message = fmt.Sprintf("unblock account: %v failed in partition %v, error: %v", account, partition, err)
			logrus.Errorf("[SyncAccountUser] %v", message)
			continue
		}
		unBlockSuccessPartitions = append(unBlockSuccessPartitions, partition)
		message = fmt.Sprintf("unblock account: %v success in partition %v", account, partition)
		logrus.Infof("[SyncAccountUser], %v", message)
	}

	// 非unblockedPartitions分区需要封锁：只对当前尚未封锁（在 AllowedPartitions 中）且不在 unblockPartition 中的分区执行封锁，
	// 避免对已封锁分区的 no-op 操作被误计为同步变更
	var needToBlock []string
	for _, p := range AllowedPartitions {
		if !slices.Contains(unblockPartition, p) {
			needToBlock = append(needToBlock, p)
		}
	}
	blockFailedPartitions, blockSuccessPartitions := blockAccount(syncData, needToBlock)

	logrus.Infof("unBlockFailedPartitions: %v, unBlockSuccessPartitions: %v, blockFailedPartitions: %v, blockSuccessPartitions: %v", unBlockFailedPartitions, unBlockSuccessPartitions, blockFailedPartitions, blockSuccessPartitions)
	// 只要任何一个分区解封或者封锁失败，都返回失败
	if len(unBlockFailedPartitions) > 0 || len(blockFailedPartitions) > 0 {
		message = fmt.Sprintf("unblock account failed, fail unblock partitions: %v, fail block partitions: %v", unBlockFailedPartitions, blockFailedPartitions)
		logrus.Errorf("[SyncAccountUser] %v", message)
		return UnblockAccountFailedOperation(syncData.AccountName, message)
	}

	if len(unBlockSuccessPartitions) == 0 && len(blockSuccessPartitions) == 0 {
		return nil
	}

	message = fmt.Sprintf("unblock account: %v success", syncData.AccountName)
	logrus.Infof("[SyncAccountUser], %v", message)
	return UnblockAccountSuccessOperation(syncData.AccountName)
}

// blockAccount 将syncData中的账户在actualData中的分区中封锁，unblockPartitions中包含的分区不用封锁，返回封锁成功及失败的分区
func blockAccount(syncData *pb.SyncAccountInfo, partitions []string) ([]string, []string) {
	var (
		message                string
		blockFailedPartitions  []string
		blockSuccessPartitions []string
	)
	account := syncData.AccountName

	for _, partition := range partitions {
		err := utils.EnsureAccountUsersAssociationInPartition(account, partition)
		if err != nil {
			blockFailedPartitions = append(blockFailedPartitions, partition)
			message = fmt.Sprintf("block account: %v ensure association failed in partition %v, error: %v", account, partition, err)
			logrus.Errorf("[SyncAccountUser] %v", message)
			continue
		}

		err = utils.BlockAccountUseAssociation(account, partition)
		if err != nil {
			blockFailedPartitions = append(blockFailedPartitions, partition)
			message = fmt.Sprintf("block account: %v failed in partition %v, error: %v", account, partition, err)
			logrus.Errorf("[SyncAccountUser] %v", message)
			continue
		}
		blockSuccessPartitions = append(blockSuccessPartitions, partition)
		message = fmt.Sprintf("block account: %v success in partition %v", account, partition)
	}

	return blockFailedPartitions, blockSuccessPartitions
}

func ensureAccountUsersAssociationInPartitions(account string, partitions []string) error {
	for _, partition := range partitions {
		if err := utils.EnsureAccountUsersAssociationInPartition(account, partition); err != nil {
			return fmt.Errorf("ensure association failed in partition %s: %w", partition, err)
		}
	}
	return nil
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
		partitions = syncData.GetUnblockedPartitions().(*pb.SyncAccountInfo_AssignedPartitions_).AssignedPartitions.Partitions
	}

	return partitions, nil
}
