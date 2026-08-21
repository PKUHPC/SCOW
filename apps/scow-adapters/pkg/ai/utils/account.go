package utils

import (
	"fmt"
	"regexp"
)

var accountNameRe = regexp.MustCompile(`^[A-Za-z0-9_-]{1,255}$`)

// CheckAccount 检查 AI 账户名是否符合数据库和业务约束。
func CheckAccount(name string) error {
	if !accountNameRe.MatchString(name) {
		return fmt.Errorf("the account must be 1-255 characters containing only letters, digits, underscores, and hyphens")
	}
	return nil
}
