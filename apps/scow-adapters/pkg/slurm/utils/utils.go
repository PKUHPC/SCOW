package utils

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os/exec"
	"os/user"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
	"google.golang.org/protobuf/types/known/timestamppb"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/slurm/config"
)

const associationCommandMaxDuration = 5 * time.Minute

// 预编译正则表达式以提高性能
var (
	nodeNameRe   = regexp.MustCompile(`NodeName=(\S+)`)
	partitionsRe = regexp.MustCompile(`Partitions=(\S+)`)
	stateRe      = regexp.MustCompile(`State=(\S+)`)
	realMemoryRe = regexp.MustCompile(`RealMemory=(\S+)`)
	allocMemRe   = regexp.MustCompile(`AllocMem=(\S+)`)
	cpuTotRe     = regexp.MustCompile(`CPUTot=(\S+)`)
	cpuAllocRe   = regexp.MustCompile(`CPUAlloc=(\S+)`)
	gresRe       = regexp.MustCompile(`Gres=(\S+)`)
	allocTRESRe  = regexp.MustCompile(`AllocTRES=(\S+)`)
	bracketsRe   = regexp.MustCompile(`.*\[(.*)\]`)
	numRe        = regexp.MustCompile(`^\d+$`)
	scopeRe      = regexp.MustCompile(`^(\d+)-(\d+)$`)
	stateMap     = map[string]int{
		"PENDING":       0,
		"RUNNING":       1,
		"SUSPENDED":     2,
		"COMPLETED":     3,
		"CANCELED":      4,
		"FAILED":        5,
		"TIMEOUT":       6,
		"NODE_FAIL":     7,
		"PREEMPTED":     8,
		"BOOT_FAIL":     9,
		"DEADLINE":      10,
		"OUT_OF_MEMORY": 11,
	}
)

type PartitionInfo struct {
	Describe   string
	Nodes      uint32
	CpuPerNode uint32
	GpuPerNode uint32
	MemPerNode uint64
}

// extractValue 使用预编译正则表达式提取值
func extractValue(input string, re *regexp.Regexp) string {
	matches := re.FindStringSubmatch(input)
	if len(matches) > 1 {
		return matches[1]
	}
	return ""
}

// ExecuteCommand 执行系统命令并返回退出码、标准输出、标准错误和错误信息
func ExecuteCommand(command string, args ...string) (int, string, string, error) {
	cmd := exec.Command(command, args...)
	return runCommand(cmd)
}

// ExecuteCommandContext 执行会修改 association 的外部命令。
// 命令同时受请求 context 和服务端最大执行时间约束，任一先到都会终止子进程。
func ExecuteCommandContext(ctx context.Context, command string, args ...string) (int, string, string, error) {
	commandCtx, cancel := context.WithTimeout(ctx, associationCommandMaxDuration)
	defer cancel()

	cmd := exec.CommandContext(commandCtx, command, args...)
	exitCode, stdout, stderr, err := runCommand(cmd)
	if commandCtx.Err() != nil {
		return -1, stdout, stderr, commandCtx.Err()
	}
	return exitCode, stdout, stderr, err
}

func runCommand(cmd *exec.Cmd) (int, string, string, error) {

	// 捕获标准输出和错误输出
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	// 执行命令
	err := cmd.Run()
	if err != nil {
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			return exitErr.ExitCode(), stdout.String(), stderr.String(), err
		}
		return -1, stdout.String(), stderr.String(), err
	}

	return 0, stdout.String(), stderr.String(), nil
}

// RunCommand 简单执行shell命令函数
func RunCommand(command string) (string, error) {
	var output bytes.Buffer

	cmd := exec.Command("bash", "-c", command)

	// 创建一个 bytes.Buffer 用于捕获输出
	cmd.Stdout = &output
	cmd.Stderr = &output

	// 执行命令
	err := cmd.Run()

	if err != nil {
		return output.String(), err
	}

	return strings.TrimSpace(output.String()), nil
}

// DeleteSlice 删除Slice中某个元素
func DeleteSlice[T comparable](data []T, word T) []T {
	tmp := make([]T, 0, len(data))
	for _, v := range data {
		if v != word {
			tmp = append(tmp, v)
		}
	}
	return tmp
}

// ChangeState 作业状态码转换(ID转字符串)
func ChangeState(stateInit int) string {
	var stateString string
	switch stateInit {
	case 0:
		stateString = "PENDING"
	case 1:
		stateString = "RUNNING"
	case 2:
		stateString = "SUSPENDED"
	case 3:
		stateString = "COMPLETED"
	case 4:
		stateString = "CANCELED"
	case 5:
		stateString = "FAILED"
	case 6:
		stateString = "TIMEOUT"
	case 7:
		stateString = "NODE_FAIL"
	case 8:
		stateString = "PREEMPTED"
	case 9:
		stateString = "BOOT_FAIL"
	case 10:
		stateString = "DEADLINE"
	case 11:
		stateString = "OUT_OF_MEMORY"
	default:
		stateString = "COMPLETED"
	}
	return stateString
}

// GetStateId 作业状态码转换(字符串转ID)
func GetStateId(state string) (int, error) {
	if id, ok := stateMap[state]; ok {
		return id, nil
	}
	return 0, fmt.Errorf("unknown state %q", state)
}

func GetTimeLimit(timeLimit string) int64 {
	logrus.Tracef("[GetTimeLimit] timeLimit: %s", timeLimit)
	var (
		timeLimitMinutes int64
		err              error
	)
	//d-HH:MM:SS（包含 -）
	if strings.Contains(timeLimit, "-") {
		timeLimitMinutesList := strings.Split(timeLimit, "-")
		if len(timeLimitMinutesList) != 2 {
			logrus.Warnf("[GetTimeLimit] timeLimit length: %d", len(timeLimitMinutesList))
			return 0
		}
		day, err := strconv.Atoi(timeLimitMinutesList[0])
		if err != nil {
			logrus.Errorf("invalid time limit of day: %v, err: %s", timeLimitMinutesList[0], err)
			return 0
		}
		timeLimitMinutesListNew := strings.Split(timeLimitMinutesList[1], ":")
		switch len(timeLimitMinutesListNew) {
		case 1: // D-HH
			hours, err := strconv.Atoi(timeLimitMinutesListNew[0])
			if err != nil {
				logrus.Errorf("invalid time limit of hours: %v, err: %s", timeLimitMinutesListNew[0], err.Error())
				return 0
			}
			return int64(hours)*60 + int64(day)*24*60
		case 2, 3: // D-HH:MM or D-HH:MM:SS
			hours, err := strconv.Atoi(timeLimitMinutesListNew[0])
			if err != nil {
				logrus.Errorf("invalid time limit of hours: %v, err: %s", timeLimitMinutesListNew[0], err.Error())
				return 0
			}
			minutes, err := strconv.Atoi(timeLimitMinutesListNew[1])
			if err != nil {
				logrus.Errorf("invalid time limit of minutes: %v, err: %s", timeLimitMinutesListNew[1], err.Error())
				return 0
			}
			return int64(minutes) + int64(hours)*60 + int64(day)*24*60
		default:
			logrus.Warnf("[GetTimeLimit] timeLimitMinutesListNew length: %d", len(timeLimitMinutesListNew))
			return 0
		}
	} else {
		// 没有timeLimitMinutes超过一天的作业
		// HH:MM:SS 或 MM:SS（包含 :）
		timeLimitMinutesList := strings.Split(timeLimit, ":")
		switch len(timeLimitMinutesList) {
		case 1:
			// 纯分钟数，如 MaxTime=20 时 squeue 输出 "20"
			timeLimitMinutes, err = strconv.ParseInt(timeLimitMinutesList[0], 10, 64)
			if err != nil {
				logrus.Errorf("invalid time limit of hours: %v, err: %s", timeLimitMinutesList[0], err.Error())
				return 0
			}
		case 2:
			minutes, err := strconv.Atoi(timeLimitMinutesList[0])
			if err != nil {
				logrus.Errorf("invalid time limit of minutes: %v, err: %s", timeLimitMinutesList[0], err.Error())
				return 0
			}
			timeLimitMinutes = int64(minutes)
		case 3:
			hours, err := strconv.Atoi(timeLimitMinutesList[0])
			if err != nil {
				logrus.Errorf("invalid time limit of hours: %v, err: %s", timeLimitMinutesList[0], err.Error())
				return 0
			}
			minutes, err := strconv.Atoi(timeLimitMinutesList[1])
			if err != nil {
				logrus.Errorf("invalid time limit of minutes: %v, err: %s", timeLimitMinutesList[1], err.Error())
				return 0
			}
			timeLimitMinutes = int64(minutes) + int64(hours)*60
		default:
			logrus.Warnf("[GetTimeLimit] timeLimitMinutesList length: %d", len(timeLimitMinutesList))
			return 0
		}
		return timeLimitMinutes
	}

}

func GetGpuCountsFromGpuIdList(tresAlloc string, gpuId []int) int32 {
	var gpusCounts int32
	resAllocList := strings.Split(tresAlloc, ",")
	for _, idValue := range gpuId {
		for _, resAlloc := range resAllocList {
			resAllocKey := strings.Split(resAlloc, "=")
			if len(resAllocKey) != 2 {
				return gpusCounts
			}
			id := resAllocKey[0]
			idInt, _ := strconv.Atoi(id)
			if idInt == idValue {
				number := resAllocKey[1]
				numberInt, _ := strconv.Atoi(number)
				gpusCounts = int32(numberInt)
				return gpusCounts
			}
		}
	}
	return gpusCounts
}

// GetResInfoNumFromTresInfo 通过作业表中的tres信息解析获取资源信息
func GetResInfoNumFromTresInfo(tresInfo string, resId int) int {
	var resInfoNum int
	resAllocList := strings.Split(tresInfo, ",")
	for _, resInfo := range resAllocList {
		resInfoKey := strings.Split(resInfo, "=")
		if len(resInfoKey) != 2 {
			return resInfoNum
		}
		id := resInfoKey[0]
		idInt, _ := strconv.Atoi(id)
		if idInt == resId {
			tresNum := resInfoKey[1]
			tresNumInt, _ := strconv.Atoi(tresNum)
			resInfoNum = tresNumInt
			return resInfoNum
		}
	}
	return resInfoNum
}

// GetUserUidGid 根据指定用户名获取uid
func GetUserUidGid(username string) (int, int, error) {
	u, err := user.Lookup(username)
	if err != nil {
		return -1, -1, err
	}
	uid := u.Uid
	gid := u.Gid
	uidInt, _ := strconv.Atoi(uid)
	gidInt, _ := strconv.Atoi(gid)
	return uidInt, gidInt, nil
}

// GetUserNameByUid 根据指定的uid获取用户名
func GetUserNameByUid(uid int) (string, error) {
	u, err := user.LookupId(strconv.Itoa(uid))
	if err != nil {
		return "", err
	}
	return u.Username, nil
}

// checkNameLegal 判断名称是否合法, 小写字母（a 到 z）、数字（0 到 9）或下划线（_）为合法，其他非法。
func checkNameLegal(s string) bool {
	pattern := "^[a-z0-9_]+$"
	// 编译正则表达式
	reg := regexp.MustCompile(pattern)
	// 使用正则表达式判断字符串是否符合模式
	if reg.MatchString(s) {
		return true
	}
	return false
}

// GetPendingMapInfo 获取map信息
func GetPendingMapInfo(pendingString string) map[int]string {
	m := make(map[int]string)

	pairs := strings.Split(pendingString, ";")
	for _, pair := range pairs {
		kv := strings.Split(pair, "=")
		if len(kv) != 2 {
			continue
		}
		key, err := strconv.Atoi(kv[0])
		if err != nil {
			continue
		}
		value := strings.Trim(kv[1], "()")
		m[key] = value
	}
	return m
}

// IsSubSet 判断 subArr 是否为 arr 的子集
func IsSubSet[T comparable](arr, subArr []T) bool {
	// 创建一个map，用于记录arr中的元素
	m := make(map[T]bool, len(arr))
	// 将arr中的元素添加到map中
	for _, num := range arr {
		m[num] = true
	}
	// 遍历subArr中的元素，判断是否都在map中
	for _, num := range subArr {
		if !m[num] {
			return false
		}
	}
	return true
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

func GetRunningElapsedSeconds(timeString string) int64 {
	var (
		elapsedSeconds int64
	)
	if strings.Contains(timeString, "-") {
		ElapsedSecondsList := strings.Split(timeString, "-")
		if len(ElapsedSecondsList) != 2 {
			return 0
		}
		day, _ := strconv.Atoi(ElapsedSecondsList[0])
		ElapsedSecondsListNew := strings.Split(ElapsedSecondsList[1], ":")
		if len(ElapsedSecondsListNew) != 3 {
			return 0
		}
		hours, _ := strconv.Atoi(ElapsedSecondsListNew[0])
		minutes, _ := strconv.Atoi(ElapsedSecondsListNew[1])
		seconds, _ := strconv.Atoi(ElapsedSecondsListNew[2])
		return int64(seconds) + int64(minutes)*60 + int64(hours)*3600 + int64(day)*24*3600
	} else {
		// 没有超过一天的作业
		ElapsedSecondsList := strings.Split(timeString, ":")
		if len(ElapsedSecondsList) == 2 {
			minutes, _ := strconv.Atoi(ElapsedSecondsList[0])
			seconds, _ := strconv.Atoi(ElapsedSecondsList[1])
			elapsedSeconds = int64(seconds) + int64(minutes)*60
		} else {
			if len(ElapsedSecondsList) != 3 {
				return 0
			}
			hours, _ := strconv.Atoi(ElapsedSecondsList[0])
			minutes, _ := strconv.Atoi(ElapsedSecondsList[1])
			seconds, _ := strconv.Atoi(ElapsedSecondsList[2])
			elapsedSeconds = int64(seconds) + int64(minutes)*60 + int64(hours)*3600
		}
		return elapsedSeconds
	}
}

func SortJobInfo(sortKey string, sortOrder string, jobInfo []*pb.JobInfo) []*pb.JobInfo {
	if len(jobInfo) <= 1 {
		return jobInfo
	}

	ascending := sortOrder == "ASC"

	switch sortKey {
	case "JobId":
		sort.Slice(jobInfo, func(i, j int) bool {
			if ascending {
				return jobInfo[i].JobId < jobInfo[j].JobId
			}
			return jobInfo[i].JobId > jobInfo[j].JobId
		})
	case "Name":
		sort.Slice(jobInfo, func(i, j int) bool {
			if ascending {
				return jobInfo[i].Name < jobInfo[j].Name
			}
			return jobInfo[i].Name > jobInfo[j].Name
		})
	case "Account":
		sort.Slice(jobInfo, func(i, j int) bool {
			if ascending {
				return jobInfo[i].Account < jobInfo[j].Account
			}
			return jobInfo[i].Account > jobInfo[j].Account
		})
	case "User":
		sort.Slice(jobInfo, func(i, j int) bool {
			if ascending {
				return jobInfo[i].User < jobInfo[j].User
			}
			return jobInfo[i].User > jobInfo[j].User
		})
	case "Partition":
		sort.Slice(jobInfo, func(i, j int) bool {
			if ascending {
				return jobInfo[i].Partition < jobInfo[j].Partition
			}
			return jobInfo[i].Partition > jobInfo[j].Partition
		})
	case "State":
		sort.Slice(jobInfo, func(i, j int) bool {
			if ascending {
				return jobInfo[i].State < jobInfo[j].State
			}
			return jobInfo[i].State > jobInfo[j].State
		})
	case "TimeLimitMinutes":
		sort.Slice(jobInfo, func(i, j int) bool {
			if ascending {
				return jobInfo[i].TimeLimitMinutes < jobInfo[j].TimeLimitMinutes
			}
			return jobInfo[i].TimeLimitMinutes > jobInfo[j].TimeLimitMinutes
		})
	default:
		// 默认按JobId排序
		sort.Slice(jobInfo, func(i, j int) bool {
			if ascending {
				return jobInfo[i].JobId < jobInfo[j].JobId
			}
			return jobInfo[i].JobId > jobInfo[j].JobId
		})
	}

	return jobInfo
}

func CheckSlurmStatus(result string) bool {
	subStr := "Unable to contact slurm controller"
	if strings.Contains(result, subStr) {
		return true
	} else {
		return false
	}
}

func GetPartitionInfo() map[string]*PartitionInfo {
	partitionInfo := make(map[string]*PartitionInfo, len(config.SlurmValue.Partitions))
	if config.SlurmValue.Partitions == nil {
		return partitionInfo
	}

	// 从配置文件中读取计算分区的描述字段
	for _, value := range config.SlurmValue.Partitions {
		partitionInfo[value.Name] = &PartitionInfo{
			Describe:   value.Desc,
			Nodes:      value.Nodes,
			CpuPerNode: value.CpuPerNode,
			GpuPerNode: value.GpuPerNode,
			MemPerNode: parseMemory(value.MemPerNode),
		}
	}
	return partitionInfo
}

// CheckUser 检查用户名是否非法
func CheckUser(name string) error {
	resultUser := checkNameLegal(name)
	if !resultUser {
		return fmt.Errorf("the username contains illegal characters")
	}
	return nil
}

// CheckAccount 检查账户名是否非法
func CheckAccount(name string) error {
	// 检查账户名中是否包含大写字母
	resultAcct := checkNameLegal(name)
	if !resultAcct {
		return fmt.Errorf("the account contains illegal characters")
	}
	return nil
}

func ExtractNodeInfo(info string) *pb.NodeInfo {
	var (
		partitionList []string
		totalGpusInt  int
		allocGpusInt  int
		nodeRemovable bool
		nodeState     pb.NodeInfo_NodeState
	)

	// 使用预编译正则表达式
	nodeName := extractValue(info, nodeNameRe)
	partitions := extractValue(info, partitionsRe)
	partitionList = append(partitionList, strings.Split(partitions, ",")...)
	state := extractValue(info, stateRe)
	switch state {
	case "IDLE", "IDLE+PLANNED":
		nodeState = pb.NodeInfo_IDLE
	case "DOWN", "DOWN+NOT_RESPONDING", "ALLOCATED+DRAIN", "IDLE+DRAIN", "IDLE+DRAIN+NOT_RESPONDING", "DOWN+DRAIN+INVALID_REG", "IDLE+NOT_RESPONDING":
		nodeState = pb.NodeInfo_NOT_AVAILABLE
	case "ALLOCATED", "MIXED":
		nodeState = pb.NodeInfo_RUNNING
	default: // 其他不知道的状态默认为不可用的状态
		nodeState = pb.NodeInfo_NOT_AVAILABLE
	}
	totalMem := extractValue(info, realMemoryRe)
	totalMemInt, _ := strconv.Atoi(totalMem)
	AllocMem := extractValue(info, allocMemRe)
	AllocMemInt, _ := strconv.Atoi(AllocMem)
	totalCpuCores := extractValue(info, cpuTotRe)
	totalCpuCoresInt, _ := strconv.Atoi(totalCpuCores)
	allocCpuCores := extractValue(info, cpuAllocRe)
	allocCpuCoresInt, _ := strconv.Atoi(allocCpuCores)
	totalGpus := extractValue(info, gresRe)
	if totalGpus == "(null)" {
		totalGpusInt = 0
	} else {
		_, _, _, totalGpusString, _ := ValidateGres(totalGpus)
		totalGpusInt, _ = strconv.Atoi(totalGpusString)
	}
	allocGpus := extractValue(info, allocTRESRe)
	if allocGpus == "" {
		allocGpusInt = 0
	} else {
		if strings.Contains(allocGpus, "gpu") {
			allocRes := strings.Split(allocGpus, ",")
			for _, res := range allocRes {
				if strings.Contains(res, "gpu") {
					gpuAllocResStr := strings.Split(res, "=")[1]
					allocGpusInt, _ = strconv.Atoi(gpuAllocResStr)
					break
				}
			}
		} else {
			allocGpusInt = 0
		}
	}

	idleGpuCount := uint32(totalGpusInt) - uint32(allocGpusInt)
	idleCpuCoreCount := uint32(totalCpuCoresInt) - uint32(allocCpuCoresInt)
	idleMemMb := uint32(totalMemInt) - uint32(AllocMemInt)
	if nodeState == pb.NodeInfo_NOT_AVAILABLE {
		idleGpuCount = 0
		idleCpuCoreCount = 0
		idleMemMb = 0
	}

	if allocCpuCoresInt == 0 {
		nodeRemovable = true
	}

	return &pb.NodeInfo{
		NodeName:          nodeName,
		Partitions:        partitionList,
		State:             nodeState,
		CpuCoreCount:      uint32(totalCpuCoresInt),
		AllocCpuCoreCount: uint32(allocCpuCoresInt),
		IdleCpuCoreCount:  idleCpuCoreCount,
		TotalMemMb:        uint32(totalMemInt),
		AllocMemMb:        uint32(AllocMemInt),
		IdleMemMb:         idleMemMb,
		GpuCount:          uint32(totalGpusInt),
		AllocGpuCount:     uint32(allocGpusInt),
		IdleGpuCount:      idleGpuCount,
		Removable:         nodeRemovable,
	}
}

func ParseHostList(hostStr string) ([]string, bool) {
	nameStr := strings.ReplaceAll(hostStr, " ", "")
	nameStr += ","

	var nameMeta string
	var strList []string
	var charQueue string

	for _, c := range nameStr {
		if c == '[' {
			if charQueue == "" {
				charQueue = string(c)
			} else {
				logrus.Errorf("Illegal node name string format: duplicate brackets")
				return nil, false
			}
		} else if c == ']' {
			if charQueue == "" {
				logrus.Errorf("Illegal node name string format: isolated bracket")
				return nil, false
			} else {
				nameMeta += charQueue
				nameMeta += string(c)
				charQueue = ""
			}
		} else if c == ',' {
			if charQueue == "" {
				strList = append(strList, nameMeta)
				nameMeta = ""
			} else {
				charQueue += string(c)
			}
		} else {
			if charQueue == "" {
				nameMeta += string(c)
			} else {
				charQueue += string(c)
			}
		}
	}
	if charQueue != "" {
		logrus.Errorf("Illegal node name string format: isolated bracket")
		return nil, false
	}

	regex := regexp.MustCompile(`.*\[(.*)\](\..*)*$`)
	var hostList []string

	for _, str := range strList {
		strS := strings.TrimSpace(str)
		if !regex.MatchString(strS) {
			hostList = append(hostList, strS)
		} else {
			nodes, ok := ParseNodeList(strS)
			if !ok {
				return nil, false
			}
			hostList = append(hostList, nodes...)
		}
	}
	return hostList, true
}

func ParseNodeList(nodeStr string) ([]string, bool) {
	if !bracketsRe.MatchString(nodeStr) {
		return nil, false
	}

	unitStrList := strings.Split(nodeStr, "]")
	endStr := unitStrList[len(unitStrList)-1]
	unitStrList = unitStrList[:len(unitStrList)-1]
	resList := []string{""}

	for _, str := range unitStrList {
		nodeNum := strings.FieldsFunc(str, func(r rune) bool {
			return r == '[' || r == ','
		})
		var unitList []string
		headStr := nodeNum[0]

		for _, numStr := range nodeNum[1:] {
			if numRe.MatchString(numStr) {
				unitList = append(unitList, fmt.Sprintf("%s%s", headStr, numStr))
			} else if scopeRe.MatchString(numStr) {
				locIndex := scopeRe.FindStringSubmatch(numStr)
				start, err1 := strconv.Atoi(locIndex[1])
				end, err2 := strconv.Atoi(locIndex[2])
				if err1 != nil || err2 != nil {
					return nil, false
				}
				width := len(locIndex[1])
				for j := start; j <= end; j++ {
					sNum := fmt.Sprintf("%0*d", width, j)
					unitList = append(unitList, fmt.Sprintf("%s%s", headStr, sNum))
				}
			} else {
				return nil, false // Format error
			}
		}

		var tempList []string
		for _, left := range resList {
			for _, right := range unitList {
				tempList = append(tempList, left+right)
			}
		}
		resList = tempList
	}

	if endStr != "" {
		for i := range resList {
			resList[i] += endStr
		}
	}

	return resList, true
}

// ValidateGres 严格校验 GRES (<name>[:<type>][:no_consume]:<number>[K|M|G|T]) 格式并提取字段
func ValidateGres(gresStr string) (name, gresType, flags, count string, err error) {
	if strings.Contains(gresStr, "(") {
		re := regexp.MustCompile(`^[^(]+`)
		gresStr = re.FindString(gresStr)
	}
	// 基础正则匹配整体结构
	baseRegex := regexp.MustCompile(`^([^:]+)(?::([^:]*)){0,2}:(\d+[KkMmGgTt]?)$`)
	if !baseRegex.MatchString(gresStr) {
		return "", "", "", "", fmt.Errorf("invalid GRES format: %s", gresStr)
	}

	// 提取基础字段
	matches := baseRegex.FindStringSubmatch(gresStr)
	name = matches[1]
	count = matches[3]

	// 校验 count 格式
	if !regexp.MustCompile(`^\d+[KkMmGgTt]?$`).MatchString(count) {
		return "", "", "", "", fmt.Errorf("invalid count: %s", count)
	}

	// 拆分中间字段
	parts := strings.Split(gresStr, ":")
	middle := parts[1 : len(parts)-1] // 去除 name 和 count

	// 分层校验中间字段
	switch len(middle) {
	case 0: // name:count 格式
		return name, "", "", count, nil
	case 1: // name:type:count
		gresType = middle[0]
		if gresType == "" {
			return "", "", "", "", fmt.Errorf("type cannot be empty")
		}
	case 2: // name:type:flags:count
		gresType = middle[0]
		flags = middle[1]
		// 校验 flags 合法性
		if !regexp.MustCompile(`^(no_consume|shared)$`).MatchString(flags) {
			return "", "", "", "", fmt.Errorf("invalid flags: %s", flags)
		}
	default:
		return "", "", "", "", fmt.Errorf("too many segments in GRES")
	}

	return name, gresType, flags, count, nil
}

func NormalizeAllowAcctList(allowAcctList string) string {
	if strings.TrimSpace(allowAcctList) == "" {
		return EMPTYALLOWACCOUNT
	}

	accounts := strings.Split(allowAcctList, ",")

	var filtered []string
	for _, acc := range accounts {
		acc = strings.TrimSpace(acc)
		if acc != "" && acc != EMPTYALLOWACCOUNT {
			filtered = append(filtered, acc)
		}
	}

	if len(filtered) == 0 {
		return EMPTYALLOWACCOUNT
	}

	return strings.Join(filtered, ",")
}

func GetMemoryInMb(mem string) int64 {
	if mem == "" {
		return 0
	}

	memStr := strings.ToUpper(mem)
	// 使用 switch 匹配不同单位
	switch {
	case strings.HasSuffix(memStr, "K"):
		kb, _ := strconv.ParseInt(strings.TrimSuffix(memStr, "K"), 10, 64)
		return kb / 1024
	case strings.HasSuffix(memStr, "M"):
		mb, _ := strconv.ParseInt(strings.TrimSuffix(memStr, "M"), 10, 64)
		return mb
	case strings.HasSuffix(memStr, "G"):
		gb, _ := strconv.ParseInt(strings.TrimSuffix(memStr, "G"), 10, 64)
		return gb * 1024
	case strings.HasSuffix(memStr, "T"):
		tb, _ := strconv.ParseInt(strings.TrimSuffix(memStr, "T"), 10, 64)
		return tb * 1024 * 1024
	default:
		// 无单位时默认是MB
		mb, _ := strconv.ParseInt(memStr, 10, 64)
		return mb
	}
}

// ConvertJobStartTime 将字符串时间转换为 *timestamppb.Timestamp
// 输入格式：N/A 或 2025-10-29T09:03:21
// 返回值：当输入为 N/A 时返回 nil，否则返回对应的 Timestamp
func ConvertJobStartTime(singleJobStartTime string) *timestamppb.Timestamp {
	// 处理空值和 N/A 情况
	if singleJobStartTime == "" || strings.ToUpper(singleJobStartTime) == "N/A" {
		return nil
	}

	// 1. 尝试 RFC3339/RFC3339Nano，能带时区就用串里的
	for _, f := range []string{time.RFC3339, time.RFC3339Nano} {
		if t, err := time.Parse(f, singleJobStartTime); err == nil {
			return timestamppb.New(t)
		}
	}

	// 2. 不带时区的格式，固定用运行机器的时区解析
	noTZFormats := []string{
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
		time.RFC1123,
		time.RFC822,
	}
	for _, f := range noTZFormats {
		if t, err := time.ParseInLocation(f, singleJobStartTime, time.Local); err == nil {
			return timestamppb.New(t)
		}
	}

	return nil
}

func GetAccountAuthorizedPartitions(partitionAndAllowAccounts map[string]string, accounts []string) []string {
	var partitions []string
	for part, accs := range partitionAndAllowAccounts {
		if accs == "ALL" {
			partitions = append(partitions, part)
			continue
		}
		// 把 allowAccounts 切成 set
		set := make(map[string]struct{})
		for _, a := range strings.Split(accs, ",") {
			set[a] = struct{}{}
		}
		// 只要 accounts 里任意一个命中就保留该分区
		for _, want := range accounts {
			if _, ok := set[want]; ok {
				partitions = append(partitions, part)
				break
			}
		}
	}
	return partitions
}

func GetAuthorizedPartitionsNodes(partitions []string) ([]string, error) {
	seen := make(map[string]struct{})
	for _, partition := range partitions {
		partitionsResult, err := GetPartitionsByName(partition)
		if err != nil {
			logrus.Warnf("get partitions %s info failed, skip it: %v", partition, err)
			continue
		}
		nodesName := extractValue(partitionsResult, nodesRe)
		nodeList, ok := ParseHostList(nodesName)
		if !ok {
			logrus.Errorf("invalid node range format: %s", nodesName)
			continue
		}

		for _, n := range nodeList {
			seen[n] = struct{}{}
		}
	}

	result := make([]string, 0, len(seen))
	for n := range seen {
		result = append(result, n)
	}

	return result, nil
}

// GetRemainingPartitions 返回在 partitions 中但不在 allowPartitions 中的分区
func GetRemainingPartitions(partitions, allowPartitions []string) []string {
	// 创建允许分区的映射，用于快速查找
	allowedMap := make(map[string]bool)
	for _, partition := range allowPartitions {
		allowedMap[partition] = true
	}

	// 存储剩余分区的切片
	var remaining []string

	// 遍历所有分区，只添加不在允许映射中的分区
	for _, partition := range partitions {
		if !allowedMap[partition] {
			remaining = append(remaining, partition)
		}
	}

	return remaining
}

func GetAccountPartitionStatus(partitions, allowPartitions []string) []*pb.AccountStatusInPartition {
	allowedSet := make(map[string]bool, len(allowPartitions))
	for _, partition := range allowPartitions {
		allowedSet[partition] = true
	}

	// 预分配结果切片，避免动态扩容开销
	result := make([]*pb.AccountStatusInPartition, 0, len(partitions))

	// 遍历所有分区，确定每个分区的状态
	for _, partition := range partitions {
		// 如果分区在允许集合中，则未封锁；否则封锁
		_, isAllowed := allowedSet[partition]
		status := &pb.AccountStatusInPartition{
			Partition: partition,
			Blocked:   !isAllowed, // 不在允许列表中的分区被封锁
		}
		result = append(result, status)
	}

	return result
}

// NormalizePartitionNames 将分区名列表（如来自 assoc_table 的小写名）还原为
// scontrol 中的真实大小写。未能匹配的分区名保持原样。
func NormalizePartitionNames(partitions []string) ([]string, error) {
	realNames, err := GetPartitionsName()
	if err != nil {
		return nil, err
	}
	lowerToReal := make(map[string]string, len(realNames))
	for _, name := range realNames {
		lowerToReal[strings.ToLower(name)] = name
	}
	result := make([]string, len(partitions))
	for i, p := range partitions {
		if realName, ok := lowerToReal[strings.ToLower(p)]; ok {
			result[i] = realName
		} else {
			result[i] = p
		}
	}
	return result, nil
}

// NormalizeExistingPartitionNames 将分区名还原为 scontrol 中的真实大小写，并丢弃
// 当前 Slurm 中不存在的分区，适用于数据库授权分区可能滞后的读路径。
func NormalizeExistingPartitionNames(partitions []string) ([]string, error) {
	realNames, err := GetPartitionsName()
	if err != nil {
		return nil, err
	}
	lowerToReal := make(map[string]string, len(realNames))
	for _, name := range realNames {
		lowerToReal[strings.ToLower(name)] = name
	}

	seen := make(map[string]struct{})
	result := make([]string, 0, len(partitions))
	for _, p := range partitions {
		realName, ok := lowerToReal[strings.ToLower(p)]
		if !ok {
			logrus.Warnf("authorized partition %s does not exist in slurm, skip it", p)
			continue
		}
		if _, ok := seen[realName]; ok {
			continue
		}
		seen[realName] = struct{}{}
		result = append(result, realName)
	}
	return result, nil
}

func GetAccountBlockedPartitionStatus(partitions []string) []*pb.AccountStatusInPartition {
	// 预分配结果切片，避免动态扩容开销
	result := make([]*pb.AccountStatusInPartition, 0, len(partitions))

	// 遍历所有分区，确定每个分区的状态
	for _, partition := range partitions {
		status := &pb.AccountStatusInPartition{
			Partition: partition,
			Blocked:   true,
		}
		result = append(result, status)
	}

	return result
}
