package utils

import (
	"context"
	"fmt"
	"os"
	"slices"
	"strconv"
	"strings"

	"github.com/sirupsen/logrus"

	craneProtos "scow-adapters/gen/crane-ai"
	"scow-adapters/pkg/crane-ai/client"
)

type jobCount struct {
	JobCount        uint32
	RunningJobCount uint32
	PendingJobCount uint32
}

type CraneCtldResponseError struct {
	Message    string
	RichErrors []*craneProtos.RichError
}

func (e *CraneCtldResponseError) Error() string {
	return e.Message
}

func (e *CraneCtldResponseError) AllHaveCode(code craneProtos.ErrCode) bool {
	return richErrorsAllHaveCode(e.RichErrors, code)
}
func formatRichErrors(richErrors []*craneProtos.RichError) string {
	if len(richErrors) == 0 {
		return "no rich error returned"
	}

	messages := make([]string, 0, len(richErrors))
	for _, richError := range richErrors {
		if richError == nil {
			continue
		}
		messages = append(messages, fmt.Sprintf("code: %s, description: %s",
			richError.GetCode().String(), richError.GetDescription()))
	}
	if len(messages) == 0 {
		return "no rich error returned"
	}
	return strings.Join(messages, "; ")
}

func richErrorsAllHaveCode(richErrors []*craneProtos.RichError, code craneProtos.ErrCode) bool {
	if len(richErrors) == 0 {
		return false
	}

	for _, richError := range richErrors {
		if richError == nil || richError.GetCode() != code {
			return false
		}
	}
	return true
}

func getUsersByAccountName(accountName string) ([]*craneProtos.UserInfo, error) {
	request := &craneProtos.QueryUserInfoRequest{
		Uid:     0,
		Account: accountName,
	}
	response, err := client.CraneCtld.QueryUserInfo(context.Background(), request)
	if err != nil {
		logrus.Errorf("QueryUserInAccountBlockStatus err: %v", err)
		return nil, fmt.Errorf("query users failed: %v", err)
	}
	if !response.GetOk() {
		return nil, fmt.Errorf("query users failed: %v", response.GetRichErrorList()[0].GetDescription())
	}
	return response.UserList, nil
}

func AddUserToAccount(accountName, userName string, partitions ...[]string) error {
	var allowedPartitionQosList []*craneProtos.UserInfo_AllowedPartitionQos

	account, err := GetAccountByName(accountName)
	if err != nil {
		return fmt.Errorf("AddUserToAccount get account failed: %v", err)
	}

	allowedPartitions := account.AllowedPartitions
	if len(partitions) > 0 {
		allowedPartitions = partitions[0]
	}

	// 获取计算分区 配置qos
	for _, partition := range allowedPartitions {
		allowedPartitionQosList = append(allowedPartitionQosList, &craneProtos.UserInfo_AllowedPartitionQos{
			PartitionName: partition,
			QosList:       account.AllowedQosList,
			DefaultQos:    account.DefaultQos,
		})
	}

	uid, err := GetUidByUserName(userName)
	if err != nil {
		return fmt.Errorf("the user is not exists")
	}
	user := &craneProtos.UserInfo{
		Uid:                     uint32(uid),
		Name:                    userName,
		Account:                 accountName,
		Blocked:                 false,
		AllowedPartitionQosList: allowedPartitionQosList,
		AdminLevel:              craneProtos.UserInfo_None,
	}
	requestAddUser := &craneProtos.AddUserRequest{
		Uid:  0,
		User: user,
	}
	responseUser, err := client.CraneCtld.AddUser(context.Background(), requestAddUser)
	if err != nil {
		logrus.Errorf("CreateAccount err: %v", err)
		return err
	}
	if !responseUser.GetOk() {
		return fmt.Errorf("add user failed, code: %v ", strconv.FormatInt(int64(responseUser.GetCode()), 10))
	}
	return nil
}

// SelectAccountExists 查询账户的存在情况，并返回错误
func SelectAccountExists(account string) (bool, error) {
	request := &craneProtos.QueryAccountInfoRequest{
		Uid:         0,
		AccountList: []string{account},
	}
	response, err := client.CraneCtld.QueryAccountInfo(context.Background(), request)
	if err != nil {
		return false, fmt.Errorf("qury account %s failed: %v", account, err)
	}
	if !response.GetOk() {
		return false, nil
	}

	return true, nil
}

func CreateAccount(accountName string, partitions ...[]string) error {
	var partitionList []string
	if len(partitions) > 0 && len(partitions[0]) > 0 {
		partitionList = partitions[0]
	} else {
		// 未指定 authorized_partitions 时沿用旧行为：使用配置里的全部分区。
		// authorized_partitions=[] 时也先按全量分区创建，再在创建成功后删除全部分区；
		// 不能直接写空 AllowedPartitions，因为 proto3 repeated 空列表跨 gRPC 后会变成 nil。
		for _, partition := range client.CConfig.Partitions {
			partitionList = append(partitionList, partition.Name)
		}
	}
	// 获取系统QOS
	qosList, err := GetAllQos()
	if err != nil {
		return err
	}

	AccountInfo := &craneProtos.AccountInfo{
		Name:              accountName,
		Description:       "Create account in crane.",
		AllowedPartitions: partitionList,
		DefaultQos:        qosList[0],
		AllowedQosList:    qosList,
	}
	// 创建账户请求体
	request := &craneProtos.AddAccountRequest{
		Uid:     uint32(os.Getuid()),
		Account: AccountInfo,
	}
	response, err := client.CraneCtld.AddAccount(context.Background(), request)
	if err != nil {
		logrus.Errorf("CreateAccount err: %v", err)
		return err
	}
	if !response.GetOk() {
		return fmt.Errorf("create account error: %v", strconv.FormatInt(int64(response.GetCode()), 10))
	}
	if len(partitions) > 0 && len(partitions[0]) == 0 {
		if err := BlockAccountWithPartition(accountName, partitionList); err != nil {
			// authorized_partitions=[] 需要先创建全量分区再删空；若删分区失败，必须删除刚创建的账户，
			// 避免把“无可使用分区”错误地留成“全量可使用分区”。
			if rollbackErr := DeleteAccount(accountName); rollbackErr != nil {
				logrus.Errorf("CreateAccount rollback account %s failed: %v", accountName, rollbackErr)
			}
			return fmt.Errorf("block all account partitions after create account failed: %w", err)
		}
	}
	return nil
}

func DeleteAccount(accountName string) error {
	request := &craneProtos.DeleteAccountRequest{
		Uid:         uint32(os.Getuid()),
		AccountList: []string{accountName},
	}
	response, err := client.CraneCtld.DeleteAccount(context.Background(), request)
	if err != nil {
		logrus.Errorf("DeleteAccount err: %v", err)
		return err
	}
	if !response.GetOk() {
		richErrors := response.GetRichErrorList()
		return &CraneCtldResponseError{
			Message:    formatRichErrors(richErrors),
			RichErrors: richErrors,
		}
	}
	return nil
}

func BlockAccount(accountName string) error {
	// 请求体 封锁账户
	request := &craneProtos.BlockAccountOrUserRequest{
		Block:      true,
		EntityType: craneProtos.EntityType_Account,
		EntityList: []string{accountName},
		Uid:        0,
	}
	response, err := client.CraneCtld.BlockAccountOrUser(context.Background(), request)
	if err != nil {
		logrus.Errorf("BlockAccount err: %v", err)
		return err
	}
	if !response.GetOk() {
		logrus.Errorf("BlockAccount err: %v", fmt.Errorf("ACCOUNT_ALREADY_EXISTS"))
		return err
	}

	return nil
}

func BlockAccountWithPartition(accountName string, partitions []string) error {
	// 封锁账户请求体
	request := &craneProtos.ModifyAccountRequest{
		Name:  accountName,
		Uid:   0,
		Force: true,
	}

	request.Operations = append(request.Operations, &craneProtos.ModifyFieldOperation{
		ModifyField: craneProtos.ModifyField_Partition,
		ValueList:   partitions,
		Type:        craneProtos.OperationType_Delete,
	})

	response, err := client.CraneCtld.ModifyAccount(context.Background(), request)
	if err != nil {
		logrus.Errorf("BlockAccountWithPartitions err: %v", err)
		return err
	}
	if !response.GetOk() {
		var message string
		for _, richError := range response.GetRichErrorList() {
			message += richError.GetDescription() + "\n"
		}
		logrus.Errorf("BlockAccountWithPartitions failed: %v", message)
		return fmt.Errorf("error: %v", message)
	}
	return nil
}

func UnblockAccount(accountName string) error {
	// 请求体 封锁账户
	request := &craneProtos.BlockAccountOrUserRequest{
		Block:      false,
		EntityType: craneProtos.EntityType_Account,
		EntityList: []string{accountName},
		Uid:        0,
	}
	response, err := client.CraneCtld.BlockAccountOrUser(context.Background(), request)
	if err != nil {
		logrus.Errorf("BlockAccount err: %v", err)
		return err
	}
	if !response.GetOk() {
		logrus.Errorf("BlockAccount err: %v", fmt.Errorf("ACCOUNT_ALREADY_EXISTS"))
		return err
	}

	return nil
}

func UnblockAccountWithPartition(accountName string, partitions []string) error {
	// 封锁账户请求体
	request := &craneProtos.ModifyAccountRequest{
		Name:  accountName,
		Uid:   0,
		Force: true,
	}

	request.Operations = append(request.Operations, &craneProtos.ModifyFieldOperation{
		ModifyField: craneProtos.ModifyField_Partition,
		ValueList:   partitions,
		Type:        craneProtos.OperationType_Add,
	})

	response, err := client.CraneCtld.ModifyAccount(context.Background(), request)
	if err != nil {
		logrus.Errorf("UnblockAccountWithPartitions err: %v", err)
		return err
	}
	if !response.GetOk() {
		var message string
		for _, richError := range response.GetRichErrorList() {
			message += richError.GetDescription() + "\n"
		}
		logrus.Errorf("UnblockAccountWithPartitions failed: %v", message)
		return fmt.Errorf("error: %v", message)
	}

	// 封锁的时候会将账户下面的用户的allow partition删掉，因此解封的时候需要加回来
	if err = modifyUserAllowedPartitions(accountName, partitions); err != nil {
		logrus.Errorf("UnblockAccountWithPartitions err: %v", err)
		return err
	}

	return nil
}

func modifyUserAllowedPartitions(accountName string, partitions []string) error {
	users, err := getUsersByAccountName(accountName)
	if err != nil {
		logrus.Errorf("BlockAccountWithPartitions err: %v", err)
		return err
	}

	for _, user := range users {
		logrus.Infof("modify account %v user %v partitions %v", accountName, user, partitions)
		request := &craneProtos.ModifyUserRequest{
			Name:    user.Name,
			Account: accountName,
			Uid:     0,
		}

		request.Operations = append(request.Operations, &craneProtos.ModifyFieldOperation{
			ModifyField: craneProtos.ModifyField_Partition,
			ValueList:   partitions,
			Type:        craneProtos.OperationType_Add,
		})

		response, err := client.CraneCtld.ModifyUser(context.Background(), request)
		if err != nil {
			logrus.Errorf("modify user failed: %v", err)
			return err
		}
		if !response.GetOk() {
			var message string
			for _, richError := range response.GetRichErrorList() {
				message += richError.GetDescription() + "\n"
			}
			logrus.Errorf("modify user failed: %v", message)
			return fmt.Errorf("error: %v", message)
		}
	}

	logrus.Infof("modify account %v users partitions success", accountName)
	return nil
}

// SelectUserExists 查询用户的存在情况，并返回错误
func SelectUserExists(userName string) (bool, error) {
	request := &craneProtos.QueryUserInfoRequest{
		Uid:      0,
		UserList: []string{userName},
	}

	response, err := client.CraneCtld.QueryUserInfo(context.Background(), request)
	if err != nil {
		logrus.Errorf("Failed to show the user %v, error: %v", userName, err)
		return false, err
	}
	if !response.GetOk() {
		return false, nil
	}
	return true, nil
}

func DeleteUserFromAccount(userId, accountName string) error {
	return DeleteUsersFromAccount([]string{userId}, accountName)
}

func DeleteUsersFromAccount(userIds []string, accountName string) error {
	if len(userIds) == 0 {
		return nil
	}

	request := &craneProtos.DeleteUserRequest{
		Uid:      0,
		Account:  accountName,
		UserList: userIds,
	}

	response, err := client.CraneCtld.DeleteUser(context.Background(), request)
	if err != nil {
		return err
	}
	if !response.GetOk() {
		return fmt.Errorf("failed to delete users %v in account %v", userIds, accountName)
	}
	return nil
}

func DeleteUser(userId string) error {
	request := &craneProtos.DeleteUserRequest{
		Uid:      0,
		UserList: []string{userId},
	}

	response, err := client.CraneCtld.DeleteUser(context.Background(), request)
	if err != nil {
		logrus.Errorf("[DeleteUser] delete user %s failed due to %s", userId, err)
		return err
	}
	if !response.GetOk() {
		richErrors := response.GetRichErrorList()
		richErrorMessage := formatRichErrors(richErrors)
		if richErrorsAllHaveCode(richErrors, craneProtos.ErrCode_ERR_INVALID_USER) {
			logrus.Warnf("[DeleteUser] user %s does not exist in crane, ignored: %v", userId, richErrorMessage)
			return nil
		}

		logrus.Errorf("[DeleteUser] delete user %s failed: %v", userId, richErrorMessage)
		return fmt.Errorf("delete user %s failed: %v", userId, richErrorMessage)
	}
	return nil
}

func BlockUserInAccount(userId, accountName string) error {
	request := &craneProtos.BlockAccountOrUserRequest{
		Block:      true,
		Uid:        0,
		EntityType: craneProtos.EntityType_User,
		EntityList: []string{userId},
		Account:    accountName,
	}
	response, err := client.CraneCtld.BlockAccountOrUser(context.Background(), request)
	if err != nil {
		logrus.Errorf("BlockUserInAccount err: %v", err)
		return err
	}
	if !response.GetOk() {
		logrus.Errorf("BlockUserInAccount err: %v", fmt.Errorf("ASSOCIATION_NOT_EXISTS"))
		return fmt.Errorf("failed block user %v in account %v", userId, accountName)
	}
	return nil
}

func UnblockUserInAccount(userId, accountName string) error {
	request := &craneProtos.BlockAccountOrUserRequest{
		Block:      false,
		Uid:        0,
		EntityType: craneProtos.EntityType_User,
		EntityList: []string{userId},
		Account:    accountName,
	}
	response, err := client.CraneCtld.BlockAccountOrUser(context.Background(), request)
	if err != nil {
		logrus.Errorf("UnblockUserInAccount err: %v", err)
		return err
	}
	if !response.GetOk() {
		logrus.Errorf("UnblockUserInAccount err: %v", fmt.Errorf("ASSOCIATION_NOT_EXISTS"))
		return fmt.Errorf("failed unblock user %v in account %v", userId, accountName)
	}
	return nil
}

func HasUnfinishedJobsByUserName(userName string) (bool, error) {
	request := &craneProtos.QueryJobsInfoRequest{
		FilterUsers:                []string{userName},
		OptionIncludeCompletedJobs: false,
	}
	response, err := client.CraneCtld.QueryJobsInfo(context.Background(), request)

	if err != nil {
		return false, err
	}
	if !response.GetOk() {
		return false, nil
	}

	if len(response.GetJobInfoList()) != 0 {
		return true, nil
	}

	return false, nil
}

func GetAccountAssociatedUser(accountName string, excludeUserList []string) ([]string, error) {
	var userList []string

	request := &craneProtos.QueryUserInfoRequest{
		Uid:     0,
		Account: accountName,
	}
	response, err := client.CraneCtld.QueryUserInfo(context.Background(), request)
	if err != nil {
		return nil, err
	}
	if !response.GetOk() {
		return nil, fmt.Errorf("the account %v not have user", accountName)
	}
	for _, ui := range response.GetUserList() {
		if Contains(excludeUserList, ui.Name) {
			continue
		}
		userList = append(userList, ui.Name)
	}

	return userList, nil
}

func GetAccountUserNames(accountName string) ([]string, error) {
	request := &craneProtos.QueryUserInfoRequest{
		Uid:     0,
		Account: accountName,
	}
	response, err := client.CraneCtld.QueryUserInfo(context.Background(), request)
	if err != nil {
		return nil, err
	}
	if !response.GetOk() {
		logrus.Warnf("query account %v users failed, RichErrorList: %v", accountName, response.GetRichErrorList())
		return nil, nil
	}

	userNames := make([]string, 0, len(response.GetUserList()))
	for _, user := range response.GetUserList() {
		userNames = append(userNames, user.GetName())
	}
	return userNames, nil
}

func GetAccountUserBlockedInfo(accountName string) (map[string]bool, error) {
	request := &craneProtos.QueryUserInfoRequest{
		Uid:     0,
		Account: accountName,
	}
	response, err := client.CraneCtld.QueryUserInfo(context.Background(), request)
	if err != nil {
		return nil, err
	}
	if !response.GetOk() {
		return nil, fmt.Errorf("account %v have not user", accountName)
	}
	blockedInfo := make(map[string]bool)
	for _, ui := range response.GetUserList() {
		blockedInfo[ui.Name] = ui.Blocked
	}
	return blockedInfo, nil
}

func GetJobsStatusDistribution(authorizedPartitions []string) (map[string]*jobCount, error) {
	partitionJobs := make(map[string]*jobCount)
	for _, part := range client.CConfig.Partitions {
		if !slices.Contains(authorizedPartitions, part.Name) {
			continue
		}
		// 获取正在运行作业的个数
		runningJob, err := GetTaskByPartitionAndStatus([]string{part.Name}, []craneProtos.JobStatus{craneProtos.JobStatus_Running})
		if err != nil {
			return nil, fmt.Errorf("get running task failed: %v", err)
		}
		runningJobNum := len(runningJob)

		// 获取正在排队作业的个数
		pendingJob, err := GetTaskByPartitionAndStatus([]string{part.Name}, []craneProtos.JobStatus{craneProtos.JobStatus_Pending})
		if err != nil {
			return nil, fmt.Errorf("get pending task failed: %v", err)
		}
		pendingJobNum := len(pendingJob)

		totalJobNum := runningJobNum + pendingJobNum
		partitionJobs[part.Name] = &jobCount{
			JobCount:        uint32(totalJobNum),
			RunningJobCount: uint32(runningJobNum),
			PendingJobCount: uint32(pendingJobNum),
		}
	}
	return partitionJobs, nil
}
