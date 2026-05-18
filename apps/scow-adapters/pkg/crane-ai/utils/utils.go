package utils

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"reflect"
	"runtime"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
	craneProtos "scow-adapters/gen/crane-ai"
	protos "scow-adapters/gen/go"
	"scow-adapters/pkg/crane-ai/client"
)

type ClusterNodesInfo struct {
	NodeCount             uint32
	RunningNodeCount      uint32
	IdleNodeCount         uint32
	NotAvailableNodeCount uint32
	CpuCoreCount          uint32
	RunningCpuCount       uint32
	IdleCpuCount          uint32
	NotAvailableCpuCount  uint32
	GpuCoreCount          uint32
	RunningGpuCount       uint32
	IdleGpuCount          uint32
	NotAvailableGpuCount  uint32
	JobCount              uint32
	RunningJobCount       uint32
	PendingJobCount       uint32
	NodeUsage             float32
	CpuUsage              float32
	GpuUsage              float32
}

// MountModel 挂载点路径及模式，如公共数据集或者私有数据集
type MountModel struct {
	Path     string `json:"path"`
	IsPublic bool   `json:"isPublic"`
}

// GetUidByUserName 通过os/user包去获取用户的uid
func GetUidByUserName(userName string) (int, error) {
	u, err := user.Lookup(userName)
	if err != nil {
		return 0, fmt.Errorf("Failed to lookup user: %s\n", err)
	}
	uid, _ := strconv.Atoi(u.Uid)
	return uid, nil
}

// GetQos 获取系统中Qos列表
func GetQos() ([]string, error) {
	var qosList []string
	request := &craneProtos.QueryQosInfoRequest{
		Uid: uint32(os.Getuid()),
	}
	response, err := client.CraneCtld.QueryQosInfo(context.Background(), request)
	if err != nil {
		return []string{}, err
	}
	Qos := response.GetQosList()
	for _, value := range Qos {
		qosList = append(qosList, value.GetName())
	}
	return qosList, nil
}

func GetAllQos() ([]string, error) {
	qosList, err := GetQos()
	if err != nil {
		return []string{}, err
	}
	qosListValue := RemoveValue(qosList, "UNLIMITED")
	if len(qosListValue) == 0 {
		return nil, fmt.Errorf("qos is nil")
	}

	return qosListValue, nil
}

func GetAllAccount() ([]*craneProtos.AccountInfo, error) {
	request := &craneProtos.QueryAccountInfoRequest{
		Uid: 0,
	}
	response, err := client.CraneCtld.QueryAccountInfo(context.Background(), request)
	if err != nil {
		return nil, err
	}
	if !response.GetOk() {
		return nil, fmt.Errorf("failed get accounts: %v", response.GetRichErrorList()[0].GetDescription())
	}
	return response.GetAccountList(), nil
}

// CheckAccount 检查账户名是否非法
func CheckAccount(name string) error {
	if len(name) > 30 {
		return fmt.Errorf("name is too long (up to 30)")
	}
	return nil
}

func GetAccountByName(accountName string) (*craneProtos.AccountInfo, error) {
	request := &craneProtos.QueryAccountInfoRequest{
		Uid:         0,
		AccountList: []string{accountName},
	}
	response, err := client.CraneCtld.QueryAccountInfo(context.Background(), request)
	if err != nil {
		return nil, err
	}
	if !response.GetOk() {
		return nil, fmt.Errorf("failed get account %v, error: %v", accountName, response.RichErrorList[0].GetDescription())
	}
	return response.GetAccountList()[0], nil
}

func GetUserByName(userName string) (*craneProtos.UserInfo, error) {
	request := &craneProtos.QueryUserInfoRequest{
		Uid:      0,
		UserList: []string{userName},
	}
	response, err := client.CraneCtld.QueryUserInfo(context.Background(), request)
	if err != nil {
		return nil, err
	}
	if !response.GetOk() {
		return nil, fmt.Errorf("failed get user %v, error: %v", userName, response.GetRichErrorList()[0].GetDescription())
	}

	return response.GetUserList()[0], nil
}

func GetAccountByUser(userName string) ([]string, error) {
	var accountList []string
	request := &craneProtos.QueryUserInfoRequest{
		Uid:      0,
		UserList: []string{userName},
	}
	response, err := client.CraneCtld.QueryUserInfo(context.Background(), request)
	if err != nil {
		return nil, err
	}
	if !response.GetOk() {
		return nil, fmt.Errorf("failed get account by user %v, error: %v", userName, response.GetRichErrorList()[0].GetDescription())
	}

	for _, list := range response.GetUserList() {
		if strings.Contains(list.Account, "*") {
			account := list.Account[:len(list.Account)-1]
			accountList = append(accountList, account)
		} else {
			accountList = append(accountList, list.Account)
		}
	}
	return accountList, nil
}

func GetAllUser() ([]*craneProtos.UserInfo, error) {
	request := &craneProtos.QueryUserInfoRequest{
		Uid: 0,
	}
	response, err := client.CraneCtld.QueryUserInfo(context.Background(), request)
	if err != nil {
		return nil, err
	}
	if !response.GetOk() {
		return nil, fmt.Errorf("get all user error: %v", response.GetRichErrorList()[0].GetDescription())
	}
	return response.GetUserList(), nil
}

// GetAllAccountUserInfoMap 获取账户下每个用户的信息
func GetAllAccountUserInfoMap(allAccounts []*craneProtos.AccountInfo) (map[*craneProtos.AccountInfo][]*craneProtos.UserInfo, error) {
	accountUserInfo := make(map[*craneProtos.AccountInfo][]*craneProtos.UserInfo)

	for _, account := range allAccounts {
		request := &craneProtos.QueryUserInfoRequest{
			Uid:     0,
			Account: account.Name,
		}
		response, err := client.CraneCtld.QueryUserInfo(context.Background(), request)
		if err != nil {
			return nil, err
		}
		if !response.GetOk() {
			var message string
			for _, richError := range response.GetRichErrorList() {
				message += richError.GetDescription() + "\n"
			}
			return nil, fmt.Errorf("failed get account user info: %v", message)
		}

		for _, info := range response.GetUserList() {
			if _, ok := accountUserInfo[account]; !ok {
				accountUserInfo[account] = []*craneProtos.UserInfo{}
			}
			accountUserInfo[account] = append(accountUserInfo[account], info)
		}
	}

	return accountUserInfo, nil
}

func GetAllAccountUserInfoConcurrently(allAccounts []*craneProtos.AccountInfo) (map[*craneProtos.AccountInfo][]*craneProtos.UserInfo, error) {
	var (
		wg              sync.WaitGroup
		mu              sync.Mutex
		accountUserInfo = make(map[*craneProtos.AccountInfo][]*craneProtos.UserInfo)
		errChan         = make(chan error, 1)
	)

	// 动态计算并发数：CPU核心数 * 2（I/O密集型任务的常用倍数）
	poolSize := runtime.NumCPU() * 2
	if poolSize < 10 {
		poolSize = 10
	}

	// 如果账户数量较少，使用更小的并发数
	if len(allAccounts) < poolSize {
		poolSize = len(allAccounts)
	}

	// 限制最大并发数，避免资源耗尽
	if poolSize > 50 {
		poolSize = 50
	}
	accountChan := make(chan *craneProtos.AccountInfo, len(allAccounts))

	// 启动worker协程
	for i := 0; i < poolSize; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for account := range accountChan {
				// 查询用户信息
				request := &craneProtos.QueryUserInfoRequest{
					Uid:     0,
					Account: account.Name,
				}
				response, err := client.CraneCtld.QueryUserInfo(context.Background(), request)
				if err != nil {
					select {
					case errChan <- fmt.Errorf("account %s query error: %v", account.Name, err):
					default:
					}
					return
				}

				if !response.GetOk() {
					var message string
					for _, richError := range response.GetRichErrorList() {
						message += richError.GetDescription() + "\n"
					}
					select {
					case errChan <- fmt.Errorf("account %s query failed: %v", account.Name, message):
					default:
					}
					return
				}

				// 加锁更新结果
				mu.Lock()
				if _, ok := accountUserInfo[account]; !ok {
					accountUserInfo[account] = []*craneProtos.UserInfo{}
				}
				accountUserInfo[account] = append(accountUserInfo[account], response.GetUserList()...)
				mu.Unlock()
			}
		}()
	}

	// 发送任务到channel
	for _, account := range allAccounts {
		accountChan <- account
	}
	close(accountChan)

	// 等待所有worker完成
	wg.Wait()

	// 检查是否有错误
	select {
	case err := <-errChan:
		return nil, err
	default:
		return accountUserInfo, nil
	}
}

func GetPartitionByName(partitionName string) (*craneProtos.PartitionInfo, error) {
	request := &craneProtos.QueryPartitionInfoRequest{
		PartitionName: partitionName,
	}
	response, err := client.CraneCtld.QueryPartitionInfo(context.Background(), request)
	if err != nil {
		return nil, err
	}

	return response.GetPartitionInfoList()[0], nil
}

func GetTaskByPartitionAndStatus(partitionList []string, statusList []craneProtos.TaskStatus) ([]*craneProtos.TaskInfo, error) {
	req := craneProtos.QueryTasksInfoRequest{
		FilterPartitions:            partitionList,
		FilterStates:                statusList,
		OptionIncludeCompletedTasks: false,
	}

	response, err := client.CraneCtld.QueryTasksInfo(context.Background(), &req)
	if err != nil {
		return nil, err
	}
	if !response.GetOk() {
		return nil, fmt.Errorf("the partitions %v not have task", partitionList)
	}

	return response.GetTaskInfoList(), nil
}

func GetTaskByAccountName(accountNames []string) ([]*craneProtos.TaskInfo, error) {
	req := craneProtos.QueryTasksInfoRequest{
		OptionIncludeCompletedTasks: true,
		FilterAccounts:              accountNames,
		NumLimit:                    99999999,
	}

	response, err := client.CraneCtld.QueryTasksInfo(context.Background(), &req)
	if err != nil {
		return nil, err
	}

	if !response.GetOk() {
		return nil, fmt.Errorf("the account %v not have task", accountNames)
	}

	return response.GetTaskInfoList(), nil
}

func GetNodeByPartitionAndStatus(partitionList []string, cranedStateList []craneProtos.CranedResourceState) (uint32, error) {
	var nodeCount uint32
	controlStateList := []craneProtos.CranedControlState{craneProtos.CranedControlState_CRANE_NONE, craneProtos.CranedControlState_CRANE_DRAIN}
	req := craneProtos.QueryClusterInfoRequest{
		FilterPartitions:           partitionList,
		FilterCranedResourceStates: cranedStateList,
		FilterCranedControlStates:  controlStateList,
	}

	response, err := client.CraneCtld.QueryClusterInfo(context.Background(), &req)
	if err != nil {
		return 0, err
	}

	for _, partitionCraned := range response.Partitions {
		for _, commonCranedStateList := range partitionCraned.CranedLists {
			nodeCount += commonCranedStateList.Count
		}
	}
	return nodeCount, nil
}

func GetNodeByPartition(partitionList []string) (uint32, uint32, uint32, uint32, error) {
	var idleNodeCount, allocNodeCount, mixNodeCount, downNodeCount uint32

	resourceStateList := []craneProtos.CranedResourceState{
		craneProtos.CranedResourceState_CRANE_IDLE,
		craneProtos.CranedResourceState_CRANE_MIX,
		craneProtos.CranedResourceState_CRANE_ALLOC,
		craneProtos.CranedResourceState_CRANE_DOWN,
	}

	controlStateList := []craneProtos.CranedControlState{
		craneProtos.CranedControlState_CRANE_NONE,
		craneProtos.CranedControlState_CRANE_DRAIN,
	}

	powerStateList := []craneProtos.CranedPowerState{
		craneProtos.CranedPowerState_CRANE_POWER_ACTIVE,
		craneProtos.CranedPowerState_CRANE_POWER_IDLE,
		craneProtos.CranedPowerState_CRANE_POWER_SLEEPING,
		craneProtos.CranedPowerState_CRANE_POWER_POWEREDOFF,
		craneProtos.CranedPowerState_CRANE_POWER_TO_SLEEPING,
		craneProtos.CranedPowerState_CRANE_POWER_WAKING_UP,
		craneProtos.CranedPowerState_CRANE_POWER_POWERING_ON,
		craneProtos.CranedPowerState_CRANE_POWER_POWERING_OFF,
	}

	req := craneProtos.QueryClusterInfoRequest{
		FilterPartitions:           partitionList,
		FilterCranedResourceStates: resourceStateList,
		FilterCranedControlStates:  controlStateList,
		FilterCranedPowerStates:    powerStateList,
	}

	response, err := client.CraneCtld.QueryClusterInfo(context.Background(), &req)
	if err != nil {
		return idleNodeCount, allocNodeCount, mixNodeCount, downNodeCount, err
	}

	if !response.GetOk() {
		return idleNodeCount, allocNodeCount, mixNodeCount, downNodeCount, fmt.Errorf("get cluster info failed")
	}

	logrus.Tracef("GetNodeByPartition: cluster info: %v", response)
	logrus.Tracef("GetNodeByPartition: cluster info: %v", response.Partitions)
	logrus.Tracef("GetNodeByPartition: cluster info: %v", response.Partitions[0].GetCranedLists())
	for _, partition := range response.Partitions {
		for _, commonCranedStateList := range partition.CranedLists {
			if commonCranedStateList.Count > 0 {
				switch commonCranedStateList.ResourceState {
				case craneProtos.CranedResourceState_CRANE_IDLE:
					idleNodeCount += commonCranedStateList.Count
				case craneProtos.CranedResourceState_CRANE_ALLOC:
					allocNodeCount += commonCranedStateList.Count
				case craneProtos.CranedResourceState_CRANE_MIX:
					mixNodeCount += commonCranedStateList.Count
				case craneProtos.CranedResourceState_CRANE_DOWN:
					downNodeCount += commonCranedStateList.Count
				}
			}
		}
	}

	return idleNodeCount, allocNodeCount, mixNodeCount, downNodeCount, nil
}

func GetCraneStatesList(stateList []string) []craneProtos.TaskStatus {
	var statesList []craneProtos.TaskStatus
	for _, value := range stateList {
		if value == "PENDING" || value == "PENDDING" {
			statesList = append(statesList, craneProtos.TaskStatus_Pending)
		} else if value == "RUNNING" {
			statesList = append(statesList, craneProtos.TaskStatus_Running)
		} else if value == "CANCELED" {
			statesList = append(statesList, craneProtos.TaskStatus_Cancelled)
		} else if value == "COMPLETED" {
			statesList = append(statesList, craneProtos.TaskStatus_Completed)
		} else if value == "FAILED" || value == "NODE_FAIL" {
			statesList = append(statesList, craneProtos.TaskStatus_Failed)
		} else if value == "TIMEOUT" {
			statesList = append(statesList, craneProtos.TaskStatus_ExceedTimeLimit)
		} else {
			statesList = append(statesList, craneProtos.TaskStatus_Invalid)
		}
	}
	return statesList
}

func RemoveValue[T comparable](list []T, value T) []T {
	var result []T
	for _, item := range list {
		if item != value {
			result = append(result, item)
		}
	}
	return result
}

func sortByKey(list []*protos.JobInfo, fieldName string, sortOrder string) bool {
	if sortOrder == "ASC" {
		sort.Slice(list, func(i, j int) bool {
			fieldValueI := reflect.ValueOf(list[i]).Elem().FieldByName(fieldName)
			fieldValueJ := reflect.ValueOf(list[j]).Elem().FieldByName(fieldName)
			switch fieldValueI.Kind() {
			case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
				return fieldValueI.Int() < fieldValueJ.Int()
			case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
				return fieldValueI.Uint() > fieldValueJ.Uint()
			case reflect.Float32, reflect.Float64:
				return fieldValueI.Float() < fieldValueJ.Float()
			case reflect.String:
				return fieldValueI.String() < fieldValueJ.String()
			default:
				return false
			}
		})
	} else if sortOrder == "DESC" {
		sort.Slice(list, func(i, j int) bool {
			fieldValueI := reflect.ValueOf(list[i]).Elem().FieldByName(fieldName)
			fieldValueJ := reflect.ValueOf(list[j]).Elem().FieldByName(fieldName)
			switch fieldValueI.Kind() {
			case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
				return fieldValueI.Int() > fieldValueJ.Int()
			case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
				return fieldValueI.Uint() > fieldValueJ.Uint()
			case reflect.Float32, reflect.Float64:
				return fieldValueI.Float() > fieldValueJ.Float()
			case reflect.String:
				return fieldValueI.String() > fieldValueJ.String()
			default:
				return false
			}
		})
	}
	return true
}

func SortJobInfo(sortKey string, sortOrder string, jobInfo []*protos.JobInfo) []*protos.JobInfo {
	sortByKey(jobInfo, sortKey, sortOrder)
	return jobInfo
}

// LocalSubmitJob 本地提交cbatch作业函数
func LocalSubmitJob(scriptString string, username string) (string, error) {
	// 提交作业命令行
	cmdLine := fmt.Sprintf("su - %s -c 'cbatch %s'", username, scriptString)
	cmd := exec.Command("bash", "-c", cmdLine)

	// 创建一个 bytes.Buffer 用于捕获输出
	var output bytes.Buffer
	cmd.Stdout = &output
	cmd.Stderr = &output

	// 执行命令
	err := cmd.Run()
	if err != nil {
		return output.String(), err
	}

	return output.String(), nil
}

// LocalRunCommandOnNodes executes a command on specific nodes using crun
func LocalRunCommandOnNodes(nodeList string, command string, username string, timeout time.Duration) (string, string, error) {
	logrus.Debugf("LocalRunCommandOnNodes params: nodeList=%s, command=%s, username=%s, timeout=%v", nodeList, command, username, timeout)
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	// We need to escape single quotes in the command because they are inside the outer single quotes of su -c
	safeCommand := strings.ReplaceAll(command, "'", "'\\''")

	// Use -- to separate crun flags from the command to execute
	// This prevents crun from parsing flags in the command (like -o) as crun flags
	cmdLine := fmt.Sprintf("su - %s -c 'crun -w %s -- %s'", username, nodeList, safeCommand)
	logrus.Debugf("LocalRunCommandOnNodes executing command: %s", cmdLine)

	cmd := exec.CommandContext(ctx, "bash", "-c", cmdLine)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return stdout.String(), stderr.String(), fmt.Errorf("command timed out after %v", timeout)
		}
		return stdout.String(), stderr.String(), err
	}

	return strings.TrimSpace(stdout.String()), strings.TrimSpace(stderr.String()), nil
}

// RunCommand 简单执行shell命令函数
func RunCommand(command string) (string, error) {
	cmd := exec.Command("bash", "-c", command)

	// 创建一个 bytes.Buffer 用于捕获输出
	var output bytes.Buffer
	cmd.Stdout = &output
	cmd.Stderr = &output

	// 执行命令
	err := cmd.Run()

	if err != nil {
		return output.String(), err
	}

	return strings.TrimSpace(output.String()), nil
}

// GetCraneClusterConfig 获取partition的信息, whitelistPartition为空时获取所有分区信息，不为空则获取白名单内的分区信息
func GetCraneClusterConfig(whitelistPartition, qosList []string) ([]*protos.Partition, error) {
	var partitions []*protos.Partition

	for _, part := range client.CConfig.Partitions {
		if !Contains(whitelistPartition, part.Name) && whitelistPartition != nil {
			continue
		}
		partitionName := part.Name
		request := &craneProtos.QueryPartitionInfoRequest{
			PartitionName: partitionName,
		}
		response, err := client.CraneCtld.QueryPartitionInfo(context.Background(), request)
		if err != nil {
			return nil, err
		}
		partitionValue := response.GetPartitionInfoList()[0]
		totalGpusTypeMap := partitionValue.GetResTotal().GetDeviceMap()
		// device_map:{name_type_map:{key:"npu"  value:{type_count_map:{key:"910B3"  value:8}}}}
		gpuCount := GetGpuNumsFromPartition(totalGpusTypeMap)
		partitions = append(partitions, &protos.Partition{
			Name:  partitionValue.GetName(),
			MemMb: partitionValue.GetResTotal().GetAllocatableRes().GetMemoryLimitBytes() / (1024 * 1024),
			Cores: uint32(partitionValue.GetResTotal().GetAllocatableRes().GetCpuCoreLimit()),
			Gpus:  gpuCount,
			Nodes: partitionValue.GetAliveNodes(),
			Qos:   qosList,
		})
	}

	return partitions, nil
}

func GetPartitionDeviceType(partitionName string) (string, error) {
	var deviceType = ""
	request := &craneProtos.QueryPartitionInfoRequest{
		PartitionName: partitionName,
	}
	response, err := client.CraneCtld.QueryPartitionInfo(context.Background(), request)
	if err != nil {
		return "", err
	}
	partitionValue := response.GetPartitionInfoList()[0]
	deviceMap := partitionValue.GetResTotal().GetDeviceMap()

	for key, _ := range deviceMap.GetNameTypeMap() {
		deviceType = key
	}

	return deviceType, nil
}

// Contains reports whether v is present in s.
func Contains[S ~[]E, E comparable](s S, v E) bool {
	return Index(s, v) >= 0
}

// Index returns the index of the first occurrence of v in s,
// or -1 if not present.
func Index[S ~[]E, E comparable](s S, v E) int {
	for i := range s {
		if v == s[i] {
			return i
		}
	}
	return -1
}

func ExtractNodeInfo(info *craneProtos.CranedInfo) *protos.NodeInfo {
	var nodeState protos.NodeInfo_NodeState

	nodeName := info.GetHostname()
	partitions := info.GetPartitionNames()
	state := info.GetResourceState()
	switch state {
	case craneProtos.CranedResourceState_CRANE_IDLE:
		nodeState = protos.NodeInfo_IDLE
	case craneProtos.CranedResourceState_CRANE_MIX, craneProtos.CranedResourceState_CRANE_ALLOC:
		nodeState = protos.NodeInfo_RUNNING
	case craneProtos.CranedResourceState_CRANE_DOWN:
		nodeState = protos.NodeInfo_NOT_AVAILABLE
	default: // 其他不知道的状态默认为不可用的状态
		nodeState = protos.NodeInfo_NOT_AVAILABLE
	}

	totalMem := info.GetResTotal().GetAllocatableResInNode().GetMemoryLimitBytes() / (1024 * 1024)
	allocMem := info.GetResAlloc().GetAllocatableResInNode().GetMemoryLimitBytes() / (1024 * 1024)

	totalCpuCores := info.GetResTotal().GetAllocatableResInNode().GetCpuCoreLimit()
	allocCpuCores := info.GetResAlloc().GetAllocatableResInNode().GetCpuCoreLimit()

	totalGpusTypeMap := info.GetResTotal().GetDedicatedResInNode()
	totalGpus := getGpuNums(totalGpusTypeMap)
	allocGpusTypeMap := info.GetResAlloc().GetDedicatedResInNode()
	allocGpus := getGpuNums(allocGpusTypeMap)
	IdleGpuCountTypeMap := info.GetResAvail().GetDedicatedResInNode()
	idleGpus := getGpuNums(IdleGpuCountTypeMap)

	return &protos.NodeInfo{
		NodeName:          nodeName,
		Partitions:        partitions,
		State:             nodeState,
		CpuCoreCount:      uint32(totalCpuCores),
		AllocCpuCoreCount: uint32(allocCpuCores),
		IdleCpuCoreCount:  uint32(totalCpuCores) - uint32(allocCpuCores),
		TotalMemMb:        uint32(totalMem),
		AllocMemMb:        uint32(allocMem),
		IdleMemMb:         uint32(totalMem) - uint32(allocMem),
		GpuCount:          totalGpus,
		AllocGpuCount:     allocGpus,
		IdleGpuCount:      idleGpus,
	}
}

func getGpuNums(data *craneProtos.DedicatedResourceInNode) uint32 {
	if data == nil {
		return 0
	}

	var typeCount int
	for _, typeCountMap := range data.GetNameTypeMap() {
		for _, slots := range typeCountMap.GetTypeSlotsMap() {
			slotsSize := len(slots.Slots)
			if slotsSize != 0 {
				typeCount += slotsSize
			}
		}
	}

	return uint32(typeCount)
}

// GetGpuNumsFromPartition 获取加速卡的数量 device_map:{name_type_map:{key:"npu"  value:{type_count_map:{key:"910B3"  value:8}}}}
func GetGpuNumsFromPartition(data *craneProtos.DeviceMap) uint32 {
	if data == nil {
		return 0
	}

	var gpuCount int
	for _, typeCountMap := range data.GetNameTypeMap() { //name_type_map:{key:"npu"  value:{type_count_map:{key:"910B3"  value:8}}}
		for _, count := range typeCountMap.GetTypeCountMap() {
			gpuCount += int(count)
		}

	}

	return uint32(gpuCount)
}

func GetAllPartitions() []string {
	if client.CConfig.Partitions == nil {
		return nil
	}

	var partitions []string
	for _, partition := range client.CConfig.Partitions {
		partitions = append(partitions, partition.Name)
	}
	return partitions
}

// GetGpuNumsFromJob 获取加速卡的数量 device_map:{name_type_map:{key:"BI" value:{total:8}}}
func GetGpuNumsFromJob(data *craneProtos.DeviceMap) int32 {
	if data == nil {
		return 0
	}

	var gpuCount int32
	for _, typeCountMap := range data.GetNameTypeMap() { //name_type_map:{key:"BI" value:{total:8}}
		for _, value := range typeCountMap.GetTypeCountMap() {
			gpuCount += int32(value)
		}
	}

	return gpuCount
}

// SliceSubtract a排除b
func SliceSubtract[T comparable](a, b []T) []T {
	exclude := make(map[T]struct{})
	for _, item := range b {
		exclude[item] = struct{}{}
	}

	var result []T
	for _, item := range a {
		if _, ok := exclude[item]; !ok {
			result = append(result, item)
		}
	}
	return result
}

func GetUserHomedir(username string) (string, error) {
	// 获取指定用户名的用户信息
	u, err := user.Lookup(username)
	if err != nil {
		return "", err
	}

	// 获取家目录
	homeDir := u.HomeDir
	return homeDir, nil
}

func GetAccountsAuthorizedPartitions(accounts []string) ([]string, error) {
	var AuthorizedPartitions []string
	seen := make(map[string]struct{})
	for _, a := range accounts {
		// 获取账户信息
		account, err := GetAccountByName(a)
		if err != nil {
			return nil, fmt.Errorf("get accounts: %v failed: %v", a, err)
		}

		for _, p := range account.GetAllowedPartitions() {
			if _, ok := seen[p]; !ok {
				seen[p] = struct{}{}
				AuthorizedPartitions = append(AuthorizedPartitions, p)
			}
		}
	}

	return AuthorizedPartitions, nil
}

// GetSummaryClusterNodesInfo 获取集群中节点的信息
func GetSummaryClusterNodesInfo(authorizedPartitions []string) (*ClusterNodesInfo, error) {
	var (
		nodeCount             uint32
		runningNodeCount      uint32
		idleNodeCount         uint32
		notAvailableNodeCount uint32
		cpuCoreCount          uint32
		runningCpuCount       uint32
		idleCpuCount          uint32
		notAvailableCpuCount  uint32
		gpuCoreCount          uint32
		runningGpuCount       uint32
		idleGpuCount          uint32
		notAvailableGpuCount  uint32
		totalJobCount         uint32
		runningJobCount       uint32
		pendingJobCount       uint32
	)

	request := &craneProtos.QueryCranedInfoRequest{}
	info, err := client.CraneCtld.QueryCranedInfo(context.Background(), request)
	if err != nil {
		logrus.Errorf("GetClusterNodesInfo failed: %v", err)
		return nil, err
	}

	logrus.Tracef("GetClusterNodesInfo nodeInfo%v", info.GetCranedInfoList())

	// 聚合节点统计信息
	for _, nodeInfo := range info.GetCranedInfoList() {
		if !anyAuthorized(nodeInfo.PartitionNames, authorizedPartitions) {
			continue
		}
		nodeName := nodeInfo.GetHostname()

		nodeCount++
		state := nodeInfo.GetResourceState()
		switch state {
		case craneProtos.CranedResourceState_CRANE_IDLE:
			idleNodeCount++
		case craneProtos.CranedResourceState_CRANE_MIX, craneProtos.CranedResourceState_CRANE_ALLOC:
			runningNodeCount++
		case craneProtos.CranedResourceState_CRANE_DOWN:
			notAvailableNodeCount++
		default: // 其他不知道的状态默认为不可用的状态
			logrus.Warnf("Unknown node state: %s", state)
		}

		totalCpuCores := nodeInfo.GetResTotal().GetAllocatableResInNode().GetCpuCoreLimit()
		allocCpuCores := nodeInfo.GetResAlloc().GetAllocatableResInNode().GetCpuCoreLimit()

		totalGpusTypeMap := nodeInfo.GetResTotal().GetDedicatedResInNode()
		totalGpus := getGpuNums(totalGpusTypeMap)
		allocGpusTypeMap := nodeInfo.GetResAlloc().GetDedicatedResInNode()
		allocGpus := getGpuNums(allocGpusTypeMap)
		IdleGpuCountTypeMap := nodeInfo.GetResAvail().GetDedicatedResInNode()
		idleGpus := getGpuNums(IdleGpuCountTypeMap)

		logrus.Tracef("GetClusterNodesInfo nodeName: %v, totalGpu: %v, allocGpus: %v, idleGpuCount: %v", nodeName, totalGpus, allocGpus, idleGpus)

		CpuCoreCount := uint32(totalCpuCores)
		AllocCpuCoreCount := uint32(allocCpuCores)
		IdleCpuCoreCount := uint32(totalCpuCores) - uint32(allocCpuCores)
		if state == craneProtos.CranedResourceState_CRANE_DOWN {
			IdleCpuCoreCount = 0
			idleGpus = 0
		}

		cpuCoreCount += CpuCoreCount
		runningCpuCount += AllocCpuCoreCount
		idleCpuCount += IdleCpuCoreCount

		gpuCoreCount += totalGpus
		runningGpuCount += allocGpus
		idleGpuCount += idleGpus

	}

	// 计算不可用资源
	notAvailableCpuCount = cpuCoreCount - runningCpuCount - idleCpuCount
	notAvailableGpuCount = gpuCoreCount - runningGpuCount - idleGpuCount

	distributionJobs, err := GetJobsStatusDistribution(authorizedPartitions)
	if err != nil {
		return nil, err
	}
	// 聚合作业统计信息
	for _, jobs := range distributionJobs {
		totalJobCount += jobs.JobCount
		runningJobCount += jobs.RunningJobCount
		pendingJobCount += jobs.PendingJobCount
	}

	var nodeUsage, cpuUsage, gpuUsage float32
	if nodeCount > 0 {
		resultRatio := float32(runningNodeCount) / float32(nodeCount)
		nodeUsage = float32(math.Round(float64(resultRatio)*100*100) / 100)
	}
	if cpuCoreCount > 0 {
		resultRatio := float32(runningCpuCount) / float32(cpuCoreCount)
		cpuUsage = float32(math.Round(float64(resultRatio)*100*100) / 100)
	}
	if gpuCoreCount > 0 {
		resultRatio := float32(runningGpuCount) / float32(gpuCoreCount)
		gpuUsage = float32(math.Round(float64(resultRatio)*100*100) / 100)
	}

	result := &ClusterNodesInfo{
		NodeCount:             nodeCount,
		RunningNodeCount:      runningNodeCount,
		IdleNodeCount:         idleNodeCount,
		NotAvailableNodeCount: notAvailableNodeCount,
		CpuCoreCount:          cpuCoreCount,
		RunningCpuCount:       runningCpuCount,
		IdleCpuCount:          idleCpuCount,
		NotAvailableCpuCount:  notAvailableCpuCount,
		GpuCoreCount:          gpuCoreCount,
		RunningGpuCount:       runningGpuCount,
		IdleGpuCount:          idleGpuCount,
		NotAvailableGpuCount:  notAvailableGpuCount,
		JobCount:              totalJobCount,
		RunningJobCount:       runningJobCount,
		PendingJobCount:       pendingJobCount,
		NodeUsage:             nodeUsage,
		CpuUsage:              cpuUsage,
		GpuUsage:              gpuUsage,
	}

	logrus.Tracef("GetClusterNodesInfo node Info: %v", result)
	return result, nil
}

func GetSummaryPartitionsInfo(authorizedPartitions []string) ([]*protos.SummaryPartitionInfo, error) {
	var partitions []*protos.SummaryPartitionInfo
	logrus.Infof("GetSummaryPartitionsInfo CConfig: %v", client.CConfig)
	logrus.Infof("GetSummaryPartitionsInfo partitions: %v", client.CConfig.Partitions)
	for _, part := range client.CConfig.Partitions { // 遍历每个计算分区、分别获取信息  分区从接口获取
		logrus.Infof("GetSummaryPartitionsInfo partition name: %v", part.Name)
		if !slices.Contains(authorizedPartitions, part.Name) {
			continue
		}
		var state protos.SummaryPartitionInfo_PartitionStatus
		// 根据分区名获取分区信息
		partitionName := part.Name

		partitionInfo, err := GetPartitionByName(partitionName)
		if err != nil {
			logrus.Errorf("GetPartitionsInfo failed: %v", err)
			return nil, fmt.Errorf("get partition info failed: %v", err)
		}
		logrus.Tracef("GetClusterInfo partition info: %v", partitionInfo)

		//// 获取正在运行作业的个数
		//runningJob, err := GetTaskByPartitionAndStatus([]string{partitionName}, []craneProtos.TaskStatus{craneProtos.TaskStatus_Running})
		//if err != nil {
		//	logrus.Errorf("GetClusterInfo failed: %v", err)
		//	return nil, fmt.Errorf("get running task failed: %v", err)
		//}
		//runningJobNum := len(runningJob)

		// 获取正在排队作业的个数
		pendingJob, err := GetTaskByPartitionAndStatus([]string{partitionName}, []craneProtos.TaskStatus{craneProtos.TaskStatus_Pending})
		if err != nil {
			logrus.Errorf("GetClusterInfo failed: %v", err)
			return nil, fmt.Errorf("get pending task failed: %v", err)
		}
		pendingJobNum := len(pendingJob)

		idleNodeCount, allocNodeCount, mixNodeCount, downNodeCount, err := GetNodeByPartition([]string{partitionName})
		if err != nil {
			logrus.Errorf("GetClusterInfo failed: %v", err)
			return nil, fmt.Errorf("get pending task failed: %v", err)
		}
		logrus.Tracef("GetClusterInfo idleNodeCount, allocNodeCount, mixNodeCount, downNodeCount: %v, %v, %v, %v", idleNodeCount, allocNodeCount, mixNodeCount, downNodeCount)

		runningNodes := allocNodeCount + mixNodeCount
		if partitionInfo.GetState() == craneProtos.PartitionState_PARTITION_UP {
			state = protos.SummaryPartitionInfo_AVAILABLE
		} else {
			state = protos.SummaryPartitionInfo_NOT_AVAILABLE
		}
		TotalCpu := partitionInfo.GetResTotal().GetAllocatableRes().GetCpuCoreLimit()
		AllocCpu := partitionInfo.GetResAlloc().GetAllocatableRes().GetCpuCoreLimit()

		TotalGpu := GetGpuNumsFromPartition(partitionInfo.GetResTotal().GetDeviceMap())
		AllocGpu := GetGpuNumsFromPartition(partitionInfo.GetResAlloc().GetDeviceMap())

		var nodeUsage, cpuUsage, gpuUsage float32
		if partitionInfo.GetTotalNodes() > 0 {
			resultRatio := float32(runningNodes) / float32(partitionInfo.GetTotalNodes())
			nodeUsage = float32(math.Round(float64(resultRatio)*100*100) / 100)
		}
		if TotalCpu > 0 {
			resultRatio := float32(AllocCpu) / float32(TotalCpu)
			cpuUsage = float32(math.Round(float64(resultRatio)*100*100) / 100)
		}
		if TotalGpu > 0 {
			resultRatio := float32(AllocGpu) / float32(TotalGpu)
			gpuUsage = float32(math.Round(float64(resultRatio)*100*100) / 100)
		}

		partitions = append(partitions, &protos.SummaryPartitionInfo{
			PartitionName:   partitionInfo.GetName(),
			NodeCount:       partitionInfo.GetTotalNodes(),
			NodeUsage:       nodeUsage,
			CpuCoreCount:    uint32(TotalCpu),
			CpuUsage:        cpuUsage,
			GpuCoreCount:    TotalGpu,
			GpuUsage:        gpuUsage,
			PendingJobCount: uint32(pendingJobNum),
			PartitionStatus: state,
		})
	}

	return partitions, nil
}

// a中有任意一个在b中存在为true，否则为false
func anyAuthorized(a, b []string) bool {
	// b 转 Set
	auth := make(map[string]struct{}, len(b))
	for _, p := range b {
		auth[p] = struct{}{}
	}
	// 遍历 a 只要命中一个就返回
	for _, p := range a {
		if _, ok := auth[p]; ok {
			return true
		}
	}
	return false
}

func ParseGres(gres string) *craneProtos.DeviceMap {
	result := &craneProtos.DeviceMap{NameTypeMap: make(map[string]*craneProtos.TypeCountMap)}
	if gres == "" {
		return result
	}
	gresList := strings.Split(gres, ",")
	for _, g := range gresList {
		parts := strings.Split(g, ":")
		name := parts[0]
		if len(parts) == 2 {
			gresNameCount, err := strconv.ParseUint(parts[1], 10, 64)
			if err != nil {
				logrus.Errorf("Error parsing gres count: %s\n", g)
			}
			if gresNameCount == 0 {
				continue
			}
			if _, exist := result.NameTypeMap[name]; !exist {
				result.NameTypeMap[name] = &craneProtos.TypeCountMap{TypeCountMap: make(map[string]uint64), Total: gresNameCount}
			} else {
				result.NameTypeMap[name].Total += gresNameCount
			}
		} else if len(parts) == 3 {
			gresType := parts[1]
			count, err := strconv.ParseUint(parts[2], 10, 64)
			if err != nil {
				fmt.Printf("Error parsing count for %s: %v\n", name, err)
				continue
			}
			if count == 0 {
				continue
			}
			if _, exist := result.NameTypeMap[name]; !exist {
				typeCountMap := make(map[string]uint64)
				typeCountMap[gresType] = count
				result.NameTypeMap[name] = &craneProtos.TypeCountMap{TypeCountMap: typeCountMap, Total: 0}
			} else {
				result.NameTypeMap[name].TypeCountMap[gresType] = count
			}
		} else {
			logrus.Errorf("Error parsing gres: %s\n", g)
		}
	}

	return result
}

func ParseMountModel(mount string) ([]MountModel, error) {
	var info []MountModel

	var rawStrings []string
	err := json.Unmarshal([]byte(mount), &rawStrings)
	if err != nil {
		return info, err
	}

	for _, s := range rawStrings {
		var mm MountModel
		err = json.Unmarshal([]byte(s), &mm)
		if err != nil {
			return info, err
		}
		info = append(info, mm)
	}

	return info, nil
}

// GetUIDGIDByName 支持返回字符串格式
func GetUIDGIDByName(username string) (uid, gid string, err error) {
	u, err := user.Lookup(username)
	if err != nil {
		return "", "", fmt.Errorf("found user failed: %w", err)
	}

	return u.Uid, u.Gid, nil
}

func AcceleratorIsAscend(accelerator string) bool {
	if strings.Contains(accelerator, HuaweiAscend) {
		return true
	}
	return false
}

func GetDirPathWithSlash(inputPath string) string {
	if inputPath == "" {
		return ""
	}

	// 使用filepath.Dir获取目录
	// 例如：/data/home/test/entry.sh → /data/home/test
	//      /data/home/test/ → /data/home/test
	//      / → /
	dir := filepath.Dir(inputPath)

	// 保证目录末尾带斜杠（兼容Unix/Linux系统）
	// 根目录特殊处理：filepath.Dir("/") 返回 "/", 无需额外添加
	if dir != "/" && !strings.HasSuffix(dir, "/") {
		dir += "/"
	}

	return dir
}

func GetExecutableDir() (string, error) {
	// 获取可执行文件的绝对路径
	exePath, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("failed to obtain executable file path: %w", err)
	}

	// 剥离文件名，只保留目录路径
	// filepath.Dir() 跨平台兼容（Windows/Linux/Mac）
	exeDir := filepath.Dir(exePath)

	return exeDir + "/", nil
}

func SplitBeforeUser(fullPath, username string) string {
	// 构造待查找的段，例如 "/demo_admin/"
	segment := "/" + username + "/"
	// 找第一次出现的位置
	idx := strings.Index(fullPath, segment)
	if idx == -1 {
		return ""
	}

	return fullPath[:idx+1]
}

func CheckAndAddExecPermission(dirPath string) error {
	// 拼接entry.sh的完整路径
	entryPath := filepath.Join(dirPath, "entry.sh")

	// 检查文件是否存在并获取文件信息
	fileInfo, err := os.Stat(entryPath)
	if err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("the entry.sh file does not exist in directory %s", dirPath)
		}
		return fmt.Errorf("failed to retrieve entry. sh file information: %w", err)
	}

	// 3. 检查是否是普通文件（排除目录、管道等特殊文件）
	if fileInfo.IsDir() {
		return fmt.Errorf("entry.sh is a directory, not an executable file")
	}

	// 4. 检查文件是否有可执行权限（判断用户、组、其他任意一方是否有可执行权限）
	// Unix权限位说明：0100(用户可执行)、0010(组可执行)、0001(其他可执行)，组合为0111
	perm := fileInfo.Mode().Perm()
	hasExecPermission := perm&0111 != 0

	if hasExecPermission {
		fmt.Printf("file (%s) already has executable permission, permission bit: %#o\n", entryPath, perm)
		return nil
	}

	// 5. 无执行权限时，添加可执行权限（保留原有读写权限，仅添加执行权限）
	newPerm := perm | 0111 // 按位或操作，添加所有用户的可执行权限
	if err := os.Chmod(entryPath, newPerm); err != nil {
		return fmt.Errorf("failed to add executable permissions for entry.sh: %w", err)
	}

	return nil
}
