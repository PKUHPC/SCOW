package user

import (
	"context"
	"fmt"
	"strings"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc/codes"

	pb "scow-adapters/gen/go"
	ce "scow-adapters/pkg/common/error"
	"scow-adapters/pkg/slurm/utils"
)

type ServerUser struct {
	pb.UnimplementedUserServiceServer
}

func (s *ServerUser) AddUserToAccount(ctx context.Context, in *pb.AddUserToAccountRequest) (*pb.AddUserToAccountResponse, error) {
	logrus.Tracef("Received request AddUserToAccount: %v", in)
	// 检查账户名和用户名中是否包含大写字母
	if err := utils.CheckAccount(in.AccountName); err != nil {
		logrus.Errorf("AddUserToAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "ACCOUNT_CONTAIN_ILLEGAL_CHARACTERS", err.Error())
	}
	if err := utils.CheckUser(in.UserId); err != nil {
		logrus.Errorf("AddUserToAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "USER_CONTAIN_ILLEGAL_CHARACTERS", err.Error())
	}

	// 检查账号是否存在slurm中
	exist, err := utils.SelectAccountExists(in.AccountName)
	if err != nil {
		logrus.Errorf("AddUserToAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("account %s not found", in.AccountName)
		logrus.Errorf("AddUserToAccount failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "ACCOUNT_NOT_FOUND", err.Error())
	}

	// 获取系统中的所有Qos
	qosList, err := utils.GetAllQosInDatabase()
	if err != nil {
		logrus.Errorf("AddUserToAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	baseQos := strings.Join(qosList, ",")
	// 获取系统中的partitions
	partitions, err := utils.GetPartitionsName()
	if err != nil {
		logrus.Errorf("AddUserToAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}
	if len(partitions) == 0 {
		err = fmt.Errorf("no partitions found")
		logrus.Errorf("AddUserToAccount failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "PARTITION_NOT_FOUND", err.Error())
	}

	// 检查用户是否在slurm中
	exist, err = utils.SelectUserExists(in.UserId)
	if err != nil {
		logrus.Errorf("AddUserToAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if exist {
		// 用户已存在，先检查账户和用户之间是否存在关联关系
		if err = utils.CheckUserAndAccountAssociate(in.UserId, in.AccountName); err != nil {
			// 不存在关联关系，则将用户加入账户
			if err = utils.AddUserToAccount(in.UserId, in.AccountName, baseQos, partitions); err != nil {
				logrus.Errorf("AddUserToAccount failed: %v", err)
				return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
			}
			logrus.Infof("AddUserToAccount sucess! User is: %v, Account is: %v", in.UserId, in.AccountName)
			return &pb.AddUserToAccountResponse{}, nil
		}
		// 存在关联关系，则返回用户已存在
		err = fmt.Errorf("AddUserToAccount failed: User %s is already exists in account %s", in.UserId, in.AccountName)
		logrus.Errorf("AddUserToAccount failed: %v", err)
		return nil, ce.RichError(codes.AlreadyExists, "USER_ACCOUNT_ALREADY_EXISTS", err.Error())
	}

	// 用户不存在则创建用户，并将用户加入到账户中
	if err = utils.AddUserToAccount(in.UserId, in.AccountName, baseQos, partitions); err != nil {
		logrus.Errorf("AddUserToAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}
	logrus.Infof("AddUserToAccount sucess! User is: %v, Account is: %v", in.UserId, in.AccountName)
	return &pb.AddUserToAccountResponse{}, nil
}

func (s *ServerUser) RemoveUserFromAccount(ctx context.Context, in *pb.RemoveUserFromAccountRequest) (*pb.RemoveUserFromAccountResponse, error) {
	logrus.Tracef("Received request RemoveUserFromAccount: %v", in)
	// 检查账户名和用户名中是否包含大写字母
	if err := utils.CheckAccount(in.AccountName); err != nil {
		logrus.Errorf("RemoveUserFromAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "ACCOUNT_CONTAIN_ILLEGAL_CHARACTERS", err.Error())
	}
	if err := utils.CheckUser(in.UserId); err != nil {
		logrus.Errorf("RemoveUserFromAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "USER_CONTAIN_ILLEGAL_CHARACTERS", err.Error())
	}

	// 检查账号名是否在slurm中
	exist, err := utils.SelectAccountExists(in.AccountName)
	if err != nil {
		logrus.Errorf("RemoveUserFromAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("account %s not found", in.AccountName)
		logrus.Errorf("RemoveUserFromAccount failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "ACCOUNT_NOT_FOUND", err.Error())
	}

	// 检查用户名是否在slurm中
	exist, err = utils.SelectUserExists(in.UserId)
	if err != nil {
		logrus.Errorf("RemoveUserFromAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("user %s not found", in.UserId)
		logrus.Errorf("RemoveUserFromAccount failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "USER_NOT_FOUND", err.Error())
	}

	// 检查账户和用户之间是否存在关联关系
	if err := utils.CheckUserAndAccountAssociate(in.UserId, in.AccountName); err != nil {
		logrus.Errorf("RemoveUserFromAccount failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "USER_ACCOUNT_NOT_FOUND", err.Error())
	}

	// 查询用户uid
	uid, _, err := utils.GetUserUidGid(in.UserId)
	if err != nil {
		logrus.Errorf("RemoveUserFromAccount failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "USER_NOT_FOUND", err.Error())
	}

	// 获取用户未结束的作业列表
	jobList, err := utils.GetNotCompletedJobsByUserAndAccount(uid, in.AccountName)
	if err != nil {
		logrus.Errorf("RemoveUserFromAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	// 有作业不允许删用户
	if len(jobList) != 0 {
		err = fmt.Errorf("the user %s have running jobs", in.UserId)
		logrus.Errorf("RemoveUserFromAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "RUNNING_JOB_EXISTS", err.Error())
	}

	// 查询用户除当前账户外的关联的其他账户
	acctList, err := utils.GetAccountsAssocWithUserWithoutAccountInDatabase(in.UserId, in.AccountName)
	if err != nil {
		logrus.Errorf("RemoveUserFromAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	// 用户只关联这个账户的情况
	if len(acctList) == 0 {
		// 没作业下直接删除用户
		if err = utils.DeleteUser(in.UserId); err != nil {
			logrus.Errorf("RemoveUserFromAccount failed: %v", err)
			return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
		}

		logrus.Infof("RemoveUserFromAccount sucess! User is: %v, Account is: %v", in.UserId, in.AccountName)
		return &pb.RemoveUserFromAccountResponse{}, nil
	}

	// 用户还关联其他账户的情况，还需更改默认账号并删除用户
	if err = utils.DeleteUserWithAccount(in.UserId, in.AccountName, acctList); err != nil {
		logrus.Errorf("RemoveUserFromAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}

	logrus.Infof("RemoveUserFromAccount sucess! User is: %v, Account is: %v", in.UserId, in.AccountName)
	return &pb.RemoveUserFromAccountResponse{}, nil
}

func (s *ServerUser) BlockUserInAccount(ctx context.Context, in *pb.BlockUserInAccountRequest) (*pb.BlockUserInAccountResponse, error) {
	logrus.Tracef("Received request BlockUserInAccount: %v", in)
	// 检查账户名和用户名中是否包含大写字母
	if err := utils.CheckAccount(in.AccountName); err != nil {
		logrus.Errorf("BlockUserInAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "ACCOUNT_CONTAIN_ILLEGAL_CHARACTERS", err.Error())
	}
	if err := utils.CheckUser(in.UserId); err != nil {
		logrus.Errorf("BlockUserInAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "USER_CONTAIN_ILLEGAL_CHARACTERS", err.Error())
	}

	// 检查账号名是否在slurm中
	exist, err := utils.SelectAccountExists(in.AccountName)
	if err != nil {
		logrus.Errorf("BlockUserInAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("account %s not found", in.AccountName)
		logrus.Errorf("BlockUserInAccount failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "ACCOUNT_NOT_FOUND", err.Error())
	}

	// 检查用户名是否在slurm中
	exist, err = utils.SelectUserExists(in.UserId)
	if err != nil {
		logrus.Errorf("BlockUserInAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("user %s not found", in.UserId)
		logrus.Errorf("BlockUserInAccount failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "USER_NOT_FOUND", err.Error())
	}

	// 检查账户与用户是否存在关联关系, 没关联直接返回
	if err := utils.CheckUserAndAccountAssociate(in.UserId, in.AccountName); err != nil {
		logrus.Errorf("BlockUserInAccount failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "USER_ACCOUNT_NOT_FOUND", err.Error())
	}

	// 关联存在的情况下封锁账户
	if err := utils.BlockUserInAccount(in.UserId, in.AccountName); err != nil {
		logrus.Errorf("BlockUserInAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}
	logrus.Infof("BlockUserInAccount sucess! User is: %v, Account is: %v", in.UserId, in.AccountName)
	return &pb.BlockUserInAccountResponse{}, nil
}

func (s *ServerUser) UnblockUserInAccount(ctx context.Context, in *pb.UnblockUserInAccountRequest) (*pb.UnblockUserInAccountResponse, error) {
	logrus.Tracef("Received request UnblockUserInAccount: %v", in)
	// 检查账户名和用户名中是否包含大写字母
	if err := utils.CheckAccount(in.AccountName); err != nil {
		logrus.Errorf("UnblockUserInAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "ACCOUNT_CONTAIN_ILLEGAL_CHARACTERS", err.Error())
	}
	if err := utils.CheckUser(in.UserId); err != nil {
		logrus.Errorf("UnblockUserInAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "USER_CONTAIN_ILLEGAL_CHARACTERS", err.Error())
	}

	// 检查账号名是否在slurm中
	exist, err := utils.SelectAccountExists(in.AccountName)
	if err != nil {
		logrus.Errorf("UnblockUserInAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("account %s not found", in.AccountName)
		logrus.Errorf("UnblockUserInAccount failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "ACCOUNT_NOT_FOUND", err.Error())
	}

	// 检查用户名是否在slurm中
	exist, err = utils.SelectUserExists(in.UserId)
	if err != nil {
		logrus.Errorf("UnblockUserInAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("user %s not found", in.UserId)
		logrus.Errorf("UnblockUserInAccount failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "USER_NOT_FOUND", err.Error())
	}

	// 检查账户与用户是否存在关联关系
	if err := utils.CheckUserAndAccountAssociate(in.UserId, in.AccountName); err != nil {
		logrus.Errorf("UnblockUserInAccount failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "USER_ACCOUNT_NOT_FOUND", err.Error())
	}

	// 最大提交作业数为NULL表示没被封锁，不需要解封
	if maxSubmitJobs := utils.GetMaxSubmitJobs(in.UserId, in.AccountName); maxSubmitJobs == "NULL" {
		logrus.Infof("UnblockUserInAccount User %v is not block in Account %v", in.UserId, in.AccountName)
		return &pb.UnblockUserInAccountResponse{}, nil
	}

	// 用户从账户中解封
	if err := utils.UnblockUserInAccount(in.UserId, in.AccountName); err != nil {
		logrus.Errorf("UnblockUserInAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}
	logrus.Infof("UnblockUserInAccount sucess! User id: %v, Account is: %v", in.UserId, in.AccountName)
	return &pb.UnblockUserInAccountResponse{}, nil
}

func (s *ServerUser) QueryUserInAccountBlockStatus(ctx context.Context, in *pb.QueryUserInAccountBlockStatusRequest) (*pb.QueryUserInAccountBlockStatusResponse, error) {
	logrus.Tracef("Received request QueryUserInAccountBlockStatus: %v", in)
	// 检查账户名、用户名是否包含大写字母
	if err := utils.CheckAccount(in.AccountName); err != nil {
		logrus.Errorf("QueryUserInAccountBlockStatus failed: %v", err)
		return nil, ce.RichError(codes.Internal, "ACCOUNT_CONTAIN_ILLEGAL_CHARACTERS", err.Error())
	}
	if err := utils.CheckUser(in.UserId); err != nil {
		logrus.Errorf("QueryUserInAccountBlockStatus failed: %v", err)
		return nil, ce.RichError(codes.Internal, "USER_CONTAIN_ILLEGAL_CHARACTERS", err.Error())
	}

	// 检查账号名是否在slurm中
	exist, err := utils.SelectAccountExists(in.AccountName)
	if err != nil {
		logrus.Errorf("QueryUserInAccountBlockStatus failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("account %s not found", in.AccountName)
		logrus.Errorf("QueryUserInAccountBlockStatus failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "ACCOUNT_NOT_FOUND", err.Error())
	}

	// 检查用户名是否在slurm中
	exist, err = utils.SelectUserExists(in.UserId)
	if err != nil {
		logrus.Errorf("QueryUserInAccountBlockStatus failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("user %s not found", in.UserId)
		logrus.Errorf("QueryUserInAccountBlockStatus failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "USER_NOT_FOUND", err.Error())
	}

	// 检查账户与用户在slurm中是否存在关联关系
	if err := utils.CheckUserAndAccountAssociate(in.UserId, in.AccountName); err != nil {
		logrus.Errorf("QueryUserInAccountBlockStatus failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "USER_ACCOUNT_NOT_FOUND", err.Error())
	}

	// 查询max_submit_jobs的值,通过max_submit_jobs来判断用户是否被封锁
	if maxSubmitJobs := utils.GetMaxSubmitJobs(in.UserId, in.AccountName); maxSubmitJobs == "NULL" {
		logrus.Infof("User %v In Account %v is Unblocked Status", in.UserId, in.AccountName)
		return &pb.QueryUserInAccountBlockStatusResponse{Blocked: false}, nil
	}

	logrus.Infof("User %v In Account %v is Blocked Status", in.UserId, in.AccountName)
	return &pb.QueryUserInAccountBlockStatusResponse{Blocked: true}, nil
}

func (s *ServerUser) DeleteUser(ctx context.Context, in *pb.DeleteUserRequest) (*pb.DeleteUserResponse, error) {
	logrus.Tracef("Received request DeleteUser: %v", in)
	// 该用户作业的判断
	runningJobs, err := utils.GetJobsInUser(in.UserId)
	if err != nil {
		logrus.Errorf("DeleteUser failed: %v", err)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}
	if runningJobs > 0 {
		err = fmt.Errorf("DeleteUser failed: exist running jobs")
		logrus.Errorf("DeleteUser failed: %v", err)
		return nil, err
	}
	// 从账户中移除用户会把delete字段置为1
	deleted, err := utils.SelectUserDeleted(in.UserId)
	if err != nil {
		logrus.Errorf("DeleteUser failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	// 用户已删除或不存在，不做操作
	if deleted {
		logrus.Infof("user %s deleted alredy or not found", in.UserId)
		return &pb.DeleteUserResponse{}, nil
	}
	// 未删除的用户需要调用slurm命令删除
	if err = utils.DeleteUser(in.UserId); err != nil {
		logrus.Errorf("DeleteUser failed: %v", err)
		return nil, err
	}
	logrus.Infof("Delete User: %v sucess!", in.UserId)
	return &pb.DeleteUserResponse{}, nil
}
