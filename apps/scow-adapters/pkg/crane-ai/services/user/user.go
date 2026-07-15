package user

import (
	"context"
	"fmt"
	"strconv"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc/codes"

	craneProtos "scow-adapters/gen/crane-ai"
	protos "scow-adapters/gen/go"
	ce "scow-adapters/pkg/common/error"
	"scow-adapters/pkg/crane-ai/client"
	"scow-adapters/pkg/crane-ai/utils"
)

type ServerUser struct {
	protos.UnimplementedUserServiceServer
}

func (s *ServerUser) AddUserToAccount(ctx context.Context, in *protos.AddUserToAccountRequest) (*protos.AddUserToAccountResponse, error) {
	var allowedPartitionQosList []*craneProtos.UserInfo_AllowedPartitionQos
	logrus.Infof("Received request AddUserToAccount: %v", in)

	var partitions []string
	useUsablePartitions := false
	switch partitionStrategy := in.PartitionStrategy.(type) {
	case *protos.AddUserToAccountRequest_UsablePartitions_:
		useUsablePartitions = true
		if partitionStrategy.UsablePartitions != nil {
			partitions = partitionStrategy.UsablePartitions.Partitions
		}
	case *protos.AddUserToAccountRequest_UseAllPartitions:
		if !partitionStrategy.UseAllPartitions {
			logrus.Debugf("AddUserToAccount rejected invalid use_all_partitions=false")
			return nil, ce.RichError(codes.InvalidArgument, "INVALID_ARGUMENT",
				"use_all_partitions must be true when set")
		}
	}

	account, err := utils.GetAccountByName(in.AccountName)
	if err != nil {
		logrus.Errorf("AddUserToAccount get account failed: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", err.Error())
	}

	allowedPartitions := account.AllowedPartitions
	if useUsablePartitions {
		for _, partition := range partitions {
			if !utils.Contains(account.AllowedPartitions, partition) {
				logrus.Warnf("AddUserToAccount usable partition %s is not in account %s allowed partitions %v", partition, in.AccountName, account.AllowedPartitions)
			}
		}
		for _, partition := range account.AllowedPartitions {
			if !utils.Contains(partitions, partition) {
				logrus.Warnf("AddUserToAccount account %s allowed partition %s is not in usable partitions %v", in.AccountName, partition, partitions)
			}
		}
		allowedPartitions = partitions
	}

	// 获取计算分区 配置qos
	for _, partition := range allowedPartitions {
		allowedPartitionQosList = append(allowedPartitionQosList, &craneProtos.UserInfo_AllowedPartitionQos{
			PartitionName: partition,
			QosList:       account.AllowedQosList,
			DefaultQos:    account.DefaultQos,
		})
	}
	uid, err := utils.GetUidByUserName(in.UserId)
	if err != nil {
		logrus.Errorf("AddUserToAccount err: %v", err)
		return nil, ce.RichError(codes.NotFound, "USER_NOT_FOUND", "The user is not exists.")
	}
	user := &craneProtos.UserInfo{
		Uid:                     uint32(uid),
		Name:                    in.UserId,
		Account:                 in.AccountName,
		Blocked:                 false,
		AllowedPartitionQosList: allowedPartitionQosList,
		AdminLevel:              craneProtos.UserInfo_None, // none
	}
	// 添加用户到账户下的请求体
	request := &craneProtos.AddUserRequest{
		Uid:  0,
		User: user,
	}
	response, err := client.CraneCtld.AddUser(context.Background(), request)
	if err != nil {
		logrus.Errorf("AddUserToAccount err: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", err.Error())
	}
	if !response.GetOk() {
		if response.GetCode() == craneProtos.ErrCode_ERR_USER_ALREADY_EXISTS {
			logrus.Errorf("AddUserToAccount err: %v", response.GetCode())
			return nil, ce.RichError(codes.AlreadyExists, "USER_ALREADY_EXISTS", strconv.FormatInt(int64(response.GetCode()), 10))
		}
		logrus.Errorf("AddUserToAccount err: %v", response.GetCode())
		return nil, ce.RichError(codes.Internal, "FAILED_ADD_USER_TO_ACCOUNT", strconv.FormatInt(int64(response.GetCode()), 10))
	}
	logrus.Infof("AddUserToAccount success! user: %v, account: %v", in.UserId, in.AccountName)
	return &protos.AddUserToAccountResponse{}, nil
}

func (s *ServerUser) RemoveUserFromAccount(ctx context.Context, in *protos.RemoveUserFromAccountRequest) (*protos.RemoveUserFromAccountResponse, error) {
	logrus.Infof("Received request RemoveUserFromAccount: %v", in)
	request := &craneProtos.DeleteUserRequest{
		Uid:      0,
		Account:  in.AccountName,
		UserList: []string{in.UserId},
	}

	response, err := client.CraneCtld.DeleteUser(context.Background(), request)
	if err != nil {
		logrus.Errorf("RemoveUserFromAccount err: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", err.Error())
	}
	if !response.GetOk() {
		logrus.Errorf("RemoveUserFromAccount err: %v", fmt.Errorf("ASSOCIATION_NOT_EXISTS"))
		return nil, ce.RichError(codes.NotFound, "ASSOCIATION_NOT_EXISTS", response.GetRichErrorList()[0].GetDescription())
	}
	logrus.Infof("RemoveUserFromAccount success! user: %v, account: %v", in.UserId, in.AccountName)
	return &protos.RemoveUserFromAccountResponse{}, nil
}

func (s *ServerUser) BlockUserInAccount(ctx context.Context, in *protos.BlockUserInAccountRequest) (*protos.BlockUserInAccountResponse, error) {
	logrus.Infof("Received request BlockUserInAccount: %v", in)
	request := &craneProtos.BlockAccountOrUserRequest{
		Block:      true,
		Uid:        0, // 操作者
		EntityType: craneProtos.EntityType_User,
		EntityList: []string{in.UserId},
		Account:    in.AccountName,
	}
	response, err := client.CraneCtld.BlockAccountOrUser(context.Background(), request)
	if err != nil {
		logrus.Errorf("BlockUserInAccount err: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", err.Error())
	}
	if !response.GetOk() {
		logrus.Errorf("BlockUserInAccount err: %v", fmt.Errorf("ASSOCIATION_NOT_EXISTS"))
		return nil, ce.RichError(codes.NotFound, "ASSOCIATION_NOT_EXISTS", response.GetRichErrorList()[0].GetDescription())
	}
	logrus.Infof("BlockUserInAccount success! user: %v, account: %v", in.UserId, in.AccountName)
	return &protos.BlockUserInAccountResponse{}, nil
}

func (s *ServerUser) UnblockUserInAccount(ctx context.Context, in *protos.UnblockUserInAccountRequest) (*protos.UnblockUserInAccountResponse, error) {
	logrus.Infof("Received request UnblockUserInAccount: %v", in)
	request := &craneProtos.BlockAccountOrUserRequest{
		Block:      false,
		Uid:        0,
		EntityType: craneProtos.EntityType_User,
		EntityList: []string{in.UserId},
		Account:    in.AccountName,
	}
	response, err := client.CraneCtld.BlockAccountOrUser(context.Background(), request)
	if err != nil {
		logrus.Errorf("UnblockUserInAccount err: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", err.Error())
	}
	if !response.GetOk() {
		logrus.Errorf("UnblockUserInAccount err: %v", fmt.Errorf("ASSOCIATION_NOT_EXISTS"))
		return nil, ce.RichError(codes.NotFound, "ASSOCIATION_NOT_EXISTS", response.GetRichErrorList()[0].GetDescription())
	}
	logrus.Infof("UnblockUserInAccount success! user: %v, account: %v", in.UserId, in.AccountName)
	return &protos.UnblockUserInAccountResponse{}, nil
}

func (s *ServerUser) QueryUserInAccountBlockStatus(ctx context.Context, in *protos.QueryUserInAccountBlockStatusRequest) (*protos.QueryUserInAccountBlockStatusResponse, error) {
	logrus.Infof("Received request QueryUserInAccountBlockStatus: %v", in)
	request := &craneProtos.QueryUserInfoRequest{
		Uid:      0,
		UserList: []string{in.UserId},
		Account:  in.AccountName,
	}
	response, err := client.CraneCtld.QueryUserInfo(context.Background(), request)
	if err != nil {
		logrus.Errorf("QueryUserInAccountBlockStatus err: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", err.Error())
	}
	if !response.GetOk() {
		logrus.Errorf("QueryUserInAccountBlockStatus err: %v", fmt.Errorf("CRANE_INTERNAL_ERROR"))
		return nil, ce.RichError(codes.Internal, "CRANE_INTERNAL_ERROR", response.GetRichErrorList()[0].GetDescription())
	}

	blocked := response.GetUserList()[0].GetBlocked()
	logrus.Tracef("QueryUserInAccountBlockStatus Blocked: %v", blocked)
	return &protos.QueryUserInAccountBlockStatusResponse{Blocked: blocked}, nil
}

func (s *ServerUser) DeleteUser(ctx context.Context, in *protos.DeleteUserRequest) (*protos.DeleteUserResponse, error) {
	// 检查用户名是否在
	exist, err := utils.SelectUserExists(in.UserId)
	if err != nil {
		logrus.Errorf("DeleteUser failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("user %s not found", in.UserId)
		logrus.Warnf("DeleteUser failed: %v", err)
		return &protos.DeleteUserResponse{}, nil
	}

	// 判断用户是否有未完成的作业
	hasJobs, err := utils.HasUnfinishedJobsByUserName(in.UserId)
	if err != nil {
		logrus.Errorf("DeleteUser failed: get jobs by user %v failed: %v", in.UserId, err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	logrus.Tracef("[DeleteUser] exist running jobs: %v", hasJobs)
	if hasJobs {
		err = fmt.Errorf("Exist running jobs")
		logrus.Errorf("DeleteUser failed: %v", err)
		return nil, err
	}
	// 删除用户数据
	if err = utils.DeleteUser(in.UserId); err != nil {
		logrus.Errorf("DeleteUser: %v failed: %v", in.UserId, err)
		return nil, err
	}
	logrus.Infof("Delete user: %v sucess!", in.UserId)
	return &protos.DeleteUserResponse{}, nil
}
