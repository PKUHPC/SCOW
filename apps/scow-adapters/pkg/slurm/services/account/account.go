package account

import (
	"context"
	"fmt"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc/codes"

	pb "scow-adapters/gen/go"
	ce "scow-adapters/pkg/common/error"
	sau "scow-adapters/pkg/slurm/services/account/sync_account_user"
	"scow-adapters/pkg/slurm/utils"
)

type ServerAccount struct {
	pb.UnimplementedAccountServiceServer
	muBlock   sync.Mutex // Add a Mutex field for locking
	muUnBlock sync.Mutex // Add a Mutex field for locking
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

	logrus.Tracef("List accounts success: %v", &pb.ListAccountsResponse{Accounts: acctList})
	return &pb.ListAccountsResponse{Accounts: acctList}, nil
}

func (s *ServerAccount) CreateAccount(ctx context.Context, in *pb.CreateAccountRequest) (*pb.CreateAccountResponse, error) {
	logrus.Tracef("Received request CreateAccount: %v", in)
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
	// authorizedPartitions 表示账户/资源维度授权分区；Slurm 仍维护全量 association。
	// account_blocked 为 true 时，授权分区仍保留在 SCOW/resource 侧，但新建的物理 association 全部按账户原因封锁。
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
	if in.AccountBlocked {
		// 账户封锁原因单独由 account_blocked 表达；即使存在可使用分区，物理 association 也应全部封锁。
		openPartitions = nil
	}

	qosList, err := utils.GetQosList()
	if err != nil {
		logrus.Errorf("CreateAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	blockedPartitions := make([]string, 0)
	rb := func(cause error) error {
		if rollbackErr := utils.DeleteAccount(in.AccountName); rollbackErr != nil {
			logrus.Errorf("CreateAccount rollback failed: %v, account is: %v", rollbackErr, in.AccountName)
			return cause
		}
		// 分区封锁成功后会持久化原始 MaxSubmitJobs；账户已回滚删除时，这些恢复记录也要清理，避免同名账户重建后读到旧值。
		for _, partition := range blockedPartitions {
			if permissionErr := utils.DeletePermissionRecord(in.AccountName, partition, in.OwnerUserId); permissionErr != nil {
				logrus.Errorf("CreateAccount rollback cleanup permission record failed: %v, owner is: %v, account is: %v, partition is: %v", permissionErr, in.OwnerUserId, in.AccountName, partition)
			}
		}
		return cause
	}

	// 创建账户
	if err := utils.CreateAccount(in.AccountName); err != nil {
		logrus.Errorf("CreateAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}

	// 创建用户及修改用户qos
	baseQos := strings.Join(qosList, ",")
	if err = utils.AddUserToAccount(in.OwnerUserId, in.AccountName, baseQos, allPartitions); err != nil {
		err = rb(err)
		logrus.Errorf("CreateAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}

	for _, partition := range allPartitions {
		if slices.Contains(openPartitions, partition) {
			continue
		}
		if err = utils.BlockUserAssociationInAccountPartitionByAccountState(in.OwnerUserId, in.AccountName, partition); err != nil {
			err = rb(err)
			logrus.Errorf("CreateAccount block partition failed: %v, owner is: %v, account is: %v, partition is: %v", err, in.OwnerUserId, in.AccountName, partition)
			return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
		}
		blockedPartitions = append(blockedPartitions, partition)
	}

	logrus.Infof("CreateAccount sucess! account is: %v, owerUserId is: %v", in.AccountName, in.OwnerUserId)
	return &pb.CreateAccountResponse{}, nil
}

func (s *ServerAccount) BlockAccount(ctx context.Context, in *pb.BlockAccountRequest) (*pb.BlockAccountResponse, error) {
	logrus.Tracef("Received request BlockAccount: %v", in)
	s.muBlock.Lock()
	defer s.muBlock.Unlock()
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

	partitions, err := utils.GetPartitionsName()
	if err != nil {
		logrus.Errorf("BlockAccount get cluster partitions failed: %v, account is: %v", err, in.AccountName)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}
	if err = ensureAccountUsersAssociationInPartitions(in.AccountName, partitions, "BlockAccount"); err != nil {
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}

	// 获取账户的授权分区
	partitions, err = utils.GetAccountAssociatedAllowedPartitionInDatabase(in.AccountName)
	if err != nil {
		logrus.Errorf("BlockAccount get account associated partition failed: %v, account is: %v", err, in.AccountName)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	if len(partitions) == 0 {
		logrus.Infof("BlockAccount: account %v no need block", in.AccountName)
		return &pb.BlockAccountResponse{}, nil
	}

	for _, p := range partitions {
		err = utils.BlockAccountUseAssociation(in.AccountName, p)
		if err != nil {
			logrus.Errorf("BlockAccount failed: %v, account is: %v, partition is: %v", err, in.AccountName, p)
			return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
		}
		logrus.Infof("BlockAccount sucess! account is: %v, partition is: %v", in.AccountName, p)
	}

	return &pb.BlockAccountResponse{}, nil
}

func (s *ServerAccount) UnblockAccount(ctx context.Context, in *pb.UnblockAccountRequest) (*pb.UnblockAccountResponse, error) {
	logrus.Tracef("Received request UnblockAccount: %v", in)
	s.muUnBlock.Lock() // 加锁操作
	defer s.muUnBlock.Unlock()
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

	partitions, err := utils.GetPartitionsName()
	if err != nil {
		logrus.Errorf("UnblockAccount get cluster partitions failed: %v, account is: %v", err, in.AccountName)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}
	if err = ensureAccountUsersAssociationInPartitions(in.AccountName, partitions, "UnblockAccount"); err != nil {
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}

	// 获取账户的已封锁分区
	blockedPartitions, err := utils.GetAccountAssociatedBlockedPartitionInDatabase(in.AccountName)
	if err != nil {
		logrus.Errorf("UnblockAccount get account associated partition failed: %v, account is: %v", err, in.AccountName)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	if len(blockedPartitions) == 0 {
		logrus.Infof("UnblockAccount: account %v no need unblock", in.AccountName)
		return &pb.UnblockAccountResponse{}, nil
	}

	for _, p := range blockedPartitions {
		err = utils.UnblockAccountUseAssociation(in.AccountName, p)
		if err != nil {
			logrus.Errorf("UnblockAccount failed: %v, account is: %v, partition is: %v", err, in.AccountName, p)
			return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
		}
		logrus.Infof("UnblockAccount sucess! account is: %v, partition is: %v", in.AccountName, p)
	}

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
	logrus.Tracef("GetAllAccountsWithUsers acctAndUsers: %v", acctAndUsersBlockInfo)

	// 3. 获取账户的授权分区
	accountPartitionBlockInfo, err := utils.GetAccountAllowedPartitionByAssociation()
	if err != nil {
		logrus.Errorf("GetAllAccountsWithUsers get account associate partition failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	logrus.Tracef("GetAllAccountsWithUsers accountPartitionBlockInfo: %v", accountPartitionBlockInfo)

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
		logrus.Tracef("GetAllAccountsWithUsers account %v acctAndUsers: %v", v, usersBlockInfo)
		for user, blocked := range usersBlockInfo {
			logrus.Tracef("user: %v, blocked: %v", user, blocked)
			userInfo = append(userInfo, &pb.ClusterAccountInfo_UserInAccount{
				UserId:   user,
				UserName: user,
				Blocked:  blocked,
			})
		}

		// 4.2 有具体分区时沿用分区状态；完全没有具体分区时回退到基础 association 的 MaxSubmitJobs。
		blocked := true
		if blockInfo, exists := accountPartitionBlockInfo[v]; exists {
			if blockInfo.HasPartition {
				blocked = len(blockInfo.AllowedPartitions) == 0
			} else {
				blocked = blockInfo.FallbackBlocked
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

	logrus.Tracef("GetAllAccountsWithUsers: %v", acctInfo)
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
		if err = utils.DeleteAccount(in.AccountName); err != nil {
			logrus.Errorf("DeleteAccount failed: %v", err)
			return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
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

	s.muBlock.Lock()
	defer s.muBlock.Unlock()
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
	if err := ensureAccountUsersAssociationInPartitions(in.AccountName, in.BlockedPartitions, "BlockAccountWithPartitions"); err != nil {
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}

	// 记录本次请求中已经封锁成功的分区。
	// 后续分区如果失败，会用这个列表执行反向解封补偿，尽量把 Slurm 状态恢复到请求前。
	successPartitions := make([]string, 0, len(in.BlockedPartitions))
	for _, p := range in.BlockedPartitions {
		err = utils.BlockAccountUseAssociation(in.AccountName, p)
		if err != nil {
			logrus.Errorf("BlockAccountWithPartitions failed: %v, account is: %v, partition is: %v", err, in.AccountName, p)
			// 多分区封锁不是 Slurm 事务。这里对已经封锁成功的分区执行反向解封，
			// 避免接口整体失败时 SCOW 侧认为没有封锁，但 Slurm 侧已经封锁了部分分区。
			err = rollbackAccountPartitions(
				in.AccountName,
				successPartitions,
				utils.UnblockAccountUseAssociation,
				"BlockAccountWithPartitions",
				"unblock",
				err,
			)
			return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
		}
		successPartitions = append(successPartitions, p)
		logrus.Infof("BlockAccountWithPartitions sucess! account is: %v, partition is: %v", in.AccountName, p)
	}

	return &pb.BlockAccountWithPartitionsResponse{}, nil
}

func (s *ServerAccount) UnblockAccountWithPartitions(ctx context.Context, in *pb.UnblockAccountWithPartitionsRequest) (*pb.UnblockAccountWithPartitionsResponse, error) {
	logrus.Tracef("Received request UnblockAccountWithPartitions: %v", in)

	if len(in.UnblockedPartitions) == 0 {
		return &pb.UnblockAccountWithPartitionsResponse{}, nil
	}

	s.muUnBlock.Lock() // 加锁操作
	defer s.muUnBlock.Unlock()

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

	// 先确保所有目标分区上的用户关联都存在，再开始修改 Slurm 解封状态。
	// 这样如果某个分区无法补齐 association，请求会在真正解封前失败，避免只解封前几个分区后中断。
	if err := ensureAccountUsersAssociationInPartitions(in.AccountName, in.UnblockedPartitions, "UnblockAccountWithPartitions"); err != nil {
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}

	// 记录本次请求中已经解封成功的分区。
	// 后续分区如果失败，会用这个列表执行反向封锁补偿，尽量把 Slurm 状态恢复到请求前。
	successPartitions := make([]string, 0, len(in.UnblockedPartitions))
	for _, p := range in.UnblockedPartitions {
		err = utils.UnblockAccountUseAssociation(in.AccountName, p)
		if err != nil {
			logrus.Errorf("UnblockAccountWithPartitions failed: %v, account is: %v, partition is: %v", err, in.AccountName, p)
			// 多分区解封不是 Slurm 事务。这里对已经解封成功的分区执行反向封锁，
			// 避免接口整体失败时 SCOW 侧认为没有解封，但 Slurm 侧已经解封了部分分区。
			err = rollbackAccountPartitions(
				in.AccountName,
				successPartitions,
				utils.BlockAccountUseAssociation,
				"UnblockAccountWithPartitions",
				"block",
				err,
			)
			return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
		}
		successPartitions = append(successPartitions, p)
		logrus.Infof("UnblockAccountWithPartitions sucess! account is: %v, partition is: %v", in.AccountName, p)
	}

	return &pb.UnblockAccountWithPartitionsResponse{}, nil
}

// ensureAccountUsersAssociationInPartitions 是多分区封锁/解封前的预检查。
// BlockAccountUseAssociation 和 UnblockAccountUseAssociation 都依赖账户用户在目标分区下已有 association；
// 如果边执行边补齐 association，某个分区失败时前面分区可能已经被封锁或解封。
// 因此这里先把所有分区的 association 准备好，任何一个分区失败都直接返回，不进入后续状态修改阶段。
func ensureAccountUsersAssociationInPartitions(account string, partitions []string, operation string) error {
	for _, partition := range partitions {
		if err := utils.EnsureAccountUsersAssociationInPartition(account, partition); err != nil {
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
	account string,
	partitions []string,
	rollback func(account, partition string) error,
	operation string,
	rollbackAction string,
	originalErr error,
) error {
	if len(partitions) == 0 {
		return originalErr
	}

	var rollbackErrors []string
	for _, partition := range partitions {
		if err := rollback(account, partition); err != nil {
			logrus.Errorf("%s rollback %s failed: %v, account is: %v, partition is: %v", operation, rollbackAction, err, account, partition)
			rollbackErrors = append(rollbackErrors, fmt.Sprintf("%s: %v", partition, err))
			continue
		}

		logrus.Infof("%s rollback %s success, account is: %v, partition is: %v", operation, rollbackAction, account, partition)
	}

	if len(rollbackErrors) > 0 {
		return fmt.Errorf("%w; rollback %s failed in partitions: %s", originalErr, rollbackAction, strings.Join(rollbackErrors, "; "))
	}

	return originalErr
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

	// 判断账户在queriedPartitions中是否被block
	for _, p := range queriedPartitions {
		// 查询账户存在与该分区有关联的未封锁用户，若有用户表示该账户在分区是解封状态，若无用户，表示账户在该分区是封锁状态
		accountAssociatedUsers, err := utils.GetAccountAssociatedAllowedUserInDatabaseByDeleted(in.AccountName, p)
		if err != nil {
			logrus.Errorf("QueryAccountBlockStatusWithPartitions get account associated user failed: %v, account is: %v, partition is: %v", err, in.AccountName, p)
			return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
		}

		if len(accountAssociatedUsers) == 0 {
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
	logrus.Tracef("GetAllAccountsWithUsers accountPartitionBlockInfo: %v", accountPartitionBlockInfo)

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
		logrus.Tracef("GetAllAccountsWithUsers account %v acctAndUsers: %v", v, usersBlockInfo)
		for user, blocked := range usersBlockInfo {
			logrus.Tracef("user: %v, blocked: %v", user, blocked)
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

		// 4.3 有具体分区时沿用分区状态；完全没有具体分区时回退到基础 association 的 MaxSubmitJobs。
		var allowPartitions []string
		blocked := true
		if blockInfo, exists := accountPartitionBlockInfo[v]; exists {
			allowPartitions = blockInfo.AllowedPartitions
			if blockInfo.HasPartition {
				blocked = len(blockInfo.AllowedPartitions) == 0
			} else {
				blocked = blockInfo.FallbackBlocked
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

	logrus.Tracef("GetAllAccountsWithUsersAndBlockedDetails response: %v", acctInfo)
	return &pb.GetAllAccountsWithUsersAndBlockedDetailsResponse{Accounts: acctInfo}, nil
}

func (s *ServerAccount) SyncAccountUserInfo(ctx context.Context, in *pb.SyncAccountUserInfoRequest) (*pb.SyncAccountUserInfoResponse, error) {
	var syncResults []*pb.SyncAccountUserInfoResponse_SyncOperationResult
	start := time.Now()
	logrus.Infof("Start SyncAccountUserInfo, SyncAccounts: %v", in.SyncAccounts)
	logrus.Infof("Start SyncAccountUserInfo, Timeout Millisecond: %v", *in.TimeoutMilliseconds)

	if in.SyncAccounts == nil || len(in.SyncAccounts) == 0 {
		logrus.Infof("SyncAccountUserInfo SyncAccounts is nil, no synchronization is required")
		return nil, nil
	}

	// 设置带超时的context
	var cancel context.CancelFunc
	ctx, cancel = context.WithTimeout(ctx, time.Duration(*in.TimeoutMilliseconds)*time.Millisecond)
	defer cancel()

	isCompleted := true

outerLoop:
	for i, syncAccount := range in.SyncAccounts {
		// 每次循环前检查超时
		select {
		case <-ctx.Done():
			logrus.Warnf("Sync timeout，%d/%d accounts processed", i, len(in.SyncAccounts))
			isCompleted = false
			break outerLoop // 超时了，跳出循环不在执行，返回已处理的结果和未完成状态
		default:
		}

		logrus.Tracef("SyncAccountUserInfo, snyc index: %v", i)
		if *syncAccount.Deleted {
			message := fmt.Sprintf("account %v is deleted, no sync required", syncAccount.AccountName)
			logrus.Infof("[SyncAccountUser] %v", message)
			continue
		}

		results := sau.SyncAccountUser(syncAccount)
		for _, result := range results {
			if result == nil {
				continue
			}
			syncResults = append(syncResults, result)
		}
	}

	// 等待结果收集完成或超时
	if isCompleted {
		// 计算耗时（毫秒）
		elapsed := time.Since(start).Milliseconds()
		logrus.Infof("SyncAccountUserInfo completed, used time: %d, timelimit: %d", elapsed, *in.TimeoutMilliseconds)
		logrus.Infof("SyncAccountUserInfo completed, results: %d", len(syncResults))
	} else {
		// 计算耗时（毫秒）
		elapsed := time.Since(start).Milliseconds()
		logrus.Infof("SyncAccountUserInfo timeout, used time: %d, timelimit: %d", elapsed, *in.TimeoutMilliseconds)
		logrus.Warnf("SyncAccountUserInfo timeout, returning %d completed results", len(syncResults))
	}

	return &pb.SyncAccountUserInfoResponse{SyncResults: syncResults, CompletelyExecuted: isCompleted}, nil
}
