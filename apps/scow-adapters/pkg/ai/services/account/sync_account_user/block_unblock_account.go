package sync_account_user

import (
	"fmt"
	"sort"
	"strings"

	"github.com/sirupsen/logrus"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/utils"
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

	account, err := utils.GetAccountByName(syncData.AccountName)
	if err != nil {
		message := fmt.Sprintf("get account: %v failed", syncData.AccountName)
		logrus.Errorf("[SyncAccountUser], %v", message)
		return BlockAccountFailedOperation(syncData.AccountName, message)
	}

	if account.Blocked == 1 {
		logrus.Infof("BlockAccount account %s is already blocked", syncData.AccountName)
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

	// 获取unblockedPartitions分区，该分区需要解封
	unblockPartition, err := getUnblockPartition(syncData)
	if err != nil {
		message = fmt.Sprintf("unblock account failed, get partition failed: %v", err)
		logrus.Errorf("[SyncAccountUser] %v", message)
		return UnblockAccountFailedOperation(syncData.AccountName, message)
	}

	account, err := utils.GetAccountByName(syncData.AccountName)
	if err != nil {
		message = fmt.Sprintf("get account %v failed: %v", syncData.AccountName, err)
		logrus.Errorf("[SyncAccountUser] %v", message)
		return UnblockAccountFailedOperation(syncData.AccountName, message)
	}

	partitionsChanged := !equalAccounts(unblockPartition, account.Partitions)
	if account.Blocked == 0 && !partitionsChanged {
		return nil
	}

	if account.Blocked != 0 {
		if err = utils.UnblockAccount(syncData.AccountName); err != nil {
			message = fmt.Sprintf("unblock account %v failed: %v", syncData.AccountName, err)
			logrus.Errorf("[SyncAccountUser] %v", message)
			return UnblockAccountFailedOperation(syncData.AccountName, message)
		}
	}

	// 需要封锁的分区不在unblockedPartitions中，自然就封锁了
	if partitionsChanged {
		if err = utils.UpdateAccountPartitions(syncData.AccountName, strings.Join(unblockPartition, ",")); err != nil {
			message = fmt.Sprintf("update account %v partitions %v failed: %v", syncData.AccountName, unblockPartition, err)
			logrus.Errorf("[SyncAccountUser] %v", message)
			return UnblockAccountFailedOperation(syncData.AccountName, message)
		}
	}

	message = fmt.Sprintf("unblock account: %v success", syncData.AccountName)
	logrus.Infof("[SyncAccountUser], %v", message)
	return UnblockAccountSuccessOperation(syncData.AccountName)
}

func getUnblockPartition(syncData *pb.SyncAccountInfo) ([]string, error) {
	var partitions []string
	var err error

	if syncData.GetUseAllPartitions() {
		partitions, err = utils.GetQueueName()
		if err != nil {
			return nil, err
		}
	} else {
		partitions = syncData.GetUnblockedPartitions().(*pb.SyncAccountInfo_AssignedPartitions_).AssignedPartitions.Partitions
	}

	return partitions, nil
}

// equalAccounts 检查 []string 和逗号分隔的字符串是否表示相同的账户（顺序无关）
func equalAccounts(sliceAccounts []string, strAccounts string) bool {
	if len(sliceAccounts) == 0 && strAccounts == "" {
		return true
	}
	// 分割字符串
	strSplit := strings.Split(strAccounts, ",")

	// 如果长度不同，直接返回 false
	if len(sliceAccounts) != len(strSplit) {
		return false
	}

	// 排序后再比较
	sort.Strings(sliceAccounts)
	sort.Strings(strSplit)

	// 逐个比较元素
	for i := 0; i < len(sliceAccounts); i++ {
		if sliceAccounts[i] != strSplit[i] {
			return false
		}
	}

	return true
}
