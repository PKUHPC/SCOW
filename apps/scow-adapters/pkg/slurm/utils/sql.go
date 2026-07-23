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
	UserBlockLimit int
}

// IsUserBlockedInAccount 查询用户在账户下是否被用户维度封锁。
func IsUserBlockedInAccount(user, account string) bool {
	var exists int
	clusterName := config.SlurmValue.MySQLConfig.ClusterName
	maxJobsSqlConfig := fmt.Sprintf("SELECT EXISTS(SELECT 1 FROM %s_assoc_table WHERE user = ? AND acct = ? AND deleted = 0 AND %s)", clusterName, sqlUserBlockedCondition)
	err := client.SlurmDB.QueryRow(maxJobsSqlConfig, user, account).Scan(&exists)
	if err != nil {
		return false
	}
	return exists == 1
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

// GetNotCompletedJobsByUserNameAndAccount 获取用户未结束的作业列表。
// 不依赖系统/LDAP uid，适用于用户已从 LDAP 删除但 Slurm accounting 中仍有用户关联的场景。
func GetNotCompletedJobsByUserNameAndAccount(user, account string) ([]string, error) {
	var (
		jobName string
		jobList []string
	)
	clusterName := config.SlurmValue.MySQLConfig.ClusterName
	jobSqlConfig := fmt.Sprintf(
		"SELECT j.job_name FROM %s_job_table j JOIN %s_assoc_table a ON j.id_assoc = a.id_assoc WHERE a.user = ? AND a.acct = ? AND j.state IN (0, 1, 2)",
		clusterName,
		clusterName,
	)
	jobRows, err := client.SlurmDB.Query(jobSqlConfig, user, account)
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
		"SELECT acct, user, %s FROM %s_assoc_table WHERE deleted = 0 AND user != '' ORDER BY acct, user",
		sqlUserBlockColumn,
		config.SlurmValue.MySQLConfig.ClusterName,
	)

	rows, err := client.SlurmDB.Query(query)
	if err != nil {
		return nil, fmt.Errorf("sql query failed: %v", err)
	}
	defer rows.Close()

	// 临时存储每个用户的所有用户封锁字段值
	userBlockLimits := make(map[string]map[string][]sql.NullInt64)

	// 第一遍扫描：收集所有用户的所有用户封锁字段值
	for rows.Next() {
		if err := rows.Scan(&acctName, &userName, &maxJobs); err != nil {
			return nil, fmt.Errorf("row scan failed: %v", err)
		}

		if _, ok := userBlockLimits[acctName]; !ok {
			userBlockLimits[acctName] = make(map[string][]sql.NullInt64)
		}

		userBlockLimits[acctName][userName] = append(userBlockLimits[acctName][userName], maxJobs)
	}

	// 检查是否有扫描错误
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows error: %v", err)
	}

	// 第二遍处理：确定每个用户的最终封锁状态
	for acct, users := range userBlockLimits {
		if _, ok := acctUsersStatus[acct]; !ok {
			acctUsersStatus[acct] = make(map[string]bool)
		}

		for user, jobs := range users {
			// 默认设置为封锁状态（只有全部为0时才封锁）
			blocked := true

			// 检查该用户的所有用户封锁字段值
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

// GetAccountAssociatedUsersInPartition 从数据库中获取指定账户在指定分区下已存在关联的用户。
func GetAccountAssociatedUsersInPartition(accountName, partition string) ([]string, error) {
	var (
		userName string
		userList []string
	)

	acctSqlConfig := fmt.Sprintf(
		"SELECT DISTINCT `user` FROM %s_assoc_table WHERE deleted = 0 AND user != '' AND acct = ? AND `partition` = ?",
		config.SlurmValue.MySQLConfig.ClusterName,
	)

	rows, err := client.SlurmDB.Query(acctSqlConfig, accountName, partition)
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

	acctSqlConfig := fmt.Sprintf("SELECT DISTINCT `user`, %s FROM %s_assoc_table WHERE deleted = 0 AND user != '' AND `partition` != '' AND acct = ?", sqlUserBlockColumn, config.SlurmValue.MySQLConfig.ClusterName)
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
			UserBlockLimit: convertJobNums(maxJobs),
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

	userSqlConfig := fmt.Sprintf("SELECT DISTINCT `user` FROM %s_assoc_table WHERE deleted = 0 AND `partition`= ? AND acct = ? AND %s", config.SlurmValue.MySQLConfig.ClusterName, sqlAccountPartitionNotBlockedCondition)

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

	partitionSqlConfig := fmt.Sprintf("SELECT DISTINCT `partition` FROM %s_assoc_table WHERE deleted = 0 AND `partition` != '' AND `user` != '' AND acct = ? AND %s",
		config.SlurmValue.MySQLConfig.ClusterName, sqlAccountPartitionNotBlockedCondition)

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

	partitionSqlConfig := fmt.Sprintf("SELECT DISTINCT `partition` FROM %s_assoc_table WHERE deleted = 0 AND `partition` != '' AND `user` != '' AND acct = ? AND %s",
		config.SlurmValue.MySQLConfig.ClusterName, sqlAccountPartitionBlockedCondition)

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

// AccountPartitionBlockInfo 汇总账户的具体分区和无分区兜底状态。
type AccountPartitionBlockInfo struct {
	HasPartition      bool
	AllowedPartitions []string
	FallbackBlocked   bool
}

// GetAccountAllowedPartitionByAssociation 从数据库中获取账户的分区封锁信息。
// 具体分区存在时由 AllowedPartitions 判断状态；完全没有具体分区时才使用 FallbackBlocked。
func GetAccountAllowedPartitionByAssociation() (map[string]AccountPartitionBlockInfo, error) {
	var (
		account       string
		partition     string
		maxSubmitJobs sql.NullInt64
	)

	partitionSqlConfig := fmt.Sprintf(
		"SELECT acct, `partition`, %s FROM %s_assoc_table WHERE deleted = 0 AND `user` != ''",
		sqlAccountPartitionBlockColumn,
		config.SlurmValue.MySQLConfig.ClusterName,
	)

	rows, err := client.SlurmDB.Query(partitionSqlConfig)
	if err != nil {
		return nil, fmt.Errorf("sql query failed: %v", err)
	}
	defer rows.Close()

	accountBlockInfo := make(map[string]AccountPartitionBlockInfo)
	allowedPartitionSets := make(map[string]map[string]struct{})

	for rows.Next() {
		if err := rows.Scan(&account, &partition, &maxSubmitJobs); err != nil {
			return nil, fmt.Errorf("row scan failed: %v", err)
		}

		info, exists := accountBlockInfo[account]
		if !exists {
			// 没有可用的基础 association 时保守视为封锁；遇到任一非零或 NULL 值后解除兜底封锁。
			info.FallbackBlocked = true
		}

		if partition == "" {
			if !maxSubmitJobs.Valid || maxSubmitJobs.Int64 != int64(associationBlockedLimit) {
				info.FallbackBlocked = false
			}
		} else {
			info.HasPartition = true
			if !maxSubmitJobs.Valid || maxSubmitJobs.Int64 != int64(associationBlockedLimit) {
				if _, exists := allowedPartitionSets[account]; !exists {
					allowedPartitionSets[account] = make(map[string]struct{})
				}
				if _, exists := allowedPartitionSets[account][partition]; !exists {
					allowedPartitionSets[account][partition] = struct{}{}
					info.AllowedPartitions = append(info.AllowedPartitions, partition)
				}
			}
		}

		accountBlockInfo[account] = info
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows error: %v", err)
	}

	return accountBlockInfo, nil
}

// GetLegacyUserBlockPartitions 查询旧版用户封锁留下的分区。
func GetLegacyUserBlockPartitions(user, account string) ([]string, error) {
	query := fmt.Sprintf(
		"SELECT DISTINCT `partition` FROM %s_assoc_table WHERE deleted = 0 AND `user` = ? AND acct = ? AND `partition` != '' AND %s",
		config.SlurmValue.MySQLConfig.ClusterName, sqlLegacyUserBlockCompatibilityCriteria,
	)
	rows, err := client.SlurmDB.Query(query, user, account)
	if err != nil {
		return nil, fmt.Errorf("sql query failed: %v", err)
	}
	defer rows.Close()
	var partitions []string
	for rows.Next() {
		var partition string
		if err := rows.Scan(&partition); err != nil {
			return nil, fmt.Errorf("row scan failed: %v", err)
		}
		partitions = append(partitions, partition)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("sql rows failed: %v", err)
	}
	return partitions, nil
}

// GetUsersAndAccountPartitionSubmitLimits 查询指定账户+分区下尚未被账户分区封锁的用户及其原始限制值。
// 只返回账户-分区封锁字段为 NULL 或非 0 的用户，已封锁（= 0）的用户跳过，
// 避免重复封锁时用 0 覆盖 acct_permission_persistence 表中已保存的真实原始值。
// Slurm assoc_table 中账户-分区封锁字段为 NULL 表示无限制，此函数统一映射为 -1 返回。
func GetUsersAndAccountPartitionSubmitLimits(account, partition string) (map[string]int32, error) {
	query := fmt.Sprintf(
		"SELECT `user`, %s FROM %s_assoc_table WHERE deleted = 0 AND acct = ? AND `partition` = ? AND `user` != '' AND %s",
		sqlAccountPartitionBlockColumn, config.SlurmValue.MySQLConfig.ClusterName, sqlAccountPartitionNotBlockedCondition,
	)

	rows, err := client.SlurmDB.Query(query, account, partition)
	if err != nil {
		logrus.Errorf("GetUsersAndAccountPartitionSubmitLimits sql query failed, error: %v", err)
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
			result[userName] = associationUnlimitedLimit // NULL 表示无限制
		} else {
			result[userName] = int32(maxSubmitJobs.Int64)
		}
	}
	if err := rows.Err(); err != nil {
		logrus.Errorf("GetUsersAndAccountPartitionSubmitLimits rows error: %v", err)
		return nil, fmt.Errorf("sql rows failed")
	}
	return result, nil
}

// GetUserAccountPartitionSubmitLimit 查询单个用户在指定账户+分区关联中的账户-分区提交限制。
// 返回值含义：
//   - int32: 该 association 当前的账户-分区提交限制；当数据库字段为 NULL 时，统一映射为 -1 表示无限制。
//   - bool: 该 association 是否存在；
//   - error: 查询过程是否出错；
func GetUserAccountPartitionSubmitLimit(user, account, partition string) (int32, bool, error) {
	query := fmt.Sprintf(
		"SELECT %s FROM %s_assoc_table WHERE deleted = 0 AND `user` = ? AND acct = ? AND `partition` = ? LIMIT 1",
		sqlAccountPartitionBlockColumn, config.SlurmValue.MySQLConfig.ClusterName,
	)

	var submitLimit sql.NullInt64
	if err := client.SlurmDB.QueryRow(query, user, account, partition).Scan(&submitLimit); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, false, nil
		}
		return 0, false, fmt.Errorf("sql query failed: %v", err)
	}
	if !submitLimit.Valid {
		return associationUnlimitedLimit, true, nil
	}
	return int32(submitLimit.Int64), true, nil
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
