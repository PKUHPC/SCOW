package sync_account_user

import (
	"fmt"

	"github.com/sirupsen/logrus"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/crane/utils"
)

func createAccount(syncData *pb.SyncAccountInfo) (*pb.SyncAccountUserInfoResponse_SyncOperationResult, error) {
	var result *pb.SyncAccountUserInfoResponse_SyncOperationResult
	// 如果账户为空，直接返回
	if syncData.AccountName == "" {
		message := fmt.Sprintf("account %v is nil", syncData.AccountName)
		logrus.Errorf("[SyncAccountUser] %v", message)
		return CreateAccountFailedOperation(syncData.AccountName, message), fmt.Errorf("account %v is nil", syncData.AccountName)
	}

	exist, err := utils.SelectAccountExists(syncData.AccountName)
	if err != nil {
		message := fmt.Sprintf("get account failed: %v", err)
		logrus.Errorf("[SyncAccountUser] %v", message)
		return CreateAccountFailedOperation(syncData.AccountName, message), fmt.Errorf("get account %v failed %v", syncData.AccountName, message)
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
