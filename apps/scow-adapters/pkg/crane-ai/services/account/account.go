package account

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc/codes"

	craneProtos "scow-adapters/gen/crane-ai"
	protos "scow-adapters/gen/go"
	"scow-adapters/pkg/common/accountsync"
	ce "scow-adapters/pkg/common/error"
	"scow-adapters/pkg/crane-ai/client"
	sau "scow-adapters/pkg/crane-ai/services/account/sync_account_user"
	"scow-adapters/pkg/crane-ai/utils"
)

type ServerAccount struct {
	protos.UnimplementedAccountServiceServer
	muBlock   sync.Mutex
	muUnBlock sync.Mutex
}

func (s *ServerAccount) ListAccounts(ctx context.Context, in *protos.ListAccountsRequest) (*protos.ListAccountsResponse, error) {
	accountList, err := utils.GetAccountByUser(in.UserId)
	if err != nil {
		logrus.Errorf("ListAccounts failed: %v", err)
		return nil, ce.RichError(codes.Internal, "ListAccounts failed", err.Error())
	}

	logrus.Tracef("ListAccounts accounts: %v", accountList)
	return &protos.ListAccountsResponse{Accounts: accountList}, nil
}

func (s *ServerAccount) CreateAccount(ctx context.Context, in *protos.CreateAccountRequest) (*protos.CreateAccountResponse, error) {
	logrus.Infof("Received request CreateAccount: %v", in)

	// 检查账户名
	if err := utils.CheckAccount(in.AccountName); err != nil {
		logrus.Errorf("CreateAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "ACCOUNT_ILLEGAL", err.Error())
	}

	var partitions []string
	useAuthorizedPartitions := false
	switch partitionStrategy := in.PartitionStrategy.(type) {
	case *protos.CreateAccountRequest_AuthorizedPartitions_:
		useAuthorizedPartitions = true
		if partitionStrategy.AuthorizedPartitions != nil {
			partitions = partitionStrategy.AuthorizedPartitions.Partitions
		}
	case *protos.CreateAccountRequest_UseAllPartitions:
		if !partitionStrategy.UseAllPartitions {
			logrus.Debugf("CreateAccount rejected invalid use_all_partitions=false")
			return nil, ce.RichError(codes.InvalidArgument, "INVALID_ARGUMENT",
				"use_all_partitions must be true when set")
		}
	}

	if useAuthorizedPartitions {
		if err := utils.CreateAccount(in.AccountName, partitions); err != nil {
			logrus.Errorf("create account %v failed: %v", in.AccountName, err)
			return nil, ce.RichError(codes.Internal, "CRANE_INTERNAL_ERROR", err.Error())
		}
	} else if err := utils.CreateAccount(in.AccountName); err != nil {
		logrus.Errorf("create account %v failed: %v", in.AccountName, err)
		return nil, ce.RichError(codes.Internal, "CRANE_INTERNAL_ERROR", err.Error())
	}
	logrus.Tracef("create account: %v success", in.AccountName)

	rollbackCreatedAccount := func(cause error) (*protos.CreateAccountResponse, error) {
		if rollbackErr := utils.DeleteAccount(in.AccountName); rollbackErr != nil {
			logrus.Errorf("CreateAccount rollback account %v failed after add owner failure: %v", in.AccountName, rollbackErr)
		}
		return nil, ce.RichError(codes.Internal, "CRANE_CALL_FAILED", cause.Error())
	}

	// 账户创建成功后，将用户添加至账户中
	if useAuthorizedPartitions {
		if err := utils.AddUserToAccount(in.AccountName, in.OwnerUserId, partitions); err != nil {
			logrus.Errorf("CreateAccount err: %v", err)
			return rollbackCreatedAccount(err)
		}
	} else if err := utils.AddUserToAccount(in.AccountName, in.OwnerUserId); err != nil {
		logrus.Errorf("CreateAccount err: %v", err)
		return rollbackCreatedAccount(err)
	}

	if in.AccountBlocked {
		if err := utils.BlockAccount(in.AccountName); err != nil {
			logrus.Errorf("CreateAccount block account %v failed: %v", in.AccountName, err)
			if rollbackErr := utils.DeleteAccount(in.AccountName); rollbackErr != nil {
				logrus.Errorf("CreateAccount rollback account %v failed after block failure: %v", in.AccountName, rollbackErr)
			}
			return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", err.Error())
		}
	}

	logrus.Tracef("add user : %v to account: %v success", in.OwnerUserId, in.AccountName)
	return &protos.CreateAccountResponse{}, nil
}

func (s *ServerAccount) BlockAccount(ctx context.Context, in *protos.BlockAccountRequest) (*protos.BlockAccountResponse, error) {
	logrus.Infof("Received request BlockAccount: %v", in)
	s.muBlock.Lock()
	defer s.muBlock.Unlock()

	// 检查账户名
	if err := utils.CheckAccount(in.AccountName); err != nil {
		logrus.Errorf("BlockAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "ACCOUNT_ILLEGAL", err.Error())
	}

	// 先查询账户
	account, err := utils.GetAccountByName(in.AccountName)
	if err != nil {
		logrus.Errorf("BlockAccount get account failed: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", err.Error())
	}

	if account.Blocked {
		logrus.Infof("BlockAccount account %v is blocked, no need block", in.AccountName)
		return &protos.BlockAccountResponse{}, nil
	}

	// 封锁账户时将账户的Blocked字段置为true
	if err := utils.BlockAccount(in.AccountName); err != nil {
		logrus.Errorf("BlockAccount err: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", err.Error())
	}

	logrus.Infof("BlockAccount account: %v success", in.AccountName)
	return &protos.BlockAccountResponse{}, nil
}

func (s *ServerAccount) UnblockAccount(ctx context.Context, in *protos.UnblockAccountRequest) (*protos.UnblockAccountResponse, error) {
	logrus.Infof("Received request UnblockAccount: %v", in)
	s.muUnBlock.Lock() // 加锁操作
	defer s.muUnBlock.Unlock()

	// 检查账户名
	if err := utils.CheckAccount(in.AccountName); err != nil {
		logrus.Errorf("UnblockAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "ACCOUNT_ILLEGAL", err.Error())
	}

	// 解封账户时将账户的Blocked字段置为false
	if err := utils.UnblockAccount(in.AccountName); err != nil {
		logrus.Errorf("BlockAccount err: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", err.Error())
	}

	logrus.Infof("UnblockAccount account: %v success", in.AccountName)
	return &protos.UnblockAccountResponse{}, nil
}

func (s *ServerAccount) GetAllAccountsWithUsers(ctx context.Context, in *protos.GetAllAccountsWithUsersRequest) (*protos.GetAllAccountsWithUsersResponse, error) {
	var accounts []*protos.ClusterAccountInfo

	logrus.Infof("Received request GetAllAccountsWithUsers: %v", in)
	allAccount, err := utils.GetAllAccount()
	if err != nil {
		logrus.Errorf("GetAllAccountsWithUsers err: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_INTERNAL_ERROR", err.Error())
	}
	// 获取所有账户信息
	for _, account := range allAccount {
		var userInfo []*protos.ClusterAccountInfo_UserInAccount
		requestUser := &craneProtos.QueryUserInfoRequest{
			Uid:     0,
			Account: account.GetName(),
		}
		// 获取单个账户下用户信息
		responseUser, _ := client.CraneCtld.QueryUserInfo(context.Background(), requestUser)
		for _, user := range responseUser.GetUserList() {
			userInfo = append(userInfo, &protos.ClusterAccountInfo_UserInAccount{
				UserId:   user.GetName(),
				UserName: user.GetName(),
				Blocked:  user.GetBlocked(),
			})
		}
		accounts = append(accounts, &protos.ClusterAccountInfo{
			AccountName: account.GetName(),
			Blocked:     account.GetBlocked(),
			Users:       userInfo,
		})
	}
	logrus.Tracef("GetAllAccountsWithUsers Accounts: %v", accounts)
	return &protos.GetAllAccountsWithUsersResponse{Accounts: accounts}, nil
}

func (s *ServerAccount) QueryAccountBlockStatus(ctx context.Context, in *protos.QueryAccountBlockStatusRequest) (*protos.QueryAccountBlockStatusResponse, error) {
	var accountStatusInPartition []*protos.AccountStatusInPartition
	logrus.Infof("Received request QueryAccountBlockStatus: %v", in)

	// 检查账户名
	if err := utils.CheckAccount(in.AccountName); err != nil {
		logrus.Errorf("QueryAccountBlockStatus failed: %v", err)
		return nil, ce.RichError(codes.Internal, "ACCOUNT_ILLEGAL", err.Error())
	}

	// 查询账户
	account, err := utils.GetAccountByName(in.AccountName)
	if err != nil {
		logrus.Errorf("QueryAccountBlockStatus err: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_INTERNAL_ERROR", err.Error())
	}

	// 获取所有分区
	partitions := utils.GetAllPartitions()

	// 获取账户的blocked
	accountBlocked := account.GetBlocked()
	// 该账户在所有分区中的封锁
	if accountBlocked {
		for _, partition := range partitions {
			accountStatusInPartition = append(accountStatusInPartition, &protos.AccountStatusInPartition{
				Blocked:   accountBlocked,
				Partition: partition,
			})
		}
		logrus.Tracef("QueryAccountBlockStatus Account Blocked Details: %v", accountStatusInPartition)
		return &protos.QueryAccountBlockStatusResponse{Blocked: accountBlocked, AccountBlockedDetails: accountStatusInPartition}, nil
	}

	// 获取账户的allowPartitions
	allowPartitions := account.GetAllowedPartitions()
	for _, partition := range partitions {
		if utils.Contains(allowPartitions, partition) {
			accountStatusInPartition = append(accountStatusInPartition, &protos.AccountStatusInPartition{
				Blocked:   false,
				Partition: partition,
			})
			continue
		}
		accountStatusInPartition = append(accountStatusInPartition, &protos.AccountStatusInPartition{
			Blocked:   true,
			Partition: partition,
		})
	}

	logrus.Tracef("QueryAccountBlockStatus Accounts: %v", accountStatusInPartition)
	return &protos.QueryAccountBlockStatusResponse{Blocked: false, AccountBlockedDetails: accountStatusInPartition}, nil
}

func (s *ServerAccount) DeleteAccount(ctx context.Context, in *protos.DeleteAccountRequest) (*protos.DeleteAccountResponse, error) {
	logrus.Infof("Received request DeleteAccount: %v", in)

	// 检查账户名
	if err := utils.CheckAccount(in.AccountName); err != nil {
		logrus.Errorf("DeleteAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "ACCOUNT_ILLEGAL", err.Error())
	}

	jobInfo, err := utils.GetTaskByAccountName([]string{in.AccountName})
	if err != nil {
		logrus.Errorf("DeleteAccount err: %v", err)
		return nil, ce.RichError(codes.Internal, "CRANE_RUNCOMMAND_ERROR", err.Error())
	}
	logrus.Tracef("DeleteAccount running job info for account %s: %v", in.AccountName, jobInfo)

	runningJobs := len(jobInfo)
	if runningJobs != 0 {
		err = fmt.Errorf("exist running jobs")
		logrus.Errorf("DeleteAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "RUNNING_JOB_EXISTS", err.Error())
	}

	userNames, err := utils.GetAccountUserNames(in.AccountName)
	if err != nil {
		logrus.Errorf("DeleteAccount query account users failed: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", err.Error())
	}
	if len(userNames) != 0 {
		if err = utils.DeleteUsersFromAccount(userNames, in.AccountName); err != nil {
			logrus.Errorf("DeleteAccount remove users %v from account %v failed: %v", userNames, in.AccountName, err)
			return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", err.Error())
		}
		logrus.Infof("DeleteAccount remove users %v from account %v success", userNames, in.AccountName)
	}

	if err := utils.DeleteAccount(in.AccountName); err != nil {
		var responseErr *utils.CraneCtldResponseError
		if errors.As(err, &responseErr) {
			richErrorCode := "UNKNOWN"
			if len(responseErr.RichErrors) > 0 && responseErr.RichErrors[0] != nil {
				richErrorCode = responseErr.RichErrors[0].GetCode().String()
			}

			logrus.Errorf(
				"DeleteAccount %s failed, response get false, RichError code: %v",
				in.AccountName,
				richErrorCode,
			)

			if responseErr.AllHaveCode(craneProtos.ErrCode_ERR_INVALID_ACCOUNT) {
				return nil, ce.RichError(codes.NotFound, "ASSOCIATION_NOT_EXISTS", responseErr.Error())
			}

			return nil, ce.RichError(codes.Internal, "DELETE_ACCOUNT_FAILED", responseErr.Error())
		}

		logrus.Errorf("DeleteAccount err: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", err.Error())
	}

	logrus.Infof("DeleteAccount: %v success", in.AccountName)
	return &protos.DeleteAccountResponse{}, nil
}

// BlockAccountWithPartitions Crane账户封锁将根据分区来细粒度封锁
func (s *ServerAccount) BlockAccountWithPartitions(ctx context.Context, in *protos.BlockAccountWithPartitionsRequest) (*protos.BlockAccountWithPartitionsResponse, error) {
	logrus.Infof("Received request BlockAccountWithPartitions: %v", in)
	s.muBlock.Lock()
	defer s.muBlock.Unlock()

	if len(in.BlockedPartitions) == 0 {
		logrus.Infof("BlockAccountWithPartitions：%v no partition need block", in.AccountName)
		return &protos.BlockAccountWithPartitionsResponse{}, nil
	}

	// 检查账户名
	if err := utils.CheckAccount(in.AccountName); err != nil {
		logrus.Errorf("BlockAccountWithPartitions failed: %v", err)
		return nil, ce.RichError(codes.Internal, "ACCOUNT_ILLEGAL", err.Error())
	}

	// 查询账户
	account, err := utils.GetAccountByName(in.AccountName)
	if err != nil {
		logrus.Errorf("BlockAccountWithPartitions err: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_INTERNAL_ERROR", err.Error())
	}

	// 获取账户的allowPartitions
	allowPartitions := account.GetAllowedPartitions()

	var needBlockPartitions []string
	// 请求的分区在账户的allowPartitions内需要进行封锁，若不在allowPartitions内，表示账户在该分区本来就是封锁状态，无需进行封锁了
	for _, partition := range in.BlockedPartitions {
		if utils.Contains(allowPartitions, partition) {
			needBlockPartitions = append(needBlockPartitions, partition)
		}
	}

	if len(needBlockPartitions) == 0 {
		logrus.Infof("BlockAccountWithPartitions account %v no need block in partitions %v", in.AccountName, in.BlockedPartitions)
		return &protos.BlockAccountWithPartitionsResponse{}, nil
	}

	if err = utils.BlockAccountWithPartition(in.AccountName, needBlockPartitions); err != nil {
		logrus.Errorf("BlockAccount err: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", err.Error())
	}

	logrus.Infof("BlockAccountWithPartitions account: %v success", in.AccountName)
	return &protos.BlockAccountWithPartitionsResponse{}, nil
}

func (s *ServerAccount) UnblockAccountWithPartitions(ctx context.Context, in *protos.UnblockAccountWithPartitionsRequest) (*protos.UnblockAccountWithPartitionsResponse, error) {
	logrus.Infof("Received request UnblockAccountWithPartitions: %v", in)
	s.muUnBlock.Lock() // 加锁操作
	defer s.muUnBlock.Unlock()

	// 检查账户名
	if err := utils.CheckAccount(in.AccountName); err != nil {
		logrus.Errorf("UnblockAccountWithPartitions failed: %v", err)
		return nil, ce.RichError(codes.Internal, "ACCOUNT_ILLEGAL", err.Error())
	}

	// 查询账户
	account, err := utils.GetAccountByName(in.AccountName)
	if err != nil {
		logrus.Errorf("UnblockAccountWithPartitions err: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_INTERNAL_ERROR", err.Error())
	}

	// 获取账户的allowPartitions
	allowPartitions := account.GetAllowedPartitions()

	var needUnblockPartitions []string
	// 请求的分区不在账户的allowPartitions内，表示账户在该分区是封锁状态，需进行解封
	for _, partition := range in.UnblockedPartitions {
		if !utils.Contains(allowPartitions, partition) {
			needUnblockPartitions = append(needUnblockPartitions, partition)
		}
	}

	if account.Blocked {
		// SCOW 只会在账户应处于解封态时调用分区解封接口。
		// AllowedPartitions 和账户整体 Blocked 是两套状态；即使目标分区已在授权列表中，
		// 也需要先清除整体 blocked 状态，否则账户仍然无法提交作业。
		if err = utils.UnblockAccount(in.AccountName); err != nil {
			logrus.Errorf("UnblockAccountWithPartitions unblock account failed: %v", err)
			return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", err.Error())
		}
	}

	if len(needUnblockPartitions) == 0 {
		logrus.Infof("UnblockAccountWithPartitions account %v no need unblock in partitions %v", in.AccountName, in.UnblockedPartitions)
		return &protos.UnblockAccountWithPartitionsResponse{}, nil
	}

	// 还需添加账户的allowPartitions
	if err := utils.UnblockAccountWithPartition(in.AccountName, needUnblockPartitions); err != nil {
		logrus.Errorf("BlockAccount err: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", err.Error())
	}

	logrus.Infof("UnblockAccountWithPartitions account: %v success", in.AccountName)
	return &protos.UnblockAccountWithPartitionsResponse{}, nil
}

func (s *ServerAccount) QueryAccountBlockStatusWithPartitions(ctx context.Context, in *protos.QueryAccountBlockStatusWithPartitionsRequest) (*protos.QueryAccountBlockStatusWithPartitionsResponse, error) {
	var (
		accountStatusInPartition []*protos.AccountStatusInPartition
		queriedPartitions        []string
	)
	logrus.Infof("Received request QueryAccountBlockStatus: %v", in)

	// 检查账户名
	if err := utils.CheckAccount(in.AccountName); err != nil {
		logrus.Errorf("QueryAccountBlockStatusWithPartitions failed: %v", err)
		return nil, ce.RichError(codes.Internal, "ACCOUNT_ILLEGAL", err.Error())
	}

	// 查询账户
	account, err := utils.GetAccountByName(in.AccountName)
	if err != nil {
		logrus.Errorf("QueryAccountBlockStatusWithPartitions err: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_INTERNAL_ERROR", err.Error())
	}

	// 获取计算分区信息
	if len(in.QueriedPartitions) == 0 {
		queriedPartitions = utils.GetAllPartitions()
	} else {
		queriedPartitions = in.QueriedPartitions
	}

	// 获取账户的blocked
	accountBlocked := account.GetBlocked()
	// 该账户在所有分区中封锁
	if accountBlocked {
		for _, partition := range queriedPartitions {
			accountStatusInPartition = append(accountStatusInPartition, &protos.AccountStatusInPartition{
				Blocked:   accountBlocked,
				Partition: partition,
			})
		}
		logrus.Tracef("QueryAccountBlockStatusWithPartitions Account Blocked Details: %v", accountStatusInPartition)
		return &protos.QueryAccountBlockStatusWithPartitionsResponse{Blocked: accountBlocked, AccountBlockedDetails: accountStatusInPartition}, nil
	}

	// 获取账户的allowPartitions
	allowPartitions := account.GetAllowedPartitions()
	for _, partition := range queriedPartitions {
		if utils.Contains(allowPartitions, partition) {
			accountStatusInPartition = append(accountStatusInPartition, &protos.AccountStatusInPartition{
				Blocked:   false,
				Partition: partition,
			})
			continue
		}
		accountStatusInPartition = append(accountStatusInPartition, &protos.AccountStatusInPartition{
			Blocked:   true,
			Partition: partition,
		})
	}
	logrus.Tracef("QueryAccountBlockStatusWithPartitions Account Blocked Details: %v", accountStatusInPartition)
	return &protos.QueryAccountBlockStatusWithPartitionsResponse{Blocked: false, AccountBlockedDetails: accountStatusInPartition}, nil
}

func (s *ServerAccount) GetAllAccountsWithUsersAndBlockedDetails(ctx context.Context, in *protos.GetAllAccountsWithUsersAndBlockedDetailsRequest) (*protos.GetAllAccountsWithUsersAndBlockedDetailsResponse, error) {
	logrus.Infof("Received request GetAllAccountsWithUsersAndBlockedDetails: %v", in)

	var acctInfo []*protos.ClusterAccountInfoWithBlockedDetails
	// 1. 获取所有账户
	allAccount, err := utils.GetAllAccount()
	if err != nil {
		return nil, ce.RichError(codes.Unavailable, "CRANE_INTERNAL_ERROR", err.Error())
	}
	// 2. 获取所有账户的用户信息
	accountUserInfoMap, err := utils.GetAllAccountUserInfoConcurrently(allAccount)
	if err != nil {
		logrus.Errorf("GetAllAccountsWithUsersAndBlockedDetails err: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_INTERNAL_ERROR", err.Error())
	}

	// 3. 获取所有分区
	partitions := utils.GetAllPartitions()

	// 4. 获取和每个账户关联的用户的信息以及用户的block状态
	for account, users := range accountUserInfoMap {
		var (
			userInfo                 []*protos.ClusterAccountInfoWithBlockedDetails_UserInAccount
			accountStatusInPartition []*protos.AccountStatusInPartition
		)

		for _, user := range users {
			userInfo = append(userInfo, &protos.ClusterAccountInfoWithBlockedDetails_UserInAccount{
				UserId:   user.GetName(),
				UserName: user.GetName(),
				Blocked:  user.GetBlocked(),
			})

		}

		// 获取账户的blocked
		accountBlocked := account.GetBlocked()
		// 该账户在所有分区中的封锁
		if accountBlocked {
			for _, partition := range partitions {
				accountStatusInPartition = append(accountStatusInPartition, &protos.AccountStatusInPartition{
					Blocked:   accountBlocked,
					Partition: partition,
				})
			}
			acctInfo = append(acctInfo, &protos.ClusterAccountInfoWithBlockedDetails{
				AccountName:           account.GetName(),
				Users:                 userInfo,
				Blocked:               true,
				AccountBlockedDetails: accountStatusInPartition,
			})
			continue
		}

		// 获取账户的allowPartitions
		allowPartitions := account.GetAllowedPartitions()
		for _, partition := range partitions {
			if utils.Contains(allowPartitions, partition) {
				accountStatusInPartition = append(accountStatusInPartition, &protos.AccountStatusInPartition{
					Blocked:   false,
					Partition: partition,
				})
				continue
			}
			accountStatusInPartition = append(accountStatusInPartition, &protos.AccountStatusInPartition{
				Blocked:   true,
				Partition: partition,
			})
		}

		acctInfo = append(acctInfo, &protos.ClusterAccountInfoWithBlockedDetails{
			AccountName:           account.GetName(),
			Users:                 userInfo,
			Blocked:               false,
			AccountBlockedDetails: accountStatusInPartition,
		})
	}

	logrus.Tracef("GetAllAccountsWithUsersAndBlockedDetails finished, accounts count: %d", len(acctInfo))
	return &protos.GetAllAccountsWithUsersAndBlockedDetailsResponse{Accounts: acctInfo}, nil
}

func (s *ServerAccount) SyncAccountUserInfo(ctx context.Context, in *protos.SyncAccountUserInfoRequest) (*protos.SyncAccountUserInfoResponse, error) {
	var syncResults []*protos.SyncAccountUserInfoResponse_SyncOperationResult
	start := time.Now()
	syncID := in.GetSessionId()
	timeoutMs := in.GetTimeoutMilliseconds()
	ctx, cancel := context.WithTimeout(ctx, time.Duration(timeoutMs)*time.Millisecond)
	defer cancel()
	ctx = accountsync.WithSyncID(ctx, syncID)
	summary := accountsync.NewSummary(len(in.GetSyncAccounts()))
	logrus.Infof("SyncAccountUserInfo started: syncId=%q accounts=%d timeoutMs=%d",
		syncID, summary.AccountsRequested(), timeoutMs)

	if in.SyncAccounts == nil || len(in.SyncAccounts) == 0 {
		logrus.Info(summary.LogMessage(syncID, true, "none", time.Since(start).Milliseconds(), timeoutMs))
		return nil, nil
	}

	isCompleted := true
	incompleteReason := "none"

outerLoop:
	for _, syncAccount := range in.SyncAccounts {
		// 每次循环前检查超时
		select {
		case <-ctx.Done():
			isCompleted = false
			incompleteReason = ctx.Err().Error()
			break outerLoop // 超时了，跳出循环不在执行，返回已处理的结果和未完成状态
		default:
		}

		if *syncAccount.Deleted {
			summary.SkipAccount(syncAccount)
			accountsync.Tracef(ctx, "account=%s expectedDeleted=true action=skip", syncAccount.AccountName)
			continue
		}

		results, stats := sau.SyncAccountUser(ctx, syncAccount)
		summary.RecordAccount(results, stats)
		for _, result := range results {
			if result == nil {
				continue
			}
			syncResults = append(syncResults, result)
		}
	}

	elapsedMs := time.Since(start).Milliseconds()
	message := summary.LogMessage(syncID, isCompleted, incompleteReason, elapsedMs, timeoutMs)
	if isCompleted {
		logrus.Info(message)
	} else {
		logrus.Warn(message)
	}

	return &protos.SyncAccountUserInfoResponse{SyncResults: syncResults, CompletelyExecuted: isCompleted}, nil
}
