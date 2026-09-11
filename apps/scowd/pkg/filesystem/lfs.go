package filesystem

import (
	"bytes"
	"fmt"
	"os/exec"
	"regexp"
	"strconv"
	"strings"

	"github.com/sirupsen/logrus"

	"scowd/pkg/libs/auth"
	storageUtils "scowd/pkg/utils/storage"
	apiv1 "scowd/protos/gen/api/storage"
)

type LfsAdapter struct {
	logger *logrus.Entry
}

// NewLfsAdapter 创建 Lustre 适配器实例
func NewLfsAdapter(path string, cfg *apiv1.LustreConfig, logger *logrus.Entry) (*LfsAdapter, error) {
	return &LfsAdapter{logger: logger}, nil
}

func (a *LfsAdapter) SetUsersQuota(users []string, path string, hardBytes, softBytes uint64, graceDays int) ([]string, []string, error) {
	// Convert bytes to KB (round up)
	hardKB := hardBytes / 1024
	if hardBytes%1024 != 0 {
		hardKB += 1
	}

	successUsers := make([]string, 0)
	failedUsers := make([]string, 0)

	for _, user := range users {
		uid, err := auth.ResolveUserID(user)
		if err != nil {
			a.logger.Errorf("Failed to resolve user %s to UID: %v", user, err)
			failedUsers = append(failedUsers, user)
			continue
		}
		// LFS uses lfs setquota command
		cmd := exec.Command("lfs", "setquota", "-u", uid,
			"-b", "0", // block soft limit
			"-B", strconv.FormatUint(hardKB, 10), // block hard limit
			"-i", "0", // inode soft limit
			"-I", "0", // inode hard limit
			path,
		)
		var stderr bytes.Buffer
		cmd.Stderr = &stderr

		if err := cmd.Run(); err != nil {
			a.logger.Errorf("Failed to set quota for user %s: %v, stderr: %s", user, err, stderr.String())
			failedUsers = append(failedUsers, user)
		} else {
			if stderr.Len() > 0 {
				a.logger.Warnf("lfs setquota for user %s succeeded but produced stderr output (quota may not be enabled on %s): %s", user, path, stderr.String())
			}
			successUsers = append(successUsers, user)
		}
	}

	return successUsers, failedUsers, nil
}

func (a *LfsAdapter) SetUserQuota(user, path string, hardBytes, softBytes uint64, graceDays int) error {
	// 字节转KB（向上取整避免为0）
	hardKB := hardBytes / 1024
	if hardBytes%1024 != 0 {
		hardKB += 1 // 非整KB时进位
	}

	uid, err := auth.ResolveUserID(user)
	if err != nil {
		return fmt.Errorf("failed to resolve user %s to UID: %w", user, err)
	}

	cmd := exec.Command("lfs", "setquota", "-u", uid,
		"-b", "0", // block soft limit
		"-B", strconv.FormatUint(hardKB, 10), // block hard limit
		"-i", "0", // inode soft limit
		"-I", "0", // inode hard limit
		path,
	)

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to set quota for user %s: %v", user, err)
	}

	return nil
}

func (a *LfsAdapter) GetUsersQuota(users []string, path string) ([]QuotaInfo, error) {
	a.logger.Debugf("the number of users is %d", len(users))

	result := make([]QuotaInfo, 0, len(users))
	for _, user := range users {
		uid, err := auth.ResolveUserID(user)
		if err != nil {
			a.logger.WithError(err).Errorf("Failed to resolve user %s to UID, skipping this user", user)
			continue
		}
		// Query quota using lfs quota command
		cmd := exec.Command("lfs", "quota", "-u", uid, path)
		var out bytes.Buffer
		var errOut bytes.Buffer
		cmd.Stdout = &out
		cmd.Stderr = &errOut

		if err := cmd.Run(); err != nil {
			// lfs quota命令在用户超出配额时可能返回非零退出码，但仍有有效输出
			// 如果有stdout输出，尝试解析；如果没有输出才报错
			if out.String() == "" {
				a.logger.WithError(err).Errorf("lfs quota command failed for user %s, stdout: %s, stderr: %s, skipping this user", user, out.String(), errOut.String())
				continue
			}
			// 有输出时记录警告但继续处理
			a.logger.WithError(err).Warnf("lfs quota command returned non-zero exit code for user %s, but has output, continuing to parse", user)
		}

		// Parse output
		quota, err := parseLfsQuotaOutput(out.String(), path, a.logger)
		if err != nil {
			a.logger.WithError(err).Warnf("parse lfs quota output error for user %s, skipping this user", user)
			continue
		}

		if quota.Filesystem == "" {
			a.logger.WithError(err).Warnf("no quota configured for %s, skipping this user", user)
			continue
		}
		quota.UserID = user
		result = append(result, quota)
	}
	return result, nil
}

func (a *LfsAdapter) SetGroupQuota(group, path string, hardBytes, softBytes uint64, graceDays int) error {
	hardKB := hardBytes / 1024
	if hardBytes%1024 != 0 {
		hardKB += 1
	}

	gid, err := auth.ResolveGroupID(group)
	if err != nil {
		return fmt.Errorf("failed to resolve group %s to GID: %w", group, err)
	}

	cmd := exec.Command("lfs", "setquota", "-g", gid,
		"-b", "0",
		"-B", strconv.FormatUint(hardKB, 10),
		"-i", "0",
		"-I", "0",
		path,
	)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to set quota for group %s: %v, stderr: %s", group, err, stderr.String())
	}
	if stderr.Len() > 0 {
		a.logger.Warnf("lfs setquota for group %s succeeded but produced stderr output (quota may not be enabled on %s): %s", group, path, stderr.String())
	}

	return nil
}

func (a *LfsAdapter) SetGroupsQuota(groups []string, path string, hardBytes, softBytes uint64, graceDays int) ([]string, []string, error) {
	successGroups := make([]string, 0)
	failedGroups := make([]string, 0)

	for _, group := range groups {
		if err := a.SetGroupQuota(group, path, hardBytes, softBytes, graceDays); err != nil {
			a.logger.Printf("Failed to set quota for group %s: %v", group, err)
			failedGroups = append(failedGroups, group)
		} else {
			successGroups = append(successGroups, group)
		}
	}

	return successGroups, failedGroups, nil
}

func (a *LfsAdapter) GetGroupsQuota(groups []string, path string) ([]GroupQuotaInfo, error) {
	result := make([]GroupQuotaInfo, 0, len(groups))
	for _, group := range groups {
		gid, err := auth.ResolveGroupID(group)
		if err != nil {
			a.logger.WithError(err).Errorf("Failed to resolve group %s to GID, skipping this group", group)
			continue
		}
		cmd := exec.Command("lfs", "quota", "-g", gid, path)
		var out bytes.Buffer
		var errOut bytes.Buffer
		cmd.Stdout = &out
		cmd.Stderr = &errOut

		if err := cmd.Run(); err != nil {
			if out.String() == "" {
				a.logger.WithError(err).Errorf("lfs quota command failed for group %s, skipping", group)
				continue
			}
			a.logger.WithError(err).Warnf("lfs quota command returned non-zero exit code for group %s, continuing to parse", group)
		}

		quota, err := parseLfsQuotaOutput(out.String(), path, a.logger)
		if err != nil {
			a.logger.WithError(err).Warnf("parse lfs quota output error for group %s, skipping", group)
			continue
		}
		if quota.Filesystem == "" {
			a.logger.WithError(err).Warnf("no quota configured for group %s, skipping", group)
			continue
		}
		result = append(result, GroupQuotaInfo{
			Filesystem:            quota.Filesystem,
			GroupName:             group,
			BlockUsedStorageBytes: quota.BlockUsedStorageBytes,
			BlockSoftLimitBytes:   quota.BlockSoftLimitBytes,
			BlockHardLimitBytes:   quota.BlockHardLimitBytes,
			BlockGraceDays:        quota.BlockGraceDays,
		})
	}
	return result, nil
}

// 解析LFS quota输出
func parseLfsQuotaOutput(output, path string, logger *logrus.Entry) (QuotaInfo, error) {
	lines := strings.Split(output, "\n")

	totalSpace, _, err := storageUtils.GetDiskSpace(path)
	if err != nil {
		logger.WithError(err).Errorf("Failed to get the file system")
		return QuotaInfo{}, err
	}

	for _, line := range lines {
		line = strings.TrimSpace(line)
		// LFS quota output format: filesystem kbytes quota limit grace files quota limit grace
		if strings.Contains(line, path) || strings.Contains(line, "/") {
			// 正则表达式匹配LFS quota输出格式
			re := regexp.MustCompile(`^(\S+)\s+(\d+)\*?\s+(\d+)\s+(\d+)\s+(\S*)\s+(\d+)\*?\s+(\d+)\s+(\d+)\s*(\S*)$`)
			matches := re.FindStringSubmatch(line)

			if len(matches) < 9 {
				continue
			}

			logger.Debugf("parse lfs quota matches %v", matches)
			// 解析核心字段
			var hardLimit uint64
			if limit, err := parseIntWithCheck(matches[4]); err != nil {
				return QuotaInfo{}, fmt.Errorf("failed to parse hard limit: %v", err)
			} else if limit == 0 { // limit字段为0表示无限制
				hardLimit = totalSpace
			} else {
				hardLimit = limit * 1024
			}

			// 提取blocks字段的数字部分（去除可能的*号）
			// 当用户的磁盘使用量超过软限制时，
			// blocks字段的数字后面会附加一个星号(*)作为警告标识
			// 例如："1024*" 表示使用了1024KB且已超过软限制
			// 这里使用TrimSuffix去除星号，只保留数字部分用于计算
			blocksStr := strings.TrimSuffix(matches[2], "*")
			blocksUsed, err := parseIntWithCheck(blocksStr)
			if err != nil {
				return QuotaInfo{}, fmt.Errorf("failed to parse blocks used: %v", err)
			}

			softLimit, err := parseIntWithCheck(matches[3])
			if err != nil {
				return QuotaInfo{}, fmt.Errorf("failed to parse soft limit: %v", err)
			}

			return QuotaInfo{
				Filesystem:            matches[1],
				BlockUsedStorageBytes: blocksUsed * 1024,
				BlockSoftLimitBytes:   softLimit * 1024,
				BlockHardLimitBytes:   hardLimit,
				BlockGraceDays:        parseGracePeriod(matches[5]),
			}, nil
		}
	}
	return QuotaInfo{}, nil
}

// 带错误检查的parseInt函数
func parseIntWithCheck(s string) (uint64, error) {
	if s == "" {
		return 0, nil
	}
	val, err := strconv.ParseUint(s, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("failed to parse integer '%s': %v", s, err)
	}
	return val, nil
}
