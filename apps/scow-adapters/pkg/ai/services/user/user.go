package user

import (
	"context"
	"fmt"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc/codes"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/utils"
	ce "scow-adapters/pkg/common/error"
)

type ServerUser struct {
	pb.UnimplementedUserServiceServer
}

func (s *ServerUser) AddUserToAccount(ctx context.Context, in *pb.AddUserToAccountRequest) (*pb.AddUserToAccountResponse, error) {
	logrus.Infof("Received request AddUserToAccount: %v", in)
	userName := in.UserId
	accountName := in.AccountName

	// 检查账号是否存在
	exist, err := utils.SelectAccountExists(accountName)
	if err != nil {
		logrus.Errorf("AddUserToAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("account %s not found", accountName)
		logrus.Errorf("AddUserToAccount failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "ACCOUNT_NOT_FOUND", err.Error())
	}

	// 检查用户是否存在
	exist, err = utils.SelectUserExists(userName)
	if err != nil {
		logrus.Errorf("AddUserToAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if exist {
		// 检查用户和账户的关联关系
		associate, err := utils.GetAssociateByAccountAndUser(accountName, userName)
		if err != nil {
			logrus.Errorf("AddUserToAccount: get associate by account %v and user: %v failed: %v", accountName, userName, err)
			return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
		}
		if associate == nil {
			if err = utils.CreateAccountAndUserAssociate(accountName, userName); err != nil {
				logrus.Errorf("AddUserToAccount failed: %v", err)
				return nil, ce.RichError(codes.Internal, "SQL_CREATE_FAILED", err.Error())
			}
			return &pb.AddUserToAccountResponse{}, nil
		}
		deleted := associate.Deleted
		if deleted == 0 {
			err = fmt.Errorf("AddUserToAccount failed: User %s is already exists in account %s", in.UserId, in.AccountName)
			logrus.Errorf("AddUserToAccount failed: %v", err)
			return nil, ce.RichError(codes.AlreadyExists, "USER_ALREADY_EXISTS", err.Error())
		}
		if err = utils.UpdateUserDeletedInAccount(accountName, userName, 0); err != nil {
			return nil, ce.RichError(codes.Internal, "SQL_UPDATE_FAILED", err.Error())
		}

		if associate.Blocked == 1 {
			if err = utils.UpdateUserBlockedInAccount(userName, accountName, 0); err != nil {
				return nil, ce.RichError(codes.Internal, "SQL_UPDATE_FAILED", err.Error())
			}
		}

		return &pb.AddUserToAccountResponse{}, nil
	}

	if err = utils.AddUserToAccount(accountName, userName); err != nil {
		logrus.Errorf("AddUserToAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_CREATE_FAILED", err.Error())
	}
	return &pb.AddUserToAccountResponse{}, nil
}

func (s *ServerUser) RemoveUserFromAccount(ctx context.Context, in *pb.RemoveUserFromAccountRequest) (*pb.RemoveUserFromAccountResponse, error) {
	logrus.Infof("Received request RemoveUserFromAccount: %v", in)
	userName := in.UserId
	accountName := in.AccountName

	// 检查账号名是否存在
	exist, err := utils.SelectAccountExists(accountName)
	if err != nil {
		logrus.Errorf("RemoveUserFromAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("account %s not found", in.AccountName)
		logrus.Errorf("RemoveUserFromAccount failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "ACCOUNT_NOT_FOUND", err.Error())
	}

	// 检查用户名是否在
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

	// 检查用户和账户的关联关系
	associate, err := utils.GetAssociateByAccountAndUser(accountName, userName)
	if err != nil {
		logrus.Errorf("RemoveUserFromAccount: get associate by account %v and user: %v failed: %v", accountName, userName, err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if associate == nil {
		err = fmt.Errorf("account %v and user %v associate not found", accountName, userName)
		return nil, ce.RichError(codes.NotFound, "ASSOC_NOT_FOUND", err.Error())
	}

	if associate.Deleted == 1 {
		logrus.Infof("user %v id deleted", userName)
		return &pb.RemoveUserFromAccountResponse{}, nil
	} else {
		// 该用户作业的判断
		unfinishedJobs, err := utils.GetUnfinishedJobsByUserAndAccount(userName, accountName)
		if err != nil {
			logrus.Errorf("RemoveUserFromAccount failed: get jobs by user %v failed: %v", userName, err)
			return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
		}
		if len(unfinishedJobs) != 0 {
			err = fmt.Errorf("exist running jobs")
			logrus.Errorf("RemoveUserFromAccount failed: %v", err)
			return nil, ce.RichError(codes.Internal, "USER_EXITS_JOBS", err.Error())
		}

		if err = utils.UpdateUserDeletedInAccount(accountName, userName, 1); err != nil {
			return nil, ce.RichError(codes.Internal, "SQL_UPDATE_FAILED", err.Error())
		}
		return &pb.RemoveUserFromAccountResponse{}, nil
	}
}

func (s *ServerUser) BlockUserInAccount(ctx context.Context, in *pb.BlockUserInAccountRequest) (*pb.BlockUserInAccountResponse, error) {
	logrus.Infof("Received request BlockUserInAccount: %v", in)
	userName := in.UserId
	accountName := in.AccountName

	// 检查账号名是否存在
	exist, err := utils.SelectAccountExists(accountName)
	if err != nil {
		logrus.Errorf("BlockUserInAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("account %s not found", in.AccountName)
		logrus.Errorf("BlockUserInAccount failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "ACCOUNT_NOT_FOUND", err.Error())
	}

	// 检查用户名是否在
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

	// 检查用户和账户的关联关系
	associate, err := utils.GetAssociateByAccountAndUser(accountName, userName)
	if err != nil {
		logrus.Errorf("BlockUserInAccount: get associate by account %v and user: %v failed: %v", accountName, userName, err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if associate == nil {
		err = fmt.Errorf("account %v and user %v associate not found", accountName, userName)
		return nil, ce.RichError(codes.NotFound, "ASSOC_NOT_FOUND", err.Error())
	}

	if associate.Deleted == 1 {
		err = fmt.Errorf("user %v id deleted", userName)
		return nil, ce.RichError(codes.Internal, "USER_IS_DELETED", err.Error())
	} else {
		blocked := associate.Blocked
		if blocked == 1 {
			logrus.Infof("user %v is blocked", userName)
			return &pb.BlockUserInAccountResponse{}, nil
		}
		if err = utils.UpdateUserBlockedInAccount(userName, accountName, 1); err != nil {
			return nil, ce.RichError(codes.Internal, "SQL_UPDATE_FAILED", err.Error())
		}
		return &pb.BlockUserInAccountResponse{}, nil
	}
}

func (s *ServerUser) UnblockUserInAccount(ctx context.Context, in *pb.UnblockUserInAccountRequest) (*pb.UnblockUserInAccountResponse, error) {
	logrus.Infof("Received request UnblockUserInAccount: %v", in)
	userName := in.UserId
	accountName := in.AccountName

	// 检查账号名是否存在
	exist, err := utils.SelectAccountExists(accountName)
	if err != nil {
		logrus.Errorf("UnblockUserInAccount failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("account %s not found", in.AccountName)
		logrus.Errorf("UnblockUserInAccount failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "ACCOUNT_NOT_FOUND", err.Error())
	}

	// 检查用户名是否在
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

	// 检查用户和账户的关联关系
	associate, err := utils.GetAssociateByAccountAndUser(accountName, userName)
	if err != nil {
		logrus.Errorf("UnblockUserInAccount: get associate by account %v and user: %v failed: %v", accountName, userName, err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if associate == nil {
		err = fmt.Errorf("account %v and user %v associate not found", accountName, userName)
		return nil, ce.RichError(codes.NotFound, "ASSOC_NOT_FOUND", err.Error())
	}

	if associate.Deleted == 1 {
		err = fmt.Errorf("user %v id deleted", userName)
		return nil, ce.RichError(codes.Internal, "USER_IS_DELETED", err.Error())
	} else {
		blocked := associate.Blocked
		if blocked == 0 {
			return &pb.UnblockUserInAccountResponse{}, nil
		}
		if err = utils.UpdateUserBlockedInAccount(userName, accountName, 0); err != nil {
			return nil, ce.RichError(codes.Internal, "SQL_UPDATE_FAILED", err.Error())
		}
		return &pb.UnblockUserInAccountResponse{}, nil
	}
}

func (s *ServerUser) QueryUserInAccountBlockStatus(ctx context.Context, in *pb.QueryUserInAccountBlockStatusRequest) (*pb.QueryUserInAccountBlockStatusResponse, error) {
	logrus.Infof("Received request QueryUserInAccountBlockStatus: %v", in)
	userName := in.UserId
	accountName := in.AccountName

	// 检查账号名是否存在
	exist, err := utils.SelectAccountExists(accountName)
	if err != nil {
		logrus.Errorf("QueryUserInAccountBlockStatus failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("account %s not found", in.AccountName)
		logrus.Errorf("QueryUserInAccountBlockStatus failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "ACCOUNT_NOT_FOUND", err.Error())
	}

	// 检查用户名是否在
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

	// 检查用户和账户的关联关系
	associate, err := utils.GetAssociateByAccountAndUser(accountName, userName)
	if err != nil {
		logrus.Errorf("QueryUserInAccountBlockStatus: get associate by account %v and user: %v failed: %v", accountName, userName, err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if associate == nil {
		err = fmt.Errorf("account %v and user %v associate not found", accountName, userName)
		return nil, ce.RichError(codes.NotFound, "ASSOC_NOT_FOUND", err.Error())
	}

	if associate.Deleted == 1 {
		err = fmt.Errorf("user %v id deleted", userName)
		return nil, ce.RichError(codes.Internal, "USER_IS_DELETED", err.Error())
	} else {
		if associate.Blocked == 1 {
			return &pb.QueryUserInAccountBlockStatusResponse{Blocked: true}, nil
		} else {
			return &pb.QueryUserInAccountBlockStatusResponse{Blocked: false}, nil
		}
	}
}

func (s *ServerUser) DeleteUser(ctx context.Context, in *pb.DeleteUserRequest) (*pb.DeleteUserResponse, error) {
	logrus.Infof("Received request DeleteUser: %v", in)
	// 检查用户名是否在
	exist, err := utils.SelectUserExists(in.UserId)
	if err != nil {
		logrus.Errorf("DeleteUser failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	// 用户不存在，不做操作
	if !exist {
		err = fmt.Errorf("user %s not found", in.UserId)
		logrus.Warnf("DeleteUser failed: %v", err)
		return &pb.DeleteUserResponse{}, nil
	}

	// 该用户作业的判断
	unfinishedJobs, err := utils.GetUnfinishedJobsByUserName(in.UserId)
	if err != nil {
		logrus.Errorf("DeleteUser failed: get jobs by user %v failed: %v", in.UserId, err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	if len(unfinishedJobs) > 0 {
		err = fmt.Errorf("DeleteUser failed: Exist running jobs")
		return nil, ce.RichError(codes.Internal, "USER_EXITS_JOBS", err.Error())
	}
	if err = utils.DeleteUser(in.UserId); err != nil {
		logrus.Errorf("DeleteUser: %v failed: %v", in.UserId, err)
		return nil, ce.RichError(codes.Internal, "SQL_DELETE_FAILED", err.Error())
	}
	logrus.Infof("Delete User: %v sucess!", in.UserId)
	return &pb.DeleteUserResponse{}, nil
}
