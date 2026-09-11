package filesystem

import (
	"bytes"
	"fmt"
	"os/exec"
	"strings"

	"scowd/internal/auth"
	"scowd/internal/storage/disk"
	apiv1 "scowd/protos/gen/api/storage"

	"github.com/sirupsen/logrus"
)

type GpfsAdapter struct {
	filesystem string
	logger     *logrus.Entry
}

// NewGpfsAdapter creates a new GPFS adapter instance
// NewGpfsAdapter 创建 GPFS 适配器实例
func NewGpfsAdapter(path string, cfg *apiv1.GpfsConfig, logger *logrus.Entry) (*GpfsAdapter, error) {
	if strings.TrimSpace(cfg.Filesystem) == "" {
		return nil, fmt.Errorf("filesystem parameter is required in GPFS config")
	}
	return &GpfsAdapter{filesystem: cfg.Filesystem, logger: logger}, nil
}

func (a *GpfsAdapter) SetUsersQuota(users []string, path string, hardBytes, softBytes uint64, graceDays int) ([]string, []string, error) {
	// Convert bytes to KB (round up)
	hardKB := hardBytes / 1024
	if hardBytes%1024 != 0 {
		hardKB += 1
	}

	successUsers := make([]string, 0)
	failedUsers := make([]string, 0)

	for _, userName := range users {
		uid, err := auth.ResolveUserID(userName)
		if err != nil {
			a.logger.Printf("Failed to lookup user %s: %v", userName, err)
			failedUsers = append(failedUsers, userName)
			continue
		}

		// GPFS uses mmsetquota command with Device parameter
		cmd := exec.Command("mmsetquota", a.filesystem,
			"--user", uid,
			"--block", fmt.Sprintf("0:%dK", hardKB), // soft:hard block limit in KB (no unit means KB)
			"--files", "0:0", // inode limits
		)

		if err := cmd.Run(); err != nil {
			a.logger.Printf("Failed to set quota for user %s (UID: %s): %v", userName, uid, err)
			failedUsers = append(failedUsers, userName)
		} else {
			successUsers = append(successUsers, userName)
		}
	}

	return successUsers, failedUsers, nil
}

func (a *GpfsAdapter) SetUserQuota(userName, path string, hardBytes, softBytes uint64, graceDays int) error {
	// 字节转KB（向上取整避免为0）
	hardKB := hardBytes / 1024
	if hardBytes%1024 != 0 {
		hardKB += 1 // 非整KB时进位
	}

	// GPFS 接受名称或数字 ID。统一解析并传 UID，避免纯数字用户名被当作 UID。
	uid, err := auth.ResolveUserID(userName)
	if err != nil {
		return fmt.Errorf("failed to lookup user %s: %v", userName, err)
	}

	// GPFS uses mmsetquota command with Device parameter
	cmd := exec.Command("mmsetquota", a.filesystem,
		"--user", uid,
		"--block", fmt.Sprintf("0:%dK", hardKB), // soft:hard block limit in KB (no unit means KB)
		"--files", "0:0", // inode limits
	)

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to set quota for user %s (UID: %s): %v", userName, uid, err)
	}

	return nil
}

func (a *GpfsAdapter) GetUsersQuota(users []string, path string) ([]QuotaInfo, error) {
	a.logger.Debugf("the number of users is %d", len(users))

	result := make([]QuotaInfo, 0, len(users))
	for _, userName := range users {
		uid, err := auth.ResolveUserID(userName)
		if err != nil {
			a.logger.WithError(err).Errorf("Failed to lookup user %s, skipping this user", userName)
			continue
		}

		// Query quota using mmlsquota command
		cmd := exec.Command("mmlsquota", "-u", uid, "-Y", "-e", a.filesystem)
		var out bytes.Buffer
		var errOut bytes.Buffer
		cmd.Stdout = &out
		cmd.Stderr = &errOut

		if err := cmd.Run(); err != nil {
			// mmrepquota命令在用户超出配额时可能返回非零退出码，但仍有有效输出
			// 如果有stdout输出，尝试解析；如果没有输出才报错
			if out.String() == "" {
				a.logger.WithError(err).
					Errorf("mmlsquota command failed for user %s (UID: %s), stdout: %s, stderr: %s, skipping this user",
						userName, uid, out.String(), errOut.String())
				continue
			}
			// 有输出时记录警告但继续处理
			a.logger.WithError(err).
				Warnf("mmlsquota command returned non-zero exit code for user %s (UID: %s), but has output, continuing to parse",
					userName, uid)
		}

		// Parse output
		quota, err := parseGpfsQuotaOutput(out.String(), path, a.logger)
		if err != nil {
			a.logger.WithError(err).Warnf("parse gpfs quota output error for user %s, skipping this user", userName)
			continue
		}
		if quota.Filesystem == "" {
			a.logger.WithError(err).Warnf("no quota configured for %s, skipping this user", userName)
			continue
		}
		quota.UserID = userName
		result = append(result, quota)
	}
	return result, nil
}

func (a *GpfsAdapter) SetGroupQuota(group, path string, hardBytes, softBytes uint64, graceDays int) error {
	hardKB := hardBytes / 1024
	if hardBytes%1024 != 0 {
		hardKB += 1
	}

	// 与用户配额一致，传 GID 可消除纯数字组名与 GID 之间的歧义。
	gid, err := auth.ResolveGroupID(group)
	if err != nil {
		return fmt.Errorf("failed to resolve group %s to GID: %w", group, err)
	}

	cmd := exec.Command("mmsetquota", a.filesystem,
		"--group", gid,
		"--block", fmt.Sprintf("0:%dK", hardKB),
		"--files", "0:0",
	)

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to set quota for group %s: %v", group, err)
	}

	return nil
}

func (a *GpfsAdapter) SetGroupsQuota(groups []string, path string, hardBytes, softBytes uint64, graceDays int) ([]string, []string, error) {
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

func (a *GpfsAdapter) GetGroupsQuota(groups []string, path string) ([]GroupQuotaInfo, error) {
	result := make([]GroupQuotaInfo, 0, len(groups))
	for _, group := range groups {
		gid, err := auth.ResolveGroupID(group)
		if err != nil {
			a.logger.WithError(err).Errorf("Failed to resolve group %s to GID, skipping this group", group)
			continue
		}
		cmd := exec.Command("mmlsquota", "-g", gid, "-Y", "-e", a.filesystem)
		var out bytes.Buffer
		var errOut bytes.Buffer
		cmd.Stdout = &out
		cmd.Stderr = &errOut

		if err := cmd.Run(); err != nil {
			if out.String() == "" {
				a.logger.WithError(err).
					Errorf("mmlsquota command failed for group %s, skipping", group)
				continue
			}
			a.logger.WithError(err).
				Warnf("mmlsquota command returned non-zero exit code for group %s, continuing to parse", group)
		}

		quota, err := parseGpfsGroupQuotaOutput(out.String(), path, a.logger)
		if err != nil {
			a.logger.WithError(err).Warnf("parse gpfs quota output error for group %s, skipping", group)
			continue
		}
		if quota.Filesystem == "" {
			a.logger.WithError(err).Warnf("no quota configured for group %s, skipping", group)
			continue
		}
		quota.GroupName = group
		result = append(result, quota)
	}
	return result, nil
}

// 解析GPFS quota输出（-Y参数格式）
func parseGpfsQuotaOutput(output, path string, logger *logrus.Entry) (QuotaInfo, error) {
	lines := strings.Split(output, "\n")

	totalSpace, _, err := storage.GetDiskSpace(path)
	if err != nil {
		logger.WithError(err).Errorf("Failed to get the file system")
		return QuotaInfo{}, err
	}

	for _, line := range lines {
		line = strings.TrimSpace(line)
		// 跳过HEADER行和空行
		if strings.HasPrefix(line, "mmlsquota:user:HEADER:") || line == "" {
			continue
		}

		// -Y参数输出格式: mmlsquota:user:0:1:::share:USR:69031:l202300293:603136:0:0:0:none:2304:0:0:0:none::0:root:
		// 字段顺序: mmlsquota:user:HEADER:version:reserved:reserved:filesystemName:quotaType:id:name:blockUsage:blockQuota:blockLimit:blockInDoubt:blockGrace:filesUsage:filesQuota:filesLimit:filesInDoubt:filesGrace:remarks:fid:filesetname:
		if strings.HasPrefix(line, "mmlsquota:user:") && strings.Contains(line, ":USR:") {
			fields := strings.Split(line, ":")
			// 确保有足够的字段
			if len(fields) < 23 {
				continue
			}

			logger.Debugf("parse gpfs quota fields %v", fields)

			// 解析字段：blockUsage(10), blockQuota(11), blockLimit(12), blockGrace(14)
			// 在GPFS配额输出中，当用户的磁盘使用量超过软限制时，
			// blockUsage字段的数字后面可能会附加一个星号(*)作为警告标识
			// 例如："603136*" 表示使用了603136KB且已超过软限制
			// 这里使用TrimSuffix去除星号，只保留数字部分用于计算
			blocksUsedStr := strings.TrimSuffix(fields[10], "*")
			blocksUsed, err := parseIntWithCheck(blocksUsedStr)
			if err != nil {
				return QuotaInfo{}, fmt.Errorf("failed to parse blocks used: %v", err)
			}

			softLimit, err := parseIntWithCheck(fields[11])
			if err != nil {
				return QuotaInfo{}, fmt.Errorf("failed to parse soft limit: %v", err)
			}

			var hardLimit uint64
			if limit, err := parseIntWithCheck(fields[12]); err != nil {
				return QuotaInfo{}, fmt.Errorf("failed to parse hard limit: %v", err)
			} else if limit == 0 { // limit字段为0表示无限制
				hardLimit = totalSpace
			} else {
				hardLimit = limit * 1024
			}

			return QuotaInfo{
				Filesystem:            path, // GPFS使用路径作为文件系统标识
				BlockUsedStorageBytes: blocksUsed * 1024,
				BlockSoftLimitBytes:   softLimit * 1024,
				BlockHardLimitBytes:   hardLimit,
				BlockGraceDays:        parseGracePeriod(fields[14]),
			}, nil
		}
	}
	return QuotaInfo{}, nil
}

// parseGpfsGroupQuotaOutput 解析 mmlsquota -g 的 -Y 格式输出
func parseGpfsGroupQuotaOutput(output, path string, logger *logrus.Entry) (GroupQuotaInfo, error) {
	lines := strings.Split(output, "\n")

	totalSpace, _, err := storage.GetDiskSpace(path)
	if err != nil {
		logger.WithError(err).Errorf("Failed to get the file system")
		return GroupQuotaInfo{}, err
	}

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "mmlsquota:group:HEADER:") || line == "" {
			continue
		}

		// 格式与用户配额相同，但 quotaType 字段为 GRP
		if strings.HasPrefix(line, "mmlsquota:group:") && strings.Contains(line, ":GRP:") {
			fields := strings.Split(line, ":")
			if len(fields) < 23 {
				continue
			}

			logger.Debugf("parse gpfs group quota fields %v", fields)

			blocksUsedStr := strings.TrimSuffix(fields[10], "*")
			blocksUsed, err := parseIntWithCheck(blocksUsedStr)
			if err != nil {
				return GroupQuotaInfo{}, fmt.Errorf("failed to parse blocks used: %v", err)
			}

			softLimit, err := parseIntWithCheck(fields[11])
			if err != nil {
				return GroupQuotaInfo{}, fmt.Errorf("failed to parse soft limit: %v", err)
			}

			var hardLimit uint64
			if limit, err := parseIntWithCheck(fields[12]); err != nil {
				return GroupQuotaInfo{}, fmt.Errorf("failed to parse hard limit: %v", err)
			} else if limit == 0 {
				hardLimit = totalSpace
			} else {
				hardLimit = limit * 1024
			}

			return GroupQuotaInfo{
				Filesystem:            path,
				BlockUsedStorageBytes: blocksUsed * 1024,
				BlockSoftLimitBytes:   softLimit * 1024,
				BlockHardLimitBytes:   hardLimit,
				BlockGraceDays:        parseGracePeriod(fields[14]),
			}, nil
		}
	}
	return GroupQuotaInfo{}, nil
}
