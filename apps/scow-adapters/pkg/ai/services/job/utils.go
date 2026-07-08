package job

import (
	"fmt"
	"strings"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc/codes"

	"scow-adapters/pkg/ai/utils"
	ce "scow-adapters/pkg/common/error"
)

func EscapeLikePattern(pattern string) string {
	replacer := strings.NewReplacer(
		`\`, `\\`,
		`%`, `\%`,
		`_`, `\_`,
	)

	return replacer.Replace(pattern)
}

func CheckUserInfo(accountName, userName string) (err error) {
	// 检查账号名是否存在
	exist, err := utils.SelectAccountExists(accountName)
	if err != nil {
		logrus.Errorf("SubmitJob failed %v", err)
		return ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("account %s not found", accountName)
		logrus.Errorf("SubmitJob failed %v", err)
		return ce.RichError(codes.NotFound, "ACCOUNT_NOT_FOUND", err.Error())
	}

	account, err := utils.GetAccountByName(accountName)
	if err != nil {
		logrus.Errorf("SubmitJob query account %s failed: %v", accountName, err)
		return ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	if account.Blocked == 1 {
		err = fmt.Errorf("the account has been blocked")
		logrus.Errorf("SubmitJob failed %v", err)
		return ce.RichError(codes.Internal, "ACCOUNT_BLOCKED", err.Error())
	}

	// 检查用户名是否在
	exist, err = utils.SelectUserExists(userName)
	if err != nil {
		logrus.Errorf("SubmitJob failed %v", err)
		return ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("user %s not found", userName)
		logrus.Errorf("SubmitJob failed %v", err)
		return ce.RichError(codes.NotFound, "USER_NOT_FOUND", err.Error())
	}

	// 判断账户与用户关联是否存在
	associate, err := utils.GetAssociateByAccountAndUser(accountName, userName)
	if err != nil {
		logrus.Errorf("SubmitJob get associate by account %v and user: %v failed: %v", accountName, userName, err)
		return ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if associate == nil {
		err = fmt.Errorf("the assoc not found")
		logrus.Errorf("SubmitJob failed %v", err)
		return ce.RichError(codes.NotFound, "ASSOC_NOT_FOUND", err.Error())
	}

	// 获取配置信息
	if associate.Blocked == 1 {
		err = fmt.Errorf("the user has been blocked")
		logrus.Errorf("SubmitJob failed %v", err)
		return ce.RichError(codes.Internal, "USER_BLOCKED", err.Error())
	}
	return nil
}
