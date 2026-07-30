package utils

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/sirupsen/logrus"

	"scow-adapters/pkg/slurm/client"
	"scow-adapters/pkg/slurm/config"
)

type AssociateInfo struct {
	// Blocked 表示该用户全部有效 association 的 MaxJobs、MaxSubmitJobs 都为 0。
	Blocked bool
	// HasBlockLimit 表示至少一个 association 的任一 Max* 字段为 0。
	// SCOW 要求解封时，该字段用于发现只修改成功一半的异常状态并继续修复。
	HasBlockLimit bool
}

// IsUserBlockedInAccount 查询账户下的指定用户当前是否处于封锁状态。
func IsUserBlockedInAccount(user, account string) bool {
	// 同一用户在一个账户下可能有多个分区 association。只有至少存在一条有效
	// association，并且每条 association 的 MaxJobs、MaxSubmitJobs 都为 0，才视为封锁。
	// IF 会把 NULL、-1 和其他非 0 值都转换为 0，因此它们不会被误判为封锁。
	var blocked int
	clusterName := config.SlurmValue.MySQLConfig.ClusterName
	query := fmt.Sprintf(
		`SELECT COALESCE(MIN(IF(%s, 1, 0)), 0)
		 FROM %s_assoc_table
		 WHERE user = ? AND acct = ? AND deleted = 0`,
		sqlUserBlockedCondition,
		clusterName,
	)
	err := client.SlurmDB.QueryRow(query, user, account).Scan(&blocked)
	if err != nil {
		return false
	}
	return blocked == 1
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
		blocked  int
	)

	// 创建嵌套 map 结构：map[账户]map[用户]封锁状态
	acctUsersStatus := make(map[string]map[string]bool)

	// 在数据库中按账户和用户聚合，避免把“用户数 x 分区数”的所有 association
	// 拉回 Go 内存。一个用户只有在所有有效 association 的 MaxJobs、MaxSubmitJobs
	// 都为 0 时才被封锁；NULL、-1 或其他非 0 值都会使聚合结果为未封锁。
	query := fmt.Sprintf(
		`SELECT a.acct, a.user, MIN(IF(%s, 1, 0)) AS blocked
		 FROM %s_assoc_table a
		 WHERE a.deleted = 0 AND a.user != ''
		 GROUP BY a.acct, a.user
		 ORDER BY a.acct, a.user`,
		sqlUserBlockedCondition,
		config.SlurmValue.MySQLConfig.ClusterName,
	)

	rows, err := client.SlurmDB.Query(query)
	if err != nil {
		return nil, fmt.Errorf("sql query failed: %v", err)
	}
	defer rows.Close()

	for rows.Next() {
		if err := rows.Scan(&acctName, &userName, &blocked); err != nil {
			return nil, fmt.Errorf("row scan failed: %v", err)
		}
		if _, ok := acctUsersStatus[acctName]; !ok {
			acctUsersStatus[acctName] = make(map[string]bool)
		}
		acctUsersStatus[acctName][userName] = blocked == 1
	}

	// 检查是否有扫描错误
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows error: %v", err)
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
	var userName string
	var blocked, hasBlockLimit int
	assocInfo := make(map[string]*AssociateInfo)

	// 在数据库中按用户聚合，查询结果大小只与用户数有关，不会把“用户数 x 分区数”
	// 的全部 association 拉回 Go。Blocked 用于判断是否已经完整封锁；HasBlockLimit
	// 用于发现 MaxJobs=0、MaxSubmitJobs=-1 这类只完成一半的异常状态。
	const userColumn = "`user`"
	const partitionColumn = "`partition`"
	acctSqlConfig := fmt.Sprintf(`
		SELECT %s,
			MIN(IF(%s, 1, 0)) AS blocked,
			MAX(IF(%s = 0 OR %s = 0, 1, 0)) AS has_block_limit
		FROM %s_assoc_table
		WHERE deleted = 0 AND %s != '' AND %s != '' AND acct = ?
		GROUP BY %s
	`, userColumn, sqlUserBlockedCondition, sqlUserJobsBlockColumn, sqlUserSubmitJobsBlockColumn,
		config.SlurmValue.MySQLConfig.ClusterName, userColumn, partitionColumn, userColumn)
	rows, err := client.SlurmDB.Query(acctSqlConfig, accountName)
	if err != nil {
		logrus.Errorf("sql query failed, error: %v", err)
		return nil, fmt.Errorf("sql query failed")
	}
	defer rows.Close()
	for rows.Next() {
		if err = rows.Scan(&userName, &blocked, &hasBlockLimit); err != nil {
			return nil, fmt.Errorf("scan account associate info failed: %w", err)
		}

		assocInfo[userName] = &AssociateInfo{
			Blocked:       blocked == 1,
			HasBlockLimit: hasBlockLimit == 1,
		}
	}
	err = rows.Err()
	if err != nil {
		logrus.Errorf("sql rows failed, error: %v", err)
		return nil, fmt.Errorf("sql query failed")
	}
	return assocInfo, nil
}

// AccountPartitionAssociationState 汇总账户在一个分区下的实际 Grp* 状态。
type AccountPartitionAssociationState struct {
	// HasAssociations 表示该分区下至少存在一个有效用户 association。
	HasAssociations bool
	// Blocked 表示该分区下全部用户 association 的 GrpJobs、GrpSubmitJobs 都为 0。
	Blocked bool
	// HasBlockLimit 表示至少一个用户 association 的任一 Grp* 字段为 0。
	HasBlockLimit bool
}

// GetAccountPartitionAssociationStates 一次查询账户全部分区的实际 Grp* 状态。
// 同步接口用它找出与 SCOW 期望状态不一致的分区，避免为每个分区单独查询数据库。
func GetAccountPartitionAssociationStates(account string) (map[string]AccountPartitionAssociationState, error) {
	const userColumn = "`user`"
	const partitionColumn = "`partition`"
	query := fmt.Sprintf(`
		SELECT %s,
			MIN(IF(%s, 1, 0)) AS blocked,
			MAX(IF(%s = 0 OR %s = 0, 1, 0)) AS has_block_limit
		FROM %s_assoc_table
		WHERE deleted = 0 AND acct = ? AND %s != '' AND %s != ''
		GROUP BY %s
	`, partitionColumn, sqlAccountPartitionBlockedCondition, sqlAccountJobsBlockColumn,
		sqlAccountSubmitJobsBlockColumn, config.SlurmValue.MySQLConfig.ClusterName,
		userColumn, partitionColumn, partitionColumn)

	rows, err := client.SlurmDB.Query(query, account)
	if err != nil {
		return nil, fmt.Errorf("query account partition association states failed: %w", err)
	}
	defer rows.Close()

	states := make(map[string]AccountPartitionAssociationState)
	for rows.Next() {
		var partition string
		var blocked, hasBlockLimit int
		if err := rows.Scan(&partition, &blocked, &hasBlockLimit); err != nil {
			return nil, fmt.Errorf("scan account partition association state failed: %w", err)
		}
		states[partition] = AccountPartitionAssociationState{
			HasAssociations: true, Blocked: blocked == 1, HasBlockLimit: hasBlockLimit == 1,
		}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate account partition association states failed: %w", err)
	}
	return states, nil
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
	// 整体账户封锁写在父 association 上，对所有分区生效，因此不存在允许分区。
	wholeBlocked, _, found, err := GetAccountGroupBlockState(accountName)
	if err != nil {
		return nil, err
	}
	if found && wholeBlocked {
		return nil, nil
	}
	return GetAccountAuthorizedPartitionsInDatabase(accountName)
}

// GetAccountAuthorizedPartitionsInDatabase 根据用户 association 的实际 Grp* 返回授权分区。
// 一个分区下全部有效用户 association 都是 GrpJobs=0、GrpSubmitJobs=0 时，该账户无权使用该分区；
// 只要存在一条未同时为 0 的 association，就视为有权限。父 association 的欠费限制不参与判断，
// 因此欠费账户仍能看到它原本有权使用的资源。
func GetAccountAuthorizedPartitionsInDatabase(accountName string) ([]string, error) {
	var partitionList []string
	const userColumn = "`user`"
	const partitionColumn = "`partition`"
	partitionSqlConfig := fmt.Sprintf(`
		SELECT %s
		FROM %s_assoc_table
		WHERE deleted = 0 AND acct = ? AND %s != '' AND %s != ''
		GROUP BY %s
		HAVING MIN(IF(%s, 1, 0)) = 0
	`, partitionColumn, config.SlurmValue.MySQLConfig.ClusterName, partitionColumn, userColumn,
		partitionColumn, sqlAccountPartitionBlockedCondition)

	rows, err := client.SlurmDB.Query(partitionSqlConfig, accountName)
	if err != nil {
		logrus.Errorf("sql query failed, error: %v", err)
		return nil, fmt.Errorf("sql query failed")
	}
	defer rows.Close()
	for rows.Next() {
		var partition string
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
	states, err := GetAccountPartitionAssociationStates(accountName)
	if err != nil {
		return nil, err
	}
	partitions := make([]string, 0, len(states))
	for partition, state := range states {
		if state.Blocked {
			partitions = append(partitions, partition)
		}
	}
	return partitions, nil
}

// AccountPartitionBlockInfo 保存账户关联分区及其封锁状态。
// HasPartition=true 表示 Slurm 中至少存在一条 Partition 非空的用户 association。
// AllowedPartitions 是至少存在一条未被 Grp* 双零封锁的用户 association 的分区。
// WholeAccountBlocked=true 表示账户父 association 的 GrpJobs、GrpSubmitJobs 均为 0。
// “所有分区均被封锁”不使用该字段表示，调用方通过 HasPartition=true 且 AllowedPartitions 为空判断。
type AccountPartitionBlockInfo struct {
	HasPartition        bool
	AllowedPartitions   []string
	WholeAccountBlocked bool
}

// GetAccountAllowedPartitionByAssociation 查询账户封锁状态及未封锁分区。
// 该函数用于账户管理接口，因此整体欠费封锁会让账户显示为已封锁。
func GetAccountAllowedPartitionByAssociation() (map[string]AccountPartitionBlockInfo, error) {
	return getAccountPartitionInfo(true)
}

// GetAccountAuthorizedPartitionByAssociation 查询所有账户有权查看的分区。
// 该函数用于 GetSummaryClusterInfo 等资源展示接口，只排除无权限分区；
// 即使账户欠费，也会返回它原本有权使用的分区。
func GetAccountAuthorizedPartitionByAssociation() (map[string]AccountPartitionBlockInfo, error) {
	return getAccountPartitionInfo(false)
}

// getAccountPartitionInfo 汇总每个账户的实际分区权限和整体欠费状态。
// 分区权限直接根据用户 association 的 GrpJobs、GrpSubmitJobs 聚合；整体欠费状态来自
// 账户父 association 的实际 GrpJobs、GrpSubmitJobs。
//
// includeWholeAccountBlock 决定是否把整体欠费状态合并到结果：
//   - true：供账户管理接口使用。欠费账户的 AllowedPartitions 为空，WholeAccountBlocked=true；
//   - false：供资源展示接口使用。忽略整体欠费状态，欠费账户仍返回它有权查看的分区。
//
// 例如 teamA/cpu 下至少一条用户 association 的 Grp* 未同时为 0，而 teamA/gpu 下全部为双零：
// 两种查询都会得到 AllowedPartitions=[cpu]，因为 gpu 是无权限分区。
// 如果 teamA 的父 association 还有整体欠费限制，则 true 查询返回 AllowedPartitions=[]、WholeAccountBlocked=true；
// false 查询仍返回 AllowedPartitions=[cpu]，使欠费用户可以查看已有权限的 cpu 分区资源。
func getAccountPartitionInfo(includeWholeAccountBlock bool) (map[string]AccountPartitionBlockInfo, error) {
	// 一次 SQL 按账户和分区聚合实际限制，结果大小只与账户分区数有关。
	const userColumn = "`user`"
	const partitionColumn = "`partition`"
	partitionSqlConfig := fmt.Sprintf(
		`SELECT acct, %s, MIN(IF(%s, 1, 0)) AS blocked
		 FROM %s_assoc_table
		 WHERE deleted = 0 AND %s != ''
		 GROUP BY acct, %s`,
		partitionColumn, sqlAccountPartitionBlockedCondition, config.SlurmValue.MySQLConfig.ClusterName,
		userColumn, partitionColumn,
	)

	rows, err := client.SlurmDB.Query(partitionSqlConfig)
	if err != nil {
		return nil, fmt.Errorf("sql query failed: %v", err)
	}
	defer rows.Close()

	accountPartitions := make(map[string]map[string]bool)

	for rows.Next() {
		var account, partition string
		var blocked int
		if err := rows.Scan(&account, &partition, &blocked); err != nil {
			return nil, fmt.Errorf("row scan failed: %v", err)
		}
		if _, exists := accountPartitions[account]; !exists {
			accountPartitions[account] = make(map[string]bool)
		}
		if partition != "" {
			accountPartitions[account][partition] = blocked == 1
		}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows error: %v", err)
	}

	wholeBlocked := make(map[string]struct{})
	if includeWholeAccountBlock {
		wholeBlockQuery := fmt.Sprintf(`
			SELECT acct
			FROM %s_assoc_table
			WHERE deleted = 0 AND %s = '' AND %s = '' AND %s
		`, config.SlurmValue.MySQLConfig.ClusterName, userColumn, partitionColumn,
			sqlAccountPartitionBlockedCondition)
		blockRows, err := client.SlurmDB.Query(wholeBlockQuery)
		if err != nil {
			return nil, fmt.Errorf("query whole account block records failed: %v", err)
		}
		defer blockRows.Close()
		for blockRows.Next() {
			var account string
			if err := blockRows.Scan(&account); err != nil {
				return nil, fmt.Errorf("scan whole account block record failed: %v", err)
			}
			wholeBlocked[account] = struct{}{}
		}
		if err := blockRows.Err(); err != nil {
			return nil, fmt.Errorf("iterate whole account block records failed: %v", err)
		}
	}

	// 整体欠费账户在管理接口中返回空的 AllowedPartitions；资源展示接口忽略父级欠费，
	// 仍根据叶子 association 返回账户原本有权查看的分区。
	// WholeAccountBlocked 只记录整体欠费状态；全部分区是否均被封锁由调用方检查 AllowedPartitions。
	accountBlockInfo := make(map[string]AccountPartitionBlockInfo, len(accountPartitions))
	for account, partitions := range accountPartitions {
		info := AccountPartitionBlockInfo{HasPartition: len(partitions) > 0}
		if _, blocked := wholeBlocked[account]; blocked {
			info.WholeAccountBlocked = true
			accountBlockInfo[account] = info
			continue
		}
		for partition, blocked := range partitions {
			if !blocked {
				info.AllowedPartitions = append(info.AllowedPartitions, partition)
			}
		}
		accountBlockInfo[account] = info
	}

	return accountBlockInfo, nil
}

// scanLimitPair 将 SlurmDB 的可空限制字段转换成统一的恢复值。
// NULL 表示该字段未设置限制，sacctmgr 使用 -1 清除限制，因此统一映射为 -1。
func scanLimitPair(jobs, submitJobs sql.NullInt64) associationLimitPair {
	result := associationLimitPair{Jobs: associationUnlimitedLimit, SubmitJobs: associationUnlimitedLimit}
	if jobs.Valid {
		result.Jobs = int32(jobs.Int64)
	}
	if submitJobs.Valid {
		result.SubmitJobs = int32(submitJobs.Int64)
	}
	return result
}

// GetAccountGroupLimits 查询账户父 association 的 GrpJobs、GrpSubmitJobs 原值。
// User 和 Partition 都必须为空，确保整体封锁写在所有用户、分区共同的父节点上。
// bool 返回 false 表示账户父 association 不存在。
func GetAccountGroupLimits(account string) (associationLimitPair, bool, error) {
	query := fmt.Sprintf(
		"SELECT %s, %s FROM %s_assoc_table WHERE deleted = 0 AND acct = ? AND `user` = '' AND `partition` = '' LIMIT 1",
		sqlAccountJobsBlockColumn, sqlAccountSubmitJobsBlockColumn, config.SlurmValue.MySQLConfig.ClusterName,
	)
	var jobs, submitJobs sql.NullInt64
	if err := client.SlurmDB.QueryRow(query, account).Scan(&jobs, &submitJobs); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return associationLimitPair{}, false, nil
		}
		return associationLimitPair{}, false, fmt.Errorf("query account group limits failed: %w", err)
	}
	return scanLimitPair(jobs, submitJobs), true, nil
}

// GetAccountGroupBlockState 查询账户父 association 当前是否包含 SCOW 的 Grp* 封锁值。
// blocked=true 表示两个字段都为 0；hasBlockLimit=true 表示至少一个字段为 0，
// 可用于发现命令只修改成功一个字段的异常状态。
func GetAccountGroupBlockState(account string) (blocked, hasBlockLimit, found bool, err error) {
	limits, found, err := GetAccountGroupLimits(account)
	if err != nil || !found {
		return false, false, found, err
	}
	blocked = limits.Jobs == associationBlockedLimit && limits.SubmitJobs == associationBlockedLimit
	hasBlockLimit = limits.Jobs == associationBlockedLimit || limits.SubmitJobs == associationBlockedLimit
	return blocked, hasBlockLimit, true, nil
}

// GetUsersGroupLimits 查询账户指定分区下每个用户 association 当前的 GrpJobs、GrpSubmitJobs。
// 封锁前按用户保存这些值，解封时再把每个用户 association 恢复为各自保存的值。
func GetUsersGroupLimits(account, partition string) (map[string]associationLimitPair, error) {
	query := fmt.Sprintf(
		"SELECT `user`, %s, %s FROM %s_assoc_table WHERE deleted = 0 AND acct = ? AND `partition` = ? AND `user` != ''",
		sqlAccountJobsBlockColumn, sqlAccountSubmitJobsBlockColumn, config.SlurmValue.MySQLConfig.ClusterName,
	)
	rows, err := client.SlurmDB.Query(query, account, partition)
	if err != nil {
		return nil, fmt.Errorf("query users group limits failed: %w", err)
	}
	defer rows.Close()

	result := make(map[string]associationLimitPair)
	for rows.Next() {
		var user string
		var jobs, submitJobs sql.NullInt64
		if err := rows.Scan(&user, &jobs, &submitJobs); err != nil {
			return nil, fmt.Errorf("scan users group limits failed: %w", err)
		}
		result[user] = scanLimitPair(jobs, submitJobs)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate users group limits failed: %w", err)
	}
	return result, nil
}

// GetUserMaxLimits 查询用户在账户下各分区 association 的 Max* 原值。
// 返回值以 partition 为键，因为不同分区可能配置不同的管理员限制。
func GetUserMaxLimits(user, account string) (map[string]associationLimitPair, error) {
	query := fmt.Sprintf(
		"SELECT `partition`, %s, %s FROM %s_assoc_table WHERE deleted = 0 AND `user` = ? AND acct = ?",
		sqlUserJobsBlockColumn, sqlUserSubmitJobsBlockColumn, config.SlurmValue.MySQLConfig.ClusterName,
	)
	rows, err := client.SlurmDB.Query(query, user, account)
	if err != nil {
		return nil, fmt.Errorf("query user max limits failed: %w", err)
	}
	defer rows.Close()

	result := make(map[string]associationLimitPair)
	for rows.Next() {
		var partition string
		var jobs, submitJobs sql.NullInt64
		if err := rows.Scan(&partition, &jobs, &submitJobs); err != nil {
			return nil, fmt.Errorf("scan user max limits failed: %w", err)
		}
		result[partition] = scanLimitPair(jobs, submitJobs)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate user max limits failed: %w", err)
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
