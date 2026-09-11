package filesystem

import (
	"errors"
	"strings"

	"github.com/Masterminds/semver"
	"github.com/sirupsen/logrus"
)

var (
	ErrUnsupportedVersion    = errors.New("unsupported file system version")
	ErrUnsupportedFilesystem = errors.New("unsupported file system")
	ErrInvalidConfig         = errors.New("invalid storage configuration")
)

type QuotaInfo struct {
	Filesystem            string
	UserID                string
	BlockUsedStorageBytes uint64 // 单位：字节
	BlockSoftLimitBytes   uint64 // 单位：字节
	BlockHardLimitBytes   uint64 // 单位：字节
	BlockGraceDays        int    // 宽限天数
}

type GroupQuotaInfo struct {
	Filesystem            string
	GroupName             string
	BlockUsedStorageBytes uint64 // 单位：字节
	BlockSoftLimitBytes   uint64 // 单位：字节
	BlockHardLimitBytes   uint64 // 单位：字节
	BlockGraceDays        int    // 宽限天数
}

// FileSystemAdapter 适配器通用接口
type FileSystemAdapter interface {
	SetUserQuota(user string, path string, hardBytes, softBytes uint64, graceDays int) error
	SetUsersQuota(users []string, path string, hardBytes, softBytes uint64, graceDays int) ([]string, []string, error)
	GetUsersQuota(users []string, path string) ([]QuotaInfo, error)
	SetGroupQuota(group string, path string, hardBytes, softBytes uint64, graceDays int) error
	SetGroupsQuota(groups []string, path string, hardBytes, softBytes uint64, graceDays int) ([]string, []string, error)
	GetGroupsQuota(groups []string, path string) ([]GroupQuotaInfo, error)
}

func checkVersionCompatible(current, required string) bool {
	currentVer := semver.MustParse(strings.TrimPrefix(current, "v"))
	constraint, err := semver.NewConstraint(required)
	if err != nil {
		logrus.WithError(err)
		return false
	}
	return constraint.Check(currentVer)
}
