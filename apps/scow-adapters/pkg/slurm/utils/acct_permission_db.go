package utils

import (
	"fmt"
	"time"

	"github.com/sirupsen/logrus"

	"scow-adapters/pkg/slurm/client"
)

// upsertPermissionRecord 保存（或覆盖更新）封锁前某用户在指定账户+分区下的原始 max_submit_jobs。
// 以 (account_name, partition_name, user_name) 三元组作为唯一键：
//   - 若记录不存在，则插入；
//   - 若记录已存在（账户重复封锁），则更新 original_max_submit_jobs 和 mod_time。
func upsertPermissionRecord(accountName, partitionName, userName string, originalMaxSubmitJobs int32) error {
	now := uint64(time.Now().Unix())
	query := `
		INSERT INTO acct_permission_persistence
			(creation_time, mod_time, account_name, partition_name, user_name, original_max_submit_jobs)
		VALUES (?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			mod_time               = VALUES(mod_time),
			original_max_submit_jobs = VALUES(original_max_submit_jobs)
	`
	_, err := client.SlurmDB.Exec(query, now, now, accountName, partitionName, userName, originalMaxSubmitJobs)
	if err != nil {
		return fmt.Errorf("upsert permission record failed: %w", err)
	}
	logrus.Tracef("upserted permission record: account=%s partition=%s user=%s original_max_submit_jobs=%d",
		accountName, partitionName, userName, originalMaxSubmitJobs)
	return nil
}

// getPermissionRecords 读取指定账户+分区下所有已持久化的原始 max_submit_jobs 记录。
// 返回 map[userName]originalMaxSubmitJobs。
func getPermissionRecords(accountName, partitionName string) (map[string]int32, error) {
	query := `
		SELECT user_name, original_max_submit_jobs
		FROM acct_permission_persistence
		WHERE account_name = ? AND partition_name = ?
	`
	rows, err := client.SlurmDB.Query(query, accountName, partitionName)
	if err != nil {
		return nil, fmt.Errorf("get permission records failed: %w", err)
	}
	defer rows.Close()

	records := make(map[string]int32)
	for rows.Next() {
		var userName string
		var originalMaxSubmitJobs int32
		if err := rows.Scan(&userName, &originalMaxSubmitJobs); err != nil {
			return nil, fmt.Errorf("scan permission record failed: %w", err)
		}
		records[userName] = originalMaxSubmitJobs
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate permission records failed: %w", err)
	}
	return records, nil
}

// DeletePermissionRecord 删除指定账户+分区+用户的一条持久化记录。
// 用于 CreateAccount/AddUserToAccount 回滚：association 已删除时，对应的 MaxSubmitJobs 恢复记录也不应继续保留。
func DeletePermissionRecord(accountName, partitionName, userName string) error {
	query := `DELETE FROM acct_permission_persistence WHERE account_name = ? AND partition_name = ? AND user_name = ?`
	_, err := client.SlurmDB.Exec(query, accountName, partitionName, userName)
	if err != nil {
		return fmt.Errorf("delete permission record failed: %w", err)
	}
	logrus.Tracef("deleted permission record: account=%s partition=%s user=%s", accountName, partitionName, userName)
	return nil
}

// deletePermissionRecords 解封账户后，清理指定账户+分区下的所有持久化记录。
func deletePermissionRecords(accountName, partitionName string) error {
	query := `DELETE FROM acct_permission_persistence WHERE account_name = ? AND partition_name = ?`
	_, err := client.SlurmDB.Exec(query, accountName, partitionName)
	if err != nil {
		return fmt.Errorf("delete permission records failed: %w", err)
	}
	logrus.Tracef("deleted permission records: account=%s partition=%s", accountName, partitionName)
	return nil
}
