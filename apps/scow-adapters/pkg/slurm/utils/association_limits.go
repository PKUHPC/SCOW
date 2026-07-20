package utils

import "fmt"

const (
	// associationBlockedLimit 是 SCOW 在 Slurm association 上表达“封锁”的统一值。
	// Slurm 中对应限制字段被设置为 0 后，用户将不能在对应维度提交或运行作业。
	associationBlockedLimit int32 = 0
	// associationUnlimitedLimit 是 SCOW 在 Slurm association 上表达“解封/无限制”的统一值。
	// sacctmgr 中 -1 表示清除该限制，恢复为不由该字段限制。
	associationUnlimitedLimit int32 = -1

	// 用户-账户维度封锁使用 Slurm association 的 MaxJobs/max_jobs 字段。
	//
	// 业务含义：
	//   - 用户封锁：某个用户在某个账户下不可运行作业。
	//   - 用户解封：清除这个用户在该账户下的运行作业数限制。
	//
	// Slurm 字段映射：
	//   - sacctmgr 命令使用 MaxJobs。
	//   - SlurmDB assoc_table 使用 max_jobs。
	//
	// 注意：这个字段不表达账户在分区上的封锁；账户-分区封锁由 MaxSubmitJobs 表达。
	slurmUserBlockField = "MaxJobs"
	sqlUserBlockColumn  = "max_jobs"

	// 账户-分区维度封锁使用 Slurm association 的 MaxSubmitJobs/max_submit_jobs 字段。
	//
	// 业务含义：
	//   - 账户封锁：某个账户在某个分区下不可提交作业。
	//   - 账户解封：恢复该账户在该分区下所有用户封锁前的提交限制。
	//
	// 实现方式：
	//   - Slurm 没有直接的“账户在分区下封锁”字段。
	//   - 适配器通过批量修改该账户+分区下所有用户 association 的 MaxSubmitJobs 来表达。
	//   - 封锁前会保存每个用户原始 max_submit_jobs，解封时尽量恢复原值。
	//
	// Slurm 字段映射：
	//   - sacctmgr 命令使用 MaxSubmitJobs。
	//   - SlurmDB assoc_table 使用 max_submit_jobs。
	slurmAccountPartitionBlockField = "MaxSubmitJobs"
	sqlAccountPartitionBlockColumn  = "max_submit_jobs"

	// sqlUserBlockedCondition 表示用户在账户下被用户维度封锁。
	sqlUserBlockedCondition = sqlUserBlockColumn + " = 0"
	// sqlAccountPartitionBlockedCondition 表示账户在分区下被账户-分区维度封锁。
	sqlAccountPartitionBlockedCondition = sqlAccountPartitionBlockColumn + " = 0"
	// sqlAccountPartitionNotBlockedCondition 表示账户在分区下未被账户-分区维度封锁。
	// NULL 在 SlurmDB 中表示未设置限制，也视为未封锁。
	sqlAccountPartitionNotBlockedCondition = "(" + sqlAccountPartitionBlockColumn + " IS NULL OR " + sqlAccountPartitionBlockColumn + " != 0)"
	// sqlLegacyUserBlockCompatibilityCriteria 用于识别旧版用户封锁遗留数据。
	// 旧逻辑曾同时修改 MaxSubmitJobs/GrpJobs/GrpSubmit/GrpSubmitJobs；
	// 新版用户封锁只使用 MaxJobs，因此用户解封时需要清理这些历史字段。
	sqlLegacyUserBlockCompatibilityCriteria = sqlAccountPartitionBlockedCondition + " AND (grp_jobs = 0 OR grp_submit_jobs = 0)"
)

// userBlockLimitArg 构造用户-账户维度封锁字段的 sacctmgr set 参数。
//
// blocked=true  -> MaxJobs=0，表示该用户在该账户下被封锁。
// blocked=false -> MaxJobs=-1，表示清除用户封锁限制。
func userBlockLimitArg(blocked bool) string {
	limit := associationUnlimitedLimit
	if blocked {
		limit = associationBlockedLimit
	}
	return associationLimitArg(slurmUserBlockField, limit)
}

// accountPartitionBlockLimitArg 构造账户-分区维度封锁字段的 sacctmgr set 参数。
//
// blocked=true  -> MaxSubmitJobs=0，表示该账户在该分区下被封锁。
// blocked=false -> MaxSubmitJobs=-1，表示清除账户-分区封锁限制。
//
// 如果解封时存在封锁前持久化的原始值，应使用 accountPartitionSubmitLimitArg
// 直接恢复原始值，而不是统一设置为 -1。
func accountPartitionBlockLimitArg(blocked bool) string {
	limit := associationUnlimitedLimit
	if blocked {
		limit = associationBlockedLimit
	}
	return accountPartitionSubmitLimitArg(limit)
}

// accountPartitionSubmitLimitArg 构造账户-分区维度提交限制字段的 sacctmgr set 参数。
// 该函数用于恢复封锁前保存的原始 MaxSubmitJobs 值，也用于封锁/解封的通用构造。
func accountPartitionSubmitLimitArg(limit int32) string {
	return associationLimitArg(slurmAccountPartitionBlockField, limit)
}

// associationLimitArg 按 sacctmgr 的 set 参数格式拼接字段和值，例如 MaxJobs=0。
func associationLimitArg(field string, limit int32) string {
	return fmt.Sprintf("%s=%d", field, limit)
}
