package utils

import (
	"bufio"
	"bytes"
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

// AddUserToAccount 将用户加入账户中
func AddUserToAccount(user, account, baseQos string, partitions []string) error {
	defaultQos := config.SlurmValue.Slurm.DefaultQOS
	partition := strings.Join(partitions, ",")
	args := []string{"-i", "create", "user", fmt.Sprintf("name=%s", user), fmt.Sprintf("partition=%s", partition), fmt.Sprintf("account=%s", account)}
	exitCode, stdout, stderr, err := ExecuteCommand(client.SACCTMGR, args...)
	if err != nil {
		if exitCode == -1 {
			// 命令执行前就失败了
			return fmt.Errorf("system error: %v", err)
		} else {
			// 命令执行但失败了
			return fmt.Errorf("create user failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
		}
	}

	args = []string{"-i", "modify", "user", "where", fmt.Sprintf("name=%s", user), fmt.Sprintf("account=%s", account), "set", fmt.Sprintf("qos=%s", baseQos), fmt.Sprintf("DefaultQOS=%s", defaultQos)}
	exitCode, stdout, stderr, err = ExecuteCommand(client.SACCTMGR, args...)
	if err != nil {
		if exitCode == -1 {
			// 命令执行前就失败了
			return fmt.Errorf("system error: %v", err)
		} else {
			// 命令执行但失败了
			return fmt.Errorf("modify user failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
		}
	}

	return nil
}

func createUserAssociationsInAccountPartition(users []string, account, partition string) error {
	if len(users) == 0 {
		return nil
	}

	args := []string{"-i", "create", "user",
		fmt.Sprintf("name=%s", strings.Join(users, ",")),
		fmt.Sprintf("partition=%s", partition),
		fmt.Sprintf("account=%s", account),
		accountPartitionBlockLimitArg(true)}
	exitCode, stdout, stderr, err := ExecuteCommand(client.SACCTMGR, args...)
	if err != nil {
		if exitCode == -1 {
			return fmt.Errorf("system error: %v", err)
		}

		output := strings.TrimSpace(stdout + "\n" + stderr)
		if strings.Contains(output, "Nothing added") || strings.Contains(output, "Nothing modified") {
			return nil
		}

		return fmt.Errorf("create user association failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
	}

	return nil
}

// EnsureAccountUsersAssociationInPartition 确保账户下已有用户在指定分区中存在 association。
func EnsureAccountUsersAssociationInPartition(account, partition string) error {
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

	if err := createUserAssociationsInAccountPartition(missingUsers, account, partition); err != nil {
		return fmt.Errorf("create associations for users=%v account=%s partition=%s failed: %w", missingUsers, account, partition, err)
	}
	logrus.Infof("EnsureAccountUsersAssociationInPartition: created associations for users=%v account=%s partition=%s", missingUsers, account, partition)
	return nil
}

// DeleteUser 使用slurm命令删除用户
func DeleteUser(user string) error {
	args := []string{"-i", "delete", "user", fmt.Sprintf("name=%s", user)}
	exitCode, stdout, stderr, err := ExecuteCommand(client.SACCTMGR, args...)
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
func DeleteUserAccountAssociation(user, account string) error {
	args := []string{"-i", "delete", "user", fmt.Sprintf("name=%s", user), fmt.Sprintf("account=%s", account)}
	exitCode, stdout, stderr, err := ExecuteCommand(client.SACCTMGR, args...)
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
func DeleteUserWithAccount(user, account string, acctList []string) error {
	args := []string{"-i", "update", "user", "set", fmt.Sprintf("DefaultAccount=%s", acctList[0]), "where", fmt.Sprintf("user=%s", user)}
	exitCode, stdout, stderr, err := ExecuteCommand(client.SACCTMGR, args...)
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
	exitCode, stdout, stderr, err = ExecuteCommand(client.SACCTMGR, args...)
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
func CreateAccount(account string) error {
	args := []string{"-i", "create", "account", fmt.Sprintf("name=%s", account)}
	exitCode, stdout, stderr, err := ExecuteCommand(client.SACCTMGR, args...)
	if err != nil {
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
func DeleteAccount(account string) error {
	args := []string{"-i", "delete", "account", fmt.Sprintf("name=%s", account)}
	exitCode, stdout, stderr, err := ExecuteCommand(client.SACCTMGR, args...)
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

// BlockUserInAccount 封锁账户下的用户
func BlockUserInAccount(user, account string) error {
	args := []string{"-i", "-Q", "modify", "user", "where", fmt.Sprintf("name=%s", user), fmt.Sprintf("account=%s", account),
		"set", "MaxJobs=0"}
	exitCode, stdout, stderr, err := ExecuteCommand(client.SACCTMGR, args...)
	if err != nil {
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

// UnblockUserInAccount 解封账户下的用户
func UnblockUserInAccount(user, account string) error {
	args := []string{"-i", "-Q", "modify", "user", "where", fmt.Sprintf("name=%s", user), fmt.Sprintf("account=%s", account),
		"set", "MaxJobs=-1"}
	exitCode, stdout, stderr, err := ExecuteCommand(client.SACCTMGR, args...)
	if err != nil {
		if exitCode == -1 {
			// 命令执行前就失败了
			return fmt.Errorf("system error: %v", err)
		} else {
			// 命令执行但失败了
			return fmt.Errorf("unblock user failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
		}
	}

	if err := clearLegacyUserBlockFields(user, account); err != nil {
		logrus.Warnf("UnblockUserInAccount: clear legacy user block fields failed, ignored: user=%s account=%s err=%v", user, account, err)
	}

	return nil
}

func clearLegacyUserBlockFields(user, account string) error {
	partitions, err := GetLegacyUserBlockPartitions(user, account)
	if err != nil {
		return fmt.Errorf("get legacy user block partitions failed: %w", err)
	}
	if len(partitions) == 0 {
		return nil
	}

	args := []string{"-i", "-Q", "modify", "user", "where",
		fmt.Sprintf("name=%s", user),
		fmt.Sprintf("account=%s", account),
		fmt.Sprintf("partition=%s", strings.Join(partitions, ",")),
		"set", "GrpJobs=-1", "GrpSubmit=-1", "GrpSubmitJobs=-1"}
	exitCode, stdout, stderr, err := ExecuteCommand(client.SACCTMGR, args...)
	if err != nil {
		if exitCode == -1 {
			return fmt.Errorf("system error: %v", err)
		}
		if stdout == "Nothing modified" || stderr == "" {
			return nil
		}
		return fmt.Errorf("clear legacy user block fields failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
	}

	logrus.Infof("UnblockUserInAccount: cleared legacy user block fields for user=%s account=%s partitions=%v", user, account, partitions)
	return nil
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

// BlockUserAssociationInAccountPartitionByAccountState 仅封锁单个用户在指定账户+分区下的账户-分区关联。
// 只将该 association 的账户-分区提交限制设为 0，不修改用户维度封锁字段，
// 并在封锁成功后持久化该用户原始账户-分区提交限制，供后续账户/分区解封时精确恢复。
func BlockUserAssociationInAccountPartitionByAccountState(user, account, partition string) error {
	originalSubmitLimit, found, err := GetUserAccountPartitionSubmitLimit(user, account, partition)
	if err != nil {
		return fmt.Errorf("get user account-partition submit limit failed: %w", err)
	}
	if !found {
		return fmt.Errorf("user %s not found in account=%s partition=%s", user, account, partition)
	}
	if originalSubmitLimit == associationBlockedLimit {
		logrus.Infof("BlockUserAssociationInAccountPartitionByAccountState: user %s already blocked in account=%s partition=%s, skip", user, account, partition)
		return nil
	}

	args := []string{"-i", "-Q", "modify", "user", "where",
		fmt.Sprintf("name=%s", user),
		fmt.Sprintf("account=%s", account),
		fmt.Sprintf("partition=%s", partition),
		"set", accountPartitionBlockLimitArg(true)}
	exitCode, stdout, stderr, err := ExecuteCommand(client.SACCTMGR, args...)
	if err != nil {
		if exitCode == -1 {
			return fmt.Errorf("system error: %v", err)
		}
		if strings.TrimSpace(stdout) == "Nothing modified" {
			return nil
		}
		return fmt.Errorf("block user association failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
	}

	if err := upsertPermissionRecord(account, partition, user, originalSubmitLimit); err != nil {
		logrus.Warnf("BlockUserAssociationInAccountPartitionByAccountState: save original account-partition submit limit for user %s failed: %v", user, err)
	}
	return nil
}

// BlockAccountUseAssociation 封锁账户在指定分区下的所有用户（将账户-分区提交限制设为 0）。
// 先执行 sacctmgr 封锁命令，成功后再将原始账户-分区提交限制持久化到数据库，
// 确保 DB 记录仅在 Slurm 侧已实际封锁后写入，避免命令失败时原始值被覆盖。
func BlockAccountUseAssociation(account, partition string) error {
	// 1. 查询该账户+分区下所有用户的当前账户-分区封锁字段值
	userOriginalValues, err := GetUsersAndAccountPartitionSubmitLimits(account, partition)
	if err != nil {
		return fmt.Errorf("get users account-partition submit limits failed: %w", err)
	}
	if len(userOriginalValues) == 0 {
		logrus.Infof("BlockAccountUseAssociation: no users found for account=%s partition=%s, skip", account, partition)
		return nil
	}

	// 2. 先执行 sacctmgr 封锁，仅在命令成功后才持久化原始值
	args := []string{"-i", "-Q", "modify", "user", "where",
		fmt.Sprintf("account=%s", account), fmt.Sprintf("partition=%s", partition),
		"set", accountPartitionBlockLimitArg(true)}
	exitCode, stdout, stderr, err := ExecuteCommand(client.SACCTMGR, args...)
	if err != nil {
		if exitCode == -1 {
			return fmt.Errorf("system error: %v", err)
		}
		if strings.TrimSpace(stdout) == "Nothing modified" {
			return nil
		}
		return fmt.Errorf("modify user failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
	}

	// 3. 封锁成功后持久化原始值（upsert：重复封锁时更新记录）
	for user, originalVal := range userOriginalValues {
		if err := upsertPermissionRecord(account, partition, user, originalVal); err != nil {
			// DB 写入失败仅告警，不回滚已生效的封锁；解封时将回退到无限制。
			logrus.Warnf("BlockAccountUseAssociation: save original account-partition submit limit for user %s failed: %v", user, err)
		}
	}
	return nil
}

// UnblockAccountUseAssociation 解封账户在指定分区下的所有用户，
// 从持久化表中读取每个用户封锁前的账户-分区封锁字段原始值并还原。
// 相同原始值的用户合并为一次 sacctmgr 调用，减少命令执行次数。
// 若无持久化记录（如旧数据或异常情况），回退为统一设置为无限制。
func UnblockAccountUseAssociation(account, partition string) error {
	// 1. 读取持久化的原始值
	records, err := getPermissionRecords(account, partition)
	if err != nil {
		return fmt.Errorf("get permission records failed: %w", err)
	}

	if len(records) == 0 {
		// 无历史记录：回退到统一解封账户级限制。用户级封锁由用户封锁字段独立表达，不影响账户-分区封锁字段恢复。
		logrus.Warnf("UnblockAccountUseAssociation: no saved records for account=%s partition=%s, fallback to unlimited account-partition submit limit", account, partition)
		args := []string{"-i", "-Q", "modify", "user", "where",
			fmt.Sprintf("account=%s", account), fmt.Sprintf("partition=%s", partition),
			"set", accountPartitionBlockLimitArg(false)}
		exitCode, stdout, stderr, err := ExecuteCommand(client.SACCTMGR, args...)
		if err != nil {
			if exitCode == -1 {
				return fmt.Errorf("system error: %v", err)
			}
			if stdout == "Nothing modified" || stderr == "" {
				return nil
			}
			return fmt.Errorf("unblock account partition submit limit failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
		}
		return nil
	}

	// 2. 按相同 originalVal 分组，每组合并为一次 sacctmgr 批量调用。
	valueToUsers := make(map[int32][]string)
	for user, val := range records {
		valueToUsers[val] = append(valueToUsers[val], user)
	}
	for val, users := range valueToUsers {
		if err := setUsersAccountPartitionSubmitLimit(users, account, partition, val); err != nil {
			return fmt.Errorf("restore account-partition submit limit=%d for users %v failed: %w", val, users, err)
		}
	}

	// 3. 清理持久化记录（失败仅告警，不影响解封结果）
	if err := deletePermissionRecords(account, partition); err != nil {
		logrus.Warnf("UnblockAccountUseAssociation: delete permission records failed: %v", err)
	}
	return nil
}

// setUsersAccountPartitionSubmitLimit 将多个用户在同一账户+分区关联中的账户-分区封锁字段批量设为给定值，
// 使用 name=u1,u2,u3 语法合并为单次 sacctmgr 调用，避免用户数多时的串行开销。
func setUsersAccountPartitionSubmitLimit(users []string, account, partition string, limit int32) error {
	args := []string{"-i", "-Q", "modify", "user", "where",
		fmt.Sprintf("name=%s", strings.Join(users, ",")),
		fmt.Sprintf("account=%s", account),
		fmt.Sprintf("partition=%s", partition),
		"set", accountPartitionSubmitLimitArg(limit)}
	exitCode, stdout, stderr, err := ExecuteCommand(client.SACCTMGR, args...)
	if err != nil {
		if exitCode == -1 {
			return fmt.Errorf("system error: %v", err)
		}
		if strings.TrimSpace(stdout) == "Nothing modified" {
			return nil
		}
		return fmt.Errorf("set account-partition submit limit failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
	}
	return nil
}
