package sync_account_user

import (
	"context"
	"fmt"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/common/accountsync"
	"scow-adapters/pkg/crane/utils"
)

func createAccount(ctx context.Context, syncData *pb.SyncAccountInfo) (*pb.SyncAccountUserInfoResponse_SyncOperationResult, error) {
	var result *pb.SyncAccountUserInfoResponse_SyncOperationResult
	// 如果账户为空，直接返回
	if syncData.AccountName == "" {
		message := fmt.Sprintf("account %v is nil", syncData.AccountName)
		accountsync.Errorf(ctx, "operation=createAccount account=%s error=%s", syncData.AccountName, message)
		return accountsync.CreateAccountFailedOperation(syncData.AccountName, message), fmt.Errorf("account %v is nil", syncData.AccountName)
	}

	exist, err := utils.SelectAccountExists(syncData.AccountName)
	if err != nil {
		message := fmt.Sprintf("get account failed: %v", err)
		accountsync.Errorf(ctx, "operation=createAccount account=%s error=%v", syncData.AccountName, err)
		return accountsync.CreateAccountFailedOperation(syncData.AccountName, message), fmt.Errorf("get account %v failed %v", syncData.AccountName, message)
	}
	action := "create"
	if exist {
		action = "none"
	}
	accountsync.Tracef(ctx, "operation=createAccount account=%s expectedExists=true actualExists=%t action=%s",
		syncData.AccountName, exist, action)
	if !exist {
		if err = utils.CreateAccount(syncData.AccountName); err != nil {
			message := fmt.Sprintf("create account %v failed: %v", syncData.AccountName, err)
			accountsync.Errorf(ctx, "operation=createAccount account=%s expectedExists=true actualExists=false error=%v", syncData.AccountName, err)
			return accountsync.CreateAccountFailedOperation(syncData.AccountName, message), err
		}
		accountsync.Debugf(ctx, "operation=createAccount account=%s action=create result=success", syncData.AccountName)
		result = accountsync.CreateAccountSuccessOperation(syncData.AccountName)
	}

	return result, nil
}
