package sync_account_user

import (
	"context"
	"fmt"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/utils"
	"scow-adapters/pkg/common/accountsync"
)

func createAccount(ctx context.Context, syncData *pb.SyncAccountInfo) (*pb.SyncAccountUserInfoResponse_SyncOperationResult, error) {
	var result *pb.SyncAccountUserInfoResponse_SyncOperationResult
	accountName := syncData.AccountName
	// 如果账户为空，直接返回
	if accountName == "" {
		message := fmt.Sprintf("account %v is nil", accountName)
		accountsync.Errorf(ctx, "operation=createAccount account=%s error=%s", accountName, message)
		return accountsync.CreateAccountFailedOperation(accountName, message), fmt.Errorf("account %v is nil", accountName)
	}

	// 检查账号名是否在slurm中
	exist, err := utils.SelectAccountExists(accountName)
	if err != nil {
		message := fmt.Sprintf("get account %v failed: %v", syncData.AccountName, err)
		accountsync.Errorf(ctx, "operation=createAccount account=%s error=%v", accountName, err)
		return accountsync.CreateAccountFailedOperation(syncData.AccountName, message), err
	}
	action := "create"
	if exist {
		action = "none"
	}
	accountsync.Tracef(ctx, "operation=createAccount account=%s expectedExists=true actualExists=%t action=%s", accountName, exist, action)
	if !exist {
		if err = utils.CreateAccount(syncData.AccountName); err != nil {
			message := fmt.Sprintf("create account %v failed: %v", syncData.AccountName, err)
			accountsync.Errorf(ctx, "operation=createAccount account=%s expectedExists=true actualExists=false error=%v", accountName, err)
			return accountsync.CreateAccountFailedOperation(syncData.AccountName, message), err
		}
		accountsync.Debugf(ctx, "operation=createAccount account=%s action=create result=success", accountName)
		result = accountsync.CreateAccountSuccessOperation(syncData.AccountName)
	}

	return result, nil
}
