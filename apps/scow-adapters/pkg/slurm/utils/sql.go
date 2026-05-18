package utils

import (
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/sirupsen/logrus"

	"scow-adapters/pkg/slurm/client"
	"scow-adapters/pkg/slurm/config"
)

type AssociateInfo struct {
	MaxJobs int
}

// GetMaxSubmitJobs 获取用户的MaxSubmitJobs， NULL表示提交作业不受限制，0表示该用户无法提交作业
func GetMaxSubmitJobs(user, account string) string {
	var maxSubmitJobs string
	clusterName := config.SlurmValue.MySQLConfig.ClusterName
	maxSubmitJobsSqlConfig := fmt.Sprintf("SELECT DISTINCT max_submit_jobs FROM %s_assoc_table WHERE user = ? AND acct = ? AND deleted = 0", clusterName)
	err := client.SlurmDB.QueryRow(maxSubmitJobsSqlConfig, user, account).Scan(&maxSubmitJobs)
	if err != nil {
		return "NULL"
	}
	return "0"
}

// CheckUserAndAccountAssociate 在assoc_table表中查看用户和账户是否存在联系
func CheckUserAndAccountAssociate(userId, accountName string) error {
	var userName string
	clusterName := config.SlurmValue.MySQLConfig.ClusterName
	assocSqlConfig := fmt.Sprintf("SELECT DISTINCT user FROM %s_assoc_table WHERE user = ? AND acct = ? AND deleted = 0", clusterName)
	err := client.SlurmDB.QueryRow(assocSqlConfig, userId, accountName).Scan(&userName)
	if err != nil {
		return fmt.Errorf("user: %s and account: %s associate is not exists", userId, accountName)
	}
	return nil
}

// GetNotCompletedJobsByUserAndAccount 获取用户未结束的作业列表
func GetNotCompletedJobsByUserAndAccount(uid int, account string) ([]string, error) {
	var (
		jobName string
		jobList []string
	)
	clusterName := config.SlurmValue.MySQLConfig.ClusterName
	jobSqlConfig := fmt.Sprintf("SELECT job_name FROM %s_job_table WHERE id_user = ? AND account = ? AND state IN (0, 1, 2)", clusterName)
	jobRows, err := client.SlurmDB.Query(jobSqlConfig, uid, account)
	if err != nil {
		return nil, fmt.Errorf("sql query failed")
	}
	defer jobRows.Close()
	for jobRows.Next() {
		err = jobRows.Scan(&jobName)
		if err != nil {
			return nil, fmt.Errorf("sql query failed")
		}
		jobList = append(jobList, jobName)
	}
	err = jobRows.Err()
	if err != nil {
		return nil, fmt.Errorf("sql query failed")
	}
	return jobList, nil
}

// GetAllQosInDatabase 从数据库查询所有的qos
func GetAllQosInDatabase() ([]string, error) {
	var (
		qosName string
		qosList []string
	)
	qosSqlConfig := "SELECT name FROM qos_table WHERE deleted = 0"
	rows, err := client.SlurmDB.Query(qosSqlConfig)
	if err != nil {
		return nil, fmt.Errorf("sql query failed")
	}
	defer rows.Close()
	for rows.Next() {
		err = rows.Scan(&qosName)
		if err != nil {
			return nil, fmt.Errorf("sql query failed")
		}
		qosList = append(qosList, qosName)
	}
	err = rows.Err()
	if err != nil {
		return nil, fmt.Errorf("sql query failed")
	}
	return qosList, nil
}

// SelectUserExists 查询用户的存在情况，并返回错误
func SelectUserExists(user string) (bool, error) {
	var exists int
	userSqlConfig := "SELECT EXISTS(SELECT 1 FROM user_table WHERE name = ? AND deleted = 0)"
	err := client.SlurmDB.QueryRow(userSqlConfig, user).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("%s does not exists", user)
	}

	if exists == 0 {
		return false, nil
	}

	return true, nil
}

// SelectAccountExists 查询账户的存在情况，并返回错误
func SelectAccountExists(account string) (bool, error) {
	var exists int
	accountSqlConfig := "SELECT EXISTS(SELECT 1 FROM acct_table WHERE name = ? AND deleted = 0)"
	err := client.SlurmDB.QueryRow(accountSqlConfig, account).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("%s does not exists", account)
	}

	if exists == 0 {
		return false, nil
	}

	return true, nil
}

// GetAllAccountInDatabase 从数据库中获取所有账户
func GetAllAccountInDatabase() ([]string, error) {
	var (
		acctName string
		acctList []string
	)
	acctSqlConfig := fmt.Sprintf("SELECT name FROM acct_table WHERE deleted = 0")
	rows, err := client.SlurmDB.Query(acctSqlConfig)
	if err != nil {
		return nil, fmt.Errorf("sql query failed")
	}
	defer rows.Close()
	for rows.Next() {
		err = rows.Scan(&acctName)
		if err != nil {
			return nil, fmt.Errorf("sql query failed")
		}
		acctList = append(acctList, acctName)
	}
	err = rows.Err()
	if err != nil {
		return nil, fmt.Errorf("sql query failed")
	}
	return acctList, nil
}

// GetAccountsAssocWithUserInDatabase 获取与用户相关联的所有账户信息
func GetAccountsAssocWithUserInDatabase(userId string) ([]string, error) {
	var (
		assocAcct string
		acctList  []string
	)

	clusterName := config.SlurmValue.MySQLConfig.ClusterName
	assocSqlConfig := fmt.Sprintf("SELECT DISTINCT acct FROM %s_assoc_table WHERE user = ? AND deleted = 0", clusterName)
	rows, err := client.SlurmDB.Query(assocSqlConfig, userId)
	if err != nil {
		return nil, fmt.Errorf("sql query failed")
	}
	defer rows.Close()
	for rows.Next() {
		err = rows.Scan(&assocAcct)
		if err != nil {
			return nil, fmt.Errorf("sql query failed")
		}
		acctList = append(acctList, assocAcct)
	}
	err = rows.Err()
	if err != nil {
		return nil, fmt.Errorf("sql query failed")
	}
	return acctList, nil
}

// GetAccountsAssocWithUserWithoutAccountInDatabase 获取与用户相关联的除某个账户外的所有账户信息
func GetAccountsAssocWithUserWithoutAccountInDatabase(userId, account string) ([]string, error) {
	var (
		acct     string
		acctList []string
	)

	clusterName := config.SlurmValue.MySQLConfig.ClusterName
	assocAcctSqlConfig := fmt.Sprintf("SELECT DISTINCT acct FROM %s_assoc_table WHERE user = ? AND deleted = 0 AND acct != ?", clusterName)
	rows, err := client.SlurmDB.Query(assocAcctSqlConfig, userId, account)
	if err != nil {
		return nil, fmt.Errorf("sql query failed")
	}
	defer rows.Close()
	for rows.Next() {
		err := rows.Scan(&acct)
		if err != nil {
			return nil, fmt.Errorf("sql query failed")
		}
		acctList = append(acctList, acct)
	}
	err = rows.Err()
	if err != nil {
		return nil, fmt.Errorf("sql query failed")
	}

	return acctList, nil
}

// GetQosList 从qos表中获取所有qos
func GetQosList() ([]string, error) {
	var (
		qosName string
		qosList []string
	)
	qosSqlConfig := "SELECT name FROM qos_table WHERE deleted = 0"
	rows, err := client.SlurmDB.Query(qosSqlConfig)
	if err != nil {
		return nil, fmt.Errorf("sql query failed")
	}
	defer rows.Close()
	for rows.Next() {
		err := rows.Scan(&qosName)
		if err != nil {
			return nil, fmt.Errorf("sql query failed")
		}
		qosList = append(qosList, qosName)
	}

	err = rows.Err()
	if err != nil {
		return nil, fmt.Errorf("sql query failed")
	}

	return qosList, nil
}

// GetAcctAndUsersBlockedInfo 从数据库中查询账户、用户及用户封锁的信息
func GetAcctAndUsersBlockedInfo() (map[string]map[string]bool, error) {
	var (
		acctName string
		userName string
		maxJobs  sql.NullInt64 // 使用 sql.NullInt64 处理可能的 NULL 值
	)

	// 创建嵌套 map 结构：map[账户]map[用户]封锁状态
	acctUsersStatus := make(map[string]map[string]bool)

	// 构建 SQL 查询
	query := fmt.Sprintf(
		"SELECT acct, user, max_jobs FROM %s_assoc_table WHERE deleted = 0 AND user != '' ORDER BY acct, user",
		config.SlurmValue.MySQLConfig.ClusterName,
	)

	rows, err := client.SlurmDB.Query(query)
	if err != nil {
		return nil, fmt.Errorf("sql query failed: %v", err)
	}
	defer rows.Close()

	// 临时存储每个用户的所有 max_submit_jobs 值
	userMaxJobs := make(map[string]map[string][]sql.NullInt64)

	// 第一遍扫描：收集所有用户的所有 maxJobs 值
	for rows.Next() {
		if err := rows.Scan(&acctName, &userName, &maxJobs); err != nil {
			return nil, fmt.Errorf("row scan failed: %v", err)
		}

		if _, ok := userMaxJobs[acctName]; !ok {
			userMaxJobs[acctName] = make(map[string][]sql.NullInt64)
		}

		userMaxJobs[acctName][userName] = append(userMaxJobs[acctName][userName], maxJobs)
	}

	// 检查是否有扫描错误
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows error: %v", err)
	}

	// 第二遍处理：确定每个用户的最终封锁状态
	for acct, users := range userMaxJobs {
		if _, ok := acctUsersStatus[acct]; !ok {
			acctUsersStatus[acct] = make(map[string]bool)
		}

		for user, jobs := range users {
			// 默认设置为封锁状态（只有全部为0时才封锁）
			blocked := true

			// 检查该用户的所有 max_submit_jobs 值
			for _, job := range jobs {
				// 如果有任何一个 NULL 值，用户解封
				if !job.Valid {
					blocked = false
					break
				}

				// 如果有任何一个大于0的值，用户解封
				if job.Int64 > 0 {
					blocked = false
					break
				}
			}

			acctUsersStatus[acct][user] = blocked
		}
	}

	return acctUsersStatus, nil
}

// GetAcctPartitionsInfo 从数据库中查询每个账户包含的分区数据
func GetAcctPartitionsInfo() (map[string][]string, error) {
	var (
		partition string
		acctName  string
	)
	acctAndPartitions := make(map[string][]string)
	partitionSqlConfig := fmt.Sprintf("SELECT DISTINCT acct, `partition` FROM %s_assoc_table WHERE deleted = 0", config.SlurmValue.MySQLConfig.ClusterName)
	rows, err := client.SlurmDB.Query(partitionSqlConfig)
	if err != nil {
		return nil, fmt.Errorf("sql query failed")
	}
	defer rows.Close()
	for rows.Next() {
		err = rows.Scan(&acctName, &partition)
		if err != nil {
			return nil, fmt.Errorf("sql query failed")
		}
		if partition == "" {
			continue
		}
		acctAndPartitions[acctName] = append(acctAndPartitions[acctName], partition)
	}
	return acctAndPartitions, nil
}

// GetPartitionsAcctInfo 从数据库中查询每个分区包含的账户数据
func GetPartitionsAcctInfo() (map[string][]string, error) {
	var (
		partition string
		acctName  string
	)
	partitionsAndAcct := make(map[string][]string)
	clusterName := config.SlurmValue.MySQLConfig.ClusterName
	partitionSqlConfig := fmt.Sprintf("SELECT DISTINCT acct, `partition` FROM %s_assoc_table WHERE deleted = 0", clusterName)
	rows, err := client.SlurmDB.Query(partitionSqlConfig)
	if err != nil {
		return nil, fmt.Errorf("sql query failed")
	}
	defer rows.Close()
	for rows.Next() {
		err = rows.Scan(&acctName, &partition)
		if err != nil {
			return nil, fmt.Errorf("sql query failed")
		}
		if partition == "" {
			continue
		}
		partitionsAndAcct[partition] = append(partitionsAndAcct[partition], acctName)
	}
	return partitionsAndAcct, nil
}

func GetJobTimeLimit(jobId int) (int64, error) {
	var timeLimit int64
	clusterName := config.SlurmValue.MySQLConfig.ClusterName
	timeLimitSqlConfig := fmt.Sprintf("SELECT timelimit FROM %s_job_table WHERE id_job = ?", clusterName)
	err := client.SlurmDB.QueryRow(timeLimitSqlConfig, jobId).Scan(&timeLimit)
	if err != nil {
		return 0, err
	}
	return timeLimit, nil
}

func GetJobSubmitTime(jobId int) (int64, error) {
	var timeSubmit int64
	clusterName := config.SlurmValue.MySQLConfig.ClusterName
	submitTimeSqlConfig := fmt.Sprintf("SELECT time_submit FROM %s_job_table WHERE id_job = ?", clusterName)
	err := client.SlurmDB.QueryRow(submitTimeSqlConfig, jobId).Scan(&timeSubmit)
	if err != nil {
		return 0, err
	}
	return timeSubmit, nil
}

func GetCpuMemNodeTresId() (int, int, int, error) {
	var cpuTresId, memTresId, nodeTresId int
	// cpuTresId、memTresId、nodeTresId
	cpuTresSqlConfig := "SELECT id FROM tres_table WHERE type = 'cpu'"
	memTresSqlConfig := "SELECT id FROM tres_table WHERE type = 'mem'"
	nodeTresSqlConfig := "SELECT id FROM tres_table WHERE type = 'node'"
	err := client.SlurmDB.QueryRow(cpuTresSqlConfig).Scan(&cpuTresId)
	if err != nil {
		return 0, 0, 0, err
	}
	err = client.SlurmDB.QueryRow(memTresSqlConfig).Scan(&memTresId)
	if err != nil {
		return 0, 0, 0, err
	}
	err = client.SlurmDB.QueryRow(nodeTresSqlConfig).Scan(&nodeTresId)
	if err != nil {
		return 0, 0, 0, err
	}
	return cpuTresId, memTresId, nodeTresId, nil
}

func GetGpuTresIds() ([]int, error) {
	var (
		gpuIdList []int
		gpuId     int
	)

	gpuSqlConfig := "SELECT id FROM tres_table WHERE type = 'gres' AND deleted = 0"
	rowList, err := client.SlurmDB.Query(gpuSqlConfig)
	if err != nil {
		return nil, err
	}
	defer rowList.Close()
	for rowList.Next() {
		err = rowList.Scan(&gpuId)
		if err != nil {
			return nil, err
		}
		gpuIdList = append(gpuIdList, gpuId)
	}
	err = rowList.Err()
	if err != nil {
		return nil, err
	}
	return gpuIdList, nil
}

func GetJobQosName(idQos int) string {
	var qosName string
	qosSqlConfig := "SELECT name FROM qos_table WHERE id = ? AND deleted = 0"
	err := client.SlurmDB.QueryRow(qosSqlConfig, idQos).Scan(&qosName)
	if err != nil {
		return ""
	}
	return qosName
}

// GetAccountAssociatedUserInDatabase 从数据库中获取指定账户关联的用户, 排除excludeUserList。
func GetAccountAssociatedUserInDatabase(accountName string, excludeUserList []string) ([]string, error) {
	var (
		userName string
		userList []string
	)

	acctSqlConfig := fmt.Sprintf("SELECT DISTINCT `user` FROM %s_assoc_table WHERE deleted = 0 AND user != '' AND acct = ?", config.SlurmValue.MySQLConfig.ClusterName)
	if len(excludeUserList) > 0 {
		quoted := make([]string, len(excludeUserList))
		for i, s := range excludeUserList {
			quoted[i] = fmt.Sprintf(`"%s"`, s) // 显式添加双引号
		}

		placeholders := "(" + strings.Join(quoted, ", ") + ")"
		acctSqlConfig = fmt.Sprintf("SELECT DISTINCT `user` FROM %s_assoc_table WHERE deleted = 0 AND user != '' AND acct = ? AND user NOT IN %s", config.SlurmValue.MySQLConfig.ClusterName, placeholders)
	}

	rows, err := client.SlurmDB.Query(acctSqlConfig, accountName)
	if err != nil {
		logrus.Errorf("sql query failed, error: %v", err)
		return nil, fmt.Errorf("sql query failed")
	}
	defer rows.Close()
	for rows.Next() {
		err = rows.Scan(&userName)
		if err != nil {
			return nil, fmt.Errorf("sql query failed")
		}

		userList = append(userList, userName)
	}
	err = rows.Err()
	if err != nil {
		logrus.Errorf("sql rows failed, error: %v", err)
		return nil, fmt.Errorf("sql query failed")
	}
	return userList, nil
}

// GetAccountAssociateInfoInDatabase 从数据库中获取指定账户的用户关联信息,返回key为userName，value为AssociateInfo的值。
func GetAccountAssociateInfoInDatabase(accountName string) (map[string]*AssociateInfo, error) {
	var userName, maxJobs string
	assocInfo := make(map[string]*AssociateInfo)

	acctSqlConfig := fmt.Sprintf("SELECT DISTINCT `user`, max_jobs FROM %s_assoc_table WHERE deleted = 0 AND user != '' AND `partition` != '' AND acct = ?", config.SlurmValue.MySQLConfig.ClusterName)
	rows, err := client.SlurmDB.Query(acctSqlConfig, accountName)
	if err != nil {
		logrus.Errorf("sql query failed, error: %v", err)
		return nil, fmt.Errorf("sql query failed")
	}
	defer rows.Close()
	for rows.Next() {
		err = rows.Scan(&userName, &maxJobs)
		if err != nil {
			maxJobs = "NULL"
		}

		assocInfo[userName] = &AssociateInfo{
			MaxJobs: convertJobNums(maxJobs),
		}
	}
	err = rows.Err()
	if err != nil {
		logrus.Errorf("sql rows failed, error: %v", err)
		return nil, fmt.Errorf("sql query failed")
	}
	return assocInfo, nil
}

func convertJobNums(s string) int {
	if s = strings.TrimSpace(s); s == "" {
		return 0
	}

	if s = strings.TrimSpace(s); s == "NULL" {
		return 1
	}

	sInt, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}
	return sInt
}

// GetAccountAssociatedAllowedUserInDatabaseByDeleted 从数据库中获取指定账户关联的用户。
func GetAccountAssociatedAllowedUserInDatabaseByDeleted(accountName, partition string) ([]string, error) {
	var (
		userName string
		userList []string
	)

	userSqlConfig := fmt.Sprintf("SELECT DISTINCT `user` FROM %s_assoc_table WHERE deleted = 0 AND `partition`= ? AND acct = ? AND (max_submit_jobs IS NULL OR max_submit_jobs != 0)", config.SlurmValue.MySQLConfig.ClusterName)

	rows, err := client.SlurmDB.Query(userSqlConfig, partition, accountName)
	if err != nil {
		logrus.Errorf("sql query failed, error: %v", err)
		return nil, fmt.Errorf("sql query failed")
	}
	defer rows.Close()
	for rows.Next() {
		err = rows.Scan(&userName)
		if err != nil {
			return nil, fmt.Errorf("sql query failed")
		}

		userList = append(userList, userName)
	}
	err = rows.Err()
	if err != nil {
		logrus.Errorf("sql rows failed, error: %v", err)
		return nil, fmt.Errorf("sql query failed")
	}
	return userList, nil
}

// GetAccountAssociatedAllowedPartitionInDatabase 从数据库中获取指定账户的授权分区。
func GetAccountAssociatedAllowedPartitionInDatabase(accountName string) ([]string, error) {
	var (
		partition     string
		partitionList []string
	)

	partitionSqlConfig := fmt.Sprintf("SELECT DISTINCT `partition` FROM %s_assoc_table WHERE deleted = 0 AND `partition` != '' AND `user` != '' AND acct = ? AND (max_submit_jobs IS NULL OR max_submit_jobs != 0)",
		config.SlurmValue.MySQLConfig.ClusterName)

	rows, err := client.SlurmDB.Query(partitionSqlConfig, accountName)
	if err != nil {
		logrus.Errorf("sql query failed, error: %v", err)
		return nil, fmt.Errorf("sql query failed")
	}
	defer rows.Close()
	for rows.Next() {
		err = rows.Scan(&partition)
		if err != nil {
			return nil, fmt.Errorf("sql query failed")
		}

		partitionList = append(partitionList, partition)
	}
	err = rows.Err()
	if err != nil {
		logrus.Errorf("sql rows failed, error: %v", err)
		return nil, fmt.Errorf("sql query failed")
	}
	return partitionList, nil
}

// GetAccountAssociatedBlockedPartitionInDatabase 从数据库中获取指定账户的已封锁分区。
func GetAccountAssociatedBlockedPartitionInDatabase(accountName string) ([]string, error) {
	var (
		partition     string
		partitionList []string
	)

	partitionSqlConfig := fmt.Sprintf("SELECT DISTINCT `partition` FROM %s_assoc_table WHERE deleted = 0 AND `partition` != '' AND `user` != '' AND acct = ? AND max_submit_jobs = 0",
		config.SlurmValue.MySQLConfig.ClusterName)

	rows, err := client.SlurmDB.Query(partitionSqlConfig, accountName)
	if err != nil {
		logrus.Errorf("sql query failed, error: %v", err)
		return nil, fmt.Errorf("sql query failed")
	}
	defer rows.Close()
	for rows.Next() {
		err = rows.Scan(&partition)
		if err != nil {
			return nil, fmt.Errorf("sql query failed")
		}

		partitionList = append(partitionList, partition)
	}
	err = rows.Err()
	if err != nil {
		logrus.Errorf("sql rows failed, error: %v", err)
		return nil, fmt.Errorf("sql query failed")
	}
	return partitionList, nil
}

// GetAccountAllowedPartitionByAssociation 从数据库中获取账户的授权分区。
func GetAccountAllowedPartitionByAssociation() (map[string][]string, error) {
	var (
		account   string
		partition string
	)

	partitionSqlConfig := fmt.Sprintf("SELECT DISTINCT acct,`partition` FROM %s_assoc_table WHERE deleted = 0 AND `partition` != '' AND `user` != '' AND (max_submit_jobs IS NULL OR max_submit_jobs != 0)",
		config.SlurmValue.MySQLConfig.ClusterName)

	rows, err := client.SlurmDB.Query(partitionSqlConfig)
	if err != nil {
		return nil, fmt.Errorf("sql query failed: %v", err)
	}
	defer rows.Close()

	// 存储每个账户的所有partition值
	acctBlockedInfo := make(map[string][]string)

	for rows.Next() {
		if err := rows.Scan(&account, &partition); err != nil {
			return nil, fmt.Errorf("row scan failed: %v", err)
		}

		// 如果账户不存在于map中，初始化一个空切片
		if _, exists := acctBlockedInfo[account]; !exists {
			acctBlockedInfo[account] = []string{}
		}

		acctBlockedInfo[account] = append(acctBlockedInfo[account], partition)
	}

	return acctBlockedInfo, nil
}

// GetUsersBlockedByUserLevelInAccountPartition 查询指定账户+分区下被用户维度封锁（max_jobs=0）的用户集合。
//
// 封锁用户接口（BlockUserInAccount）会将 max_jobs 置为 0，而封锁账户接口（BlockAccountUseAssociation）
// 仅修改 max_submit_jobs，不影响 max_jobs。因此 max_jobs=0 是"用户维度封锁"的唯一标识，
// 可在解封账户时用来跳过这些用户，避免误将其 MaxSubmitJobs 恢复。
func GetUsersBlockedByUserLevelInAccountPartition(account, partition string) (map[string]struct{}, error) {
	query := fmt.Sprintf(
		"SELECT DISTINCT `user` FROM %s_assoc_table WHERE deleted = 0 AND acct = ? AND `partition` = ? AND `user` != '' AND max_jobs = 0",
		config.SlurmValue.MySQLConfig.ClusterName,
	)
	rows, err := client.SlurmDB.Query(query, account, partition)
	if err != nil {
		return nil, fmt.Errorf("sql query failed: %v", err)
	}
	defer rows.Close()
	result := make(map[string]struct{})
	for rows.Next() {
		var userName string
		if err := rows.Scan(&userName); err != nil {
			return nil, fmt.Errorf("row scan failed: %v", err)
		}
		result[userName] = struct{}{}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("sql rows failed: %v", err)
	}
	return result, nil
}

// getUsersBlockedByAccountOnlyInAccountPartition 查询指定账户+分区下仅被账户维度封锁的用户列表：
// max_submit_jobs=0（账户封锁）且 max_jobs 不为 0（未被用户维度封锁）。
// 仅在 UnblockAccountUseAssociation fallback 路径中使用，用于在无持久化记录时精确恢复该恢复的用户。
func getUsersBlockedByAccountOnlyInAccountPartition(account, partition string) ([]string, error) {
	query := fmt.Sprintf(
		"SELECT DISTINCT `user` FROM %s_assoc_table WHERE deleted = 0 AND acct = ? AND `partition` = ? AND `user` != '' AND max_submit_jobs = 0 AND (max_jobs IS NULL OR max_jobs != 0)",
		config.SlurmValue.MySQLConfig.ClusterName,
	)
	rows, err := client.SlurmDB.Query(query, account, partition)
	if err != nil {
		return nil, fmt.Errorf("sql query failed: %v", err)
	}
	defer rows.Close()
	var users []string
	for rows.Next() {
		var userName string
		if err := rows.Scan(&userName); err != nil {
			return nil, fmt.Errorf("row scan failed: %v", err)
		}
		users = append(users, userName)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("sql rows failed: %v", err)
	}
	return users, nil
}

// GetUsersAndMaxSubmitJobsInAccountPartition 查询指定账户+分区下尚未被封锁的用户及其 max_submit_jobs 原始值。
// 只返回 max_submit_jobs IS NULL 或 != 0 的用户，已封锁（= 0）的用户跳过，
// 避免重复封锁时用 0 覆盖 acct_permission_persistence 表中已保存的真实原始值。
// Slurm assoc_table 中 max_submit_jobs 为 NULL 表示无限制，此函数统一映射为 -1 返回。
func GetUsersAndMaxSubmitJobsInAccountPartition(account, partition string) (map[string]int32, error) {
	query := fmt.Sprintf(
		"SELECT `user`, max_submit_jobs FROM %s_assoc_table WHERE deleted = 0 AND acct = ? AND `partition` = ? AND `user` != '' AND (max_submit_jobs IS NULL OR max_submit_jobs != 0)",
		config.SlurmValue.MySQLConfig.ClusterName,
	)

	rows, err := client.SlurmDB.Query(query, account, partition)
	if err != nil {
		logrus.Errorf("GetUsersAndMaxSubmitJobsInAccountPartition sql query failed, error: %v", err)
		return nil, fmt.Errorf("sql query failed")
	}
	defer rows.Close()

	result := make(map[string]int32)
	for rows.Next() {
		var userName string
		var maxSubmitJobs sql.NullInt64
		if err := rows.Scan(&userName, &maxSubmitJobs); err != nil {
			return nil, fmt.Errorf("row scan failed: %v", err)
		}
		if !maxSubmitJobs.Valid {
			result[userName] = -1 // NULL 表示无限制
		} else {
			result[userName] = int32(maxSubmitJobs.Int64)
		}
	}
	if err := rows.Err(); err != nil {
		logrus.Errorf("GetUsersAndMaxSubmitJobsInAccountPartition rows error: %v", err)
		return nil, fmt.Errorf("sql rows failed")
	}
	return result, nil
}

// SelectUserDeleted 查询用户是否已删除。
// 返回 (true, nil) 表示用户已删除或者不存在；(false, nil) 表示用户存在但未删除；
func SelectUserDeleted(user string) (bool, error) {
	var deleted int
	userSqlConfig := "SELECT deleted FROM user_table WHERE name = ?"
	err := client.SlurmDB.QueryRow(userSqlConfig, user).Scan(&deleted)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			logrus.Tracef("[SelectUserDeleted] user %s not found", user)
			return true, nil
		}
		return false, fmt.Errorf("sql query failed, sql: %s, err: %w", userSqlConfig, err)
	}
	logrus.Tracef("[SelectUserDeleted] user: %s, deleted: %d", user, deleted)
	return deleted == 1, nil
}
