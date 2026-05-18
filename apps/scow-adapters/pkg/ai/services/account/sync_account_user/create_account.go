package sync_account_user

import (
	"fmt"

	"github.com/sirupsen/logrus"
	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/utils"
)

func createAccount(syncData *pb.SyncAccountInfo) (*pb.SyncAccountUserInfoResponse_SyncOperationResult, error) {
	var result *pb.SyncAccountUserInfoResponse_SyncOperationResult
	accountName := syncData.AccountName
	// 如果账户为空，直接返回
	if accountName == "" {
		message := fmt.Sprintf("account %v is nil", accountName)
		logrus.Errorf("[SyncAccountUser] %v", message)
		return CreateAccountFailedOperation(accountName, message), fmt.Errorf("account %v is nil", accountName)
	}

	// 检查账号名是否在slurm中
	exist, err := utils.SelectAccountExists(accountName)
	if err != nil {
		message := fmt.Sprintf("get account %v failed: %v", syncData.AccountName, err)
		logrus.Errorf("[SyncAccountUser] %v", message)
		return CreateAccountFailedOperation(syncData.AccountName, message), err
	}
	if !exist {
		if err = utils.CreateAccount(syncData.AccountName); err != nil {
			message := fmt.Sprintf("create account %v failed: %v", syncData.AccountName, err)
			logrus.Errorf("[SyncAccountUser] %v", message)
			return CreateAccountFailedOperation(syncData.AccountName, message), err
		}
		message := fmt.Sprintf("create account %v success", syncData.AccountName)
		logrus.Infof("[SyncAccountUser] %v", message)
		result = CreateAccountSuccessOperation(syncData.AccountName)
	}

	return result, nil
}
