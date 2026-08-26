package account

import (
	"context"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/common/accountsync"
	ce "scow-adapters/pkg/common/error"
	sau "scow-adapters/pkg/slurm/services/account/sync_account_user"
	"scow-adapters/pkg/slurm/utils"
)

type ServerAccount struct {
	pb.UnimplementedAccountServiceServer
}

func (s *ServerAccount) ListAccounts(ctx context.Context, in *pb.ListAccountsRequest) (*pb.ListAccountsResponse, error) {
	logrus.Tracef("Received request ListAccounts: %v", in)
	// 检查用户名中是否包含大写字母
	if err := utils.CheckUser(in.UserId); err != nil {
		logrus.Errorf("ListAccounts failed: %v", err)
		return nil, ce.RichError(codes.Internal, "USER_CONTAIN_ILLEGAL_CHARACTERS", err.Error())
	}

	// 判断用户在slurm中是否存在
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
	acctList, err := utils.GetAccountsAssocWithUserInDatabase(in.UserId)
	if err != nil {
		logrus.Errorf("ListAccounts failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	logrus.Tracef("ListAccounts finished, user: %s, accounts count: %d", in.UserId, len(acctList))
	return &pb.ListAccountsResponse{Accounts: acctList}, nil
}

func (s *ServerAccount) CreateAccount(ctx context.Context, in *pb.CreateAccountRequest) (*pb.CreateAccountResponse, error) {
	logrus.Tracef("Received request CreateAccount: %v", in)
	// 创建账户会新增 association 并初始化封锁状态，必须与同账户的同步和封锁操作串行。
	unlock, err := utils.LockAccountAssociationMutation(ctx, in.AccountName)
	if err != nil {
		return nil, status.FromContextError(err).Err()
	}
	defer unlock()
	// 检查账户名、用户名是否包含大写字母
	if err := utils.CheckAccount(in.AccountName); err != nil {
		logrus.Errorf("CreateAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "ACCOUNT_CONTAIN_ILLEGAL_CHARACTERS", err.Error())
	}
	if err := utils.CheckUser(in.OwnerUserId); err != nil {
		logrus.Errorf("CreateAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "USER_CONTAIN_ILLEGAL_CHARACTERS", err.Error())
	}

	// 检查账户是否在slurm中
	exist, err := utils.SelectAccountExists(in.AccountName)
	if err != nil {
		logrus.Errorf("CreateAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if exist { // 存在直接返回
		err = fmt.Errorf("CreateAccount failed: account %s is already exists", in.AccountName)
		logrus.Errorf("CreateAccount failed: %v", err)
		return nil, ce.RichError(codes.AlreadyExists, "ACCOUNT_ALREADY_EXISTS", err.Error())
	}

	// 不存在则开始创建账户
	// authorizedPartitions 是账户有权查看和使用的分区。为方便以后调整权限，Slurm 中仍为账户创建所有分区的 association。
	// account_blocked=true 只通过 Grp* 禁止提交和运行作业，不会删除账户已有的分区权限。
	allPartitions, err := utils.GetPartitionsName()
	if err != nil {
		logrus.Errorf("CreateAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}
	if len(allPartitions) == 0 {
		err = fmt.Errorf("no partitions found")
		logrus.Errorf("CreateAccount failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "PARTITION_NOT_FOUND", err.Error())
	}
	openPartitions := allPartitions
	useAllPartitions := false
	switch partitionStrategy := in.PartitionStrategy.(type) {
	case *pb.CreateAccountRequest_AuthorizedPartitions_:
		openPartitions = nil
		if partitionStrategy.AuthorizedPartitions != nil {
			openPartitions = partitionStrategy.AuthorizedPartitions.Partitions
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
		openPartitions = allPartitions
	}
	qosList, err := utils.GetQosList()
	if err != nil {
		logrus.Errorf("CreateAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	rb := func(cause error) error {
		// 原请求可能已经超时；回滚脱离请求取消，但底层命令仍受服务端最大时限保护。
		if rollbackErr := utils.DeleteAccount(context.WithoutCancel(ctx), in.AccountName); rollbackErr != nil {
			logrus.Errorf("CreateAccount rollback failed: %v, account is: %v", rollbackErr, in.AccountName)
			return cause
		}
		// 创建账户后任一步骤失败并删除账户时，同时清理账户和用户封锁恢复记录，
		// 防止将失败创建产生的状态带到以后重建的同名账户。
		if cleanupErr := utils.DeleteAccountBlockRecords(in.AccountName); cleanupErr != nil {
			logrus.Errorf("CreateAccount rollback cleanup block records failed: %v, account is: %v", cleanupErr, in.AccountName)
		}
		return cause
	}

	// 创建账户
	if err := utils.CreateAccount(ctx, in.AccountName); err != nil {
		logrus.Errorf("CreateAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}

	// 创建用户及修改用户qos
	baseQos := strings.Join(qosList, ",")
	if err = utils.AddUserToAccount(ctx, in.OwnerUserId, in.AccountName, baseQos, allPartitions, openPartitions); err != nil {
		err = rb(err)
		logrus.Errorf("CreateAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}

	if in.AccountBlocked {
		// 整体封锁写账户父 association；已有分区封锁仍保留在叶子 association，二者可以叠加。
		if err = utils.BlockWholeAccountUseAssociation(ctx, in.AccountName); err != nil {
			err = rb(err)
			logrus.Errorf("CreateAccount block whole account failed: %v, account is: %v", err, in.AccountName)
			return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
		}
	}

	logrus.Infof("CreateAccount sucess! account is: %v, owerUserId is: %v", in.AccountName, in.OwnerUserId)
	return &pb.CreateAccountResponse{}, nil
}

func (s *ServerAccount) BlockAccount(ctx context.Context, in *pb.BlockAccountRequest) (*pb.BlockAccountResponse, error) {
	logrus.Tracef("Received request BlockAccount: %v", in)
	// 与账户分区封锁和所有账户解封操作共用互斥锁，保证恢复记录与 Slurm 修改顺序一致。
	unlock, err := utils.LockAccountAssociationMutation(ctx, in.AccountName)
	if err != nil {
		return nil, status.FromContextError(err).Err()
	}
	defer unlock()
	// 检查账户名中是否包含大写字母
	if err := utils.CheckAccount(in.AccountName); err != nil {
		logrus.Errorf("BlockAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "ACCOUNT_CONTAIN_ILLEGAL_CHARACTERS", err.Error())
	}

	// 检查账户是否在slurm中
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

	// 整体账户封锁直接作用于账户父 association，无需枚举当前用户和分区。
	if err = utils.BlockWholeAccountUseAssociation(ctx, in.AccountName); err != nil {
		logrus.Errorf("BlockAccount failed: %v, account is: %v", err, in.AccountName)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}
	logrus.Infof("BlockAccount success! account is: %v", in.AccountName)

	return &pb.BlockAccountResponse{}, nil
}

func (s *ServerAccount) UnblockAccount(ctx context.Context, in *pb.UnblockAccountRequest) (*pb.UnblockAccountResponse, error) {
	logrus.Tracef("Received request UnblockAccount: %v", in)
	// 封锁和解封使用同一把锁，避免两个请求同时读取并删除同一组原值记录。
	unlock, err := utils.LockAccountAssociationMutation(ctx, in.AccountName)
	if err != nil {
		return nil, status.FromContextError(err).Err()
	}
	defer unlock()
	// 检查账户名中是否包含大写字母
	if err := utils.CheckAccount(in.AccountName); err != nil {
		logrus.Errorf("UnblockAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "ACCOUNT_CONTAIN_ILLEGAL_CHARACTERS", err.Error())
	}
	// 检查账户名是否在slurm中
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

	wholeBlockRecorded, err := utils.IsWholeAccountBlockRecorded(in.AccountName)
	if err != nil {
		logrus.Errorf("UnblockAccount get account block status failed: %v, account is: %v", err, in.AccountName)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	parentBlocked, parentHasBlockLimit, _, err := utils.GetAccountGroupBlockState(in.AccountName)
	if err != nil {
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if wholeBlockRecorded || parentBlocked || parentHasBlockLimit {
		// 新版整体账户封锁只需恢复账户父 association，不触碰独立的分区或用户封锁。
		if err = utils.UnblockWholeAccountUseAssociation(ctx, in.AccountName); err != nil {
			logrus.Errorf("UnblockAccount failed: %v, account is: %v", err, in.AccountName)
			return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
		}
		logrus.Infof("UnblockAccount sucess! account is: %v", in.AccountName)
		return &pb.UnblockAccountResponse{}, nil
	}

	// 兼容旧版迁移后按分区保存的“整个账户封锁”。
	blockedPartitions, err := utils.GetAccountAssociatedBlockedPartitionInDatabase(in.AccountName)
	if err != nil {
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	// Slurm 无法把多个分区的解封包装成一个事务。记录本次已经解封成功的分区，
	// 后续分区失败时重新封锁，避免接口返回失败但部分分区已经实际解封。
	successPartitions := make([]string, 0, len(blockedPartitions))
	for _, p := range blockedPartitions {
		err = utils.UnblockAccountUseAssociation(ctx, in.AccountName, p)
		if err != nil {
			// 当前分区也需要补偿：UnblockAccountUseAssociation 可能已经恢复了 Slurm，
			// 只是在删除恢复记录时失败。重新封锁是幂等操作，也能覆盖这种部分执行。
			rollbackPartitions := make([]string, 0, len(successPartitions)+1)
			rollbackPartitions = append(rollbackPartitions, successPartitions...)
			rollbackPartitions = append(rollbackPartitions, p)
			err = rollbackAccountPartitions(
				ctx,
				in.AccountName,
				rollbackPartitions,
				utils.BlockAccountUseAssociation,
				"UnblockAccount",
				"block",
				err,
			)
			logrus.Errorf("UnblockAccount failed, account is: %v, failed partition: %v, rollback partitions: %v, err: %v", in.AccountName, p, rollbackPartitions, err)
			return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
		}
		successPartitions = append(successPartitions, p)
	}
	logrus.Infof("UnblockAccount success, account is: %v, partitions: %v", in.AccountName, successPartitions)

	return &pb.UnblockAccountResponse{}, nil
}

func (s *ServerAccount) GetAllAccountsWithUsers(ctx context.Context, in *pb.GetAllAccountsWithUsersRequest) (*pb.GetAllAccountsWithUsersResponse, error) {
	logrus.Tracef("Received request GetAllAccountsWithUsers: %v", in)

	var acctInfo []*pb.ClusterAccountInfo
	// 1. 从数据库获取系统中所有账户信息
	acctList, err := utils.GetAllAccountInDatabase()
	if err != nil {
		logrus.Errorf("GetAllAccountsWithUsers failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	// 2. 获取账户拥有的用户及该用户的封锁信息
	acctAndUsersBlockInfo, err := utils.GetAcctAndUsersBlockedInfo()
	if err != nil {
		logrus.Errorf("GetAllAccountsWithUsers failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	logrus.Tracef("GetAllAccountsWithUsers loaded account users, accounts count: %d", len(acctAndUsersBlockInfo))

	// 3. 获取账户的授权分区
	accountPartitionBlockInfo, err := utils.GetAccountAllowedPartitionByAssociation()
	if err != nil {
		logrus.Errorf("GetAllAccountsWithUsers get account associate partition failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	logrus.Tracef("GetAllAccountsWithUsers loaded partition block info, accounts count: %d", len(accountPartitionBlockInfo))

	// 4. 获取每个账户及关联的用户的封锁信息
	for _, v := range acctList {
		// root为Slurm账户层级的根节点，不作为可导入的业务账户返回
		if v == "root" {
			continue
		}

		var userInfo []*pb.ClusterAccountInfo_UserInAccount
		// 该账户在assoc_table中没有数据
		usersBlockInfo, ok := acctAndUsersBlockInfo[v]
		if !ok {
			logrus.Warnf("GetAllAccountsWithUsersAndBlockedDetails Invalid account: %v", v)
			continue
		}

		// 4.1 获取每个账户关联的用户信息以及用户的block状态
		logrus.Tracef("GetAllAccountsWithUsers processing account %s, users count: %d", v, len(usersBlockInfo))
		for user, blocked := range usersBlockInfo {
			userInfo = append(userInfo, &pb.ClusterAccountInfo_UserInAccount{
				UserId:   user,
				UserName: user,
				Blocked:  blocked,
			})
		}

		// 4.2 有整体欠费记录时账户被封锁；否则，关联了具体分区但没有任何可用分区时也视为封锁。
		blocked := true
		if blockInfo, exists := accountPartitionBlockInfo[v]; exists {
			blocked = blockInfo.WholeAccountBlocked
			if blockInfo.HasPartition && !blocked {
				blocked = len(blockInfo.AllowedPartitions) == 0
			}
		}

		if !blocked {
			acctInfo = append(acctInfo, &pb.ClusterAccountInfo{
				AccountName: v,
				Users:       userInfo,
				Blocked:     false,
			})
		} else {
			acctInfo = append(acctInfo, &pb.ClusterAccountInfo{
				AccountName: v,
				Users:       userInfo,
				Blocked:     true,
			})
		}
	}

	logrus.Tracef("GetAllAccountsWithUsers finished, accounts count: %d", len(acctInfo))
	return &pb.GetAllAccountsWithUsersResponse{Accounts: acctInfo}, nil
}

func (s *ServerAccount) QueryAccountBlockStatus(ctx context.Context, in *pb.QueryAccountBlockStatusRequest) (*pb.QueryAccountBlockStatusResponse, error) {
	logrus.Tracef("Received request QueryAccountBlockStatus: %v", in)

	// 检查账户名中是否包含大写字母
	if err := utils.CheckAccount(in.AccountName); err != nil {
		logrus.Errorf("QueryAccountBlockStatus failed: %v", err)
		return nil, ce.RichError(codes.Internal, "ACCOUNT_CONTAIN_ILLEGAL_CHARACTERS", err.Error())
	}

	// 检查账户名是否在slurm中
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

	// 获取集群所有分区
	partitions, err := utils.GetPartitionsName()
	if err != nil {
		logrus.Errorf("QueryAccountBlockStatus get partitions failed: %v", err)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}

	// 获取账户的授权分区
	allowPartitions, err := utils.GetAccountAssociatedAllowedPartitionInDatabase(in.AccountName)
	if err != nil {
		logrus.Errorf("QueryAccountBlockStatus get account associated partition failed: %v, account is: %v", err, in.AccountName)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	var accountStatusInPartition []*pb.AccountStatusInPartition
	for _, partition := range partitions {
		if slices.Contains(allowPartitions, partition) {
			accountStatusInPartition = append(accountStatusInPartition, &pb.AccountStatusInPartition{
				Blocked:   false,
				Partition: partition,
			})
		} else {
			accountStatusInPartition = append(accountStatusInPartition, &pb.AccountStatusInPartition{
				Blocked:   true,
				Partition: partition,
			})
		}
	}

	// 该账户在每个所属的分区中都被blocked
	if len(allowPartitions) == 0 {
		return &pb.QueryAccountBlockStatusResponse{Blocked: true, AccountBlockedDetails: accountStatusInPartition}, nil
	} else {
		return &pb.QueryAccountBlockStatusResponse{Blocked: false, AccountBlockedDetails: accountStatusInPartition}, nil
	}
}

// DeleteAccount 删除账户
func (s *ServerAccount) DeleteAccount(ctx context.Context, in *pb.DeleteAccountRequest) (*pb.DeleteAccountResponse, error) {
	logrus.Tracef("Received request DeleteAccount: %v", in)
	// 删除账户会同时删除 association 和封锁恢复记录，不能与同账户的同步操作并发。
	unlock, err := utils.LockAccountAssociationMutation(ctx, in.AccountName)
	if err != nil {
		return nil, status.FromContextError(err).Err()
	}
	defer unlock()
	// 检查账户名是否在slurm中
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

	// 作业的判断
	runningJobs, err := utils.GetJobsInAccount(in.AccountName)
	if err != nil {
		logrus.Errorf("DeleteAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}

	if runningJobs == 0 {
		// 可以删账户
		if err = utils.DeleteAccount(ctx, in.AccountName); err != nil {
			logrus.Errorf("DeleteAccount failed: %v", err)
			return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
		}
		if err := utils.DeleteAccountBlockRecords(in.AccountName); err != nil {
			// Slurm 账户已经删除，恢复记录不再有目标；清理失败仅告警，避免掩盖删除成功结果。
			logrus.Warnf("DeleteAccount cleanup block records failed: %v, account is: %v", err, in.AccountName)
		}
		logrus.Infof("DeleteAccount sucess! account is: %v", in.AccountName)
		return &pb.DeleteAccountResponse{}, nil
	} else {
		err = fmt.Errorf("exist running jobs")
		logrus.Errorf("DeleteAccount failed: %v", err)
		return nil, ce.RichError(codes.AlreadyExists, "HAVE_RUNNING_JOBS", err.Error())
	}
}

func (s *ServerAccount) BlockAccountWithPartitions(ctx context.Context, in *pb.BlockAccountWithPartitionsRequest) (*pb.BlockAccountWithPartitionsResponse, error) {
	logrus.Tracef("Received request BlockAccountWithPartitions: %v", in)

	if len(in.BlockedPartitions) == 0 {
		return &pb.BlockAccountWithPartitionsResponse{}, nil
	}

	// 与整体账户封锁、解封串行，避免它们同时修改同一账户的状态和恢复记录。
	unlock, err := utils.LockAccountAssociationMutation(ctx, in.AccountName)
	if err != nil {
		return nil, status.FromContextError(err).Err()
	}
	defer unlock()
	// 检查账户名中是否包含大写字母
	if err := utils.CheckAccount(in.AccountName); err != nil {
		logrus.Errorf("BlockAccountWithPartitions failed: %v", err)
		return nil, ce.RichError(codes.Internal, "ACCOUNT_CONTAIN_ILLEGAL_CHARACTERS", err.Error())
	}

	// 检查账户是否在slurm中
	exist, err := utils.SelectAccountExists(in.AccountName)
	if err != nil {
		logrus.Errorf("BlockAccountWithPartitions failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("account %s not found", in.AccountName)
		logrus.Errorf("BlockAccountWithPartitions failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "ACCOUNT_NOT_FOUND", err.Error())
	}

	// 先确保所有目标分区上的用户关联都存在，再开始修改 Slurm 封锁状态。
	// 这样如果某个分区无法补齐 association，请求会在真正封锁前失败，避免只封锁前几个分区后中断。
	if err := ensureAccountUsersAssociationInPartitions(ctx, in.AccountName, in.BlockedPartitions, true, "BlockAccountWithPartitions"); err != nil {
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}

	// 记录本次请求中已经封锁成功的分区。
	// 后续分区如果失败，会用这个列表执行反向解封补偿，尽量把 Slurm 状态恢复到请求前。
	successPartitions := make([]string, 0, len(in.BlockedPartitions))
	for _, p := range in.BlockedPartitions {
		err = utils.BlockAccountUseAssociation(ctx, in.AccountName, p)
		if err != nil {
			// 多分区封锁不是 Slurm 事务。这里对已经封锁成功的分区执行反向解封，
			// 避免接口整体失败时 SCOW 侧认为没有封锁，但 Slurm 侧已经封锁了部分分区。
			err = rollbackAccountPartitions(
				ctx,
				in.AccountName,
				successPartitions,
				utils.UnblockAccountUseAssociation,
				"BlockAccountWithPartitions",
				"unblock",
				err,
			)
			logrus.Errorf("BlockAccountWithPartitions failed, account is: %v, failed partition: %v, rollback partitions: %v, err: %v", in.AccountName, p, successPartitions, err)
			return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
		}
		successPartitions = append(successPartitions, p)
	}
	logrus.Infof("BlockAccountWithPartitions success, account is: %v, partitions: %v", in.AccountName, successPartitions)

	return &pb.BlockAccountWithPartitionsResponse{}, nil
}

func (s *ServerAccount) UnblockAccountWithPartitions(ctx context.Context, in *pb.UnblockAccountWithPartitionsRequest) (*pb.UnblockAccountWithPartitionsResponse, error) {
	logrus.Tracef("Received request UnblockAccountWithPartitions: %v", in)

	// 与封锁操作共用互斥锁，保证读取原值、恢复 Slurm、删除记录三个阶段不被打断。
	unlock, err := utils.LockAccountAssociationMutation(ctx, in.AccountName)
	if err != nil {
		return nil, status.FromContextError(err).Err()
	}
	defer unlock()

	// 检查账户名中是否包含大写字母
	if err := utils.CheckAccount(in.AccountName); err != nil {
		logrus.Errorf("UnblockAccountWithPartitions failed: %v", err)
		return nil, ce.RichError(codes.Internal, "ACCOUNT_CONTAIN_ILLEGAL_CHARACTERS", err.Error())
	}

	// 检查账户是否在slurm中
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

	// 资源管理模式下，MIS 通过本接口同时表达两层语义：
	//   1. 账户已不再欠费，需要解除账户父 association 上的整体封锁；
	//   2. unblockedPartitions 中的授权分区需要解除各用户 association 上的分区封锁。
	// 因此即使 unblockedPartitions 为空，也必须恢复整体账户封锁，不能直接返回。
	wholeBlockRecorded, err := utils.IsWholeAccountBlockRecorded(in.AccountName)
	if err != nil {
		logrus.Errorf("UnblockAccountWithPartitions get whole account block status failed: %v, account is: %v", err, in.AccountName)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	// 必须在解除父级欠费封锁之前完成 association 预检查。否则预检查失败时接口虽然返回失败，
	// 账户父 association 却已经解封，调用方看到的结果会与 Slurm 实际状态不一致。
	if len(in.UnblockedPartitions) > 0 {
		if err := ensureAccountUsersAssociationInPartitions(ctx, in.AccountName, in.UnblockedPartitions, false, "UnblockAccountWithPartitions"); err != nil {
			return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
		}
	}

	parentBlocked, parentHasBlockLimit, _, err := utils.GetAccountGroupBlockState(in.AccountName)
	if err != nil {
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	wholeAccountUnblocked := false
	if wholeBlockRecorded || parentBlocked || parentHasBlockLimit {
		if err := utils.UnblockWholeAccountUseAssociation(ctx, in.AccountName); err != nil {
			logrus.Errorf("UnblockAccountWithPartitions unblock whole account failed: %v, account is: %v", err, in.AccountName)
			return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
		}
		wholeAccountUnblocked = true
	}

	if len(in.UnblockedPartitions) == 0 {
		return &pb.UnblockAccountWithPartitionsResponse{}, nil
	}

	// 记录本次请求中已经解封成功的分区。
	// 后续分区如果失败，会用这个列表执行反向封锁补偿，尽量把 Slurm 状态恢复到请求前。
	successPartitions := make([]string, 0, len(in.UnblockedPartitions))
	for _, p := range in.UnblockedPartitions {
		err = utils.UnblockAccountUseAssociation(ctx, in.AccountName, p)
		if err != nil {
			err = rollbackWholeAccountAndPartitions(
				ctx,
				in.AccountName,
				successPartitions,
				wholeAccountUnblocked,
				utils.BlockWholeAccountUseAssociation,
				utils.BlockAccountUseAssociation,
				err,
			)
			logrus.Errorf("UnblockAccountWithPartitions failed, account is: %v, failed partition: %v, rollback partitions: %v, err: %v", in.AccountName, p, successPartitions, err)
			return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
		}
		successPartitions = append(successPartitions, p)
	}
	logrus.Infof("UnblockAccountWithPartitions success, account is: %v, partitions: %v", in.AccountName, successPartitions)

	return &pb.UnblockAccountWithPartitionsResponse{}, nil
}

// ensureAccountUsersAssociationInPartitions 是多分区封锁/解封前的预检查。
// BlockAccountUseAssociation 和 UnblockAccountUseAssociation 都依赖账户用户在目标分区下已有 association；
// 如果边执行边补齐 association，某个分区失败时前面分区可能已经被封锁或解封。
// 因此这里先把所有分区的 association 准备好，任何一个分区失败都直接返回，不进入后续状态修改阶段。
func ensureAccountUsersAssociationInPartitions(ctx context.Context, account string, partitions []string, blocked bool, operation string) error {
	for _, partition := range partitions {
		if err := utils.EnsureAccountUsersAssociationInPartition(ctx, account, partition, blocked); err != nil {
			logrus.Errorf("%s ensure association failed: %v, account is: %v, partition is: %v", operation, err, account, partition)
			return fmt.Errorf("%s ensure association failed in partition %s: %w", operation, partition, err)
		}
	}

	return nil
}

// rollbackAccountPartitions 对已经成功修改的分区执行反向补偿。
// Slurm 的 sacctmgr 命令没有把多个分区封锁/解封包装成一个事务的能力：
//   - 如果封锁第 1 个分区成功、第 2 个分区失败，第 1 个分区不会自动回滚；
//   - 如果直接向调用方返回失败，SCOW 侧通常会认为本次请求整体未生效，从而和 Slurm 实际状态不一致。
//
// 调用方在执行多分区操作时会把已成功的分区传进来，本函数逐个执行反向操作。
// rollback 参数由调用方指定：
//   - 封锁失败时传 UnblockAccountUseAssociation；
//   - 解封失败时传 BlockAccountUseAssociation。
//
// 如果补偿也失败，返回值会同时包含原始错误和补偿失败分区，方便排查仍可能残留的不一致状态。
func rollbackAccountPartitions(
	ctx context.Context,
	account string,
	partitions []string,
	rollback func(context.Context, string, string) error,
	operation string,
	rollbackAction string,
	originalErr error,
) error {
	if len(partitions) == 0 {
		return originalErr
	}

	// 请求失败时 ctx 可能已经取消；补偿需要继续执行，但每条外部命令仍有服务端最大时限。
	rollbackCtx := context.WithoutCancel(ctx)
	var rollbackErrors []string
	for _, partition := range partitions {
		if err := rollback(rollbackCtx, account, partition); err != nil {
			rollbackErrors = append(rollbackErrors, fmt.Sprintf("%s: %v", partition, err))
		}
	}

	if len(rollbackErrors) > 0 {
		return fmt.Errorf("%w; rollback %s failed in partitions: %s", originalErr, rollbackAction, strings.Join(rollbackErrors, "; "))
	}

	return originalErr
}

// rollbackWholeAccountAndPartitions 补偿 UnblockAccountWithPartitions 已经完成的修改。
// 父级欠费封锁覆盖整个账户，因此优先恢复父级，再恢复已经解封的分区；即使父级恢复失败，
// 分区补偿仍继续执行，尽可能减少请求失败后残留的不一致状态。
func rollbackWholeAccountAndPartitions(
	ctx context.Context,
	account string,
	partitions []string,
	wholeAccountUnblocked bool,
	rollbackWhole func(context.Context, string) error,
	rollbackPartition func(context.Context, string, string) error,
	originalErr error,
) error {
	rollbackCtx := context.WithoutCancel(ctx)
	var wholeAccountRollbackErr error
	if wholeAccountUnblocked {
		wholeAccountRollbackErr = rollbackWhole(rollbackCtx, account)
		if wholeAccountRollbackErr != nil {
			logrus.Errorf("UnblockAccountWithPartitions rollback whole account block failed: %v, account is: %v", wholeAccountRollbackErr, account)
		} else {
			logrus.Infof("UnblockAccountWithPartitions rollback whole account block success, account is: %v", account)
		}
	}

	err := rollbackAccountPartitions(
		rollbackCtx,
		account,
		partitions,
		rollbackPartition,
		"UnblockAccountWithPartitions",
		"block",
		originalErr,
	)
	if wholeAccountRollbackErr != nil {
		return fmt.Errorf("%w; rollback whole account block failed: %v", err, wholeAccountRollbackErr)
	}
	return err
}

func (s *ServerAccount) QueryAccountBlockStatusWithPartitions(ctx context.Context, in *pb.QueryAccountBlockStatusWithPartitionsRequest) (*pb.QueryAccountBlockStatusWithPartitionsResponse, error) {
	logrus.Tracef("Received request QueryAccountBlockStatusWithPartitions: %v", in)

	var (
		queriedPartitions        []string
		accountStatusInPartition []*pb.AccountStatusInPartition
		accountsBlocked          int
	)
	// 检查账户名中是否包含大写字母
	if err := utils.CheckAccount(in.AccountName); err != nil {
		logrus.Errorf("QueryAccountBlockStatusWithPartitions failed: %v", err)
		return nil, ce.RichError(codes.Internal, "ACCOUNT_CONTAIN_ILLEGAL_CHARACTERS", err.Error())
	}

	// 检查账户是否在slurm中
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

	partitions, err := utils.GetPartitionsName()
	if err != nil {
		logrus.Errorf("QueryAccountBlockStatusWithPartitions get partitions failed: %v", err)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}

	// 获取计算分区信息
	if len(in.QueriedPartitions) == 0 {
		queriedPartitions = partitions
	} else {
		queriedPartitions = in.QueriedPartitions
	}

	// 父 association 表示整体欠费封锁，叶子 association 的 Grp* 表示实际分区权限。
	wholeBlocked, _, _, err := utils.GetAccountGroupBlockState(in.AccountName)
	if err != nil {
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	partitionStates, err := utils.GetAccountPartitionAssociationStates(in.AccountName)
	if err != nil {
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	// SlurmDB 中的分区名大小写可能与 scontrol 不一致，统一用小写比较。
	blockedSet := make(map[string]struct{}, len(partitionStates))
	for partition, state := range partitionStates {
		if state.Blocked {
			blockedSet[strings.ToLower(partition)] = struct{}{}
		}
	}

	// 判断账户在queriedPartitions中是否被block
	for _, p := range queriedPartitions {
		_, partitionBlocked := blockedSet[strings.ToLower(p)]
		if wholeBlocked || partitionBlocked {
			accountsBlocked += 1
			accountStatusInPartition = append(accountStatusInPartition, &pb.AccountStatusInPartition{
				Blocked:   true,
				Partition: p,
			})
		} else {
			accountStatusInPartition = append(accountStatusInPartition, &pb.AccountStatusInPartition{
				Blocked:   false,
				Partition: p,
			})
		}
	}

	logrus.Tracef("QueryAccountBlockStatusWithPartitions account status in partition: %v", accountStatusInPartition)
	// 该账户在每个所属的分区中都被blocked
	if accountsBlocked == len(queriedPartitions) {
		return &pb.QueryAccountBlockStatusWithPartitionsResponse{Blocked: true, AccountBlockedDetails: accountStatusInPartition}, nil
	} else {
		return &pb.QueryAccountBlockStatusWithPartitionsResponse{Blocked: false, AccountBlockedDetails: accountStatusInPartition}, nil
	}
}

func (s *ServerAccount) GetAllAccountsWithUsersAndBlockedDetails(ctx context.Context, in *pb.GetAllAccountsWithUsersAndBlockedDetailsRequest) (*pb.GetAllAccountsWithUsersAndBlockedDetailsResponse, error) {
	logrus.Tracef("Received request GetAllAccountsWithUsersAndBlockedDetails: %v", in)

	var acctInfo []*pb.ClusterAccountInfoWithBlockedDetails
	var accountsWithoutPartitions []string
	// 1. 获取系统中所有账户信息
	acctList, err := utils.GetAllAccountInDatabase()
	if err != nil {
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	// 2. 获取账户拥有的用户及该用户的封锁信息
	acctAndUsersBlockInfo, err := utils.GetAcctAndUsersBlockedInfo()
	if err != nil {
		logrus.Errorf("GetAllAccountsWithUsersAndBlockedDetails failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	// 3. 获取账户的分区
	acctAndPartitions, err := utils.GetAcctPartitionsInfo()
	if err != nil {
		logrus.Errorf("GetAllAccountsWithUsersAndBlockedDetails failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	// 4. 获取账户的授权分区
	accountPartitionBlockInfo, err := utils.GetAccountAllowedPartitionByAssociation()
	if err != nil {
		logrus.Errorf("GetAllAccountsWithUsers get account associate partition failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	logrus.Tracef("GetAllAccountsWithUsers loaded partition block info, accounts count: %d", len(accountPartitionBlockInfo))

	// 6. 获取每个账户及关联的用户的封锁信息
	for _, v := range acctList {
		// root为Slurm账户层级的根节点，不作为可导入的业务账户返回
		if v == "root" {
			continue
		}

		var userInfo []*pb.ClusterAccountInfoWithBlockedDetails_UserInAccount
		// 该账户在assoc_table中没有数据
		usersBlockInfo, ok := acctAndUsersBlockInfo[v]
		if !ok {
			logrus.Warnf("GetAllAccountsWithUsersAndBlockedDetails Invalid account: %v", v)
			continue
		}

		// 4.1 获取每个账户关联的用户信息以及用户的block状态
		logrus.Tracef("GetAllAccountsWithUsers processing account %s, users count: %d", v, len(usersBlockInfo))
		for user, blocked := range usersBlockInfo {
			userInfo = append(userInfo, &pb.ClusterAccountInfoWithBlockedDetails_UserInAccount{
				UserId:   user,
				UserName: user,
				Blocked:  blocked,
			})
		}

		// 4.2 得到账户的分区
		partitions, ok := acctAndPartitions[v]
		if !ok {
			accountsWithoutPartitions = append(accountsWithoutPartitions, v)
			partitions = []string{}
		}

		// 4.3 有整体欠费记录时账户被封锁；否则，关联了具体分区但没有任何可用分区时也视为封锁。
		var allowPartitions []string
		blocked := true
		if blockInfo, exists := accountPartitionBlockInfo[v]; exists {
			allowPartitions = blockInfo.AllowedPartitions
			blocked = blockInfo.WholeAccountBlocked
			if blockInfo.HasPartition && !blocked {
				blocked = len(blockInfo.AllowedPartitions) == 0
			}
		}

		if !blocked {
			accountStatusInPartition := utils.GetAccountPartitionStatus(partitions, allowPartitions)
			acctInfo = append(acctInfo, &pb.ClusterAccountInfoWithBlockedDetails{
				AccountName:           v,
				Users:                 userInfo,
				Blocked:               false,
				AccountBlockedDetails: accountStatusInPartition,
			})
		} else {
			accountStatusInPartition := utils.GetAccountBlockedPartitionStatus(partitions)
			acctInfo = append(acctInfo, &pb.ClusterAccountInfoWithBlockedDetails{
				AccountName:           v,
				Users:                 userInfo,
				Blocked:               true,
				AccountBlockedDetails: accountStatusInPartition,
			})
		}
	}

	if len(accountsWithoutPartitions) > 0 {
		logrus.Warnf(
			"GetAllAccountsWithUsersAndBlockedDetails accounts have users but no non-empty partition association; they will be returned with empty blocked details, accountCount: %v, accounts: %v",
			len(accountsWithoutPartitions),
			accountsWithoutPartitions,
		)
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

		// 同步会创建、删除 association，并修改账户和用户的封锁状态。与所有普通写接口
		// 共用账户级锁，保证读取原值、保存恢复记录、修改 Slurm 的完整流程不被打断。
		unlock, err := utils.LockAccountAssociationMutation(ctx, syncAccount.AccountName)
		if err != nil {
			isCompleted = false
			incompleteReason = fmt.Sprintf("wait for account lock: %v", err)
			break outerLoop
		}
		var accountStats accountsync.Stats
		results := func() []*pb.SyncAccountUserInfoResponse_SyncOperationResult {
			defer unlock()
			var results []*pb.SyncAccountUserInfoResponse_SyncOperationResult
			results, accountStats = sau.SyncAccountUser(ctx, syncAccount)
			return results
		}()
		summary.RecordAccount(results, accountStats)
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
