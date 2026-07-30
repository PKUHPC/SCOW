package migrations

import (
	"fmt"

	"github.com/go-gormigrate/gormigrate/v2"
	"gorm.io/gorm"
)

// NewM2026072900 创建新版账户、用户封锁恢复值表。
//
// 本迁移不再根据旧 association 推断 SCOW 的账户、用户和分区权限状态。升级完成后，
// SyncAccountUserInfo 会以 SCOW 全量数据为期望状态，将 Slurm association 收敛到新字段模型：
//   - 账户欠费封锁写账户父 association 的 GrpJobs、GrpSubmitJobs；
//   - 分区权限写用户分区 association 的 GrpJobs、GrpSubmitJobs；
//   - 用户封锁写用户 association 的 MaxJobs、MaxSubmitJobs。
//
// 客户旧环境的封锁前限制均为 -1；缺少恢复记录时，运行时解封逻辑也统一回退为 -1，
// 因此无需把 acct_permission_persistence 或旧 association 数据复制到新表。
func NewM2026072900(_ string, _ string) *gormigrate.Migration {
	return &gormigrate.Migration{
		ID: "2026072900_block_limits",
		Migrate: func(tx *gorm.DB) error {
			return createBlockPersistenceTables(tx)
		},
		Rollback: func(*gorm.DB) error { return nil },
	}
}

// createBlockPersistenceTables 只保存 SCOW 执行封锁前的 association 原值。
// 分区权限不在适配器数据库中重复持久化：SCOW 请求负责提供期望权限，Slurm Grp* 负责表示实际状态。
func createBlockPersistenceTables(tx *gorm.DB) error {
	if err := tx.Exec(`
		CREATE TABLE IF NOT EXISTS account_block_persistence (
			id                       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			creation_time            BIGINT          NOT NULL,
			mod_time                 BIGINT          NOT NULL DEFAULT 0,
			account_name             VARCHAR(63)     NOT NULL,
			partition_name           VARCHAR(63)     NOT NULL DEFAULT '',
			user_name                VARCHAR(63)     NOT NULL DEFAULT '',
			original_grp_jobs        INT             NOT NULL DEFAULT -1,
			original_grp_submit_jobs INT             NOT NULL DEFAULT -1,
			PRIMARY KEY (id),
			UNIQUE KEY idx_account_block_scope (account_name, partition_name, user_name)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
	`).Error; err != nil {
		return fmt.Errorf("create account_block_persistence: %w", err)
	}

	if err := tx.Exec(`
		CREATE TABLE IF NOT EXISTS user_block_persistence (
			id                       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			creation_time            BIGINT          NOT NULL,
			mod_time                 BIGINT          NOT NULL DEFAULT 0,
			account_name             VARCHAR(63)     NOT NULL,
			user_name                VARCHAR(63)     NOT NULL,
			partition_name           VARCHAR(63)     NOT NULL DEFAULT '',
			original_max_jobs        INT             NOT NULL DEFAULT -1,
			original_max_submit_jobs INT             NOT NULL DEFAULT -1,
			PRIMARY KEY (id),
			UNIQUE KEY idx_user_block_scope (account_name, user_name, partition_name)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
	`).Error; err != nil {
		return fmt.Errorf("create user_block_persistence: %w", err)
	}
	return nil
}
