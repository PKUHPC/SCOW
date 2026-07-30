package utils

import (
	"fmt"
	"strings"
	"time"

	"scow-adapters/pkg/slurm/client"
)

const persistenceWriteBatchSize = 500

type associationLimitPair struct {
	// Jobs 保存运行中作业数限制，按使用场景分别对应 grp_jobs 或 max_jobs。
	Jobs int32
	// SubmitJobs 保存已提交作业数限制，按使用场景分别对应 grp_submit_jobs 或 max_submit_jobs。
	SubmitJobs int32
}

// accountBlockRecord 保存执行账户封锁前，一个 association 上原有的 Grp* 限制。
// 整体账户封锁使用 Partition=""、User="" 表示账户父 association；
// 分区封锁则为目标分区下的每个用户 association 各保存一条记录。
type accountBlockRecord struct {
	Account   string
	Partition string
	User      string
	Original  associationLimitPair
}

// userBlockRecord 保存执行用户封锁前，一个用户分区 association 上原有的 Max* 限制。
type userBlockRecord struct {
	Account   string
	User      string
	Partition string
	Original  associationLimitPair
}

// saveAccountBlockRecord 在修改 Slurm 前保存账户封锁将要修改的 Grp* 原值。
// 重复封锁只更新时间，不覆盖 original_*：否则当前已经为 0 的封锁值会覆盖真正的原值，
// 后续解封就无法恢复管理员在首次封锁前配置的限制。
func saveAccountBlockRecord(account, partition, user string, original associationLimitPair) error {
	return saveAccountBlockRecords([]accountBlockRecord{{
		Account: account, Partition: partition, User: user, Original: original,
	}})
}

// saveAccountBlockRecords 批量保存 association 的 Grp* 原值。
// 每批只生成一次 INSERT；重复记录仅更新时间，不覆盖第一次封锁前保存的原值。
func saveAccountBlockRecords(records []accountBlockRecord) error {
	now := time.Now().Unix()
	for start := 0; start < len(records); start += persistenceWriteBatchSize {
		end := min(start+persistenceWriteBatchSize, len(records))
		batch := records[start:end]
		values := make([]string, 0, len(batch))
		args := make([]any, 0, len(batch)*7)
		for _, record := range batch {
			values = append(values, "(?, ?, ?, ?, ?, ?, ?)")
			args = append(args, now, now, record.Account, record.Partition, record.User,
				record.Original.Jobs, record.Original.SubmitJobs)
		}
		query := `INSERT INTO account_block_persistence
			(creation_time, mod_time, account_name, partition_name, user_name, original_grp_jobs, original_grp_submit_jobs)
			VALUES ` + strings.Join(values, ",") + `
			ON DUPLICATE KEY UPDATE mod_time = VALUES(mod_time)`
		if _, err := client.SlurmDB.Exec(query, args...); err != nil {
			return fmt.Errorf("save account block records failed: %w", err)
		}
	}
	return nil
}

// getAccountBlockRecords 读取指定账户封锁范围内的全部恢复记录。
// partition 为空时读取账户父 association；非空时读取该分区下各用户 association。
func getAccountBlockRecords(account, partition string) ([]accountBlockRecord, error) {
	rows, err := client.SlurmDB.Query(`
		SELECT partition_name, user_name, original_grp_jobs, original_grp_submit_jobs
		FROM account_block_persistence
		WHERE account_name = ? AND partition_name = ?
	`, account, partition)
	if err != nil {
		return nil, fmt.Errorf("get account block records failed: %w", err)
	}
	defer rows.Close()

	var records []accountBlockRecord
	for rows.Next() {
		var record accountBlockRecord
		if err := rows.Scan(&record.Partition, &record.User, &record.Original.Jobs, &record.Original.SubmitJobs); err != nil {
			return nil, fmt.Errorf("scan account block record failed: %w", err)
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate account block records failed: %w", err)
	}
	return records, nil
}

// deleteAccountBlockRecords 在 Slurm 原值全部恢复成功后删除对应恢复记录。
// 调用方必须保证先恢复 Slurm、后删记录，避免恢复失败后丢失原值。
func deleteAccountBlockRecords(account, partition string) error {
	_, err := client.SlurmDB.Exec(
		`DELETE FROM account_block_persistence WHERE account_name = ? AND partition_name = ?`,
		account, partition,
	)
	if err != nil {
		return fmt.Errorf("delete account block records failed: %w", err)
	}
	return nil
}

// IsWholeAccountBlockRecorded 判断是否保存了账户父 association 的封锁前原值。
// 该记录只用于恢复和避免重复封锁覆盖原值，不代表 Slurm 当前是否仍处于封锁状态。
func IsWholeAccountBlockRecorded(account string) (bool, error) {
	var exists int
	err := client.SlurmDB.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM account_block_persistence
			WHERE account_name = ? AND partition_name = '' AND user_name = ''
		)
	`, account).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("query whole account block record failed: %w", err)
	}
	return exists == 1, nil
}

// saveUserBlockRecord 在写入 MaxJobs=0、MaxSubmitJobs=0 前保存原值。
// 与账户封锁记录相同，重复调用不得覆盖首次保存的 original_*。
func saveUserBlockRecord(account, user, partition string, original associationLimitPair) error {
	return saveUserBlockRecords([]userBlockRecord{{
		Account: account, User: user, Partition: partition, Original: original,
	}})
}

// saveUserBlockRecords 批量保存 association 的 Max* 原值。
func saveUserBlockRecords(records []userBlockRecord) error {
	now := time.Now().Unix()
	for start := 0; start < len(records); start += persistenceWriteBatchSize {
		end := min(start+persistenceWriteBatchSize, len(records))
		batch := records[start:end]
		values := make([]string, 0, len(batch))
		args := make([]any, 0, len(batch)*7)
		for _, record := range batch {
			values = append(values, "(?, ?, ?, ?, ?, ?, ?)")
			args = append(args, now, now, record.Account, record.User, record.Partition,
				record.Original.Jobs, record.Original.SubmitJobs)
		}
		query := `INSERT INTO user_block_persistence
			(creation_time, mod_time, account_name, user_name, partition_name, original_max_jobs, original_max_submit_jobs)
			VALUES ` + strings.Join(values, ",") + `
			ON DUPLICATE KEY UPDATE mod_time = VALUES(mod_time)`
		if _, err := client.SlurmDB.Exec(query, args...); err != nil {
			return fmt.Errorf("save user block records failed: %w", err)
		}
	}
	return nil
}

// getUserBlockRecords 读取用户在账户下所有分区 association 的 Max* 恢复值。
func getUserBlockRecords(account, user string) ([]userBlockRecord, error) {
	rows, err := client.SlurmDB.Query(`
		SELECT partition_name, original_max_jobs, original_max_submit_jobs
		FROM user_block_persistence
		WHERE account_name = ? AND user_name = ?
	`, account, user)
	if err != nil {
		return nil, fmt.Errorf("get user block records failed: %w", err)
	}
	defer rows.Close()

	var records []userBlockRecord
	for rows.Next() {
		var record userBlockRecord
		if err := rows.Scan(&record.Partition, &record.Original.Jobs, &record.Original.SubmitJobs); err != nil {
			return nil, fmt.Errorf("scan user block record failed: %w", err)
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate user block records failed: %w", err)
	}
	return records, nil
}

// deleteUserBlockRecords 在用户全部 Max* 原值恢复成功后清理持久化记录。
func deleteUserBlockRecords(account, user string) error {
	_, err := client.SlurmDB.Exec(
		`DELETE FROM user_block_persistence WHERE account_name = ? AND user_name = ?`,
		account, user,
	)
	if err != nil {
		return fmt.Errorf("delete user block records failed: %w", err)
	}
	return nil
}

// IsUserBlockRecorded 判断是否保存了该用户封锁前的 Max* 原值。
// 该记录用于解封时恢复原值和避免重复封锁覆盖原值，不直接代表用户当前的封锁状态；
// 当前状态统一根据 association 中的 MaxJobs、MaxSubmitJobs 判断。
func IsUserBlockRecorded(account, user string) (bool, error) {
	var exists int
	err := client.SlurmDB.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM user_block_persistence
			WHERE account_name = ? AND user_name = ?
		)
	`, account, user).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("query user block status failed: %w", err)
	}
	return exists == 1, nil
}

// getRecordedBlockedUsersInAccount 一次性返回账户下由 SCOW 封锁的用户集合。
// 批量创建 association 时使用该集合，避免为每个用户单独查询 user_block_persistence。
func getRecordedBlockedUsersInAccount(account string) (map[string]struct{}, error) {
	rows, err := client.SlurmDB.Query(`
		SELECT DISTINCT user_name
		FROM user_block_persistence
		WHERE account_name = ?
	`, account)
	if err != nil {
		return nil, fmt.Errorf("query blocked users in account failed: %w", err)
	}
	defer rows.Close()

	result := make(map[string]struct{})
	for rows.Next() {
		var user string
		if err := rows.Scan(&user); err != nil {
			return nil, fmt.Errorf("scan blocked user in account failed: %w", err)
		}
		result[user] = struct{}{}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate blocked users in account failed: %w", err)
	}
	return result, nil
}

// DeleteUserAssociationBlockRecords 清理已删除用户-账户 association 对应的恢复记录。
// association 删除后已经没有需要恢复的记录；如果不清理，同名关系重建后可能读取到旧数据。
func DeleteUserAssociationBlockRecords(account, user string) error {
	if _, err := client.SlurmDB.Exec(
		`DELETE FROM account_block_persistence WHERE account_name = ? AND user_name = ?`, account, user,
	); err != nil {
		return fmt.Errorf("delete removed user account block records failed: %w", err)
	}
	if _, err := client.SlurmDB.Exec(
		`DELETE FROM user_block_persistence WHERE account_name = ? AND user_name = ?`, account, user,
	); err != nil {
		return fmt.Errorf("delete removed user block records failed: %w", err)
	}
	return nil
}

// DeleteUserBlockRecords 清理用户全部 Slurm association 删除后遗留的账户封锁和用户封锁恢复记录。
// 两张表必须在同一事务中清理，避免只删除其中一张后留下不完整状态。
func DeleteUserBlockRecords(user string) error {
	tx, err := client.SlurmDB.Begin()
	if err != nil {
		return fmt.Errorf("begin delete user block records transaction failed: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	for _, query := range []string{
		`DELETE FROM account_block_persistence WHERE user_name = ?`,
		`DELETE FROM user_block_persistence WHERE user_name = ?`,
	} {
		if _, err := tx.Exec(query, user); err != nil {
			return fmt.Errorf("delete user block records failed: %w", err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit delete user block records failed: %w", err)
	}
	return nil
}

// DeleteAccountBlockRecords 清理账户删除后遗留的账户和用户封锁恢复记录。
func DeleteAccountBlockRecords(account string) error {
	for _, query := range []string{
		`DELETE FROM account_block_persistence WHERE account_name = ?`,
		`DELETE FROM user_block_persistence WHERE account_name = ?`,
	} {
		if _, err := client.SlurmDB.Exec(query, account); err != nil {
			return fmt.Errorf("delete account block records failed: %w", err)
		}
	}
	return nil
}
