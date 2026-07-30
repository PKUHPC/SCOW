package utils

import "fmt"

const (
	// associationCommandBatchSize 限制一次 sacctmgr 命令携带的用户名或分区名数量。
	associationCommandBatchSize = 200
	// associationBlockedLimit 是 SCOW 写入 Slurm 作业数限制字段的封锁值。
	// Jobs 和 SubmitJobs 字段同时设为 0 后，已有 PENDING 作业不能开始运行，也不能再提交新作业。
	associationBlockedLimit int32 = 0
	// associationUnlimitedLimit 是 SCOW 在 Slurm association 上表达“解封/无限制”的统一值。
	// sacctmgr 中 -1 表示清除该限制，恢复为不由该字段限制。
	associationUnlimitedLimit int32 = -1

	// 封锁账户下的某个用户时，修改该用户 association 的 MaxJobs/MaxSubmitJobs 字段。
	//
	// 业务含义：
	//   - 用户封锁：某个用户在某个账户下不可运行作业。
	//   - 用户解封：清除这个用户在该账户下的运行作业数限制。
	//
	// Slurm 字段映射：
	//   - sacctmgr 命令使用 MaxJobs、MaxSubmitJobs。
	//   - SlurmDB assoc_table 使用 max_jobs、max_submit_jobs。
	slurmUserJobsBlockField       = "MaxJobs"
	slurmUserSubmitJobsBlockField = "MaxSubmitJobs"
	sqlUserJobsBlockColumn        = "max_jobs"
	sqlUserSubmitJobsBlockColumn  = "max_submit_jobs"

	// 封锁整个账户或账户的某个分区时，修改 association 的 GrpJobs/GrpSubmitJobs 字段。
	//
	// 业务含义：
	//   - GrpJobs=0：账户已有的 PENDING 作业不能开始运行。
	//   - GrpSubmitJobs=0：账户不能继续提交新作业。
	//   - 解封时：恢复 SCOW 封锁前的 GrpJobs、GrpSubmitJobs 值。
	//
	// 实现方式：
	//   - Slurm 没有直接的“账户在分区下封锁”字段。
	//   - 整个账户封锁写在账户父 association 上。
	//   - 分区封锁批量写在该账户+分区下所有用户 association 上。
	//   - 修改前逐条保存 Grp* 原值，解封时把每条 association 恢复为各自的原值。
	//
	// Slurm 字段映射：
	//   - sacctmgr 命令使用 GrpJobs、GrpSubmitJobs。
	//   - SlurmDB assoc_table 使用 grp_jobs、grp_submit_jobs。
	slurmAccountJobsBlockField       = "GrpJobs"
	slurmAccountSubmitJobsBlockField = "GrpSubmitJobs"
	sqlAccountJobsBlockColumn        = "grp_jobs"
	sqlAccountSubmitJobsBlockColumn  = "grp_submit_jobs"

	// sqlUserBlockedCondition 匹配 MaxJobs、MaxSubmitJobs 均为 0 的用户 association。
	sqlUserBlockedCondition = sqlUserJobsBlockColumn + " = 0 AND " + sqlUserSubmitJobsBlockColumn + " = 0"
	// sqlAccountPartitionBlockedCondition 匹配 GrpJobs、GrpSubmitJobs 均为 0 的 association。
	sqlAccountPartitionBlockedCondition = sqlAccountJobsBlockColumn + " = 0 AND " + sqlAccountSubmitJobsBlockColumn + " = 0"
	// sqlAccountPartitionNotBlockedCondition 匹配 GrpJobs、GrpSubmitJobs 未同时为 0 的 association。
	// NULL 在 SlurmDB 中表示未设置限制，也视为未封锁。
	sqlAccountPartitionNotBlockedCondition = "(" + sqlAccountJobsBlockColumn + " IS NULL OR " + sqlAccountJobsBlockColumn + " != 0 OR " +
		sqlAccountSubmitJobsBlockColumn + " IS NULL OR " + sqlAccountSubmitJobsBlockColumn + " != 0)"
)

func forEachAssociationBatch(values []string, fn func([]string) error) error {
	for start := 0; start < len(values); start += associationCommandBatchSize {
		end := min(start+associationCommandBatchSize, len(values))
		if err := fn(values[start:end]); err != nil {
			return err
		}
	}
	return nil
}

// normalizeOriginalLimits 处理旧版本已经封锁、但没有保存恢复值的数据。
//
// 例如父 association 当前为 GrpJobs=0、GrpSubmitJobs=0，而 SCOW 第一次用新版逻辑
// 同步“封锁”状态。此时 0 是封锁后的值，不能再保存成封锁前原值，否则以后解封
// 仍会恢复成 0。只修改成功一个字段时也按同样方式处理。由于旧数据没有更准确的
// 原值，只能把值为 0 的字段按历史默认行为回退为 -1（无限制）。
func normalizeOriginalLimits(limits associationLimitPair) associationLimitPair {
	if limits.Jobs == associationBlockedLimit {
		limits.Jobs = associationUnlimitedLimit
	}
	if limits.SubmitJobs == associationBlockedLimit {
		limits.SubmitJobs = associationUnlimitedLimit
	}
	return limits
}

// userBlockLimitArgs 构造封锁或解封账户下某个用户所需的 sacctmgr set 参数。
//
// blocked=true  -> MaxJobs=0 MaxSubmitJobs=0。
// blocked=false -> MaxJobs=-1 MaxSubmitJobs=-1。
func userBlockLimitArgs(blocked bool) []string {
	limit := associationUnlimitedLimit
	if blocked {
		limit = associationBlockedLimit
	}
	return []string{
		associationLimitArg(slurmUserJobsBlockField, limit),
		associationLimitArg(slurmUserSubmitJobsBlockField, limit),
	}
}

// accountPartitionBlockLimitArgs 构造账户封锁所需的 sacctmgr set 参数。
//
// blocked=true  -> GrpJobs=0 GrpSubmitJobs=0。
// blocked=false -> GrpJobs=-1 GrpSubmitJobs=-1。
func accountPartitionBlockLimitArgs(blocked bool) []string {
	limit := associationUnlimitedLimit
	if blocked {
		limit = associationBlockedLimit
	}
	return accountGroupLimitArgs(limit, limit)
}

func accountGroupLimitArgs(jobs, submitJobs int32) []string {
	return []string{
		associationLimitArg(slurmAccountJobsBlockField, jobs),
		associationLimitArg(slurmAccountSubmitJobsBlockField, submitJobs),
	}
}

func userLimitArgs(jobs, submitJobs int32) []string {
	return []string{
		associationLimitArg(slurmUserJobsBlockField, jobs),
		associationLimitArg(slurmUserSubmitJobsBlockField, submitJobs),
	}
}

// associationLimitArg 按 sacctmgr 的 set 参数格式拼接字段和值，例如 MaxJobs=0。
func associationLimitArg(field string, limit int32) string {
	return fmt.Sprintf("%s=%d", field, limit)
}
