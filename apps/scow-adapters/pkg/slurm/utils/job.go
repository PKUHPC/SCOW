package utils

import (
	"bufio"
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/sirupsen/logrus"
	"google.golang.org/protobuf/types/known/timestamppb"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/slurm/client"
	"scow-adapters/pkg/slurm/config"
)

// jobRowData 用于存储从数据库行扫描的作业数据
type jobRowData struct {
	jobId            uint32
	jobName          string
	account          string
	partition        string
	gresUsed         string
	nodeList         string
	idQos            int
	state            int
	idUser           int
	memReq           uint64
	timeLimitMinutes int64
	submitTime       int64
	startTime        int64
	timeSuspended    int64
	endTime          int64
	nodesAlloc       int32
	cpusReq          int32
	workingDirectory string
	tresAlloc        string
	tresReq          string
}

var finishedJobStates = []int{3, 4, 5, 6, 7, 8, 9, 10, 11}

func jobStateIDsString(states []int) string {
	stateIDs := make([]string, 0, len(states))
	for _, state := range states {
		stateIDs = append(stateIDs, strconv.Itoa(state))
	}

	return strings.Join(stateIDs, ",")
}

// isFinishedJobState 根据 Slurm 明确的终态白名单判断作业是否已经结束。
func isFinishedJobState(state int) bool {
	for _, finishedState := range finishedJobStates {
		if state == finishedState {
			return true
		}
	}

	return false
}

// 预编译正则表达式，避免在循环中重复编译
var (
	accountPermissionRegex = regexp.MustCompile(`Job's account not permitted to use this partition`)
)

// GetJobSubmitTimesBatch 批量获取作业提交时间
func GetJobSubmitTimesBatch(jobIds []int) (map[int]int64, error) {
	if len(jobIds) == 0 {
		return make(map[int]int64), nil
	}

	clusterName := config.SlurmValue.MySQLConfig.ClusterName
	placeholders := strings.Repeat("?,", len(jobIds))
	placeholders = placeholders[:len(placeholders)-1] // 移除最后的逗号

	query := fmt.Sprintf("SELECT id_job, time_submit FROM %s_job_table WHERE id_job IN (%s)", clusterName, placeholders)

	args := make([]interface{}, len(jobIds))
	for i, id := range jobIds {
		args[i] = id
	}

	rows, err := client.SlurmDB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[int]int64)
	for rows.Next() {
		var jobId int
		var submitTime int64
		if err := rows.Scan(&jobId, &submitTime); err != nil {
			continue
		}
		result[jobId] = submitTime
	}

	return result, nil
}

// GetJobTimeLimitsBatch 批量获取作业时间限制
func GetJobTimeLimitsBatch(jobIds []int) (map[int]int64, error) {
	if len(jobIds) == 0 {
		return make(map[int]int64), nil
	}

	clusterName := config.SlurmValue.MySQLConfig.ClusterName
	placeholders := strings.Repeat("?,", len(jobIds))
	placeholders = placeholders[:len(placeholders)-1] // 移除最后的逗号

	query := fmt.Sprintf("SELECT id_job, timelimit FROM %s_job_table WHERE id_job IN (%s)", clusterName, placeholders)

	args := make([]interface{}, len(jobIds))
	for i, id := range jobIds {
		args[i] = id
	}

	rows, err := client.SlurmDB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[int]int64)
	for rows.Next() {
		var jobId int
		var timeLimit int64
		if err := rows.Scan(&jobId, &timeLimit); err != nil {
			continue
		}
		result[jobId] = timeLimit
	}

	return result, nil
}

func GetUnfinishedJobs(in *pb.GetJobsRequest) (*pb.GetJobsResponse, error) {
	logrus.Infof("Start get unfinished jobs")
	var (
		args    []string
		jobInfo []*pb.JobInfo
	)

	// 声明pending作业原因相关变量，稍后与其他查询一起并发执行
	var pendingReasonMap map[int]string
	var pendingErr error

	// 处理Users参数
	if len(in.Filter.Users) > 0 {
		users := strings.Join(in.Filter.Users, ",")
		args = append(args, "-u", users)
	}

	// 处理Accounts参数
	if len(in.Filter.Accounts) > 0 {
		accounts := strings.Join(in.Filter.Accounts, ",")
		args = append(args, "-A", accounts)
	}

	// 添加固定状态参数
	states := strings.ToLower(strings.Join(in.Filter.States, ","))
	args = append(args, "-t", states)

	// 处理JobId和JobName条件
	if in.Filter.JobId != nil && in.Filter.JobName != nil {
		args = append(args, "-n", *in.Filter.JobName, "-j", strconv.Itoa(int(*in.Filter.JobId)))
	} else if in.Filter.JobId != nil {
		args = append(args, "-j", strconv.Itoa(int(*in.Filter.JobId)))
	} else if in.Filter.JobName != nil {
		args = append(args, "-n", *in.Filter.JobName)
	}

	/*
		%b job gres的值
		%a 与作业关联的账户
		%A job step, 也是jobId
		%C 作业请求的 CPU（处理器）数量
		%D 分配给作业的节点数或待处理作业所需的最小节点数
		%j 作业的名称
		%l 作业的时间限制，如果尚未设置，则值为“NOT_SET”，如果无限制，则值为“UNLIMITED”。
		%m 作业请求的最小内存大小（以 MB 为单位）
		%M 作业使用的时间（以天-小时:分钟:秒为单位）
		%P 作业的分区
		%q 与作业相关的服务质量
		%S 作业的实际或预期开始时间
		%T 作业状态
		%u 作业的用户名
		%V 作业的提交时间
		%Z 作业的工作目录
		%N 分配给作业的节点列表
	*/
	publicArgs := []string{"--noheader", "--format=%b %a %A %C %D %j %l %m %M %P %q %S %T %u %V %Z %N"}
	args = append(args, publicArgs...)

	exitCode, stdout, stderr, err := ExecuteCommand(client.SQUEUE, args...)
	if err != nil {
		if exitCode == -1 {
			// 命令执行前就失败了
			return nil, fmt.Errorf("system error: %v", err)
		} else {
			// 命令执行但失败了
			return nil, fmt.Errorf("get unfinished jobs failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
		}
	}

	logrus.Tracef("GetJobs get jobs command: %v", args)
	if len(stdout) == 0 {
		return &pb.GetJobsResponse{Jobs: jobInfo}, nil
	}

	// 第一遍扫描：收集所有作业ID和基本信息
	var jobLines []string
	var jobIds []int
	var invalidTimeLimitJobIds []int

	scanner := bufio.NewScanner(strings.NewReader(stdout))
	for scanner.Scan() {
		unfinishedJobInfo := scanner.Text()
		if isValidJobInfo(unfinishedJobInfo, 17) {
			jobLines = append(jobLines, unfinishedJobInfo)
			singleJobInfo := strings.Split(unfinishedJobInfo, " ")
			singleJobId, _ := strconv.Atoi(singleJobInfo[2])
			jobIds = append(jobIds, singleJobId)

			// 收集需要查询时间限制的作业ID
			if singleJobInfo[6] == "INVALID" {
				invalidTimeLimitJobIds = append(invalidTimeLimitJobIds, singleJobId)
			}
		}
	}

	// 预分配内存，提高性能
	jobInfo = make([]*pb.JobInfo, 0, len(jobLines))

	// 并发获取pending原因、提交时间和时间限制
	var submitTimesMap map[int]int64
	var timeLimitsMap map[int]int64
	var submitErr, limitErr error
	var wg sync.WaitGroup

	wg.Add(3)
	go func() {
		defer wg.Done()
		pendingReasonMap, pendingErr = GetPendingJobsReason(in.Filter.Users)
	}()

	go func() {
		defer wg.Done()
		submitTimesMap, submitErr = GetJobSubmitTimesBatch(jobIds)
	}()

	go func() {
		defer wg.Done()
		timeLimitsMap, limitErr = GetJobTimeLimitsBatch(invalidTimeLimitJobIds)
	}()

	wg.Wait()

	// 如果批量查询失败，记录错误但继续处理
	if pendingErr != nil {
		logrus.Warnf("Pending jobs reason query failed: %v", pendingErr)
		pendingReasonMap = make(map[int]string)
	}
	if submitErr != nil {
		logrus.Warnf("Batch submit time query failed: %v", submitErr)
		submitTimesMap = make(map[int]int64)
	}
	if limitErr != nil {
		logrus.Warnf("Batch time limit query failed: %v", limitErr)
		timeLimitsMap = make(map[int]int64)
	}

	// 第二遍处理：构建作业信息
	for _, unfinishedJobInfo := range jobLines {
		var jobNodesReq, jobCpusReq, jobGpusReq int32
		var jobNodesAlloc, jobCpusAlloc, jobGpusAlloc int32
		var jobReason, jobInfoNodeList string
		var jobMemReq, jobMemAlloc, jobElapsedSeconds, jobTimeLimitMinutes int64
		var jobTimeSubmit, jobTimeStart *timestamppb.Timestamp

		singleJobInfo := strings.Split(unfinishedJobInfo, " ")
		singleJobJobName := singleJobInfo[5]
		singleJobWorkingDirectory := singleJobInfo[15]
		if ShouldFilterDir(singleJobWorkingDirectory) {
			logrus.Warnf("WorkDir %s invalid,  jobName: %s", singleJobWorkingDirectory, singleJobJobName)
			continue
		}
		singleJobAccount := singleJobInfo[1]
		singleJobUserName := singleJobInfo[13]
		singleJobId, _ := strconv.Atoi(singleJobInfo[2])
		singleJobStartTime := singleJobInfo[11]
		singleJobState := singleJobInfo[12]
		singleJobJobPartition := singleJobInfo[9]
		singleJobQos := singleJobInfo[10]

		// 优化时间限制处理
		if singleJobInfo[6] == "UNLIMITED" {
			jobTimeLimitMinutes = 0
		} else if singleJobInfo[6] == "INVALID" {
			if timeLimit, exists := timeLimitsMap[singleJobId]; exists {
				jobTimeLimitMinutes = timeLimit
			} else {
				jobTimeLimitMinutes = 0
			}
		} else {
			jobTimeLimitMinutes = GetTimeLimit(singleJobInfo[6])
		}

		// 优化提交时间处理
		if submitTime, exists := submitTimesMap[singleJobId]; exists {
			jobTimeSubmit = &timestamppb.Timestamp{Seconds: submitTime}
		} else {
			jobTimeSubmit = &timestamppb.Timestamp{Seconds: time.Now().Unix()}
		}

		singleJobJobNodesAllocTemp, _ := strconv.Atoi(singleJobInfo[4])
		jobNodesReq = int32(singleJobJobNodesAllocTemp)
		jobNodesAlloc = jobNodesReq

		singleJobCpusAllocTemp, _ := strconv.Atoi(singleJobInfo[3])
		jobCpusReq = int32(singleJobCpusAllocTemp)
		jobCpusAlloc = jobCpusReq

		jobMemReq = GetMemoryInMb(singleJobInfo[7])
		jobMemAlloc = jobMemReq

		if singleJobState == "PENDING" {
			jobNodesAlloc = 0
			reason, ok := pendingReasonMap[singleJobId]
			if ok {
				// 使用预编译的正则表达式
				match := accountPermissionRegex.FindString(reason)
				if match != "" {
					jobReason = match
				} else {
					jobReason = reason
				}
			}
			jobCpusAlloc = 0
			jobMemAlloc = 0
			jobElapsedSeconds = 0
			jobInfoNodeList = "None assigned"
		} else {
			jobReason = singleJobInfo[12]
			jobElapsedSeconds = GetRunningElapsedSeconds(singleJobInfo[8])
			jobInfoNodeList = singleJobInfo[16]
			jobTimeStart = ConvertJobStartTime(singleJobStartTime)
		}

		// 在正在运行中的作业添加gpu分配逻辑
		if singleJobInfo[0] == "N/A" {
			jobGpusReq = 0
			jobGpusAlloc = 0
		} else {
			perNodeGresAlloc := strings.Split(singleJobInfo[0], ":")
			if len(perNodeGresAlloc) > 0 {
				perNodeGpusNum, _ := strconv.Atoi(perNodeGresAlloc[len(perNodeGresAlloc)-1])
				jobGpusReq = int32(perNodeGpusNum) * jobNodesReq
				jobGpusAlloc = int32(perNodeGpusNum) * jobNodesAlloc
			} else {
				jobGpusReq = 0
				jobGpusAlloc = 0
			}
		}

		jobInfo = append(jobInfo, &pb.JobInfo{
			JobId:            uint32(singleJobId),
			Name:             singleJobJobName,
			Account:          singleJobAccount,
			User:             singleJobUserName,
			Partition:        singleJobJobPartition,
			Qos:              singleJobQos,
			State:            singleJobState,
			CpusReq:          jobCpusReq,
			MemReqMb:         jobMemReq,
			GpusReq:          jobGpusReq,
			NodesReq:         jobNodesReq,
			TimeLimitMinutes: jobTimeLimitMinutes,
			WorkingDirectory: singleJobWorkingDirectory,
			Reason:           &jobReason,
			CpusAlloc:        &jobCpusAlloc,
			MemAllocMb:       &jobMemAlloc,
			NodesAlloc:       &jobNodesAlloc,
			ElapsedSeconds:   &jobElapsedSeconds,
			NodeList:         &jobInfoNodeList,
			StartTime:        jobTimeStart,
			SubmitTime:       jobTimeSubmit,
			GpusAlloc:        &jobGpusAlloc,
		})
	}

	if len(jobInfo) == 0 {
		return &pb.GetJobsResponse{Jobs: jobInfo}, nil
	}

	if in.Sort != nil && len(jobInfo) != 0 {
		var sortKey string
		if in.Sort.GetField() == "" {
			sortKey = "JobId"
		} else {
			sortKey = in.Sort.GetField()
			words := strings.Split(sortKey, "_")
			for i := 0; i < len(words); i++ {
				words[i] = strings.Title(words[i])
			}
			sortKey = strings.Join(words, "")
		}
		sortOrder := in.Sort.GetOrder().String()
		sortJobInfo := SortJobInfo(sortKey, sortOrder, jobInfo)
		return &pb.GetJobsResponse{Jobs: sortJobInfo}, nil
	}
	logrus.Tracef("GetJobs GetJobsResponse is: %v", &pb.GetJobsResponse{Jobs: jobInfo})
	return &pb.GetJobsResponse{Jobs: jobInfo}, nil
}

func GetJobs(in *pb.GetJobsRequest) (*pb.GetJobsResponse, error) {
	logrus.Infof("Start get finished jobs")
	var (
		jobId                                                           uint32
		jobName, account, partition, gresUsed, nodeList                 string
		idQos, state, idUser, count                                     int
		memReq                                                          uint64
		timeLimitMinutes, submitTime, startTime, timeSuspended, endTime int64
		nodesAlloc, cpusReq, gpusReq                                    int32
		workingDirectory, tresAlloc, tresReq                            string
		jobInfo                                                         []*pb.JobInfo
	)
	// 查找SelectType插件的值是否为cons_tres或者cons_res
	isTresOrRes, err := IsTresOrResSelectType()
	if err != nil {
		return nil, fmt.Errorf("failed to get slurm SelectType: %v", err)
	}

	// cpuTresId、memTresId、nodeTresId
	cpuTresId, memTresId, nodeTresId, err := GetCpuMemNodeTresId()
	if err != nil {
		return nil, fmt.Errorf("failed to get slurm cpu memory node tres id in database: %v", err)
	}

	gpuTresIdList, err := GetGpuTresIds()
	if err != nil {
		logrus.Errorf("GetFinishedJobs Failed: %v", err)
		return nil, fmt.Errorf("failed to get slurm gpu tres id in database: %v", err)
	}

	pendingReasonMap, err := GetPendingJobsReason(in.Filter.Users)
	if err != nil {
		logrus.Errorf("GetFinishedJobs failed: %v", err)
		return nil, err
	}

	jobSelectSql, jobSelectTotalSql, params, totalParams := getSelectJobSql(in)
	logrus.Tracef("GetJobs sql: %v, params: %v", jobSelectSql, params)
	rows, err := client.SlurmDB.Query(jobSelectSql, params...)
	if err != nil {
		logrus.Errorf("GetFinishedJobs Failed: %v", err)
		return nil, err
	}
	defer rows.Close()

	// 预分配切片容量以减少内存重新分配
	jobInfo = make([]*pb.JobInfo, 0, 100)

	// 批量收集需要查询的数据
	var jobIds []uint32
	var userIds []int
	var qosIds []int
	var jobDataList []jobRowData
	// 第一遍扫描：收集所有数据
	for rows.Next() {
		err = rows.Scan(&account, &idUser, &cpusReq, &jobName, &jobId, &idQos, &memReq, &nodeList, &nodesAlloc, &partition, &state, &timeLimitMinutes, &submitTime, &startTime, &endTime, &timeSuspended, &gresUsed, &workingDirectory, &tresAlloc, &tresReq)
		if err != nil {
			logrus.Errorf("GetFinishedJobs Failed: %v ", err)
			continue
		}
		logrus.Tracef("GetJobs account: %v, idUser: %v, cpusReq: %v, jobName: %v, jobId: %v, idQos: %v, memReq: %v, nodeList: %v, nodesAlloc: %v, partition: %v, state: %v, "+
			"timeLimitMinutes: %v, submitTime: %v, startTime: %v, endTime: %v, timeSuspended: %v, gresUsed: %v, workingDirectory: %v, tresAlloc: %v, tresReq: %v", account, idUser,
			cpusReq, jobName, jobId, idQos, memReq, nodeList, nodesAlloc, partition, state, timeLimitMinutes, submitTime, startTime, endTime, timeSuspended, gresUsed, workingDirectory, tresAlloc, tresReq)
		// 即使底层数据库按 time_end 返回了预期结束时间命中的作业，也不允许
		// PENDING、RUNNING、SUSPENDED 作业进入后续批量查询和响应组装流程。
		if in.Filter != nil && in.Filter.EndTime != nil && !isFinishedJobState(state) {
			continue
		}
		if ShouldFilterDir(workingDirectory) {
			logrus.Warnf("WorkDir %s invalid, jobName: %s", workingDirectory, jobName)
			continue
		}
		// 收集数据到结构体
		jobData := jobRowData{
			jobId:            jobId,
			jobName:          jobName,
			account:          account,
			partition:        partition,
			gresUsed:         gresUsed,
			nodeList:         nodeList,
			idQos:            idQos,
			state:            state,
			idUser:           idUser,
			memReq:           memReq,
			timeLimitMinutes: timeLimitMinutes,
			submitTime:       submitTime,
			startTime:        startTime,
			timeSuspended:    timeSuspended,
			endTime:          endTime,
			nodesAlloc:       nodesAlloc,
			cpusReq:          cpusReq,
			workingDirectory: workingDirectory,
			tresAlloc:        tresAlloc,
			tresReq:          tresReq,
		}
		jobDataList = append(jobDataList, jobData)

		// 收集需要批量查询的ID
		jobIds = append(jobIds, jobId)
		userIds = append(userIds, idUser)
		qosIds = append(qosIds, idQos)
	}

	err = rows.Err()
	if err != nil {
		logrus.Errorf("GetFinishedJobs failed: %v", err)
		return nil, err
	}

	// 批量查询用户名和QoS名称
	userNameMap, err := GetUserNamesByUids(userIds)
	if err != nil {
		logrus.Errorf("Failed to get user names: %v", err)
		// 如果批量查询失败，使用空map，后续单独查询
		userNameMap = make(map[int]string)
	}

	qosNameMap, err := GetJobQosNamesByIds(qosIds)
	if err != nil {
		logrus.Errorf("Failed to get qos names: %v", err)
		// 如果批量查询失败，使用空map，后续单独查询
		qosNameMap = make(map[int]string)
	}

	// 批量查询需要单独获取reason的作业
	var needReasonJobIds []uint32
	for _, jobData := range jobDataList {
		if (jobData.state == 0 || jobData.state == 2) && pendingReasonMap[int(jobData.jobId)] == "" {
			needReasonJobIds = append(needReasonJobIds, jobData.jobId)
		} else if jobData.state == 1 {
			needReasonJobIds = append(needReasonJobIds, jobData.jobId)
		}
	}

	reasonMap, err := GetJobsReasonByIds(needReasonJobIds)
	if err != nil {
		logrus.Errorf("Failed to get job reasons: %v", err)
		// 如果批量查询失败，使用空map，后续单独查询
		reasonMap = make(map[uint32]string)
	}

	// 第二遍处理：构建JobInfo
	for _, jobData := range jobDataList {
		var (
			elapsedSeconds, memAllocMb                    int64
			reason, stdoutPath, stderrPath, nodeListTemp  string
			gpusAlloc, cpusAlloc, nodeReq, nodesAllocTemp int32
			startTimeTimestamp, endTimeTimestamp          *timestamppb.Timestamp
		)
		stateString := ChangeState(jobData.state)
		submitTimeTimestamp := &timestamppb.Timestamp{Seconds: time.Unix(jobData.submitTime, 0).Unix()}
		if jobData.startTime != 0 {
			startTimeTimestamp = &timestamppb.Timestamp{Seconds: time.Unix(jobData.startTime, 0).Unix()}
		}
		if jobData.endTime != 0 {
			endTimeTimestamp = &timestamppb.Timestamp{Seconds: time.Unix(jobData.endTime, 0).Unix()}
		}

		// 使用批量查询的结果
		userName := userNameMap[jobData.idUser]
		if userName == "" {
			// 如果批量查询没有结果，回退到单独查询
			userName, _ = GetUserNameByUid(jobData.idUser)
		}

		qosName := qosNameMap[jobData.idQos]
		if qosName == "" {
			// 如果批量查询没有结果，回退到单独查询
			qosName = GetJobQosName(jobData.idQos)
		}

		nodesAllocTemp = jobData.nodesAlloc
		nodeListTemp = jobData.nodeList

		// 统一的GPU分配计算函数
		calculateGpusAlloc := func() int32 {
			if !isTresOrRes || len(gpuTresIdList) == 0 {
				return 0
			}
			return GetGpuCountsFromGpuIdList(jobData.tresAlloc, gpuTresIdList)
		}

		calculateGpusReq := func() int32 {
			if !isTresOrRes || len(gpuTresIdList) == 0 {
				return 0
			}
			return GetGpuCountsFromGpuIdList(jobData.tresReq, gpuTresIdList)
		}

		if jobData.state == 0 || jobData.state == 2 {
			// 获取reason
			if pendingReason, ok := pendingReasonMap[int(jobData.jobId)]; ok {
				reason = pendingReason
			} else if batchReason, ok := reasonMap[jobData.jobId]; ok {
				reason = batchReason
				if reason == "" {
					continue // 一般是数据库中有的作业但是squeue中查不到的作业
				}
				// 使用预编译的正则表达式
				if match := accountPermissionRegex.FindString(reason); match != "" {
					reason = match
				}
			} else {
				// 回退到单独查询
				reason, err = GetJobsReasonById(jobData.jobId)
				if err != nil {
					logrus.Errorf("get job: %v reason info failed, error: %v", jobData.jobId, err)
					return nil, fmt.Errorf("get job reason failed: %v", err)
				}
				if reason == "" {
					continue
				}
				if match := accountPermissionRegex.FindString(reason); match != "" {
					reason = match
				}
			}

			if jobData.state == 0 {
				cpusAlloc = 0
				memAllocMb = 0
				nodeReq = int32(GetResInfoNumFromTresInfo(jobData.tresReq, nodeTresId))
				gpusReq = calculateGpusReq()
				elapsedSeconds = 0
				gpusAlloc = 0
			} else {
				cpusAlloc = int32(GetResInfoNumFromTresInfo(jobData.tresAlloc, cpuTresId))
				memAllocMb = int64(GetResInfoNumFromTresInfo(jobData.tresAlloc, memTresId))
				nodeReq = jobData.nodesAlloc
				gpusReq = calculateGpusReq()
				elapsedSeconds = time.Now().Unix() - jobData.startTime
				gpusAlloc = calculateGpusAlloc()
			}
		} else if jobData.state == 1 {
			// 运行中的作业
			if batchReason, ok := reasonMap[jobData.jobId]; ok {
				if batchReason == "" {
					continue
				}
			} else {
				// 回退到单独查询
				reason, err = GetJobsReasonById(jobData.jobId)
				if err != nil {
					logrus.Errorf("get job: %v reason info failed, error: %v", jobData.jobId, err)
					return nil, fmt.Errorf("get job reason failed: %v", err)
				}
				if reason == "" {
					continue
				}
			}
			reason = "Running"
			cpusAlloc = int32(GetResInfoNumFromTresInfo(jobData.tresAlloc, cpuTresId))
			memAllocMb = int64(GetResInfoNumFromTresInfo(jobData.tresAlloc, memTresId))
			nodeReq = jobData.nodesAlloc
			gpusReq = calculateGpusReq()
			elapsedSeconds = time.Now().Unix() - jobData.startTime
			gpusAlloc = calculateGpusAlloc()
		} else {
			// 已完成的作业
			reason = "end of job"
			cpusAlloc = int32(GetResInfoNumFromTresInfo(jobData.tresAlloc, cpuTresId))
			memAllocMb = int64(GetResInfoNumFromTresInfo(jobData.tresAlloc, memTresId))
			nodeReq = jobData.nodesAlloc
			gpusReq = calculateGpusReq()
			if jobData.startTime != 0 && jobData.endTime != 0 {
				elapsedSeconds = jobData.endTime - jobData.startTime
			}
			gpusAlloc = calculateGpusAlloc()
		}
		// 低版本slurm mem_req 默认值转换为0
		if jobData.memReq == 0 || jobData.memReq > 4000000000 {
			jobData.memReq = uint64(GetResInfoNumFromTresInfo(jobData.tresReq, memTresId))
		}
		if len(in.Fields) == 0 {
			jobInfo = append(jobInfo, &pb.JobInfo{
				JobId:            jobData.jobId,
				Name:             jobData.jobName,
				Account:          jobData.account,
				User:             userName,
				Partition:        jobData.partition,
				Qos:              qosName,
				State:            stateString,
				CpusReq:          jobData.cpusReq,
				GpusReq:          gpusReq,
				MemReqMb:         int64(jobData.memReq),
				TimeLimitMinutes: jobData.timeLimitMinutes,
				SubmitTime:       submitTimeTimestamp,
				WorkingDirectory: jobData.workingDirectory,
				NodeList:         &nodeListTemp,
				StartTime:        startTimeTimestamp,
				EndTime:          endTimeTimestamp,
				StdoutPath:       &stdoutPath,
				StderrPath:       &stderrPath,
				NodesReq:         nodeReq,
				ElapsedSeconds:   &elapsedSeconds,
				Reason:           &reason,
				CpusAlloc:        &cpusAlloc,
				MemAllocMb:       &memAllocMb,
				GpusAlloc:        &gpusAlloc,
				NodesAlloc:       &nodesAllocTemp,
			})
			logrus.Tracef("GetJobs jobInfo is: %v", jobInfo)
		} else {
			subJobInfo := &pb.JobInfo{}
			for _, field := range in.Fields {
				switch field {
				case "job_id":
					subJobInfo.JobId = jobData.jobId
				case "name":
					subJobInfo.Name = jobData.jobName
				case "account":
					subJobInfo.Account = jobData.account
				case "user":
					subJobInfo.User = userName
				case "partition":
					subJobInfo.Partition = jobData.partition
				case "qos":
					subJobInfo.Qos = qosName
				case "state":
					subJobInfo.State = stateString
				case "cpus_req":
					subJobInfo.CpusReq = jobData.cpusReq
				case "gpus_req":
					subJobInfo.GpusReq = gpusReq
				case "mem_req_mb":
					subJobInfo.MemReqMb = int64(jobData.memReq)
				case "nodes_req":
					subJobInfo.NodesReq = nodeReq
				case "time_limit_minutes":
					subJobInfo.TimeLimitMinutes = jobData.timeLimitMinutes
				case "submit_time":
					subJobInfo.SubmitTime = submitTimeTimestamp
				case "working_directory":
					subJobInfo.WorkingDirectory = jobData.workingDirectory
				case "stdout_path":
					subJobInfo.StdoutPath = &stdoutPath
				case "stderr_path":
					subJobInfo.StderrPath = &stderrPath
				case "start_time":
					subJobInfo.StartTime = startTimeTimestamp
				case "elapsed_seconds":
					subJobInfo.ElapsedSeconds = &elapsedSeconds
				case "reason":
					subJobInfo.Reason = &reason
				case "node_list":
					subJobInfo.NodeList = &nodeListTemp
				case "gpus_alloc":
					subJobInfo.GpusAlloc = &gpusAlloc
				case "cpus_alloc":
					subJobInfo.CpusAlloc = &cpusAlloc
				case "mem_alloc_mb":
					subJobInfo.MemAllocMb = &memAllocMb
				case "nodes_alloc":
					subJobInfo.NodesAlloc = &nodesAllocTemp
				case "end_time":
					subJobInfo.EndTime = endTimeTimestamp
				}
			}
			logrus.Tracef("GetJobs jobInfo by fields: %v", in.Fields)
			jobInfo = append(jobInfo, subJobInfo)
			logrus.Tracef("GetJobs jobInfo is: %v", jobInfo)
		}
	}

	// 获取总的页数逻辑
	if jobSelectTotalSql != "" {
		client.SlurmDB.QueryRow(jobSelectTotalSql, totalParams...).Scan(&count)
		totalCount := uint32(count)
		logrus.Tracef("GetFinishedJobs GetJobsResponse is: %v", &pb.GetJobsResponse{Jobs: jobInfo, TotalCount: &totalCount})
		return &pb.GetJobsResponse{Jobs: jobInfo, TotalCount: &totalCount}, nil
	}
	logrus.Tracef("GetFinishedJobs GetJobsResponse is: %v", &pb.GetJobsResponse{Jobs: jobInfo})
	return &pb.GetJobsResponse{Jobs: jobInfo}, nil
}

// GetUserNamesByUids 批量获取用户名
func GetUserNamesByUids(uids []int) (map[int]string, error) {
	result := make(map[int]string)
	if len(uids) == 0 {
		return result, nil
	}

	// 去重
	uidSet := make(map[int]bool)
	for _, uid := range uids {
		uidSet[uid] = true
	}

	for uid := range uidSet {
		userName, err := GetUserNameByUid(uid)
		if err == nil {
			result[uid] = userName
		}
	}

	return result, nil
}

// GetJobQosNamesByIds 批量获取QoS名称
func GetJobQosNamesByIds(qosIds []int) (map[int]string, error) {
	result := make(map[int]string)
	if len(qosIds) == 0 {
		return result, nil
	}

	// 去重
	qosIdSet := make(map[int]bool)
	for _, qosId := range qosIds {
		qosIdSet[qosId] = true
	}

	// 构建批量查询SQL
	if len(qosIdSet) == 0 {
		return result, nil
	}

	placeholders := make([]string, 0, len(qosIdSet))
	args := make([]interface{}, 0, len(qosIdSet))
	for qosId := range qosIdSet {
		placeholders = append(placeholders, "?")
		args = append(args, qosId)
	}

	query := fmt.Sprintf("SELECT id, name FROM qos_table WHERE id IN (%s) AND deleted = 0", strings.Join(placeholders, ","))
	rows, err := client.SlurmDB.Query(query, args...)
	if err != nil {
		return result, err
	}
	defer rows.Close()

	for rows.Next() {
		var qosId int
		var qosName string
		if err := rows.Scan(&qosId, &qosName); err != nil {
			continue
		}
		result[qosId] = qosName
	}

	return result, nil
}

// GetJobsReasonByIds 批量获取作业原因
func GetJobsReasonByIds(jobIds []uint32) (map[uint32]string, error) {
	result := make(map[uint32]string)
	if len(jobIds) == 0 {
		return result, nil
	}

	// 去重
	jobIdSet := make(map[uint32]bool)
	for _, jobId := range jobIds {
		jobIdSet[jobId] = true
	}

	// 批量查询，每次最多查询100个作业
	batchSize := 100
	jobIdList := make([]uint32, 0, len(jobIdSet))
	for jobId := range jobIdSet {
		jobIdList = append(jobIdList, jobId)
	}

	for i := 0; i < len(jobIdList); i += batchSize {
		end := i + batchSize
		if end > len(jobIdList) {
			end = len(jobIdList)
		}

		batch := jobIdList[i:end]
		if len(batch) == 0 {
			continue
		}

		// 构建squeue命令参数
		jobIdStrs := make([]string, len(batch))
		for j, jobId := range batch {
			jobIdStrs[j] = strconv.Itoa(int(jobId))
		}

		args := []string{"-j", strings.Join(jobIdStrs, ","), "--noheader", "--format=%i=%R"}
		exitCode, stdout, stderr, err := ExecuteCommand(client.SQUEUE, args...)
		if err != nil {
			if exitCode == -1 {
				return result, fmt.Errorf("system error: %v", err)
			} else {
				// 部分作业可能不存在，继续处理其他作业
				if !strings.Contains(stderr, "Invalid job id") {
					logrus.Warnf("get jobs reason failed (exit %d), stdout: %s, stderr: %s", exitCode, stdout, strings.TrimSpace(stderr))
				}
				continue
			}
		}

		// 解析输出
		lines := strings.Split(strings.TrimSpace(stdout), "\n")
		for _, line := range lines {
			if line == "" {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				if jobId, err := strconv.ParseUint(parts[0], 10, 32); err == nil {
					result[uint32(jobId)] = parts[1]
				}
			}
		}
	}

	return result, nil
}

// IsGetUnfinishedJobs 查询未结束作业
func IsGetUnfinishedJobs(in *pb.GetJobsRequest) bool {
	if in.Filter.States == nil {
		return false
	}

	var baseStates = []string{"RUNNING", "PENDING", "SUSPENDED"}
	if IsSubSet(baseStates, in.Filter.States) {
		return true
	}
	return false
}

func getSelectJobSql(in *pb.GetJobsRequest) (string, string, []interface{}, []interface{}) {
	var (
		startTimeFilter, endTimeFilter, submitStartTime, submitEndTime int64
		pageLimit                                                      int
		uidList, stateIdList                                           []int
		jobSelectSql, jobSelectTotalSql                                string
		params, totalParams                                            []interface{}
		orderStr, accountsString, uidListString, stateIdListString     string
	)

	if in.Sort != nil {
		orderStr = fmt.Sprintf("ORDER BY job_db_inx %s", in.Sort.GetOrder().String())
	} else {
		orderStr = "ORDER BY job_db_inx ASC" // 默认就是升序排序
	}

	clusterName := config.SlurmValue.MySQLConfig.ClusterName
	if in.Filter != nil {
		if in.Filter.EndTime != nil {
			startTimeFilter = in.Filter.EndTime.StartTime.GetSeconds()
			endTimeFilter = in.Filter.EndTime.EndTime.GetSeconds()
		}
		if in.Filter.SubmitTime != nil {
			submitStartTime = in.Filter.SubmitTime.StartTime.GetSeconds()
			submitEndTime = in.Filter.SubmitTime.EndTime.GetSeconds()
		}
		if in.Filter.Accounts != nil {
			accountsString = "'" + strings.Join(in.Filter.Accounts, "','") + "'"
		}
		if in.Filter.Users != nil {
			for _, user := range in.Filter.Users {
				uid, _, _ := GetUserUidGid(user)
				uidList = append(uidList, uid)
			}
			uidListString = strings.Trim(strings.Join(strings.Fields(fmt.Sprint(uidList)), ","), "[]")
		}
		if in.Filter.States != nil {
			for _, state := range in.Filter.States {
				stateId, err := GetStateId(state)
				if err != nil {
					logrus.Warnf("invalid state %q: %v", state, err)
					continue
				}
				stateIdList = append(stateIdList, stateId)
			}
			stateIdListString = strings.Trim(strings.Join(strings.Fields(fmt.Sprint(stateIdList)), ","), "[]")
		}

		baseSQL := fmt.Sprintf("SELECT account, id_user, cpus_req, job_name, id_job, id_qos, mem_req, nodelist, nodes_alloc, `partition`, state, timelimit, time_submit, time_start, time_end, time_suspended, gres_used, work_dir, tres_alloc, tres_req FROM %s_job_table WHERE ", clusterName)
		databaseEncode := config.SlurmValue.MySQLConfig.DatabaseEncode
		logrus.Tracef("Database encode is: %s", databaseEncode)
		// 正常情况下，数据库编码格式是latin1，环境部署时config.yaml中databaseEncode也会配成latin1。 但是为了防止config.yaml中databaseEncode配成utf8，查询时需要做这样的转换。
		if strings.Contains(databaseEncode, "utf8") {
			baseSQL = fmt.Sprintf("SELECT account, id_user, cpus_req, CONVERT(CAST(job_name AS BINARY) USING utf8) AS job_name, id_job, id_qos, mem_req, nodelist, nodes_alloc, `partition`, state, timelimit, time_submit, time_start, time_end, time_suspended, gres_used, CONVERT(CAST(work_dir AS BINARY) USING utf8) AS work_dir, tres_alloc, tres_req FROM %s_job_table WHERE ", clusterName)
		}

		var conditions []string

		if uidListString != "" {
			conditions = append(conditions, fmt.Sprintf("id_user IN (%s)", uidListString))
		}
		if stateIdListString != "" {
			conditions = append(conditions, fmt.Sprintf("state IN (%s)", stateIdListString))
		}
		if accountsString != "" {
			conditions = append(conditions, fmt.Sprintf("account IN (%s)", accountsString))
		}
		// Slurm 会为未结束作业保存预期 time_end。EndTime 查询必须同时限制为终态，
		// 并让列表 SQL 与 count SQL 复用该条件，避免分页缺项和 TotalCount 偏大。
		if in.Filter.EndTime != nil {
			conditions = append(conditions, fmt.Sprintf("state IN (%s)", jobStateIDsString(finishedJobStates)))
		}
		if startTimeFilter != 0 {
			conditions = append(conditions, "(time_end >= ? OR ? = 0)")
			params = append(params, startTimeFilter, startTimeFilter)
			totalParams = append(totalParams, startTimeFilter, startTimeFilter)
		}
		if endTimeFilter != 0 {
			conditions = append(conditions, "(time_end <= ? OR ? = 0)")
			params = append(params, endTimeFilter, endTimeFilter)
			totalParams = append(totalParams, endTimeFilter, endTimeFilter)
		}
		if submitStartTime != 0 {
			conditions = append(conditions, "(time_submit >= ? OR ? = 0)")
			params = append(params, submitStartTime, submitStartTime)
			totalParams = append(totalParams, submitStartTime, submitStartTime)
		}
		if submitEndTime != 0 {
			conditions = append(conditions, "(time_submit <= ? OR ? = 0)")
			params = append(params, submitEndTime, submitEndTime)
			totalParams = append(totalParams, submitEndTime, submitEndTime)
		}
		if in.Filter.JobId != nil {
			conditions = append(conditions, "id_job = ?")
			params = append(params, *in.Filter.JobId)
			totalParams = append(totalParams, *in.Filter.JobId)
		}
		if in.Filter.JobName != nil {
			conditions = append(conditions, "CONVERT(CAST(job_name AS BINARY) USING utf8) = ?")
			params = append(params, *in.Filter.JobName)
			totalParams = append(totalParams, *in.Filter.JobName)
		}
		queryConditions := strings.Join(conditions, " AND ")
		if in.PageInfo != nil {
			// 分页的情况
			page := in.PageInfo.Page
			pageSize := in.PageInfo.PageSize
			pageLimit = int(pageSize)
			if page == 1 {
				pageSize = 0
			} else {
				pageSize = pageSize * uint64(page-1)
			}
			jobSelectSql = fmt.Sprintf("%s %s %s LIMIT ? OFFSET ?", baseSQL, queryConditions, orderStr)
			params = append(params, pageLimit, pageSize)
			jobSelectTotalSql = fmt.Sprintf("SELECT count(*) FROM %s_job_table WHERE %s", clusterName, queryConditions)
		} else {
			// 不分页的情况
			jobSelectSql = fmt.Sprintf("%s %s %s", baseSQL, queryConditions, orderStr)
			jobSelectTotalSql = fmt.Sprintf("SELECT count(*) FROM %s_job_table WHERE %s", clusterName, queryConditions)
		}

		return jobSelectSql, jobSelectTotalSql, params, totalParams
	}

	// 没有搜索条件
	baseSQL := fmt.Sprintf("SELECT account, id_user, cpus_req, job_name, id_job, id_qos, mem_req, nodelist, nodes_alloc, `partition`, state, timelimit, time_submit, time_start, time_end, time_suspended, gres_used, work_dir, tres_alloc, tres_req FROM %s_job_table ", clusterName)
	databaseEncode := config.SlurmValue.MySQLConfig.DatabaseEncode
	logrus.Tracef("Database encode is: %s", databaseEncode)
	// 正常情况下，数据库编码格式是latin1，环境部署时config.yaml中databaseEncode也会配成latin1。 但是为了防止config.yaml中databaseEncode配成utf8，查询时需要做这样的转换。
	if strings.Contains(databaseEncode, "utf8") {
		baseSQL = fmt.Sprintf("SELECT account, id_user, cpus_req, CONVERT(CAST(job_name AS BINARY) USING utf8) AS job_name, id_job, id_qos, mem_req, nodelist, nodes_alloc, `partition`, state, timelimit, time_submit, time_start, time_end, time_suspended, gres_used, CONVERT(CAST(work_dir AS BINARY) USING utf8) AS work_dir, tres_alloc, tres_req FROM %s_job_table WHERE ", clusterName)
	}

	if in.PageInfo != nil {
		// 分页的情况 没有搜索的情况
		page := in.PageInfo.Page
		pageSize := in.PageInfo.PageSize
		pageLimit = int(pageSize)
		if page == 1 {
			pageSize = 0
		} else {
			pageSize = pageSize * uint64(page-1)
		}
		jobSelectSql = fmt.Sprintf("%s %s LIMIT ? OFFSET ?", baseSQL, orderStr)
		params = append(params, pageLimit, pageSize)
		jobSelectTotalSql = fmt.Sprintf("SELECT count(*) FROM %s_job_table", clusterName) // 总的作业条数
	} else {
		// 不分页的情况 没有搜索的情况
		jobSelectSql = fmt.Sprintf("%s %s", baseSQL, orderStr)
		jobSelectTotalSql = fmt.Sprintf("SELECT count(*) FROM %s_job_table", clusterName) // 总的作业条数
	}
	return jobSelectSql, jobSelectTotalSql, params, totalParams
}

// isValidJobInfo 判断是否为合法的作业信息
// squeue --format='%b %a %A %C %D %j %l %m %M %P %q %S %T %u %V %Z %N' 查询作业各参数之间可能不是单个空格，因此需要使用strings.Fields(jobInfo)
// Pending作业%N值为空的，照顾这种情况需要使用strings.Split(jobInfo, " ")
func isValidJobInfo(jobInfo string, length int) bool {
	if strings.TrimSpace(jobInfo) == "" {
		return false
	}

	if len(strings.Split(jobInfo, " ")) != length {
		return false
	}
	return true
}

// ShouldFilterDir 返回 true 表示该目录应被过滤
func ShouldFilterDir(dir string) bool {

	var percentEncodedPattern = regexp.MustCompile(`(?i)%[0-9a-f]{2}`)
	// 常见“格式转换乱码”片段
	var mojibakeFragments = []string{
		// UTF-8 被当成 Latin1 / Windows-1252 解码
		"Ã", "Â", "Ð", "Ñ", "Ò", "Ó", "Ô", "Õ", "Ö",
		"Ø", "Ù", "Ú", "Û", "Ü", "Ý", "Þ",
		// 常见组合
		"Ã©", "Ã¨", "Ãª", "Ã«", "Ã¤", "Ã¶", "Ã¼", "Ã±", "ÃŸ",
		"Â¥", "Â£", "Â¢", "Â©", "Â®", "Â°", "Â·",
		// GBK/GB2312 误转后的高频乱码
		"¼", "½", "¾", "¿", "À", "Á", "Ä", "Å", "Æ", "Ç", "È", "É", "Ê", "Ë", "Ì", "Í",
		// 替换字符
		"�",
	}
	logrus.Tracef("Checking directory: %s", dir)
	// 1. 真正非法 UTF-8
	if !utf8.ValidString(dir) {
		logrus.Errorf("Directory is not valid UTF-8: %s", dir)
		return true
	}

	// 2. URL 编码残留
	if percentEncodedPattern.MatchString(dir) {
		if decoded, err := url.PathUnescape(dir); err == nil && decoded != dir {
			logrus.Errorf("Directory contains percent-encoded bytes: %s", dir)
			return true
		}
		logrus.Errorf("Directory contains suspicious percent-encoded fragments: %s", dir)
		return true
	}

	// 3. 明显乱码片段
	for _, frag := range mojibakeFragments {
		if strings.Contains(dir, frag) {
			logrus.Errorf("Directory contains mojibake fragment '%s': %s", frag, dir)
			return true
		}
	}
	logrus.Tracef("Checking directory successful: %s", dir)
	return false
}
