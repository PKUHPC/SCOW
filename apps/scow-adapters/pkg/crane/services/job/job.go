package job

import (
	"bufio"
	"context"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc/codes"
	"google.golang.org/protobuf/types/known/timestamppb"

	craneProtos "scow-adapters/gen/crane"
	protos "scow-adapters/gen/go"
	ce "scow-adapters/pkg/common/error"
	"scow-adapters/pkg/crane/client"
	"scow-adapters/pkg/crane/utils"
)

const maxUint = 4294967295

type ServerJob struct {
	protos.UnimplementedJobServiceServer
}

func (s *ServerJob) CancelJob(ctx context.Context, in *protos.CancelJobRequest) (*protos.CancelJobResponse, error) {
	logrus.Infof("Received request CancelJob: %v", in)
	request := &craneProtos.CancelTaskRequest{
		OperatorUid:   0,
		FilterTaskIds: []uint32{uint32(in.JobId)},
		FilterState:   craneProtos.TaskStatus_Invalid,
	}
	_, err := client.CraneCtld.CancelTask(context.Background(), request)
	if err != nil {
		logrus.Errorf("CancelJob failed: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", "Crane service call failed.")
	}
	logrus.Infof("CancelJob job: %v success", in.JobId)
	return &protos.CancelJobResponse{}, nil
}

func (s *ServerJob) QueryJobTimeLimit(ctx context.Context, in *protos.QueryJobTimeLimitRequest) (*protos.QueryJobTimeLimitResponse, error) {
	var (
		jobIdList []uint32
		seconds   uint64
	)
	logrus.Infof("Received request QueryJobTimeLimit: %v", in)

	jobIdList = append(jobIdList, in.JobId)
	request := &craneProtos.QueryTasksInfoRequest{
		FilterTaskIds:               jobIdList,
		OptionIncludeCompletedTasks: true, // 包含运行结束的作业
	}
	response, err := client.CraneCtld.QueryTasksInfo(context.Background(), request)
	if err != nil {
		logrus.Errorf("QueryJobTimeLimit failed: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", err.Error())
	}
	taskInfoList := response.GetTaskInfoList()
	if len(taskInfoList) == 0 {
		message := fmt.Sprintf("Task #%d was not found in crane.", in.JobId)
		logrus.Errorf("QueryJobTimeLimit failed: %v", message)
		return nil, ce.RichError(codes.NotFound, "JOB_NOT_FOUND", message)
	}
	if response.GetOk() {
		for _, taskInfo := range taskInfoList {
			timeLimit := taskInfo.GetTimeLimit()
			seconds = uint64(timeLimit.GetSeconds())
		}
		logrus.Tracef("QueryJobTimeLimit job: %v, TimeLimitMinutes: %v", in.JobId, seconds/60)
		return &protos.QueryJobTimeLimitResponse{TimeLimitMinutes: seconds / 60}, nil
	}
	return nil, ce.RichError(codes.Internal, "CRANE_INTERNAL_ERROR", "Get job timelimit failed.")
}

func (s *ServerJob) ChangeJobTimeLimit(ctx context.Context, in *protos.ChangeJobTimeLimitRequest) (*protos.ChangeJobTimeLimitResponse, error) {
	var (
		jobIdList []uint32
		seconds   uint64
	)
	logrus.Infof("Received request ChangeJobTimeLimit: %v", in)
	// 查询请求体
	jobIdList = append(jobIdList, in.JobId)
	requestLimitTime := &craneProtos.QueryTasksInfoRequest{
		FilterTaskIds: jobIdList,
	}

	responseLimitTime, err := client.CraneCtld.QueryTasksInfo(context.Background(), requestLimitTime)
	if err != nil {
		logrus.Errorf("ChangeJobTimeLimit failed: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", err.Error())
	}

	taskInfoList := responseLimitTime.GetTaskInfoList()
	if len(taskInfoList) == 0 {
		message := fmt.Sprintf("Task #%d was not found in crane.", in.JobId)
		logrus.Errorf("ChangeJobTimeLimit failed: %v", message)
		return nil, ce.RichError(codes.NotFound, "JOB_NOT_FOUND", message)
	}
	if responseLimitTime.GetOk() {
		for _, taskInfo := range taskInfoList {
			timeLimit := taskInfo.GetTimeLimit()
			seconds = uint64(timeLimit.GetSeconds())
		}
	}

	// 如果小于0的话直接返回
	if in.DeltaMinutes*60+int64(seconds) <= 0 {
		return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", "Time limit should be greater than 0.")
	}
	// 修改时长限制的请求体
	request := &craneProtos.ModifyTaskRequest{
		TaskIds: []uint32{in.JobId},
		Value: &craneProtos.ModifyTaskRequest_TimeLimitSeconds{
			TimeLimitSeconds: in.DeltaMinutes*60 + int64(seconds),
		},
	}
	response, err := client.CraneCtld.ModifyTask(context.Background(), request)
	if err != nil {
		logrus.Errorf("ChangeJobTimeLimit failed: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", err.Error())
	}
	if len(response.GetNotModifiedTasks()) != 0 {
		logrus.Errorf("ChangeJobTimeLimit failed: %v", fmt.Errorf("JOB_NOT_FOUND"))
		return nil, ce.RichError(codes.NotFound, "JOB_NOT_FOUND", response.GetNotModifiedReasons()[0])
	}
	logrus.Tracef("ChangeJobTimeLimit success! job: %v, TimeLimitMinutes: %v", in.JobId, in.DeltaMinutes)
	return &protos.ChangeJobTimeLimitResponse{}, nil
}

func (s *ServerJob) GetJobById(ctx context.Context, in *protos.GetJobByIdRequest) (*protos.GetJobByIdResponse, error) {
	var (
		elapsedSeconds int64
		state          string
		reason         string
		startTime      *timestamppb.Timestamp
		endTime        *timestamppb.Timestamp
	)
	logrus.Infof("Received request GetJobById: %v", in)
	request := &craneProtos.QueryTasksInfoRequest{
		FilterTaskIds:               []uint32{uint32(in.JobId)},
		OptionIncludeCompletedTasks: true,
	}
	response, err := client.CraneCtld.QueryTasksInfo(context.Background(), request)
	if err != nil {
		logrus.Errorf("GetJobById failed: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", err.Error())
	}
	if !response.GetOk() {
		logrus.Errorf("GetJobById failed: %v", fmt.Errorf("CRANE_INTERNAL_ERROR"))
		return nil, ce.RichError(codes.Internal, "CRANE_INTERNAL_ERROR", "Crane service internal error.")
	}
	if len(response.GetTaskInfoList()) == 0 {
		logrus.Errorf("GetJobById failed: %v", fmt.Errorf("JOB_NOT_FOUND"))
		return nil, ce.RichError(codes.NotFound, "JOB_NOT_FOUND", "The job not found in crane.")
	}
	// 获取作业信息
	TaskInfoList := response.GetTaskInfoList()[0]
	if TaskInfoList.GetStatus() == craneProtos.TaskStatus_Running {
		startTime = TaskInfoList.GetStartTime()
		elapsedSeconds = time.Now().Unix() - TaskInfoList.GetStartTime().Seconds
	} else if TaskInfoList.GetStatus() == craneProtos.TaskStatus_Pending {
		elapsedSeconds = 0
	} else {
		if TaskInfoList.GetNodeNum() != 0 {
			startTime = TaskInfoList.GetStartTime()
		}
		elapsedSeconds = TaskInfoList.GetEndTime().Seconds - TaskInfoList.GetStartTime().Seconds
	}

	// 获取cpu核分配数
	// cpusAlloc := TaskInfoList.GetAllocCpus()
	cpusAlloc := TaskInfoList.GetResView().GetAllocatableRes().CpuCoreLimit
	cpusAllocInt32 := int32(cpusAlloc)
	// 获取节点列表
	nodeList := TaskInfoList.GetCranedList()

	if TaskInfoList.GetStatus().String() == "Completed" {
		state = "COMPLETED"
		reason = "ENDED"
		endTime = TaskInfoList.GetEndTime()
	} else if TaskInfoList.GetStatus().String() == "Failed" {
		state = "FAILED"
		reason = "ENDED"
		endTime = TaskInfoList.GetEndTime()
	} else if TaskInfoList.GetStatus().String() == "Cancelled" {
		state = "CANCELLED"
		reason = "ENDED"
		endTime = TaskInfoList.GetEndTime()
	} else if TaskInfoList.GetStatus().String() == "Running" {
		state = "RUNNING"
		reason = "Running"
	} else if TaskInfoList.GetStatus().String() == "Pending" {
		state = "PENDING"
		reason = "Pending"
	} else if TaskInfoList.GetStatus().String() == "ExceedTimeLimit" {
		state = "TIMEOUT"
		reason = "Timeout"
		endTime = TaskInfoList.GetEndTime()
	}

	// pending 作业直接被 cancel 时，鹤思不会设置 startTime，导致 startTime 为 epoch(1970)。
	// 此时将 startTime 置为 endTime，elapsedSeconds 置为 0，避免前端展示异常。
	if startTime == nil && endTime != nil {
		logrus.Warnf("[crane-adapter] jobId=%v name=%v user=%v partition=%v status=%v endTime=%v: startTime is nil (possibly pending cancelled), fallback startTime to endTime",
			TaskInfoList.GetTaskId(), TaskInfoList.GetName(), TaskInfoList.GetUsername(), TaskInfoList.GetPartition(), TaskInfoList.GetStatus(), endTime.AsTime().Format(time.RFC3339))
		startTime = endTime
		elapsedSeconds = 0
	}

	if len(in.Fields) == 0 {
		jobInfo := &protos.JobInfo{
			JobId:            TaskInfoList.GetTaskId(),
			Name:             TaskInfoList.GetName(),
			Account:          TaskInfoList.GetAccount(),
			User:             TaskInfoList.GetUsername(),
			Partition:        TaskInfoList.GetPartition(),
			NodeList:         &nodeList,
			StartTime:        startTime,
			EndTime:          endTime,
			TimeLimitMinutes: TaskInfoList.GetTimeLimit().Seconds / 60, // 转换成分钟数
			WorkingDirectory: TaskInfoList.GetCwd(),
			CpusAlloc:        &cpusAllocInt32,
			State:            state,
			ElapsedSeconds:   &elapsedSeconds,
			Reason:           &reason,
			Qos:              TaskInfoList.GetQos(),
			SubmitTime:       TaskInfoList.GetStartTime(),
		}
		return &protos.GetJobByIdResponse{Job: jobInfo}, nil
	}
	jobInfo := &protos.JobInfo{}
	for _, field := range in.Fields {
		switch field {
		case "job_id":
			jobInfo.JobId = TaskInfoList.GetTaskId()
		case "name":
			jobInfo.Name = TaskInfoList.GetName()
		case "account":
			jobInfo.Account = TaskInfoList.GetAccount()
		case "user":
			jobInfo.User = TaskInfoList.GetUsername()
		case "partition":
			jobInfo.Partition = TaskInfoList.GetPartition()
		case "node_list":
			jobInfo.NodeList = &nodeList
		case "start_time":
			jobInfo.StartTime = startTime
		case "end_time":
			jobInfo.EndTime = endTime
		case "time_limit_minutes":
			jobInfo.TimeLimitMinutes = TaskInfoList.GetTimeLimit().Seconds / 60
		case "working_directory":
			jobInfo.WorkingDirectory = TaskInfoList.GetCwd()
		case "cpus_alloc":
			jobInfo.CpusAlloc = &cpusAllocInt32
		case "state":
			jobInfo.State = state
		case "elapsed_seconds":
			jobInfo.ElapsedSeconds = &elapsedSeconds
		case "reason":
			jobInfo.Reason = &reason
		case "qos":
			jobInfo.Qos = TaskInfoList.GetQos()
		case "submit_time":
			jobInfo.SubmitTime = startTime
		}
	}
	logrus.Tracef("GetJobById finished, jobId: %d, name: %s, state: %s, fields: %v", jobInfo.JobId, jobInfo.Name, jobInfo.State, in.Fields)
	return &protos.GetJobByIdResponse{Job: jobInfo}, nil
}

func (s *ServerJob) GetJobs(ctx context.Context, in *protos.GetJobsRequest) (*protos.GetJobsResponse, error) {
	var (
		request  *craneProtos.QueryTasksInfoRequest
		jobsInfo []*protos.JobInfo
		totalNum uint32
	)
	logrus.Infof("Received request GetJobs, fields: %v, has_filter: %t", in.Fields, in.Filter != nil)

	if len(in.JobTypes) > 0 {
		return nil, ce.RichError(codes.Unimplemented, "AI_JOB_TYPES_UNSUPPORTED", "Crane adapter does not support AI job types.")
	}

	if in.Filter != nil {
		base := &craneProtos.QueryTasksInfoRequest{
			FilterTaskStates:            utils.GetCraneStatesList(in.Filter.States),
			FilterUsers:                 in.Filter.Users,
			FilterAccounts:              in.Filter.Accounts,
			OptionIncludeCompletedTasks: true,
			NumLimit:                    99999999,
		}

		if endTimeRange := in.Filter.EndTime; endTimeRange != nil {
			interval := &craneProtos.TimeInterval{}
			if startTime := endTimeRange.StartTime.GetSeconds(); startTime != 0 {
				interval.LowerBound = timestamppb.New(time.Unix(startTime, 0))
			}
			if endTime := endTimeRange.EndTime.GetSeconds(); endTime != 0 {
				interval.UpperBound = timestamppb.New(time.Unix(endTime, 0))
			}
			if interval.LowerBound != nil || interval.UpperBound != nil {
				base.FilterEndTimeInterval = interval
			}
		}

		if submitTimeRange := in.Filter.SubmitTime; submitTimeRange != nil {
			interval := &craneProtos.TimeInterval{}
			if startTime := submitTimeRange.StartTime.GetSeconds(); startTime != 0 {
				interval.LowerBound = timestamppb.New(time.Unix(startTime, 0))
			}
			if endTime := submitTimeRange.EndTime.GetSeconds(); endTime != 0 {
				interval.UpperBound = timestamppb.New(time.Unix(endTime, 0))
			}
			if interval.LowerBound != nil || interval.UpperBound != nil {
				base.FilterSubmitTimeInterval = interval
			}
		}

		if in.Filter.JobName != nil {
			base.FilterTaskNames = []string{*in.Filter.JobName}
		}
		if in.Filter.JobId != nil {
			base.FilterTaskIds = []uint32{*in.Filter.JobId}
		}
		request = base
	} else {
		// 没有筛选条件的请求体
		request = &craneProtos.QueryTasksInfoRequest{
			OptionIncludeCompletedTasks: true,
			NumLimit:                    99999999,
		}
	}
	response, err := client.CraneCtld.QueryTasksInfo(context.Background(), request)

	if err != nil {
		logrus.Errorf("GetJobs failed: %v", fmt.Errorf("CRANE_CALL_FAILED"))
		return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", err.Error())
	}
	if !response.GetOk() {
		logrus.Errorf("GetJobs failed: %v", fmt.Errorf("CRANE_INTERNAL_ERROR"))
		return nil, ce.RichError(codes.Internal, "CRANE_INTERNAL_ERROR", "Crane service internal error.")
	}
	if len(response.GetTaskInfoList()) == 0 {
		logrus.Infof("GetJobs: no Task found")
		totalNum = uint32(len(response.GetTaskInfoList()))
		return &protos.GetJobsResponse{Jobs: jobsInfo, TotalCount: &totalNum}, nil
	}
	totalNum = uint32(len(response.GetTaskInfoList()))
	for _, job := range response.GetTaskInfoList() {
		var elapsedSeconds, timeLimitMinutes int64
		var state string
		var reason = "no reason"
		var nodeNum int32
		var endTime, startTime *timestamppb.Timestamp
		if job.GetStatus() == craneProtos.TaskStatus_Running {
			startTime = job.GetStartTime()
			elapsedSeconds = time.Now().Unix() - job.GetStartTime().Seconds
		} else if job.GetStatus() == craneProtos.TaskStatus_Pending {
			elapsedSeconds = 0
		} else {
			if job.GetNodeNum() != 0 {
				startTime = job.GetStartTime()
			}
			elapsedSeconds = job.GetEndTime().Seconds - job.GetStartTime().Seconds
		}
		cpusAlloc := job.GetResView().GetAllocatableRes().CpuCoreLimit
		cpusAllocInt32 := int32(cpusAlloc)

		jobMemAllocMb := job.GetResView().GetAllocatableRes().MemoryLimitBytes
		memAllocMb := int64(jobMemAllocMb / (1024 * 1024))

		jobGpusAlloc := job.GetResView().GetDeviceMap()
		gpusAlloc := utils.GetGpuNumsFromJob(jobGpusAlloc)

		nodeList := job.GetCranedList()

		if job.GetStatus().String() == "Completed" {
			state = "COMPLETED"
			reason = "ENDED"
			endTime = job.GetEndTime()
		} else if job.GetStatus().String() == "Failed" {
			state = "FAILED"
			reason = "ENDED"
			endTime = job.GetEndTime()
		} else if job.GetStatus().String() == "Cancelled" {
			state = "CANCELLED"
			reason = "ENDED"
			endTime = job.GetEndTime()
		} else if job.GetStatus().String() == "Running" {
			state = "RUNNING"
			reason = "Running"
		} else if job.GetStatus().String() == "Pending" {
			state = "PENDING"
			reason = "Pending"
		} else if job.GetStatus().String() == "ExceedTimeLimit" {
			state = "TIMEOUT"
			reason = "Timeout"
			endTime = job.GetEndTime()
		} else {
			state = "IVALID"
			reason = "Ivalid"
		}
		// pending 作业直接被 cancel 时，鹤思不会设置 startTime，导致 startTime 为 epoch(1970)。
		// 此时将 startTime 置为 endTime，elapsedSeconds 置为 0，避免前端展示异常。
		if startTime == nil && endTime != nil {
			logrus.Warnf("[crane-adapter] jobId=%v name=%v user=%v partition=%v status=%v endTime=%v: startTime is nil (possibly pending→cancelled), fallback startTime to endTime",
				job.GetTaskId(), job.GetName(), job.GetUsername(), job.GetPartition(), job.GetStatus(), endTime.AsTime().Format(time.RFC3339))
			startTime = endTime
			elapsedSeconds = 0
		}
		nodeNum = int32(job.GetNodeNum())

		if job.GetTimeLimit() == nil || (job.GetTimeLimit().Seconds == 0 && job.GetTimeLimit().Nanos == 0) {
			timeLimitMinutes = maxUint
		} else {
			timeLimitMinutes = job.GetTimeLimit().Seconds / 60
			// 因为scow数据库中该值是uint类型的，当作业的TimeLimit大于该值时会插入该作业数据到数据库失败
			if timeLimitMinutes > maxUint {
				timeLimitMinutes = maxUint
			}
		}

		if len(in.Fields) == 0 {
			jobsInfo = append(jobsInfo, &protos.JobInfo{
				JobId:            job.GetTaskId(),
				Name:             job.GetName(),
				Account:          job.GetAccount(),
				User:             job.GetUsername(),
				Partition:        job.GetPartition(),
				StartTime:        startTime,
				EndTime:          endTime,
				NodesAlloc:       &nodeNum,
				TimeLimitMinutes: timeLimitMinutes,
				WorkingDirectory: job.GetCwd(),
				State:            state,
				NodeList:         &nodeList,
				CpusAlloc:        &cpusAllocInt32,
				ElapsedSeconds:   &elapsedSeconds,
				Qos:              job.GetQos(),
				Reason:           &reason,
				SubmitTime:       job.GetSubmitTime(),
				GpusAlloc:        &gpusAlloc,
				MemAllocMb:       &memAllocMb,
			})
		} else {
			subJobInfo := &protos.JobInfo{}
			for _, field := range in.Fields {
				switch field {
				case "job_id":
					subJobInfo.JobId = job.GetTaskId()
				case "name":
					subJobInfo.Name = job.GetName()
				case "account":
					subJobInfo.Account = job.GetAccount()
				case "user":
					subJobInfo.User = job.GetUsername()
				case "partition":
					subJobInfo.Partition = job.GetPartition()
				case "node_list":
					subJobInfo.NodeList = &nodeList
				case "start_time":
					subJobInfo.StartTime = startTime
				case "end_time":
					subJobInfo.EndTime = endTime
				case "time_limit_minutes":
					subJobInfo.TimeLimitMinutes = timeLimitMinutes
				case "working_directory":
					subJobInfo.WorkingDirectory = job.GetCwd()
				case "cpus_req":
					subJobInfo.CpusReq = cpusAllocInt32
				case "cpus_alloc":
					subJobInfo.CpusAlloc = &cpusAllocInt32
				case "state":
					subJobInfo.State = state
				case "elapsed_seconds":
					subJobInfo.ElapsedSeconds = &elapsedSeconds
				case "qos":
					subJobInfo.Qos = job.GetQos()
				case "submit_time":
					subJobInfo.SubmitTime = job.GetSubmitTime()
				case "reason":
					subJobInfo.Reason = &reason
				case "nodes_req":
					subJobInfo.NodesReq = nodeNum
				case "nodes_alloc":
					subJobInfo.NodesAlloc = &nodeNum
				case "gpus_req":
					subJobInfo.GpusReq = gpusAlloc
				case "gpus_alloc":
					subJobInfo.GpusAlloc = &gpusAlloc
				case "mem_req_mb":
					subJobInfo.MemReqMb = memAllocMb
				case "mem_alloc_mb":
					subJobInfo.MemAllocMb = &memAllocMb
				}
			}
			jobsInfo = append(jobsInfo, subJobInfo)
		}
	}
	if in.Sort != nil && len(jobsInfo) != 0 {
		var sortKey string
		if in.Sort.GetField() == "" {
			sortKey = "JobId" // 默认jobid进行排序
		} else {
			sortKey = in.Sort.GetField()
			// 字段转换成首字母大写的字符串
			words := strings.Split(sortKey, "_")
			for i := 0; i < len(words); i++ {
				words[i] = strings.Title(words[i])
			}
			sortKey = strings.Join(words, "")
		}
		sortOrder := in.Sort.GetOrder().String()
		sortJobinfo := utils.SortJobInfo(sortKey, sortOrder, jobsInfo)
		return &protos.GetJobsResponse{Jobs: sortJobinfo, TotalCount: &totalNum}, nil
	}
	logrus.Tracef("GetJobs finished, jobs count: %d, total count: %d, fields: %v", len(jobsInfo), totalNum, in.Fields)
	return &protos.GetJobsResponse{Jobs: jobsInfo, TotalCount: &totalNum}, nil
}

func (s *ServerJob) SubmitJob(ctx context.Context, in *protos.SubmitJobRequest) (*protos.SubmitJobResponse, error) {
	var (
		stdout, timeLimitString string
		scriptString            = "#!/bin/bash\n"
	)
	logrus.Tracef("Received request SubmitJob: %v", in)

	account, err := utils.GetAccountByName(in.Account)
	if err != nil {
		logrus.Errorf("SubmitJob get account failed: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_INTERNAL_ERROR", err.Error())
	}
	if account.GetBlocked() {
		err = fmt.Errorf("account %s is blocked", in.Account)
		logrus.Errorf("SubmitJob failed: %v", err)
		return nil, ce.RichError(codes.PermissionDenied, "ACCOUNT_BLOCKED", err.Error())
	}
	if !utils.Contains(account.GetAllowedPartitions(), in.Partition) {
		err = fmt.Errorf("account %s is not authorized to use partition %s", in.Account, in.Partition)
		logrus.Errorf("SubmitJob failed: %v", err)
		return nil, ce.RichError(codes.PermissionDenied, "ACCOUNT_PARTITION_NOT_ALLOWED", err.Error())
	}

	if in.Stdout != nil {
		stdout = *in.Stdout
	} else { // 可选参数没传的情况
		stdout = "job.%j.out"
	}

	// 工作目录由scow传过来一个绝对路径
	workdir := in.WorkingDirectory
	if !filepath.IsAbs(workdir) {
		homedirTemp, _ := utils.GetUserHomedir(in.UserId)
		workdir = homedirTemp + "/" + in.WorkingDirectory
	}

	scriptString += "#CBATCH " + "-A " + in.Account + "\n"
	scriptString += "#CBATCH " + "-p " + in.Partition + "\n"
	if in.Qos != nil {
		scriptString += "#CBATCH " + "--qos " + *in.Qos + "\n"
	}
	scriptString += "#CBATCH " + "-J " + in.JobName + "\n"
	scriptString += "#CBATCH " + "-N " + strconv.Itoa(int(in.NodeCount)) + "\n"
	scriptString += "#CBATCH " + "--ntasks-per-node " + strconv.Itoa(1) + "\n"
	if in.GpuCount != 0 {
		deviceType, err := utils.GetPartitionDeviceType(in.Partition)
		if err != nil {
			logrus.Errorf("SubmitJob failed: %v", fmt.Errorf("CREATE_SCRIPT_FAILED"))
			return nil, ce.RichError(codes.Aborted, "CREATE_SCRIPT_FAILED", "Create submit script failed.")
		}
		scriptString += "#CBATCH " + "--gres " + deviceType + ":" + strconv.Itoa(int(in.GpuCount)) + "\n"
	}
	scriptString += "#CBATCH " + "-c " + strconv.Itoa(int(in.CoreCount)) + "\n"
	if in.TimeLimitMinutes != nil {
		// 要把时间换成字符串的形式
		if *in.TimeLimitMinutes < 60 {
			timeLimitString = fmt.Sprintf("00:%s:00", strconv.Itoa(int(*in.TimeLimitMinutes)))
		} else if *in.TimeLimitMinutes == 60 {
			timeLimitString = "1:00:00"
		} else {
			hours, minitues := *in.TimeLimitMinutes/60, *in.TimeLimitMinutes%60
			timeLimitString = fmt.Sprintf("%s:%s:00", strconv.Itoa(int(hours)), strconv.Itoa(int(minitues)))
		}
		scriptString += "#CBATCH " + "--time " + timeLimitString + "\n"
	}
	scriptString += "#CBATCH " + "--chdir " + workdir + "\n"
	if in.Stdout != nil {
		scriptString += "#CBATCH " + "--output " + stdout + "\n"
	}

	if in.MemoryMb != nil {
		scriptString += "#CBATCH " + "--mem " + strconv.Itoa(int(*in.MemoryMb/uint64(in.NodeCount))) + "M" + "\n"
	}
	if len(in.ExtraOptions) != 0 {
		for _, extraVale := range in.ExtraOptions {
			scriptString += "#CBATCH " + extraVale + "\n"
		}
	}
	scriptString += "#CBATCH " + "--export ALL" + "\n"
	scriptString += "#CBATCH " + "--get-user-env" + "\n"

	scriptString += in.Script

	// 将这个保存成一个脚本文件，通过脚本文件进行提交
	// 生成一个随机的文件名
	var letters = []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")
	b := make([]rune, 10)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	filePath := "/tmp" + "/" + string(b) + ".sh" // 生成的脚本存放路径
	file, err := os.OpenFile(filePath, os.O_WRONLY|os.O_CREATE, 0777)
	if err != nil {
		logrus.Errorf("SubmitJob failed: %v", fmt.Errorf("CREATE_SCRIPT_FAILED"))
		return nil, ce.RichError(codes.Aborted, "CREATE_SCRIPT_FAILED", "Create submit script failed.")
	}
	defer file.Close()
	writer := bufio.NewWriter(file)
	writer.WriteString(scriptString)
	writer.Flush()

	os.Chmod(filePath, 0777)

	submitResult, err := utils.LocalSubmitJob(filePath, in.UserId)
	os.Remove(filePath) // 删除掉提交脚本
	if err != nil {
		logrus.Errorf("SubmitJob failed: %v", err)
		return nil, ce.RichError(codes.Internal, "CRANE_INTERNAL_ERROR", submitResult)
	}
	responseList := strings.Split(strings.TrimSpace(string(submitResult)), " ")
	jobIdString := responseList[len(responseList)-1]

	jobId1, _ := strconv.Atoi(jobIdString[:len(jobIdString)-1])

	return &protos.SubmitJobResponse{JobId: uint32(jobId1), GeneratedScript: scriptString}, nil
}

func (s *ServerJob) SubmitScriptAsJob(ctx context.Context, in *protos.SubmitScriptAsJobRequest) (*protos.SubmitScriptAsJobResponse, error) {
	logrus.Tracef("Received request SubmitScriptAsJob: %v", in)
	// 具体的提交逻辑
	updateScript := "#!/bin/bash\n"
	trimmedScript := strings.TrimLeft(in.Script, "\n")
	// 通过换行符 "\n" 分割字符串
	checkBool1 := strings.Contains(trimmedScript, "--chdir")
	checkBool2 := strings.Contains(trimmedScript, " -D ")
	if !checkBool1 && !checkBool2 {
		chdirString := fmt.Sprintf("#SBATCH --chdir=%s\n", *in.ScriptFileFullPath)
		updateScript = updateScript + chdirString
		for _, value := range strings.Split(trimmedScript, "\n")[1:] {
			updateScript = updateScript + value + "\n"
		}
		in.Script = updateScript
	}
	checkJobName1 := strings.Contains(in.Script, "--job-name")
	checkJobName2 := strings.Contains(in.Script, " -J ")
	if !checkJobName1 && !checkJobName2 {
		lines := strings.SplitN(in.Script, "\n", 2)
		if len(lines) == 2 {
			in.Script = lines[0] + "\n#SBATCH --job-name=cbatch\n" + lines[1]
		}
	}
	// 将这个保存成一个脚本文件，通过脚本文件进行提交
	// 生成一个随机的文件名
	var letters = []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")
	b := make([]rune, 10)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	filePath := "/tmp" + "/" + string(b) + ".sh" // 生成的脚本存放路径
	file, err := os.OpenFile(filePath, os.O_WRONLY|os.O_CREATE, 0777)
	if err != nil {
		logrus.Errorf("SubmitScriptAsJob failed: %v", fmt.Errorf("CREATE_SCRIPT_FAILED"))
		return nil, ce.RichError(codes.Aborted, "CREATE_SCRIPT_FAILED", "Create submit script failed.")
	}
	defer file.Close()
	writer := bufio.NewWriter(file)
	writer.WriteString(in.Script)
	writer.Flush()

	submitResult, err := utils.LocalSubmitJob(filePath, in.UserId)
	os.Remove(filePath) // 删除生成的提交脚本
	if err != nil {
		logrus.Errorf("SubmitScriptAsJob failed: %v", err)
		return nil, ce.RichError(codes.Internal, "CRANE_INTERNAL_ERROR", submitResult)
	}
	responseList := strings.Split(strings.TrimSpace(string(submitResult)), " ")
	jobIdString := responseList[len(responseList)-1]

	jobId1, _ := strconv.Atoi(jobIdString[:len(jobIdString)-1])

	return &protos.SubmitScriptAsJobResponse{JobId: uint32(jobId1)}, nil
}

func (s *ServerJob) RunCommandOnJobNodes(ctx context.Context, in *protos.RunCommandOnJobNodesRequest) (*protos.RunCommandOnJobNodesResponse, error) {
	logrus.Infof("Received request RunCommandOnJobNodes: %v", in)

	// 查询作业信息
	request := &craneProtos.QueryTasksInfoRequest{
		FilterTaskIds:               []uint32{in.JobId},
		OptionIncludeCompletedTasks: true,
	}

	response, err := client.CraneCtld.QueryTasksInfo(context.Background(), request)
	if err != nil {
		logrus.Errorf("RunCommandOnJobNodes failed to query job %d: %v", in.JobId, err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", err.Error())
	}

	if !response.GetOk() || len(response.GetTaskInfoList()) == 0 {
		logrus.Errorf("RunCommandOnJobNodes failed: Job %d not found", in.JobId)
		return nil, ce.RichError(codes.NotFound, "JOB_NOT_FOUND", "Job not found")
	}

	taskInfo := response.GetTaskInfoList()[0]

	// 检查作业状态，只有运行中的作业才能执行命令
	if taskInfo.GetStatus() != craneProtos.TaskStatus_Running {
		logrus.Errorf("RunCommandOnJobNodes failed: Job %d is not running (status: %v)", in.JobId, taskInfo.GetStatus())
		return nil, ce.RichError(codes.FailedPrecondition, "JOB_NOT_RUNNING", fmt.Sprintf("Job is not running, status: %s", taskInfo.GetStatus()))
	}

	username := taskInfo.GetUsername()
	nodeList := strings.Join(in.Nodes, ",")

	// 默认超时时间为30s
	timeout := 30 * time.Second
	if in.TimeoutSeconds > 0 {
		timeout = time.Duration(in.TimeoutSeconds) * time.Second
	}

	logrus.Debugf("RunCommandOnJobNodes calling LocalRunCommandOnNodes with: nodeList=%s, command=%s, username=%s, timeout=%v", nodeList, in.Command, username, timeout)

	// 执行命令
	stdout, stderr, err := utils.LocalRunCommandOnNodes(nodeList, in.Command, username, timeout)
	if err != nil {
		logrus.Errorf("RunCommandOnJobNodes failed execution: %v", err)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTION_FAILED", err.Error())
	}

	return &protos.RunCommandOnJobNodesResponse{
		Stdout: stdout,
		Stderr: stderr,
	}, nil
}
