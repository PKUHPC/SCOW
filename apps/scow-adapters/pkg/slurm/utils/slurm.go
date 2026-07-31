package utils

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"sync"

	"github.com/sirupsen/logrus"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/slurm/client"
	"scow-adapters/pkg/slurm/config"
)

// 预编译正则表达式以提高性能
var allowAccountsRe = regexp.MustCompile(`AllowAccounts=(\S+)`)

// AddUserToAccount 将用户加入账户，并根据 SCOW 的完整分区权限设置 association。
// partitions 是集群全部分区，allowedPartitions 是该账户当前授权分区。
// Slurm 不能稳定地通过多次 create user 为同一用户、账户追加分区，因此先一次创建
// 全部分区 association 并默认封锁，再只恢复授权分区。后续步骤失败时会保持默认拒绝，
// 避免用户在未授权分区获得短暂或持续的作业提交权限。
func AddUserToAccount(ctx context.Context, user, account, baseQos string, partitions, allowedPartitions []string) error {
	defaultQos := config.SlurmValue.Slurm.DefaultQOS
	allowedSet := make(map[string]struct{}, len(allowedPartitions))
	for _, partition := range allowedPartitions {
		allowedSet[strings.ToLower(partition)] = struct{}{}
	}
	allowed := make([]string, 0, len(partitions))
	blocked := make([]string, 0, len(partitions))
	for _, partition := range partitions {
		if _, ok := allowedSet[strings.ToLower(partition)]; ok {
			allowed = append(allowed, partition)
		} else {
			blocked = append(blocked, partition)
		}
	}

	if err := createUserInAccountPartitions(ctx, user, account, partitions); err != nil {
		return rollbackAddedUserToAccount(ctx, user, account, err,
			DeleteUserAccountAssociation, DeleteUserAssociationBlockRecords)
	}
	if err := blockUserInAccountPartitionsByPermission(ctx, user, account, blocked); err != nil {
		return rollbackAddedUserToAccount(ctx, user, account, err,
			DeleteUserAccountAssociation, DeleteUserAssociationBlockRecords)
	}
	if err := allowUserInAccountPartitionsByPermission(ctx, user, account, allowed); err != nil {
		return rollbackAddedUserToAccount(ctx, user, account, err,
			DeleteUserAccountAssociation, DeleteUserAssociationBlockRecords)
	}

	args := []string{"-i", "modify", "user", "where", fmt.Sprintf("name=%s", user), fmt.Sprintf("account=%s", account), "set", fmt.Sprintf("qos=%s", baseQos), fmt.Sprintf("DefaultQOS=%s", defaultQos)}
	exitCode, stdout, stderr, err := ExecuteCommandContext(ctx, client.SACCTMGR, args...)
	if err != nil {
		var cause error
		if exitCode == -1 {
			// 命令执行前就失败了
			cause = fmt.Errorf("system error: %v", err)
		} else {
			// 命令执行但失败了
			cause = fmt.Errorf("modify user failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
		}
		return rollbackAddedUserToAccount(ctx, user, account, cause,
			DeleteUserAccountAssociation, DeleteUserAssociationBlockRecords)
	}

	return nil
}

// rollbackAddedUserToAccount 清理 AddUserToAccount 失败前可能已经创建的部分 association。
// 补偿不继承原请求的取消状态；删除 association 失败时保留恢复记录，避免仍存在的封锁关系丢失原值。
func rollbackAddedUserToAccount(
	ctx context.Context,
	user, account string,
	cause error,
	deleteAssociation func(context.Context, string, string) error,
	deleteRecords func(string, string) error,
) error {
	rollbackCtx := context.WithoutCancel(ctx)
	if err := deleteAssociation(rollbackCtx, user, account); err != nil {
		return fmt.Errorf("%w; rollback delete user-account association failed: %v", cause, err)
	}
	if err := deleteRecords(account, user); err != nil {
		return fmt.Errorf("%w; rollback cleanup block records failed: %v", cause, err)
	}
	return cause
}

// createUserInAccountPartitions 一次创建用户在账户全部分区中的 association。
// 创建时把所有分区默认设为 GrpJobs=0、GrpSubmitJobs=0，使权限收敛过程始终失败关闭。
func createUserInAccountPartitions(ctx context.Context, user, account string, partitions []string) error {
	if len(partitions) == 0 {
		return nil
	}
	args := []string{"-i", "create", "user", fmt.Sprintf("name=%s", user),
		fmt.Sprintf("partition=%s", strings.Join(partitions, ",")), fmt.Sprintf("account=%s", account)}
	args = append(args, accountPartitionBlockLimitArgs(true)...)
	exitCode, stdout, stderr, err := ExecuteCommandContext(ctx, client.SACCTMGR, args...)
	if err != nil {
		// sacctmgr 对已存在的用户 association 可能以非 0 退出，但 Nothing added
		// 表示请求是幂等的 no-op，不应导致整个 SCOW 同步失败。
		if strings.Contains(stdout+"\n"+stderr, "Nothing added") {
			return nil
		}
		if exitCode == -1 {
			return fmt.Errorf("system error: %v", err)
		}
		return fmt.Errorf("create user failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
	}
	return nil
}

// blockUserInAccountPartitionsByPermission 确保新用户在未授权分区中保持封锁。
// create user 已为全部分区写入 Grp*=0，这里再执行一次幂等修改，以兼容
// create user 返回 Nothing added 但现有 association 状态与 SCOW 期望不一致的情况。
// 恢复记录保存的 -1 是 SCOW 解除该分区限制时应恢复的值。
func blockUserInAccountPartitionsByPermission(ctx context.Context, user, account string, partitions []string) error {
	if len(partitions) == 0 {
		return nil
	}
	defaultLimits := associationLimitPair{Jobs: associationUnlimitedLimit, SubmitJobs: associationUnlimitedLimit}
	records := make([]accountBlockRecord, 0, len(partitions))
	for _, partition := range partitions {
		records = append(records, accountBlockRecord{
			Account: account, Partition: partition, User: user,
			Original: defaultLimits,
		})
	}
	if err := saveAccountBlockRecords(records); err != nil {
		return err
	}

	return forEachAssociationBatch(partitions, func(batch []string) error {
		args := []string{"-i", "-Q", "modify", "user", "where",
			fmt.Sprintf("name=%s", user), fmt.Sprintf("account=%s", account),
			fmt.Sprintf("partition=%s", strings.Join(batch, ",")),
			fmt.Sprintf("cluster=%s", config.SlurmValue.MySQLConfig.ClusterName), "set"}
		args = append(args, accountPartitionBlockLimitArgs(true)...)
		return executeAssociationModification(ctx, "block new user unauthorized partitions", args)
	})
}

// allowUserInAccountPartitionsByPermission 只恢复 SCOW 明确授权的分区。
// 未授权分区始终保持 Grp*=0；即使本步失败，也只会导致授权分区暂时不可用。
func allowUserInAccountPartitionsByPermission(ctx context.Context, user, account string, partitions []string) error {
	return forEachAssociationBatch(partitions, func(batch []string) error {
		args := []string{"-i", "-Q", "modify", "user", "where",
			fmt.Sprintf("name=%s", user), fmt.Sprintf("account=%s", account),
			fmt.Sprintf("partition=%s", strings.Join(batch, ",")),
			fmt.Sprintf("cluster=%s", config.SlurmValue.MySQLConfig.ClusterName), "set"}
		args = append(args, accountPartitionBlockLimitArgs(false)...)
		return executeAssociationModification(ctx, "allow new user authorized partitions", args)
	})
}

func createUserAssociationsInAccountPartition(ctx context.Context, users []string, account, partition string, partitionBlocked bool) error {
	if len(users) == 0 {
		return nil
	}

	blockedUsers, err := getRecordedBlockedUsersInAccount(account)
	if err != nil {
		return err
	}
	defaultLimits := associationLimitPair{Jobs: associationUnlimitedLimit, SubmitJobs: associationUnlimitedLimit}

	return forEachAssociationBatch(users, func(batch []string) error {
		args := []string{"-i", "create", "user",
			fmt.Sprintf("name=%s", strings.Join(batch, ",")),
			fmt.Sprintf("partition=%s", partition),
			fmt.Sprintf("account=%s", account)}
		if partitionBlocked {
			// SCOW 请求已明确该分区无权限，创建时直接写入双零，避免先创建为可用状态的窗口。
			args = append(args, accountPartitionBlockLimitArgs(true)...)
		}
		exitCode, stdout, stderr, commandErr := ExecuteCommandContext(ctx, client.SACCTMGR, args...)
		if commandErr != nil {
			if exitCode == -1 {
				return fmt.Errorf("system error: %v", commandErr)
			}
			output := strings.TrimSpace(stdout + "\n" + stderr)
			if !strings.Contains(output, "Nothing added") && !strings.Contains(output, "Nothing modified") {
				return fmt.Errorf("create user association failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
			}
		}
		if partitionBlocked {
			// 新 association 的封锁前默认值为 -1，保存后可在 SCOW 重新授权时恢复。
			records := make([]accountBlockRecord, 0, len(batch))
			for _, user := range batch {
				records = append(records, accountBlockRecord{
					Account: account, Partition: partition, User: user, Original: defaultLimits,
				})
			}
			if err := saveAccountBlockRecords(records); err != nil {
				return err
			}
		}

		var blockedInBatch []string
		var userRecords []userBlockRecord
		for _, user := range batch {
			if _, blocked := blockedUsers[user]; !blocked {
				continue
			}
			blockedInBatch = append(blockedInBatch, user)
			userRecords = append(userRecords, userBlockRecord{
				Account: account, User: user, Partition: partition, Original: defaultLimits,
			})
		}
		if err := saveUserBlockRecords(userRecords); err != nil {
			return err
		}
		if len(blockedInBatch) == 0 {
			return nil
		}
		blockArgs := []string{"-i", "-Q", "modify", "user", "where",
			fmt.Sprintf("name=%s", strings.Join(blockedInBatch, ",")), fmt.Sprintf("account=%s", account),
			fmt.Sprintf("partition=%s", partition),
			fmt.Sprintf("cluster=%s", config.SlurmValue.MySQLConfig.ClusterName), "set"}
		blockArgs = append(blockArgs, userBlockLimitArgs(true)...)
		return executeAssociationModification(ctx, "block new user associations by user state", blockArgs)
	})
}

// EnsureAccountUsersAssociationInPartition 确保账户下已有用户在指定分区中存在 association。
// partitionBlocked 直接来自当前请求的完整分区权限；新 association 创建时立即使用该权限。
func EnsureAccountUsersAssociationInPartition(ctx context.Context, account, partition string, partitionBlocked bool) error {
	users, err := GetAccountAssociatedUserInDatabase(account, nil)
	if err != nil {
		return fmt.Errorf("get account associated users failed: %w", err)
	}
	if len(users) == 0 {
		logrus.Infof("EnsureAccountUsersAssociationInPartition: no users found for account=%s, skip", account)
		return nil
	}

	associatedUsers, err := GetAccountAssociatedUsersInPartition(account, partition)
	if err != nil {
		return fmt.Errorf("get account associated users in partition failed: %w", err)
	}
	associatedUserSet := make(map[string]struct{}, len(associatedUsers))
	for _, user := range associatedUsers {
		associatedUserSet[user] = struct{}{}
	}

	var missingUsers []string
	for _, user := range users {
		if _, ok := associatedUserSet[user]; ok {
			continue
		}
		missingUsers = append(missingUsers, user)
	}

	if len(missingUsers) == 0 {
		return nil
	}

	if err := createUserAssociationsInAccountPartition(ctx, missingUsers, account, partition, partitionBlocked); err != nil {
		return fmt.Errorf("create associations for users=%v account=%s partition=%s failed: %w", missingUsers, account, partition, err)
	}
	logrus.Infof("EnsureAccountUsersAssociationInPartition: created associations for users=%v account=%s partition=%s", missingUsers, account, partition)
	return nil
}

// DeleteUser 使用slurm命令删除用户
func DeleteUser(ctx context.Context, user string) error {
	args := []string{"-i", "delete", "user", fmt.Sprintf("name=%s", user)}
	exitCode, stdout, stderr, err := ExecuteCommandContext(ctx, client.SACCTMGR, args...)
	if err != nil {
		if exitCode == -1 {
			// 命令执行前就失败了
			return fmt.Errorf("system error: %v", err)
		} else {
			// 命令执行但失败了
			return fmt.Errorf("delete user failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
		}
	}
	return nil
}

// DeleteUserAccountAssociation 只删除用户与指定账户的关联，不修改用户本体和 DefaultAccount。
func DeleteUserAccountAssociation(ctx context.Context, user, account string) error {
	args := []string{"-i", "delete", "user", fmt.Sprintf("name=%s", user), fmt.Sprintf("account=%s", account)}
	exitCode, stdout, stderr, err := ExecuteCommandContext(ctx, client.SACCTMGR, args...)
	if err != nil {
		if exitCode == -1 {
			// 命令执行前就失败了
			return fmt.Errorf("system error: %v", err)
		} else {
			// 命令执行但失败了
			return fmt.Errorf("delete user account association failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
		}
	}
	return nil
}

// DeleteUserWithAccount 使用slurm命令修改用户的默认账户并删除用户
func DeleteUserWithAccount(ctx context.Context, user, account string, acctList []string) error {
	args := []string{"-i", "update", "user", "set", fmt.Sprintf("DefaultAccount=%s", acctList[0]), "where", fmt.Sprintf("user=%s", user)}
	exitCode, stdout, stderr, err := ExecuteCommandContext(ctx, client.SACCTMGR, args...)
	if err != nil {
		if exitCode == -1 {
			// 命令执行前就失败了
			return fmt.Errorf("system error: %v", err)
		} else {
			// 命令执行但失败了
			return fmt.Errorf("update user account failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
		}
	}
	args = []string{"-i", "delete", "user", fmt.Sprintf("name=%s", user), fmt.Sprintf("account=%s", account)}
	exitCode, stdout, stderr, err = ExecuteCommandContext(ctx, client.SACCTMGR, args...)
	if err != nil {
		if exitCode == -1 {
			// 命令执行前就失败了
			return fmt.Errorf("system error: %v", err)
		} else {
			// 命令执行但失败了
			return fmt.Errorf("delete user with account failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
		}
	}
	return nil
}

// CreateAccount 使用slurm命令创建账户
func CreateAccount(ctx context.Context, account string) error {
	args := []string{"-i", "create", "account", fmt.Sprintf("name=%s", account)}
	exitCode, stdout, stderr, err := ExecuteCommandContext(ctx, client.SACCTMGR, args...)
	if err != nil {
		// 同步期间账户可能已被其他步骤创建。sacctmgr 此时会返回非 0 和
		// Nothing added，但目标状态已满足，应按幂等成功处理。
		if strings.Contains(stdout+"\n"+stderr, "Nothing added") {
			return nil
		}
		if exitCode == -1 {
			// 命令执行前就失败了
			return fmt.Errorf("system error: %v", err)
		} else {
			// 命令执行但失败了
			return fmt.Errorf("create account failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
		}
	}
	return nil
}

// DeleteAccount 使用slurm命令删除账户
func DeleteAccount(ctx context.Context, account string) error {
	args := []string{"-i", "delete", "account", fmt.Sprintf("name=%s", account)}
	exitCode, stdout, stderr, err := ExecuteCommandContext(ctx, client.SACCTMGR, args...)
	if err != nil {
		if exitCode == -1 {
			// 命令执行前就失败了
			return fmt.Errorf("system error: %v", err)
		} else {
			// 命令执行但失败了
			return fmt.Errorf("delete account failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
		}
	}
	return nil
}

// BlockUserInAccount 封锁账户下的用户。
// 用户封锁只修改 MaxJobs、MaxSubmitJobs，不修改账户封锁使用的 Grp*，
// 因此账户封锁和用户封锁可以叠加，并能按各自保存的原值独立解封。
func BlockUserInAccount(ctx context.Context, user, account string) error {
	// 恢复记录只保存第一次封锁前的值，不能替代 Slurm 实际状态。即使记录已经存在，
	// 也仍要执行幂等的 Max*=0，以修复 association 被意外改回非零的状态漂移。
	recorded, err := IsUserBlockRecorded(account, user)
	if err != nil {
		return err
	}
	if !recorded {
		// 兼容旧版本已经通过 MaxJobs=0、MaxSubmitJobs=0 封锁，但尚未写入恢复记录的数据。
		// 这类数据没有可靠原值，解封函数会按历史行为回退到 -1，因此这里不保存两个 0。
		if IsUserBlockedInAccount(user, account) {
			return nil
		}

		// 用户在不同分区的 Max* 可能不同，必须在修改前逐分区读取并保存。
		originalLimits, err := GetUserMaxLimits(user, account)
		if err != nil {
			return err
		}
		if len(originalLimits) == 0 {
			return fmt.Errorf("no associations found for user=%s account=%s", user, account)
		}
		records := make([]userBlockRecord, 0, len(originalLimits))
		for partition, limits := range originalLimits {
			records = append(records, userBlockRecord{
				Account: account, User: user, Partition: partition, Original: normalizeOriginalLimits(limits),
			})
		}
		if err := saveUserBlockRecords(records); err != nil {
			_ = deleteUserBlockRecords(account, user)
			return err
		}
	}

	// 不指定 partition，使该账户下该用户现有的全部 association 同时封锁。
	args := []string{"-i", "-Q", "modify", "user", "where", fmt.Sprintf("name=%s", user), fmt.Sprintf("account=%s", account),
		fmt.Sprintf("cluster=%s", config.SlurmValue.MySQLConfig.ClusterName), "set"}
	args = append(args, userBlockLimitArgs(true)...)
	exitCode, stdout, stderr, err := ExecuteCommandContext(ctx, client.SACCTMGR, args...)
	if err != nil {
		// 只删除本次新建的恢复记录；已有记录属于第一次封锁，必须保留供以后重试和解封。
		if !recorded {
			_ = deleteUserBlockRecords(account, user)
		}
		if exitCode == -1 {
			// 命令执行前就失败了
			return fmt.Errorf("system error: %v", err)
		} else {
			// 命令执行但失败了
			return fmt.Errorf("block user failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
		}
	}
	return nil
}

// UnblockUserInAccount 解封账户下的用户，并逐分区恢复封锁前的 Max* 原值。
func UnblockUserInAccount(ctx context.Context, user, account string) error {
	records, err := getUserBlockRecords(account, user)
	if err != nil {
		return err
	}
	if len(records) == 0 {
		// 无恢复记录仅用于兼容旧数据：沿用历史行为，将两个 Max* 清为未限制。
		args := []string{"-i", "-Q", "modify", "user", "where", fmt.Sprintf("name=%s", user), fmt.Sprintf("account=%s", account),
			fmt.Sprintf("cluster=%s", config.SlurmValue.MySQLConfig.ClusterName), "set"}
		args = append(args, userBlockLimitArgs(false)...)
		if err := executeAssociationModification(ctx, "unblock user", args); err != nil {
			return err
		}
		return nil
	}

	// 封锁后新增的分区 association 在异常情况下可能没有对应恢复记录。
	// 对这些 association 只能回退到 -1；已有记录的分区随后仍会恢复第一次封锁前的原值。
	currentLimits, err := GetUserMaxLimits(user, account)
	if err != nil {
		return err
	}
	recordedPartitions := make(map[string]struct{}, len(records))
	for _, record := range records {
		recordedPartitions[record.Partition] = struct{}{}
	}
	var unrecordedBlockedPartitions []string
	for partition, limits := range currentLimits {
		if _, recorded := recordedPartitions[partition]; recorded {
			continue
		}
		if limits.Jobs == associationBlockedLimit || limits.SubmitJobs == associationBlockedLimit {
			unrecordedBlockedPartitions = append(unrecordedBlockedPartitions, partition)
		}
	}
	if err := forEachAssociationBatch(unrecordedBlockedPartitions, func(batch []string) error {
		args := []string{"-i", "-Q", "modify", "user", "where",
			fmt.Sprintf("name=%s", user), fmt.Sprintf("account=%s", account),
			fmt.Sprintf("partition=%s", strings.Join(batch, ",")),
			fmt.Sprintf("cluster=%s", config.SlurmValue.MySQLConfig.ClusterName), "set"}
		args = append(args, userBlockLimitArgs(false)...)
		return executeAssociationModification(ctx, "restore unrecorded user limits", args)
	}); err != nil {
		return err
	}

	// 相同原值的分区合并为一次 sacctmgr 调用，减少用户分区较多时的命令数量。
	grouped := make(map[associationLimitPair][]string)
	for _, record := range records {
		grouped[record.Original] = append(grouped[record.Original], record.Partition)
	}
	for limits, partitions := range grouped {
		if err := forEachAssociationBatch(partitions, func(batch []string) error {
			args := []string{"-i", "-Q", "modify", "user", "where",
				fmt.Sprintf("name=%s", user), fmt.Sprintf("account=%s", account),
				fmt.Sprintf("partition=%s", strings.Join(batch, ",")),
				fmt.Sprintf("cluster=%s", config.SlurmValue.MySQLConfig.ClusterName), "set"}
			args = append(args, userLimitArgs(limits.Jobs, limits.SubmitJobs)...)
			return executeAssociationModification(ctx, "restore user limits", args)
		}); err != nil {
			return err
		}
	}
	// 只有全部分区恢复成功后才能删除记录；中途失败时保留记录供接口重试。
	if err := deleteUserBlockRecords(account, user); err != nil {
		return err
	}
	return nil
}

// executeAssociationModification 统一处理 association 修改命令的错误语义。
// sacctmgr 在目标值已经生效时可能输出 Nothing modified；该情况满足幂等操作的目标，按成功处理。
func executeAssociationModification(ctx context.Context, operation string, args []string) error {
	exitCode, stdout, stderr, err := ExecuteCommandContext(ctx, client.SACCTMGR, args...)
	if err == nil || strings.TrimSpace(stdout) == "Nothing modified" {
		return nil
	}
	if exitCode == -1 {
		return fmt.Errorf("%s system error: %v", operation, err)
	}
	return fmt.Errorf("%s failed (exit %d), stdout: %s, stderr: %s", operation, exitCode, stdout, strings.TrimSpace(stderr))
}

// CheckJobExists 检查作业是否存在
func CheckJobExists(jobId uint32) error {
	args := []string{"--noheader", "-j", strconv.Itoa(int(jobId))}
	exitCode, stdout, stderr, err := ExecuteCommand(client.SQUEUE, args...)
	if err != nil {
		if exitCode == -1 {
			// 命令执行前就失败了
			return fmt.Errorf("system error: %v", err)
		} else {
			// 命令执行但失败了
			return fmt.Errorf("select job failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
		}
	}
	return nil
}

// GetJobsInAccountOrUser 获取账户或用户的作业数
func GetJobsInAccount(account string) (int, error) {
	args := []string{"--noheader", "-A", account, "-o", "%A"}
	exitCode, stdout, stderr, err := ExecuteCommand(client.SQUEUE, args...)
	if err != nil {
		if exitCode == -1 {
			// 命令执行前就失败了
			return 0, fmt.Errorf("[GetJobsInAccount] system error: %v", err)
		} else {
			// 命令执行但失败了
			return 0, fmt.Errorf("get jobs by account failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
		}
	}
	jobIDs := strings.Fields(stdout)
	logrus.Infof("[GetJobsInAccount] get job count: %d by account %s", len(jobIDs), account)
	return len(jobIDs), nil
}

// GetJobsInUser 获取用户的作业数
func GetJobsInUser(user string) (int, error) {
	args := []string{"--noheader", "-u", user, "-o", "%A"}
	exitCode, stdout, stderr, err := ExecuteCommand(client.SQUEUE, args...)
	if err != nil {
		if exitCode == -1 {
			// 命令执行前就失败了
			return 0, fmt.Errorf("[GetJobsInUser] system error: %v", err)
		} else {
			// 命令执行但失败了
			return 0, fmt.Errorf("[GetJobsInUser] get jobs by user failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
		}
	}
	jobIDs := strings.Fields(stdout)
	logrus.Infof("[GetJobsInUser] get job count: %d by user %s", len(jobIDs), user)
	return len(jobIDs), nil
}

func GetJobCountByPartitionAndState(partitionName, state string) (int, error) {
	args := []string{"--noheader", "-p", partitionName, "-t", state, "-o", "%A"}
	exitCode, stdout, stderr, err := ExecuteCommand(client.SQUEUE, args...)
	if err != nil {
		if exitCode == -1 {
			// 命令执行前就失败了
			return 0, fmt.Errorf("system error: %v", err)
		} else {
			// 命令执行但失败了
			return 0, fmt.Errorf("get job by partition failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
		}
	}
	jobIDs := strings.Fields(stdout)
	return len(jobIDs), nil
}

func GetUsedGpuInPartition(partition string) (int, error) {
	args := []string{"-p", partition, "-t", "r", "--format=%b", "--noheader"}
	exitCode, stdout, stderr, err := ExecuteCommand(client.SQUEUE, args...)
	if err != nil {
		if exitCode == -1 {
			// 命令执行前就失败了
			return 0, fmt.Errorf("system error: %v", err)
		} else {
			// 命令执行但失败了
			return 0, fmt.Errorf("get partition info failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
		}
	}

	var sum int
	scanner := bufio.NewScanner(strings.NewReader(stdout))
	for scanner.Scan() {
		line := scanner.Text()
		// 按冒号分割列
		columns := strings.Split(line, ":")
		if len(columns) == 0 {
			continue // 跳过空行
		}

		// 获取最后一列并转换为数值
		lastCol := columns[len(columns)-1]
		value, err := strconv.Atoi(lastCol)
		if err != nil {
			continue // 跳过非数值列
		}
		sum += value
	}

	return sum, nil
}

// GetAllowAccountsInPartition 获取分区中AllowAccounts
func GetAllowAccountsInPartition(partition string) (string, error) {
	partitionsResult, err := GetPartitionsByName(partition)
	if err != nil {
		return "", err
	}
	allowAccounts := extractValue(partitionsResult, allowAccountsRe)

	return allowAccounts, nil
}

// getJobIdForCancel 通过 squeue %i 获取用于 scancel 的作业 ID 字符串。
// 对于普通作业返回 "298"，对于 array task 返回 "288_10"。
// 若作业已结束（squeue 返回空），则回退到原始 jobId。
// 兼容 Slurm 19.05.x：该版本 scancel 不接受 array task 的内部 real job ID，
// 需使用 %i 格式（如 288_10）才能正确取消。
func getJobIdForCancel(jobId uint32) string {
	args := []string{"-j", strconv.Itoa(int(jobId)), "--noheader", "--format=%i"}
	_, stdout, _, err := ExecuteCommand(client.SQUEUE, args...)
	if err != nil {
		logrus.Errorf("Failed to get job id for cancel: %v", err)
		return strconv.Itoa(int(jobId))
	}
	result := strings.TrimSpace(stdout)
	if result == "" {
		logrus.Errorf("Job %d not found in squeue when trying to get job id for cancel, fallback to original job id", jobId)
		return strconv.Itoa(int(jobId))
	}
	lines := strings.Split(result, "\n")
	if len(lines) > 1 {
		// jobId 是 array 父 ID，squeue 返回了多个 task，直接用父 ID 取消整个数组
		logrus.Infof("Job %d is an array parent, will cancel the entire array", jobId)
		return strconv.Itoa(int(jobId))
	}
	return strings.TrimSpace(lines[0])
}

// LocalCancelJob 取消作业函数
func LocalCancelJob(username string, jobId uint32) (string, error) {
	var output bytes.Buffer

	cancelId := getJobIdForCancel(jobId)
	cmdLine := fmt.Sprintf("su - %s -c '%s %s'", username, client.SCANCEL, cancelId)
	cmd := exec.Command("bash", "-c", cmdLine)
	cmd.Stdout = &output
	cmd.Stderr = &output

	err := cmd.Run()
	if err != nil {
		logrus.Errorf("Failed to cancel job %d: %v, output: %s", jobId, err, output.String())
		return output.String(), err
	}

	return output.String(), nil
}

// LocalSubmitJob 本地提交作业函数
func LocalSubmitJob(scriptString string, username string) (string, error) {
	var output bytes.Buffer

	// 提交作业命令行
	cmdLine := fmt.Sprintf("su - %s -c '%s'", username, client.SBATCH)
	cmd := exec.Command("bash", "-c", cmdLine)

	// 创建一个 bytes.Buffer 用于捕获输出
	cmd.Stdout = &output
	cmd.Stderr = &output

	// 将脚本作为命令的输入
	cmd.Stdin = bytes.NewBufferString(scriptString)

	// 执行命令
	err := cmd.Run()
	if err != nil {
		return output.String(), err
	}

	return output.String(), nil
}

// GetPartitionsName 获取系统全部计算分区名
func GetPartitionsName() ([]string, error) {
	var partitions []string
	partitionsResult, err := GetPartitionsInfo()
	if err != nil {
		return nil, err
	}
	scanner := bufio.NewScanner(strings.NewReader(partitionsResult))
	for scanner.Scan() {
		line := scanner.Text()
		partitionName := extractValue(line, partitionNameRe)
		partitions = append(partitions, partitionName)
	}
	return partitions, nil
}

// GetPartitionNamesBySinfo 使用 sinfo 获取运行态分区名。
// 该函数只拉取分区名，用于 slurm.conf 变更后的轻量运行态探测。
func GetPartitionNamesBySinfo() ([]string, error) {
	args := []string{"--nohead", "-o", "%R"}
	exitCode, stdout, stderr, err := ExecuteCommand(client.SINFO, args...)
	if err != nil {
		if exitCode == -1 {
			return nil, fmt.Errorf("system error: %v", err)
		}
		return nil, fmt.Errorf("sinfo partition names failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
	}

	var partitions []string
	seen := make(map[string]struct{})
	scanner := bufio.NewScanner(strings.NewReader(stdout))
	for scanner.Scan() {
		partition := strings.TrimSpace(scanner.Text())
		if partition == "" {
			continue
		}
		if _, ok := seen[partition]; ok {
			continue
		}
		seen[partition] = struct{}{}
		partitions = append(partitions, partition)
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return partitions, nil
}

// GetPartitionAndAllowAccountsInfo 使用scontrol命令查询分区、AllowAccounts的数据
func GetPartitionAndAllowAccountsInfo() (map[string]string, error) {
	acctAndPartitions := make(map[string]string)
	partitionsResult, err := GetPartitionsInfo()
	if err != nil {
		return nil, fmt.Errorf("get partition info failed: %v", err)
	}
	scanner := bufio.NewScanner(strings.NewReader(partitionsResult))
	for scanner.Scan() {
		line := scanner.Text()
		partitionName := extractValue(line, partitionNameRe)
		allowAccounts := extractValue(line, allowAccountsRe)
		acctAndPartitions[partitionName] = allowAccounts
	}
	return acctAndPartitions, nil
}

// BlockOrUnBlockAccountInPartition 使用scontrol命令block或unblock账户
func BlockOrUnBlockAccountInPartition(partition, allowAcctList string) error {
	logrus.Tracef("[BlockOrUnBlockAccountInPartition] allowAcctList: %v", allowAcctList)
	allowAcctListString := NormalizeAllowAcctList(allowAcctList)
	args := []string{"update", fmt.Sprintf("partition=%s", partition), fmt.Sprintf("AllowAccounts=%s", allowAcctListString)}
	exitCode, stdout, stderr, err := ExecuteCommand(client.SCONTROL, args...)
	if err != nil {
		if exitCode == -1 {
			// 命令执行前就失败了
			return fmt.Errorf("system error: %v", err)
		} else {
			// 命令执行但失败了
			return fmt.Errorf("block or unblock account in partition: %v failed (exit %d), stdout: %s, stderr: %s", partition, exitCode, stdout, strings.TrimSpace(stderr))
		}
	}
	return nil
}

func GetNodesJsonInfo(nodeName []string) (string, error) {
	var args []string
	if len(nodeName) == 0 {
		args = []string{"show", "nodes", "--json"} // 获取全部计算节点主机名
	} else {
		args = []string{"show", "nodes", fmt.Sprintf("%s", strings.Join(nodeName, ",")), "--json"} // 获取指定计算节点主机名
	}
	exitCode, stdout, stderr, err := ExecuteCommand("/usr/bin/scontrol", args...)
	if err != nil {
		if exitCode == -1 {
			// 命令执行前就失败了
			return "", fmt.Errorf("system error: %v", err)
		} else {
			// 命令执行但失败了
			return "", fmt.Errorf("command failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
		}
	}
	return stdout, nil
}

// GetNodesInfo 获取节点信息，nodeNames列表为空时表示获取集群所有节点信息；不为空则获取nodeNames列表的节点信息
func GetNodesInfo(nodeName []string) (string, error) {
	var args []string
	if len(nodeName) == 0 {
		args = []string{"show", "nodes", "--oneliner"} // 获取全部计算节点主机名
	} else {
		args = []string{"show", "nodes", "--oneliner", fmt.Sprintf("%s", strings.Join(nodeName, ","))} // 获取指定计算节点主机名
	}
	exitCode, stdout, stderr, err := ExecuteCommand(client.SCONTROL, args...)
	if err != nil {
		if exitCode == -1 {
			// 命令执行前就失败了
			return "", fmt.Errorf("system error: %v", err)
		}
		if len(nodeName) > 1 {
			logrus.Warnf("show nodes %v failed (exit %d), stdout: %s, stderr: %s, fallback to query one by one",
				nodeName, exitCode, stdout, strings.TrimSpace(stderr))
			return getNodesInfoOneByOne(nodeName)
		}

		// 命令执行但失败了
		return "", fmt.Errorf("show nodes failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
	}

	return stdout, nil
}

func getNodesInfoOneByOne(nodeNames []string) (string, error) {
	var result strings.Builder
	for _, name := range nodeNames {
		args := []string{"show", "node", name, "--oneliner"}
		exitCode, stdout, stderr, err := ExecuteCommand(client.SCONTROL, args...)
		if err != nil {
			if exitCode == -1 {
				return "", fmt.Errorf("system error: %v", err)
			}
			logrus.Warnf("show node %s failed (exit %d), stdout: %s, stderr: %s, skip it",
				name, exitCode, stdout, strings.TrimSpace(stderr))
			continue
		}
		if strings.TrimSpace(stdout) == "" {
			logrus.Warnf("show node %s returned empty output, skip it", name)
			continue
		}
		result.WriteString(stdout)
		if !strings.HasSuffix(stdout, "\n") {
			result.WriteString("\n")
		}
	}

	return result.String(), nil
}

// GetNodeInfoByName 获取节点信息
func GetNodeInfoByName(nodeName string) (string, error) {
	args := []string{"show", "node", nodeName, "--oneliner"}

	exitCode, stdout, stderr, err := ExecuteCommand(client.SCONTROL, args...)
	if err != nil {
		if exitCode == -1 {
			// 命令执行前就失败了
			return "", fmt.Errorf("system error: %v", err)
		} else {
			// 命令执行但失败了
			return "", fmt.Errorf("show node %v failed (exit %d), stdout: %s, stderr: %s", nodeName, exitCode, stdout, strings.TrimSpace(stderr))
		}
	}

	return stdout, nil
}

// GetPartitionsInfo 获取集群所有分区信息
func GetPartitionsInfo() (string, error) {
	args := []string{"show", "partitions", "--oneliner"}
	exitCode, stdout, stderr, err := ExecuteCommand(client.SCONTROL, args...)
	if err != nil {
		if exitCode == -1 {
			// 命令执行前就失败了
			return "", fmt.Errorf("system error: %v", err)
		} else {
			// 命令执行但失败了
			return "", fmt.Errorf("show partition failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
		}
	}
	return stdout, nil
}

// GetPartitionsByName 获取集群分区信息
func GetPartitionsByName(name string) (string, error) {
	args := []string{"show", "partitions", name, "--oneliner"}
	exitCode, stdout, stderr, err := ExecuteCommand(client.SCONTROL, args...)
	if err != nil {
		if exitCode == -1 {
			// 命令执行前就失败了
			return "", fmt.Errorf("system error: %v", err)
		} else {
			// 命令执行但失败了
			return "", fmt.Errorf("show partition failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
		}
	}
	return stdout, nil
}

// PartitionJobStats 用于存储分区作业统计信息
type PartitionJobStats struct {
	Partition   string
	PendingJobs int
	RunningJobs int
	GpuUsage    int
	Error       error
}

// PartitionSinfoResult 用于存储分区 sinfo 命令结果
type PartitionSinfoResult struct {
	Partition string
	Stdout    string
	Error     error
}

// getPartitionSinfoConcurrently 并发获取分区 sinfo 信息
func getPartitionSinfoConcurrently(partitions []string) (map[string]string, error) {
	// 使用工作池模式控制并发数量
	maxWorkers := 5
	if len(partitions) < maxWorkers {
		maxWorkers = len(partitions)
	}

	jobChan := make(chan string, len(partitions))
	resultChan := make(chan PartitionSinfoResult, len(partitions))

	// 启动工作协程
	for i := 0; i < maxWorkers; i++ {
		go func() {
			for partition := range jobChan {
				result := PartitionSinfoResult{Partition: partition}

				// 执行 sinfo 命令
				args := []string{"-p", partition, "--noheader", "--format=%%R %%c %%C %%G %%a %%D %%F"}
				exitCode, stdout, stderr, err := ExecuteCommand(client.SINFO, args...)
				if err != nil {
					if exitCode == -1 {
						result.Error = fmt.Errorf("system error: %v", err)
					} else {
						result.Error = fmt.Errorf("get partition info failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
					}
					resultChan <- result
					continue
				}
				result.Stdout = stdout
				resultChan <- result
			}
		}()
	}

	// 发送任务
	for _, partition := range partitions {
		jobChan <- partition
	}
	close(jobChan)

	// 收集结果
	sinfoResults := make(map[string]string)

	for i := 0; i < len(partitions); i++ {
		result := <-resultChan
		if result.Error != nil {
			return nil, result.Error
		}
		sinfoResults[result.Partition] = result.Stdout
	}

	return sinfoResults, nil
}

// getPartitionStatsConcurrently 并发获取分区统计信息
func getPartitionStatsConcurrently(partitions []string) (map[string]map[string]int, map[string]int, error) {
	// 使用工作池模式控制并发数量
	maxWorkers := 5
	if len(partitions) < maxWorkers {
		maxWorkers = len(partitions)
	}

	jobChan := make(chan string, len(partitions))
	resultChan := make(chan PartitionJobStats, len(partitions))

	// 启动工作协程
	for i := 0; i < maxWorkers; i++ {
		go func() {
			for partition := range jobChan {
				stats := PartitionJobStats{Partition: partition}

				// 获取pending作业数
				pdJobNum, err := GetJobCountByPartitionAndState(partition, "pd")
				if err != nil {
					stats.Error = err
					resultChan <- stats
					continue
				}
				stats.PendingJobs = pdJobNum

				// 获取running作业数
				runningJobNum, err := GetJobCountByPartitionAndState(partition, "r")
				if err != nil {
					stats.Error = err
					resultChan <- stats
					continue
				}
				stats.RunningJobs = runningJobNum

				// 获取GPU使用情况
				if runningJobNum > 0 {
					runningGpus, err := GetUsedGpuInPartition(partition)
					if err != nil {
						stats.Error = err
						resultChan <- stats
						continue
					}
					stats.GpuUsage = runningGpus
				} else {
					stats.GpuUsage = 0
				}

				resultChan <- stats
			}
		}()
	}

	// 发送任务
	for _, partition := range partitions {
		jobChan <- partition
	}
	close(jobChan)

	// 收集结果
	jobStats := make(map[string]map[string]int)
	gpuUsage := make(map[string]int)

	for i := 0; i < len(partitions); i++ {
		stats := <-resultChan
		if stats.Error != nil {
			return nil, nil, stats.Error
		}

		jobStats[stats.Partition] = map[string]int{
			"pd": stats.PendingJobs,
			"r":  stats.RunningJobs,
		}
		gpuUsage[stats.Partition] = stats.GpuUsage
	}

	return jobStats, gpuUsage, nil
}

// GetPartitionsInfoBySInfo 使用sinfo命令获取分区信息
func GetPartitionsInfoBySInfo() ([]*pb.PartitionInfo, error) {
	partitions, err := GetPartitionsName()
	if err != nil {
		return nil, fmt.Errorf("get partition info failed: %v", err)
	}

	// 并发获取作业统计信息和GPU使用信息
	jobStats, gpuUsage, err := getPartitionStatsConcurrently(partitions)
	if err != nil {
		return nil, err
	}

	// 并发获取 sinfo 信息
	sinfoResults, err := getPartitionSinfoConcurrently(partitions)
	if err != nil {
		return nil, err
	}

	var parts []*pb.PartitionInfo

	for _, partition := range partitions {
		var (
			runningGpus, idleGpus, noAvailableGpus, totalGpus, totalCores, idleCores, runningCores,
			noAvailableCores, totalNodes, runningNodes, idleNodes, noAvailableNodes int
			state, partitionName string
			PartitionStatus      pb.PartitionInfo_PartitionStatus
		)

		// 从预先获取的 sinfo 结果中读取数据
		stdout, exists := sinfoResults[partition]
		if !exists {
			return nil, fmt.Errorf("no sinfo result found for partition: %s", partition)
		}

		lines := strings.Split(stdout, "\n")
		for _, line := range lines {
			partitionElement := strings.TrimSpace(line)
			if partitionElement == "" {
				logrus.Warnf("Null partitionElement: %s", partitionElement)
				continue
			}
			resultList := strings.Fields(partitionElement)
			if len(resultList) != 7 {
				logrus.Warnf("Invalid partitionElement: %s", partitionElement)
				continue
			}
			partitionName = resultList[0]
			state = resultList[4]
			nodeInfo := strings.Split(resultList[6], "/")
			if len(nodeInfo) != 4 {
				logrus.Warnf("Invalid nodeInfo: %s", resultList[6])
				continue
			}
			runningNodesTmp, _ := strconv.Atoi(nodeInfo[0])
			runningNodes += runningNodesTmp
			idleNodesTmp, _ := strconv.Atoi(nodeInfo[1])
			idleNodes += idleNodesTmp
			noAvailableNodesTmp, _ := strconv.Atoi(nodeInfo[2])
			noAvailableNodes += noAvailableNodesTmp
			totalNodesTmp, _ := strconv.Atoi(nodeInfo[3])
			totalNodes += totalNodesTmp
			// cores
			coresInfo := strings.Split(resultList[2], "/")
			if len(coresInfo) != 4 {
				logrus.Warnf("Invalid coresInfo: %s", resultList[2])
				continue
			}

			totalCoresTmp, _ := strconv.Atoi(coresInfo[3])
			totalCores += totalCoresTmp
			runningCoresTmp, _ := strconv.Atoi(coresInfo[0])
			runningCores += runningCoresTmp
			idleCoresTmp, _ := strconv.Atoi(coresInfo[1])
			idleCores += idleCoresTmp
			noAvailableCoresTmp, _ := strconv.Atoi(coresInfo[2])
			noAvailableCores += noAvailableCoresTmp
			gpuInfo := resultList[3] // 这是gpu的信息
			if gpuInfo == "(null)" {
				continue
			} else {
				//singleNodeGpusInfo := strings.Split(gpuInfo, ":")
				//singleNodeGpus := singleNodeGpusInfo[len(singleNodeGpusInfo)-1] // 获取最后一个元素
				_, _, _, singleNodeGpus, _ := ValidateGres(gpuInfo)
				singleNodeGpusInt, _ := strconv.Atoi(singleNodeGpus)
				noAvailableGpus += noAvailableNodesTmp * singleNodeGpusInt
				totalGpus += totalNodesTmp * singleNodeGpusInt
			}
		}

		// 从预先获取的作业统计中读取数据
		pdJobNum := jobStats[partitionName]["pd"]
		runningJobNum := jobStats[partitionName]["r"]
		runningGpus = gpuUsage[partitionName]

		// 计算GPU使用情况
		if totalGpus > 0 {
			idleGpus = totalGpus - runningGpus - noAvailableGpus
		} else {
			idleGpus = 0
		}

		// 计算使用率
		var percentage int
		if totalNodes > 0 {
			resultRatio := float64(runningNodes) / float64(totalNodes)
			percentage = int(resultRatio * 100)
		}

		// 确定分区状态
		if state == "up" {
			PartitionStatus = pb.PartitionInfo_AVAILABLE
		} else {
			PartitionStatus = pb.PartitionInfo_NOT_AVAILABLE
		}

		parts = append(parts, &pb.PartitionInfo{
			PartitionName:         partitionName,
			NodeCount:             uint32(totalNodes),
			RunningNodeCount:      uint32(runningNodes),
			IdleNodeCount:         uint32(idleNodes),
			NotAvailableNodeCount: uint32(noAvailableNodes),
			CpuCoreCount:          uint32(totalCores),
			RunningCpuCount:       uint32(runningCores),
			IdleCpuCount:          uint32(idleCores),
			NotAvailableCpuCount:  uint32(noAvailableCores),
			GpuCoreCount:          uint32(totalGpus),
			RunningGpuCount:       uint32(runningGpus),
			IdleGpuCount:          uint32(idleGpus),
			NotAvailableGpuCount:  uint32(noAvailableGpus),
			JobCount:              uint32(pdJobNum + runningJobNum),
			RunningJobCount:       uint32(runningJobNum),
			PendingJobCount:       uint32(pdJobNum),
			UsageRatePercentage:   uint32(percentage),
			PartitionStatus:       PartitionStatus,
		})
	}
	return parts, nil
}

// GetSlurmPartitionInfo 使用slurm命令获取partition的信息并解析成实际需要的值
func GetSlurmPartitionInfo() ([]*pb.Partition, error) {
	qosList, err := GetAllQosInDatabase()
	if err != nil {
		return nil, err
	}

	partitionInfo := GetPartitionInfo()
	partitionsResult, err := GetPartitionsInfo()
	if err != nil {
		return nil, err
	}
	lines := strings.Split(strings.TrimSpace(partitionsResult), "\n")
	results := make(chan *pb.Partition, len(lines))

	var wg sync.WaitGroup
	for _, line := range lines {
		wg.Add(1)
		go func(l string) {
			defer wg.Done()
			pi := ExtractPartitionInfo(l, partitionInfo, qosList)
			results <- pi
		}(line)
	}

	// 关闭通道的协程
	go func() {
		wg.Wait()
		close(results)
	}()

	// 收集结果
	partitionsInfo := make([]*pb.Partition, 0, len(lines))
	for result := range results {
		//读取config 的分区描述信息
		if value, ok := partitionInfo[result.Name]; ok {
			result.Description = &value.Describe
		}
		partitionsInfo = append(partitionsInfo, result)
	}

	return partitionsInfo, nil
}

func GetPartitionDeviceName(partitionName string) (string, error) {
	partitionsResult, err := GetPartitionsByName(partitionName)
	if err != nil {
		return "", err
	}

	nodesName := extractValue(partitionsResult, nodesRe)
	nodeList, ok := ParseHostList(nodesName)
	if !ok {
		logrus.Errorf("invalid node range format: %s", nodesName)
		return "", fmt.Errorf("invalid node range format: %s", nodesName)
	}

	nodeOutput, err := GetNodeInfoByName(nodeList[0])
	if err != nil {
		return "", err
	}
	nodeGres := extractValue(nodeOutput, gresRe)
	name, _, _, _, err := ValidateGres(nodeGres)
	if err != nil {
		logrus.Errorf("get node gres name failed: %v", err)
		return "", err
	}

	return name, nil
}

// IsTresOrResSelectType 判断slurm config中的SelectType是否为cons_tres或者cons_res
func IsTresOrResSelectType() (bool, error) {
	args := []string{"show", "config"}
	exitCode, stdout, stderr, err := ExecuteCommand(client.SCONTROL, args...)
	if err != nil {
		if exitCode == -1 {
			// 命令执行前就失败了
			return false, fmt.Errorf("system error: %v", err)
		} else {
			// 命令执行但失败了
			return false, fmt.Errorf("show config failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
		}
	}

	// 查找包含 'SelectType ' 的行
	var selectTypeLine string
	for _, line := range strings.Split(stdout, "\n") {
		if strings.Contains(line, "SelectType ") {
			selectTypeLine = line
			break
		}
	}
	if selectTypeLine == "" {
		return false, fmt.Errorf("not found SelectType")
	}

	if strings.Contains(selectTypeLine, "cons_tres") || strings.Contains(selectTypeLine, "cons_res") {
		return true, nil
	}

	return false, nil
}

// GetPendingJobsReason 获取pending作业的原因，返回map[int]string，key为作业id，value为原因
func GetPendingJobsReason(submitUser []string) (map[int]string, error) {
	args := []string{"-t", "pending", "-u", strings.Join(submitUser, ","), "--noheader", "--format=%i=%R"}

	exitCode, stdout, stderr, err := ExecuteCommand(client.SQUEUE, args...)
	if err != nil {
		if exitCode == -1 {
			// 命令执行前就失败了
			return nil, fmt.Errorf("system error: %v", err)
		} else {
			// 命令执行但失败了
			return nil, fmt.Errorf("get pending jobs reason failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
		}
	}

	pendingJobsReason := make(map[int]string)
	scanner := bufio.NewScanner(strings.NewReader(stdout))
	for scanner.Scan() {
		line := scanner.Text()
		kv := strings.Split(line, "=")
		if len(kv) != 2 {
			continue
		}
		jobId, err := strconv.Atoi(kv[0])
		if err != nil {
			continue
		}
		reason := strings.Trim(kv[1], "()")
		pendingJobsReason[jobId] = reason
	}

	return pendingJobsReason, nil
}

// GetJobsReasonById 获取作业的原因
func GetJobsReasonById(jobId uint32) (string, error) {
	args := []string{"-j", strconv.Itoa(int(jobId)), "--noheader", "--format=%R"}

	exitCode, stdout, stderr, err := ExecuteCommand(client.SQUEUE, args...)
	if err != nil {
		if exitCode == -1 {
			// 命令执行前就失败了
			return "", fmt.Errorf("system error: %v", err)
		} else {
			// 一般是数据库中有数据但是squeue中没有数据导致执行命令行失败
			if strings.Contains(stderr, "Invalid job id") {
				return "", nil
			}
			// 命令执行但失败了
			return "", fmt.Errorf("get jobs reason failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
		}
	}
	return stdout, nil
}

func UpdateJobTimeLimit(updateTimeLimitArgs []string) error {
	exitCode, stdout, stderr, err := ExecuteCommand(client.SCONTROL, updateTimeLimitArgs...)
	if err != nil {
		if exitCode == -1 {
			// 命令执行前就失败了
			return fmt.Errorf("system error: %v", err)
		} else {
			// 命令执行但失败了
			return fmt.Errorf("update job timelimit failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
		}
	}
	return nil
}

// CheckRunningJobsOnNode 查看节点是否还有未完成的作业
func CheckRunningJobsOnNode(nodeName string) (bool, error) {
	args := []string{"-h", "-w", nodeName, "--states=RUNNING,PENDING,SUSPENDED"}

	exitCode, stdout, stderr, err := ExecuteCommand(client.SQUEUE, args...)
	if err != nil {
		if exitCode == -1 {
			// 命令执行前就失败了
			return false, fmt.Errorf("system error: %v", err)
		} else {
			// 命令执行但失败了
			return false, fmt.Errorf("squeue show job failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
		}
	}

	return len(stdout) > 0, nil
}

// GetLoginNodesInfo 获取节点信息，nodeNames列表为空时表示获取集群所有节点信息；不为空则获取nodeNames列表的节点信息
func GetLoginNodesInfo() ([]string, error) {
	var nodes []string

	args := []string{"show", "nodes", "--oneliner"}

	exitCode, stdout, stderr, err := ExecuteCommand(client.SCONTROL, args...)
	if err != nil {
		if exitCode == -1 {
			// 命令执行前就失败了
			return nil, fmt.Errorf("system error: %v", err)
		} else {
			// 命令执行但失败了
			return nil, fmt.Errorf("show nodes failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
		}
	}

	// 按行分割输出
	scanner := bufio.NewScanner(strings.NewReader(stdout))
	for scanner.Scan() {
		line := scanner.Text()
		if strings.Contains(line, "Partitions") {
			continue
		}
		nodeName := extractValue(line, nodeNameRe)
		nodes = append(nodes, nodeName)
	}

	return nodes, nil
}

// CheckNodeExists 查看节点是否存在
func CheckNodeExists(nodeName string) (bool, error) {
	args := []string{"show", "nodes", nodeName}

	exitCode, stdout, stderr, err := ExecuteCommand(client.SCONTROL, args...)
	if err != nil {
		if exitCode == -1 {
			// 命令执行前就失败了
			return false, fmt.Errorf("system error: %v", err)
		} else {
			// 命令执行但失败了
			pattern := regexp.MustCompile(`Node.*not found`)
			matched := pattern.MatchString(stdout)
			if matched { // Node node1 not found
				logrus.Errorf("scontrol show node failed: %v, output: %s", err, stdout)
				return false, nil
			}
			logrus.Errorf("show nodes failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
			return false, fmt.Errorf("scontrol show node failed: %v, output: %s", err, stdout)
		}
	}

	return true, nil
}

func DrainNode(nodeName string) error {
	reason := "The node will be migrated to another cluster, so it is offline in this cluster."
	args := []string{"update", fmt.Sprintf("NodeName=%s", nodeName), "State=DRAIN", fmt.Sprintf("Reason=%s", reason)}

	exitCode, stdout, stderr, err := ExecuteCommand(client.SCONTROL, args...)
	if err != nil {
		if exitCode == -1 {
			// 命令执行前就失败了
			return fmt.Errorf("system error: %v", err)
		} else {
			// 命令执行但失败了
			return fmt.Errorf("scontrol update node %v failed (exit %d), stdout: %s, stderr: %s", nodeName, exitCode, stdout, strings.TrimSpace(stderr))
		}
	}
	logrus.Infof("scontrol update node %v state success", nodeName)
	return nil
}

func ResumeNode(nodeName string) error {
	args := []string{"update", fmt.Sprintf("NodeName=%s", nodeName), "State=RESUME"}

	exitCode, stdout, stderr, err := ExecuteCommand(client.SCONTROL, args...)
	if err != nil {
		if exitCode == -1 {
			// 命令执行前就失败了
			return fmt.Errorf("system error: %v", err)
		} else {
			// 命令执行但失败了
			return fmt.Errorf("scontrol update node %v failed (exit %d), stdout: %s, stderr: %s", nodeName, exitCode, stdout, strings.TrimSpace(stderr))
		}
	}

	logrus.Infof("scontrol update node %v state success", nodeName)
	return nil
}

// BlockAccountUseAssociation 封锁账户在指定分区下的所有用户 association。
// 当前 Slurm association 层级不存在“账户+分区、用户为空”的父节点，因此必须在该分区
// 的所有用户叶子 association 上写 GrpJobs=0、GrpSubmitJobs=0。
func BlockAccountUseAssociation(ctx context.Context, account, partition string) error {
	// 恢复记录存在时说明该分区以前已经由 SCOW 封锁。重复封锁不得覆盖第一次保存的原值，
	// 命令失败时也只能删除本次新建的记录。
	existingRecords, err := getAccountBlockRecords(account, partition)
	if err != nil {
		return err
	}
	wasBlocked := len(existingRecords) > 0
	// 每个用户 association 的管理员限制可能不同，逐用户读取原值用于解封恢复。
	userOriginalValues, err := GetUsersGroupLimits(account, partition)
	if err != nil {
		return err
	}
	if len(userOriginalValues) == 0 {
		return fmt.Errorf("no user associations found for account=%s partition=%s", account, partition)
	}

	records := make([]accountBlockRecord, 0, len(userOriginalValues))
	for user, original := range userOriginalValues {
		records = append(records, accountBlockRecord{
			Account: account, Partition: partition, User: user, Original: normalizeOriginalLimits(original),
		})
	}
	if err := saveAccountBlockRecords(records); err != nil {
		if !wasBlocked {
			_ = deleteAccountBlockRecords(account, partition)
		}
		return err
	}

	// 一次命令修改目标分区下全部用户，避免逐用户修改产生较长的不一致窗口。
	args := []string{"-i", "-Q", "modify", "user", "where",
		fmt.Sprintf("account=%s", account), fmt.Sprintf("partition=%s", partition),
		fmt.Sprintf("cluster=%s", config.SlurmValue.MySQLConfig.ClusterName),
		"set"}
	args = append(args, accountPartitionBlockLimitArgs(true)...)
	if err := executeAssociationModification(ctx, "block account partition", args); err != nil {
		// 仅第一次封锁失败时删除本次新建的记录；重复封锁失败时必须保留第一次保存的原值和分区记录。
		if !wasBlocked {
			_ = deleteAccountBlockRecords(account, partition)
		}
		return err
	}
	return nil
}

// UnblockAccountUseAssociation 恢复账户指定分区下所有用户 association 的原始 Grp 限制。
// 该操作只恢复账户封锁修改的 Grp*，不会修改用户封锁使用的 Max*。
func UnblockAccountUseAssociation(ctx context.Context, account, partition string) error {
	records, err := getAccountBlockRecords(account, partition)
	if err != nil {
		return err
	}
	if len(records) == 0 {
		// 兼容旧版本只有 Grp*=0、没有恢复记录的数据。SCOW 已要求授权该分区，
		// 因此必须把实际 association 清为无限制，不能因为没有恢复记录就跳过。
		currentLimits, err := GetUsersGroupLimits(account, partition)
		if err != nil {
			return err
		}
		if len(currentLimits) == 0 {
			return nil
		}
		args := []string{"-i", "-Q", "modify", "user", "where",
			fmt.Sprintf("account=%s", account), fmt.Sprintf("partition=%s", partition),
			fmt.Sprintf("cluster=%s", config.SlurmValue.MySQLConfig.ClusterName), "set"}
		args = append(args, accountPartitionBlockLimitArgs(false)...)
		if err := executeAssociationModification(ctx, "unblock account partition", args); err != nil {
			return err
		}
		return nil
	}

	// 异常中断或旧版本数据可能导致分区中新 association 没有恢复记录。
	// 先只把这些无记录且仍受限的用户恢复为 -1，再按记录恢复其他用户的原值。
	currentLimits, err := GetUsersGroupLimits(account, partition)
	if err != nil {
		return err
	}
	recordedUsers := make(map[string]struct{}, len(records))
	for _, record := range records {
		recordedUsers[record.User] = struct{}{}
	}
	var unrecordedBlockedUsers []string
	for user, limits := range currentLimits {
		if _, recorded := recordedUsers[user]; recorded {
			continue
		}
		if limits.Jobs == associationBlockedLimit || limits.SubmitJobs == associationBlockedLimit {
			unrecordedBlockedUsers = append(unrecordedBlockedUsers, user)
		}
	}
	if err := forEachAssociationBatch(unrecordedBlockedUsers, func(batch []string) error {
		args := []string{"-i", "-Q", "modify", "user", "where",
			fmt.Sprintf("name=%s", strings.Join(batch, ",")), fmt.Sprintf("account=%s", account),
			fmt.Sprintf("partition=%s", partition),
			fmt.Sprintf("cluster=%s", config.SlurmValue.MySQLConfig.ClusterName), "set"}
		args = append(args, accountPartitionBlockLimitArgs(false)...)
		return executeAssociationModification(ctx, "restore unrecorded account partition limits", args)
	}); err != nil {
		return err
	}

	// 将原值相同的用户合并，既保留逐 association 的恢复精度，又减少 sacctmgr 调用次数。
	grouped := make(map[associationLimitPair][]string)
	for _, record := range records {
		grouped[record.Original] = append(grouped[record.Original], record.User)
	}
	for limits, users := range grouped {
		if err := forEachAssociationBatch(users, func(batch []string) error {
			args := []string{"-i", "-Q", "modify", "user", "where",
				fmt.Sprintf("name=%s", strings.Join(batch, ",")), fmt.Sprintf("account=%s", account),
				fmt.Sprintf("partition=%s", partition),
				fmt.Sprintf("cluster=%s", config.SlurmValue.MySQLConfig.ClusterName), "set"}
			args = append(args, accountGroupLimitArgs(limits.Jobs, limits.SubmitJobs)...)
			return executeAssociationModification(ctx, "restore account partition group limits", args)
		}); err != nil {
			return err
		}
	}
	// 先恢复 Slurm 中的值，再删除原值记录；失败时保留记录供重试。
	return deleteAccountBlockRecords(account, partition)
}

// BlockWholeAccountUseAssociation 在账户父 association 上封锁整个账户。
// 父节点的 GrpJobs=0、GrpSubmitJobs=0 会向所有现有及未来子 association 生效，
// 因而无需枚举分区和用户，也不会遗漏封锁期间新增的关系。
func BlockWholeAccountUseAssociation(ctx context.Context, account string) error {
	// 恢复记录存在时不能直接返回：记录只表示第一次封锁前的值，父 association
	// 仍可能被意外改回非零。同步必须再次执行幂等命令，使 Slurm 收敛到 SCOW 的封锁状态。
	blocked, err := IsWholeAccountBlockRecorded(account)
	if err != nil {
		return err
	}
	actual, found, err := GetAccountGroupLimits(account)
	if err != nil {
		return err
	}
	if !found {
		return fmt.Errorf("account association not found: %s", account)
	}
	if !blocked {
		// 只保存 User、Partition 均为空的账户父 association，不能误取用户叶子记录。
		if err := saveAccountBlockRecord(account, "", "", normalizeOriginalLimits(actual)); err != nil {
			return err
		}
	}
	if actual.Jobs == associationBlockedLimit && actual.SubmitJobs == associationBlockedLimit {
		// 实际值已经满足 SCOW 的封锁要求。上面仍会为旧版双零数据补一条 -1 恢复记录。
		return nil
	}
	// modify account 精确作用于账户级 association；cluster 条件避免影响同名跨集群账户。
	args := []string{"-i", "-Q", "modify", "account", "where", fmt.Sprintf("name=%s", account),
		fmt.Sprintf("cluster=%s", config.SlurmValue.MySQLConfig.ClusterName), "set"}
	args = append(args, accountPartitionBlockLimitArgs(true)...)
	if err := executeAssociationModification(ctx, "block whole account", args); err != nil {
		// 只回滚本次新建的记录；已有记录保存的是第一次封锁前的值，不能删除。
		if !blocked {
			_ = deleteAccountBlockRecords(account, "")
		}
		return err
	}
	return nil
}

// UnblockWholeAccountUseAssociation 只恢复账户父 association 的原始 Grp*。
// 分区用户 association 上的 Grp* 和用户封锁使用的 Max* 不在此处恢复。
func UnblockWholeAccountUseAssociation(ctx context.Context, account string) error {
	records, err := getAccountBlockRecords(account, "")
	if err != nil {
		return err
	}
	// 有记录时恢复第一次封锁前的值；没有记录时说明是旧版本数据或持久化记录缺失。
	// 此时 SCOW 已明确要求解封，因此回退为 -1，使 Slurm 实际状态服从 SCOW。
	original := associationLimitPair{Jobs: associationUnlimitedLimit, SubmitJobs: associationUnlimitedLimit}
	if len(records) > 0 {
		// 整体账户封锁由 (account,"","") 唯一键保证只有一条恢复记录。
		original = records[0].Original
	}
	args := []string{"-i", "-Q", "modify", "account", "where", fmt.Sprintf("name=%s", account),
		fmt.Sprintf("cluster=%s", config.SlurmValue.MySQLConfig.ClusterName), "set"}
	args = append(args, accountGroupLimitArgs(original.Jobs, original.SubmitJobs)...)
	if err := executeAssociationModification(ctx, "unblock whole account", args); err != nil {
		return err
	}
	// Slurm 恢复成功后才删除记录，保证命令失败时仍可以重试。
	if len(records) > 0 {
		return deleteAccountBlockRecords(account, "")
	}
	return nil
}
