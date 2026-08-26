package account

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc/codes"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/config"
	sau "scow-adapters/pkg/ai/services/account/sync_account_user"
	"scow-adapters/pkg/ai/utils"
	"scow-adapters/pkg/common/accountsync"
	ce "scow-adapters/pkg/common/error"
)

type ServerAccount struct {
	pb.UnimplementedAccountServiceServer
	muBlock   sync.Mutex // Add a Mutex field for locking
	muUnBlock sync.Mutex // Add a Mutex field for locking
}

func isAccountBlocked(blocked int) bool {
	return blocked != 0
}

func getAccountStatusInPartitions(accountBlocked int, accountPartitions string, partitions []string) []*pb.AccountStatusInPartition {
	accountStatusInPartition := make([]*pb.AccountStatusInPartition, 0, len(partitions))
	if isAccountBlocked(accountBlocked) {
		for _, partition := range partitions {
			accountStatusInPartition = append(accountStatusInPartition, &pb.AccountStatusInPartition{
				Blocked:   true,
				Partition: partition,
			})
		}
		return accountStatusInPartition
	}

	allowedPartitions := make(map[string]struct{})
	for _, partition := range strings.Split(accountPartitions, ",") {
		if partition == "" {
			continue
		}
		allowedPartitions[partition] = struct{}{}
	}

	for _, partition := range partitions {
		_, allowed := allowedPartitions[partition]
		accountStatusInPartition = append(accountStatusInPartition, &pb.AccountStatusInPartition{
			Blocked:   !allowed,
			Partition: partition,
		})
	}
	return accountStatusInPartition
}

func (s *ServerAccount) ListAccounts(ctx context.Context, in *pb.ListAccountsRequest) (*pb.ListAccountsResponse, error) {
	logrus.Infof("Received request ListAccounts: %v", in)

	// 检查用户名是否在
	exist, err := utils.SelectUserExists(in.UserId)
	if err != nil {
		logrus.Errorf("ListAccounts failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("user %s not found", in.UserId)
		logrus.Errorf("ListAccounts failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "USER_NOT_FOUND", err.Error())
	}

	// 获取与用户相关联的所有账户信息
	acctList, err := utils.GetAccountsNameByUser(in.UserId)
	if err != nil {
		logrus.Errorf("ListAccounts failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	logrus.Tracef("ListAccounts finished, user: %s, accounts count: %d", in.UserId, len(acctList))
	return &pb.ListAccountsResponse{Accounts: acctList}, nil
}

func (s *ServerAccount) CreateAccount(ctx context.Context, in *pb.CreateAccountRequest) (*pb.CreateAccountResponse, error) {
	logrus.Infof("Received request CreateAccount: %v", in)
	accountName := in.AccountName
	userName := in.OwnerUserId
	if err := utils.CheckAccount(accountName); err != nil {
		logrus.Errorf("CreateAccount failed: %v", err)
		return nil, ce.RichError(codes.InvalidArgument, "ACCOUNT_NAME_INVALID", err.Error())
	}
	// 检查账号名是否存在
	exist, err := utils.SelectAccountExists(accountName)
	if err != nil {
		logrus.Errorf("CreateAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if exist {
		err = fmt.Errorf("account %s already exists", in.AccountName)
		logrus.Errorf("CreateAccount failed: %v", err)
		return nil, ce.RichError(codes.AlreadyExists, "ACCOUNT_NOT_FOUND", err.Error())
	}

	var partitions []string
	useAllPartitions := false
	switch partitionStrategy := in.PartitionStrategy.(type) {
	case *pb.CreateAccountRequest_AuthorizedPartitions_:
		if partitionStrategy.AuthorizedPartitions != nil {
			partitions = partitionStrategy.AuthorizedPartitions.Partitions
		}
	case *pb.CreateAccountRequest_UseAllPartitions:
		if !partitionStrategy.UseAllPartitions {
			logrus.Debugf("CreateAccount rejected invalid use_all_partitions=false")
			return nil, ce.RichError(codes.InvalidArgument, "INVALID_ARGUMENT",
				"use_all_partitions must be true when set")
		}
		useAllPartitions = true
	default:
		useAllPartitions = true
	}
	if useAllPartitions {
		partitions, err = utils.GetQueueName()
		if err != nil {
			logrus.Errorf("CreateAccount failed: %v", err)
			return nil, ce.RichError(codes.Internal, "GET_PARTITION_FAILED", err.Error())
		}
	}
	partitionNames := strings.Join(partitions, ",")
	accountBlocked := 0
	if in.AccountBlocked {
		// authorized_partitions 表示授权分区；AI 的 AcctTable.Blocked 是账户封锁状态，
		// 两者必须独立保存，不能用空分区列表推断账户封锁。
		accountBlocked = 1
	}
	// 检查用户名是否在
	exist, err = utils.SelectUserExists(userName)
	if err != nil {
		logrus.Errorf("CreateAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	gpuQuota := config.Value.Quota.GPU
	if exist {
		err = utils.CreateAccountIfUserExits(accountName, userName, partitionNames, gpuQuota, accountBlocked)
		if err != nil {
			logrus.Errorf("CreateAccount failed: %v", err)
			return nil, ce.RichError(codes.Internal, "SQL_CREATE_FAILED", err.Error())
		}
		return &pb.CreateAccountResponse{}, nil
	} else {
		err = utils.CreateAccountIfUserNotExits(accountName, userName, partitionNames, gpuQuota, accountBlocked)
		if err != nil {
			logrus.Errorf("CreateAccount failed: %v", err)
			return nil, ce.RichError(codes.Internal, "SQL_CREATE_FAILED", err.Error())
		}
		return &pb.CreateAccountResponse{}, nil
	}
}

func (s *ServerAccount) BlockAccount(ctx context.Context, in *pb.BlockAccountRequest) (*pb.BlockAccountResponse, error) {
	s.muBlock.Lock()
	defer s.muBlock.Unlock()
	logrus.Infof("Received request BlockAccount: %v", in)
	// 检查账号名是否在存在
	exist, err := utils.SelectAccountExists(in.AccountName)
	if err != nil {
		logrus.Errorf("BlockAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("account %s not found", in.AccountName)
		logrus.Errorf("BlockAccount failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "ACCOUNT_NOT_FOUND", err.Error())
	}

	account, err := utils.GetAccountByName(in.AccountName)
	if err != nil {
		logrus.Errorf("BlockAccount query account %s failed: %v", in.AccountName, err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	if account.Blocked == 1 {
		logrus.Infof("BlockAccount account %s is already blocked", in.AccountName)
		return &pb.BlockAccountResponse{}, nil
	}

	if err = utils.BlockAccount(in.AccountName); err != nil {
		logrus.Errorf("BlockAccount: account %v failed: %v", in.AccountName, err)
		return nil, ce.RichError(codes.Internal, "BLOCK_ACCOUNT_FAILED", err.Error())
	}
	logrus.Infof("BlockAccount: blocked account %v success", in.AccountName)
	return &pb.BlockAccountResponse{}, nil
}

func (s *ServerAccount) UnblockAccount(ctx context.Context, in *pb.UnblockAccountRequest) (*pb.UnblockAccountResponse, error) {
	s.muUnBlock.Lock() // 加锁操作
	defer s.muUnBlock.Unlock()
	logrus.Infof("Received request UnblockAccount: %v", in)
	// 检查账号名是否存在
	exist, err := utils.SelectAccountExists(in.AccountName)
	if err != nil {
		logrus.Errorf("UnblockAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("account %s not found", in.AccountName)
		logrus.Errorf("UnblockAccount failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "ACCOUNT_NOT_FOUND", err.Error())
	}

	account, err := utils.GetAccountByName(in.AccountName)
	if err != nil {
		logrus.Errorf("BlockAccount query account %s failed: %v", in.AccountName, err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	if account.Blocked == 0 {
		logrus.Infof("UnblockAccount account %s is already unblocked", in.AccountName)
		return &pb.UnblockAccountResponse{}, nil
	}

	if err = utils.UnblockAccount(in.AccountName); err != nil {
		logrus.Errorf("UnblockAccount: account %v failed: %v", in.AccountName, err)
		return nil, ce.RichError(codes.Internal, "BLOCK_ACCOUNT_FAILED", err.Error())
	}
	logrus.Infof("UnblockAccount: blocked account %v success", in.AccountName)
	return &pb.UnblockAccountResponse{}, nil
}

func (s *ServerAccount) GetAllAccountsWithUsers(ctx context.Context, in *pb.GetAllAccountsWithUsersRequest) (*pb.GetAllAccountsWithUsersResponse, error) {
	var acctInfo []*pb.ClusterAccountInfo

	logrus.Infof("Received request GetAllAccountsWithUsers: %v", in)

	accounts, err := utils.GetAccounts()
	if err != nil {
		logrus.Errorf("GetAllAccountsWithUsers: get all accounts failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	for _, account := range accounts {
		var (
			blockedAcctBool bool
			userInfo        []*pb.ClusterAccountInfo_UserInAccount
		)
		if account.Blocked == 0 {
			blockedAcctBool = false
		} else {
			blockedAcctBool = true
		}

		associate, err := utils.GetAssociateByAccountName(account.Name)
		if err != nil {
			logrus.Errorf("GetAllAccountsWithUsers: get associate by account %v failed: %v", account.Name, err)
			return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
		}
		if associate == nil {
			continue
		}

		for _, users := range *associate {
			var blockedBool bool
			if users.Blocked == 0 {
				blockedBool = false
			} else {
				blockedBool = true
			}
			userInfo = append(userInfo, &pb.ClusterAccountInfo_UserInAccount{
				UserId:   users.User,
				UserName: users.User,
				Blocked:  blockedBool,
			})
		}
		acctInfo = append(acctInfo, &pb.ClusterAccountInfo{
			AccountName: account.Name,
			Users:       userInfo,
			Blocked:     blockedAcctBool,
		})
	}
	logrus.Tracef("GetAllAccountsWithUsers finished, accounts count: %d", len(acctInfo))
	return &pb.GetAllAccountsWithUsersResponse{Accounts: acctInfo}, nil
}

func (s *ServerAccount) QueryAccountBlockStatus(ctx context.Context, in *pb.QueryAccountBlockStatusRequest) (*pb.QueryAccountBlockStatusResponse, error) {
	logrus.Infof("Received request QueryAccountBlockStatus: %v", in)
	// 检查账号是否存在
	exist, err := utils.SelectAccountExists(in.AccountName)
	if err != nil {
		logrus.Errorf("QueryAccountBlockStatus failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("account %s not found", in.AccountName)
		logrus.Errorf("QueryAccountBlockStatus failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "ACCOUNT_NOT_FOUND", err.Error())
	}

	account, err := utils.GetAccountByName(in.AccountName)
	if err != nil {
		logrus.Errorf("QueryAccountBlockStatus query account %s failed: %v", in.AccountName, err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	partitions, err := utils.GetQueueName()
	if err != nil {
		logrus.Errorf("QueryAccountBlockStatus failed: %v", err)
		return nil, ce.RichError(codes.Internal, "GET_PARTITION_FAILED", err.Error())
	}

	accountStatusInPartition := getAccountStatusInPartitions(account.Blocked, account.Partitions, partitions)
	return &pb.QueryAccountBlockStatusResponse{
		Blocked:               isAccountBlocked(account.Blocked),
		AccountBlockedDetails: accountStatusInPartition,
	}, nil
}

func (s *ServerAccount) DeleteAccount(ctx context.Context, in *pb.DeleteAccountRequest) (*pb.DeleteAccountResponse, error) {
	logrus.Infof("Received request DeleteAccount: %v", in)
	// 检查账号是否存在
	exist, err := utils.SelectAccountExists(in.AccountName)
	if err != nil {
		logrus.Errorf("DeleteAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("account %s not found", in.AccountName)
		logrus.Errorf("DeleteAccount failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "ACCOUNT_NOT_FOUND", err.Error())
	}

	// 该账户作业的判断
	unfinishedJobs, err := utils.GetUnfinishedJobsByAccountName(in.AccountName)
	if err != nil {
		logrus.Errorf("DeleteAccount failed: get jobs by account %v failed: %v", in.AccountName, err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	if len(unfinishedJobs) == 0 {
		if err = utils.DeleteAccount(in.AccountName); err != nil {
			logrus.Errorf("DeleteAccount: %v failed: %v", in.AccountName, err)
			return nil, err
		}
		logrus.Infof("Delete Account: %v sucess!", in.AccountName)
		return &pb.DeleteAccountResponse{}, nil
	} else {
		err = fmt.Errorf("exist running jobs")
		logrus.Errorf("DeleteAccount failed: %v", err)
		return nil, err
	}
}

func (s *ServerAccount) BlockAccountWithPartitions(ctx context.Context, in *pb.BlockAccountWithPartitionsRequest) (*pb.BlockAccountWithPartitionsResponse, error) {
	s.muBlock.Lock()
	defer s.muBlock.Unlock()
	logrus.Infof("Received request BlockAccountWithPartitions: %v", in)

	if len(in.BlockedPartitions) == 0 {
		return &pb.BlockAccountWithPartitionsResponse{}, nil
	}

	// 检查账号名是否存在
	exist, err := utils.SelectAccountExists(in.AccountName)
	if err != nil {
		logrus.Errorf("BlockAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("account %s not found", in.AccountName)
		logrus.Errorf("BlockAccount failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "ACCOUNT_NOT_FOUND", err.Error())
	}

	account, err := utils.GetAccountByName(in.AccountName)
	if err != nil {
		logrus.Errorf("BlockAccount query account %s failed: %v", in.AccountName, err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	if account.Partitions == "" {
		logrus.Infof("BlockAccount account %s has no authorized partitions", in.AccountName)
		return &pb.BlockAccountWithPartitionsResponse{}, nil
	}

	// 账户本身的分区减去需要封锁的分区，得到的分区重新赋值给账户就代表需要封封的分区被封锁了
	accountPartitions := utils.ExcludeBlockedPartitions(account.Partitions, in.BlockedPartitions)
	if accountPartitions == account.Partitions {
		return &pb.BlockAccountWithPartitionsResponse{}, nil
	}

	if err = utils.UpdateAccountPartitions(in.AccountName, accountPartitions); err != nil {
		logrus.Errorf("BlockAccount: account %v failed: %v", in.AccountName, err)
		return nil, ce.RichError(codes.Internal, "BLOCK_ACCOUNT_FAILED", err.Error())
	}
	logrus.Infof("BlockAccount: blocked account %v success", in.AccountName)

	return &pb.BlockAccountWithPartitionsResponse{}, nil
}

func (s *ServerAccount) UnblockAccountWithPartitions(ctx context.Context, in *pb.UnblockAccountWithPartitionsRequest) (*pb.UnblockAccountWithPartitionsResponse, error) {
	s.muUnBlock.Lock() // 加锁操作
	defer s.muUnBlock.Unlock()
	logrus.Infof("Received request UnblockAccountWithPartitions: %v", in)

	// 检查账号名是否存在
	exist, err := utils.SelectAccountExists(in.AccountName)
	if err != nil {
		logrus.Errorf("UnblockAccountWithPartitions failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("account %s not found", in.AccountName)
		logrus.Errorf("UnblockAccountWithPartitions failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "ACCOUNT_NOT_FOUND", err.Error())
	}

	account, err := utils.GetAccountByName(in.AccountName)
	if err != nil {
		logrus.Errorf("BlockAccount query account %s failed: %v", in.AccountName, err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	// 账户本来的分区去重加上需要解封的分区，得到的分区重新赋值给账户就代表需要解封的分区被解封了
	accountPartitions := utils.IncludeUnblockedPartitions(account.Partitions, in.UnblockedPartitions)
	partitionsChanged := accountPartitions != account.Partitions
	if !partitionsChanged && account.Blocked == 0 {
		return &pb.UnblockAccountWithPartitionsResponse{}, nil
	}

	if account.Blocked != 0 {
		// SCOW 只会在账户应处于解封态时调用分区解封接口。
		// 分区授权和账户整体封锁是两套状态；即使目标分区已在授权列表中，
		// 也需要先清除整体 blocked 状态，否则账户仍然无法提交作业。
		if err = utils.UnblockAccount(in.AccountName); err != nil {
			logrus.Errorf("UnblockAccountWithPartitions: unblock account %v failed: %v", in.AccountName, err)
			return nil, ce.RichError(codes.Internal, "BLOCK_ACCOUNT_FAILED", err.Error())
		}
	}

	if partitionsChanged {
		if err = utils.UpdateAccountPartitions(in.AccountName, accountPartitions); err != nil {
			logrus.Errorf("UnblockAccountWithPartitions: account %v failed: %v", in.AccountName, err)
			return nil, ce.RichError(codes.Internal, "BLOCK_ACCOUNT_FAILED", err.Error())
		}
	}
	logrus.Infof("UnblockAccountWithPartitions: unblocked account %v success in partitions", in.AccountName)
	return &pb.UnblockAccountWithPartitionsResponse{}, nil
}

func (s *ServerAccount) QueryAccountBlockStatusWithPartitions(ctx context.Context, in *pb.QueryAccountBlockStatusWithPartitionsRequest) (*pb.QueryAccountBlockStatusWithPartitionsResponse, error) {
	logrus.Infof("Received request QueryAccountBlockStatusWithPartitions: %v", in)
	var (
		queriedPartitions        []string
		accountStatusInPartition []*pb.AccountStatusInPartition
	)

	// 检查账号是否存在
	exist, err := utils.SelectAccountExists(in.AccountName)
	if err != nil {
		logrus.Errorf("QueryAccountBlockStatusWithPartitions failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("account %s not found", in.AccountName)
		logrus.Errorf("QueryAccountBlockStatusWithPartitions failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "ACCOUNT_NOT_FOUND", err.Error())
	}

	account, err := utils.GetAccountByName(in.AccountName)
	if err != nil {
		logrus.Errorf("QueryAccountBlockStatusWithPartitions query account %s failed: %v", in.AccountName, err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	partitions, err := utils.GetQueueName()
	if err != nil {
		logrus.Errorf("QueryAccountBlockStatusWithPartitions failed: %v", err)
		return nil, ce.RichError(codes.Internal, "GET_PARTITION_FAILED", err.Error())
	}

	// 获取计算分区信息
	if len(in.QueriedPartitions) == 0 {
		queriedPartitions = partitions
	} else {
		queriedPartitions = in.QueriedPartitions
	}

	accountStatusInPartition = getAccountStatusInPartitions(account.Blocked, account.Partitions, queriedPartitions)
	return &pb.QueryAccountBlockStatusWithPartitionsResponse{
		Blocked:               isAccountBlocked(account.Blocked),
		AccountBlockedDetails: accountStatusInPartition,
	}, nil
}

func (s *ServerAccount) GetAllAccountsWithUsersAndBlockedDetails(ctx context.Context, in *pb.GetAllAccountsWithUsersAndBlockedDetailsRequest) (*pb.GetAllAccountsWithUsersAndBlockedDetailsResponse, error) {
	logrus.Infof("Received request GetAllAccountsWithUsersAndBlockedDetails: %v", in)
	var acctInfo []*pb.ClusterAccountInfoWithBlockedDetails
	accounts, err := utils.GetAccounts()
	if err != nil {
		logrus.Errorf("GetAllAccountsWithUsersAndBlockedDetails: get all accounts failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	partitions, err := utils.GetQueueName()
	if err != nil {
		logrus.Errorf("GetAllAccountsWithUsersAndBlockedDetails get partitions failed: %v", err)
		return nil, ce.RichError(codes.Internal, "GET_PARTITIONS_FAILED", err.Error())
	}

	for _, account := range accounts {
		var (
			userInfo                 []*pb.ClusterAccountInfoWithBlockedDetails_UserInAccount
			accountStatusInPartition []*pb.AccountStatusInPartition
		)

		associate, err := utils.GetAssociateByAccountName(account.Name)
		if err != nil {
			logrus.Errorf("GetAllAccountsWithUsers: get associate by account %v failed: %v", account.Name, err)
			return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
		}
		if associate != nil {
			for _, users := range *associate {
				var blockedBool bool
				if users.Blocked == 0 {
					blockedBool = false
				} else {
					blockedBool = true
				}
				userInfo = append(userInfo, &pb.ClusterAccountInfoWithBlockedDetails_UserInAccount{
					UserId:   users.User,
					UserName: users.User,
					Blocked:  blockedBool,
				})
			}
		}

		accountStatusInPartition = getAccountStatusInPartitions(account.Blocked, account.Partitions, partitions)
		acctInfo = append(acctInfo, &pb.ClusterAccountInfoWithBlockedDetails{
			AccountName:           account.Name,
			Users:                 userInfo,
			Blocked:               isAccountBlocked(account.Blocked),
			AccountBlockedDetails: accountStatusInPartition,
		})
	}
	logrus.Tracef("GetAllAccountsWithUsersAndBlockedDetails finished, accounts count: %d", len(acctInfo))
	return &pb.GetAllAccountsWithUsersAndBlockedDetailsResponse{Accounts: acctInfo}, nil
}

func (s *ServerAccount) SyncAccountUserInfo(ctx context.Context, in *pb.SyncAccountUserInfoRequest) (*pb.SyncAccountUserInfoResponse, error) {
	var syncResults []*pb.SyncAccountUserInfoResponse_SyncOperationResult
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

	return &pb.SyncAccountUserInfoResponse{SyncResults: syncResults, CompletelyExecuted: isCompleted}, nil
}
