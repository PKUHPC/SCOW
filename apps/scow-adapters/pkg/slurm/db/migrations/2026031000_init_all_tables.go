package migrations

import (
	"bufio"
	"bytes"
	"fmt"
	"os/exec"
	"regexp"
	"strings"
	"time"

	"github.com/go-gormigrate/gormigrate/v2"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// 预编译正则
var (
	allowAccountsRe = regexp.MustCompile(`AllowAccounts=(\S+)`)
	partitionNameRe = regexp.MustCompile(`PartitionName=(\S+)`)
)

// NewM2026031000 构造初始化迁移：建表 + 将旧版 AllowAccounts 封锁机制转换为 Association MaxSubmitJobs=0 机制。
//
// 通过参数注入 sacctmgr/scontrol 路径和集群名，避免与 client 包形成循环依赖。
//
// 失败策略：
//   - 单个账户处理失败时只打 Warn 日志，不中断整体迁移。
//   - 整体迁移存在失败项时打 Warn 提示运维人员执行子命令重试。
//   - 始终返回 nil，不阻断适配器启动（Migration ID 照常记录，不会下次重复执行）。
func NewM2026031000(sacctmgr, scontrol, clusterName string) *gormigrate.Migration {
	return &gormigrate.Migration{
		ID: "2026031000_init_all_tables",
		Migrate: func(tx *gorm.DB) error {
			// 1. 建表
			if err := tx.Exec(`
				CREATE TABLE IF NOT EXISTS acct_permission_persistence (
					id                       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
					creation_time            BIGINT UNSIGNED NOT NULL,
					mod_time                 BIGINT UNSIGNED NOT NULL DEFAULT 0,
					account_name             VARCHAR(63)     NOT NULL,
					partition_name           VARCHAR(63)     NOT NULL DEFAULT '',
					user_name                VARCHAR(63)     NOT NULL,
					original_max_submit_jobs INT             NOT NULL DEFAULT -1,
					PRIMARY KEY (id),
					UNIQUE KEY idx_acct_partition_user_unique (account_name, partition_name, user_name)
				) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
			`).Error; err != nil {
				return fmt.Errorf("create table acct_permission_persistence: %w", err)
			}

			// 2. 存量封锁数据迁移（失败不阻断启动）
			if err := MigrateBlockToAssociation(tx, sacctmgr, scontrol, clusterName); err != nil {
				logrus.Warnf("[Migration 2026031000] some items failed, check logs and run: ./scow-slurm-adapter migrate-block-to-association: %v", err)
			}
			return nil
		},
		Rollback: func(tx *gorm.DB) error {
			return nil
		},
	}
}

// MigrateBlockToAssociation 将旧版 AllowAccounts 分区封锁机制迁移到 Association MaxSubmitJobs=0 机制。
// 幂等：已迁移的分区（AllowAccounts=ALL）会被跳过，失败项可重复执行。
// 也被 migrate-block-to-association 子命令直接调用，用于手动补跑失败项。
func MigrateBlockToAssociation(tx *gorm.DB, sacctmgr, scontrol, clusterName string) error {
	assocTable := fmt.Sprintf("`%s_assoc_table`", clusterName)

	// 1. 获取所有分区及其 AllowAccounts
	partitionAllowAccounts, err := getPartitionAllowAccounts(scontrol)
	if err != nil {
		return fmt.Errorf("get partition allow accounts: %w", err)
	}
	logrus.Infof("[Migration 2026031000] scanned %d partitions", len(partitionAllowAccounts))

	totalMigrated, totalErrors := 0, 0

	for partition, allowRaw := range partitionAllowAccounts {
		// AllowAccounts=ALL 或空：该分区无旧封锁，跳过
		if allowRaw == "ALL" || allowRaw == "" {
			continue
		}

		logrus.Infof("[Migration 2026031000] partition [%s] AllowAccounts=%s, scanning blocked accounts...", partition, allowRaw)

		// 2. 查询该分区下所有有 association 的活跃账户
		type acctRow struct{ Acct string }
		var acctRows []acctRow
		if err := tx.Raw(
			fmt.Sprintf("SELECT DISTINCT acct FROM %s WHERE deleted=0 AND `partition`=? AND `user`!=''", assocTable),
			partition,
		).Scan(&acctRows).Error; err != nil {
			logrus.Errorf("[Migration 2026031000] query accounts for partition %s failed: %v", partition, err)
			totalErrors++
			continue
		}

		// 3. 构建 AllowAccounts 集合，找出旧封锁账户
		// Slurm 账户名大小写不敏感（sacctmgr 统一存小写），做 ToLower 确保匹配准确
		allowSet := make(map[string]struct{})
		for _, a := range strings.Split(allowRaw, ",") {
			allowSet[strings.ToLower(strings.TrimSpace(a))] = struct{}{}
		}
		var blockedAccounts []string
		for _, row := range acctRows {
			if _, ok := allowSet[strings.ToLower(row.Acct)]; !ok {
				blockedAccounts = append(blockedAccounts, row.Acct)
			}
		}

		if len(blockedAccounts) == 0 {
			continue
		}

		logrus.Infof("[Migration 2026031000] found %d blocked accounts, migrating...", len(blockedAccounts))

		// 4. 逐账户迁移（写持久化记录 + sacctmgr），统计本分区错误数
		partitionErrors := 0
		for _, account := range blockedAccounts {
			if err := migrateBlockedAccount(tx, sacctmgr, assocTable, account, partition); err != nil {
				logrus.Errorf("[Migration 2026031000] [FAIL] account=%s partition=%s: %v", account, partition, err)
				partitionErrors++
			} else {
				totalMigrated++
				logrus.Infof("[Migration 2026031000] [DONE] account=%s partition=%s", account, partition)
			}
		}

		// 5. 本分区无错误时将 AllowAccounts 设回 ALL
		//    设回 ALL 后新建账户不会因不在白名单中而被意外封锁，封锁完全由新机制接管。
		//    若有账户处理失败，保留旧机制封锁，等待人工介入后重跑脚本。
		if partitionErrors == 0 {
			if err := setPartitionAllowAccounts(scontrol, partition, "ALL"); err != nil {
				logrus.Errorf("[Migration 2026031000] set partition %s AllowAccounts=ALL failed: %v", partition, err)
				totalErrors++
			} else {
				logrus.Infof("[Migration 2026031000] partition [%s] AllowAccounts restored to ALL", partition)
			}
		} else {
			logrus.Warnf("[Migration 2026031000] partition [%s] has %d failed accounts, AllowAccounts=ALL skipped, fix and run: ./scow-slurm-adapter migrate-block-to-association",
				partition, partitionErrors)
			totalErrors += partitionErrors
		}
	}

	logrus.Infof("[Migration 2026031000] migration done: succeeded=%d failed=%d", totalMigrated, totalErrors)
	if totalErrors > 0 {
		return fmt.Errorf("%d accounts migration failed", totalErrors)
	}
	return nil
}

// migrateBlockedAccount 迁移单个账户在指定分区下的封锁状态。
func migrateBlockedAccount(tx *gorm.DB, sacctmgr, assocTable, account, partition string) error {
	// 只查询 max_submit_jobs != 0（含 NULL）的活跃用户：
	//   - 这些用户是封锁前的原始状态，需保存并迁移。
	//   - max_submit_jobs = 0 的用户是被单独封锁的，与账户封锁无关，不触碰。
	type userRow struct {
		User          string `gorm:"column:user"`
		MaxSubmitJobs int32  `gorm:"column:max_submit_jobs"`
	}
	var rows []userRow
	if err := tx.Raw(
		fmt.Sprintf(
			"SELECT `user`, IFNULL(max_submit_jobs, -1) AS max_submit_jobs FROM %s WHERE deleted=0 AND acct=? AND `partition`=? AND `user`!='' AND (max_submit_jobs IS NULL OR max_submit_jobs!=0)",
			assocTable,
		),
		account, partition,
	).Scan(&rows).Error; err != nil {
		return fmt.Errorf("query users failed: %w", err)
	}

	if len(rows) == 0 {
		logrus.Infof("[Migration 2026031000] all active users already individually blocked (max_submit_jobs=0), skip")
		return nil
	}

	// 写入 acct_permission_persistence（INSERT IGNORE 保证行级幂等，不覆盖已有正确原始值）
	now := uint64(time.Now().Unix())
	for _, row := range rows {
		if err := tx.Exec(
			`INSERT IGNORE INTO acct_permission_persistence
				(creation_time, mod_time, account_name, partition_name, user_name, original_max_submit_jobs)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			now, now, account, partition, row.User, row.MaxSubmitJobs,
		).Error; err != nil {
			return fmt.Errorf("insert record for user=%s failed: %w", row.User, err)
		}
		logrus.Infof("[Migration 2026031000] saved original value: user=%s original_max_submit_jobs=%d", row.User, row.MaxSubmitJobs)
	}

	// sacctmgr 将该账户在该分区的所有用户 MaxSubmitJobs 设为 0
	out, err := exec.Command(
		sacctmgr,
		"-i", "-Q", "modify", "user", "where",
		fmt.Sprintf("account=%s", account),
		fmt.Sprintf("partition=%s", partition),
		"set", "MaxSubmitJobs=0",
	).CombinedOutput()
	if err != nil {
		return fmt.Errorf("sacctmgr failed: %v, output: %s", err, strings.TrimSpace(string(out)))
	}
	logrus.Infof("[Migration 2026031000] sacctmgr MaxSubmitJobs=0 done")
	return nil
}

// getPartitionAllowAccounts 调用 scontrol 获取所有分区及其 AllowAccounts。
func getPartitionAllowAccounts(scontrol string) (map[string]string, error) {
	out, err := exec.Command(scontrol, "show", "partition", "-o").Output()
	if err != nil {
		return nil, fmt.Errorf("scontrol show partition: %w", err)
	}
	result := make(map[string]string)
	scanner := bufio.NewScanner(bytes.NewReader(out))
	for scanner.Scan() {
		line := scanner.Text()
		partMatch := partitionNameRe.FindStringSubmatch(line)
		if len(partMatch) < 2 {
			continue
		}
		allowMatch := allowAccountsRe.FindStringSubmatch(line)
		if len(allowMatch) < 2 {
			result[partMatch[1]] = "ALL"
		} else {
			result[partMatch[1]] = allowMatch[1]
		}
	}
	return result, scanner.Err()
}

// setPartitionAllowAccounts 调用 scontrol 更新分区的 AllowAccounts。
func setPartitionAllowAccounts(scontrol, partition, allowAccounts string) error {
	out, err := exec.Command(
		scontrol, "update",
		fmt.Sprintf("partition=%s", partition),
		fmt.Sprintf("AllowAccounts=%s", allowAccounts),
	).CombinedOutput()
	if err != nil {
		return fmt.Errorf("scontrol update: %v, output: %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}
