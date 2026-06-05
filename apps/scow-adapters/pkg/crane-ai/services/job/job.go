package job

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"os"
	"path/filepath"
	"scow-adapters/pkg/crane-ai/services/job/internal/builder"
	"strconv"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/protobuf/types/known/timestamppb"

	craneProtos "scow-adapters/gen/crane-ai"
	protos "scow-adapters/gen/go"
	ce "scow-adapters/pkg/common/error"
	"scow-adapters/pkg/crane-ai/client"
	"scow-adapters/pkg/crane-ai/utils"
)

const maxUint = 4294967295

type ServerJob struct {
	protos.UnimplementedJobServiceServer
	JM *utils.JobManager
}

func (s *ServerJob) CancelJob(ctx context.Context, in *protos.CancelJobRequest) (*protos.CancelJobResponse, error) {
	logrus.Infof("Received request CancelJob: %v", in)

	defer func() {
		if err := utils.GlobalProxyManager.StopAndRemoveProxy(in.JobId); err != nil {
			logrus.Warnf("[CancelJob] delete job proxy file failed: %v", err)
		}
		if err := s.JM.DeleteJobInfo(in.JobId); err != nil {
			logrus.Warnf("[CancelJob] delete job info file failed: %v", err)
		}
	}()

	stepIds, err := utils.ParseStepIdList(strconv.Itoa(int(in.JobId)), ",")
	if err != nil {
		logrus.Errorf("[CancelJob] get job step ids failed: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", "Crane service call failed.")
	}
	request := &craneProtos.CancelJobRequest{
		OperatorUid:    0,
		FilterIds:      stepIds,
		FilterUsername: in.UserId,
		FilterState:    craneProtos.JobStatus_Invalid,
	}
	_, err = client.CraneCtld.CancelJob(context.Background(), request)
	if err != nil {
		logrus.Errorf("[CancelJob] cancel job failed: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", "Crane service call failed.")
	}
	logrus.Infof("[CancelJob] cancel job: %v success", in.JobId)
	return &protos.CancelJobResponse{}, nil
}

func (s *ServerJob) QueryJobTimeLimit(ctx context.Context, in *protos.QueryJobTimeLimitRequest) (*protos.QueryJobTimeLimitResponse, error) {
	var seconds uint64

	logrus.Infof("Received request QueryJobTimeLimit: %v", in)
	filterIds := make(map[uint32]*craneProtos.JobStepIds)
	filterIds[in.JobId] = &craneProtos.JobStepIds{Steps: []uint32{1}}
	request := &craneProtos.QueryJobsInfoRequest{
		FilterIds:                  filterIds,
		OptionIncludeCompletedJobs: true, // 包含运行结束的作业
	}
	response, err := client.CraneCtld.QueryJobsInfo(context.Background(), request)
	if err != nil {
		logrus.Errorf("QueryJobTimeLimit failed: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", err.Error())
	}
	taskInfoList := response.GetJobInfoList()
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
	var seconds uint64

	logrus.Infof("Received request ChangeJobTimeLimit: %v", in)
	// 查询请求体
	filterIds := make(map[uint32]*craneProtos.JobStepIds)
	filterIds[in.JobId] = &craneProtos.JobStepIds{Steps: []uint32{1}}
	requestLimitTime := &craneProtos.QueryJobsInfoRequest{
		FilterIds: filterIds,
	}

	responseLimitTime, err := client.CraneCtld.QueryJobsInfo(context.Background(), requestLimitTime)
	if err != nil {
		logrus.Errorf("ChangeJobTimeLimit failed: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", err.Error())
	}

	taskInfoList := responseLimitTime.GetJobInfoList()
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
	request := &craneProtos.ModifyJobRequest{
		JobIds: []uint32{in.JobId},
		Value: &craneProtos.ModifyJobRequest_TimeLimitSeconds{
			TimeLimitSeconds: in.DeltaMinutes*60 + int64(seconds),
		},
	}
	response, err := client.CraneCtld.ModifyJob(context.Background(), request)
	if err != nil {
		logrus.Errorf("ChangeJobTimeLimit failed: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", err.Error())
	}
	if len(response.GetNotModifiedJobs()) != 0 {
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
	)

	logrus.Infof("[GetJobById] Received request: %v", in)
	jobId := in.JobId
	taskInfo, err := utils.GetJobById(jobId, "")
	if err != nil {
		logrus.Errorf("[GetJobById] get job info err: %v", err)
		return nil, ce.RichError(codes.Internal, "CRANE_INTERNAL_ERROR", err.Error())
	}

	if taskInfo.GetStatus() == craneProtos.JobStatus_Running {
		elapsedSeconds = time.Now().Unix() - taskInfo.GetStartTime().Seconds
	} else if taskInfo.GetStatus() == craneProtos.JobStatus_Pending {
		elapsedSeconds = 0
	}
	// 获取作业时长
	// elapsedSeconds = TaskInfoList.GetEndTime().Seconds - TaskInfoList.GetStartTime().Seconds
	if taskInfo.GetStatus() == craneProtos.JobStatus_Running {
		elapsedSeconds = time.Now().Unix() - taskInfo.GetStartTime().Seconds
	} else if taskInfo.GetStatus() == craneProtos.JobStatus_Pending {
		elapsedSeconds = 0
	} else {
		elapsedSeconds = taskInfo.GetEndTime().Seconds - taskInfo.GetStartTime().Seconds
	}

	// 获取cpu核分配数
	// cpusAlloc := TaskInfoList.GetAllocCpus()
	cpusAlloc := taskInfo.GetAllocatedResView().GetCpuCount()
	cpusAllocInt32 := int32(cpusAlloc)
	// 获取节点列表
	nodeList := taskInfo.GetCranedList()

	if taskInfo.GetStatus().String() == "Completed" {
		state = "COMPLETED"
		reason = "ENDED"
	} else if taskInfo.GetStatus().String() == "Failed" {
		state = "FAILED"
		reason = "ENDED"
	} else if taskInfo.GetStatus().String() == "Cancelled" {
		state = "CANCELLED"
		reason = "ENDED"
	} else if taskInfo.GetStatus().String() == "Running" {
		state = "RUNNING"
		reason = "Running"
	} else if taskInfo.GetStatus().String() == "Pending" {
		state = "PENDING"
		reason = "Pending"
	}

	pods := utils.ConvertStepInfoToPodInfo(taskInfo.Partition, taskInfo.GetStepInfoList())

	if len(in.Fields) == 0 {
		jobInfo := &protos.JobInfo{
			JobId:            taskInfo.GetJobId(),
			Name:             taskInfo.GetName(),
			Account:          taskInfo.GetAccount(),
			User:             taskInfo.GetUsername(),
			Partition:        taskInfo.GetPartition(),
			NodeList:         &nodeList,
			StartTime:        taskInfo.GetStartTime(),
			EndTime:          taskInfo.GetEndTime(),
			TimeLimitMinutes: taskInfo.GetTimeLimit().Seconds / 60, // 转换成分钟数
			WorkingDirectory: taskInfo.GetCwd(),
			CpusAlloc:        &cpusAllocInt32,
			State:            state,
			ElapsedSeconds:   &elapsedSeconds,
			Reason:           &reason,
			Qos:              taskInfo.GetQos(),
			SubmitTime:       taskInfo.GetStartTime(),
			Pods:             pods,
		}
		return &protos.GetJobByIdResponse{Job: jobInfo}, nil
	}
	jobInfo := &protos.JobInfo{}
	for _, field := range in.Fields {
		switch field {
		case "job_id":
			jobInfo.JobId = taskInfo.GetJobId()
		case "name":
			jobInfo.Name = taskInfo.GetName()
		case "account":
			jobInfo.Account = taskInfo.GetAccount()
		case "user":
			jobInfo.User = taskInfo.GetUsername()
		case "partition":
			jobInfo.Partition = taskInfo.GetPartition()
		case "node_list":
			jobInfo.NodeList = &nodeList
		case "start_time":
			jobInfo.StartTime = taskInfo.GetStartTime()
		case "end_time":
			jobInfo.EndTime = taskInfo.GetEndTime()
		case "time_limit_minutes":
			jobInfo.TimeLimitMinutes = taskInfo.GetTimeLimit().Seconds / 60
		case "working_directory":
			jobInfo.WorkingDirectory = taskInfo.GetCwd()
		case "cpus_alloc":
			jobInfo.CpusAlloc = &cpusAllocInt32
		case "state":
			jobInfo.State = state
		case "elapsed_seconds":
			jobInfo.ElapsedSeconds = &elapsedSeconds
		case "reason":
			jobInfo.Reason = &reason
		case "qos":
			jobInfo.Qos = taskInfo.GetQos()
		case "pods":
			jobInfo.Pods = pods
		case "submit_time":
			jobInfo.SubmitTime = taskInfo.GetStartTime()
		}
	}
	logrus.Tracef("[GetJobById] job info: %v", jobInfo)
	return &protos.GetJobByIdResponse{Job: jobInfo}, nil
}

func (s *ServerJob) GetJobs(ctx context.Context, in *protos.GetJobsRequest) (*protos.GetJobsResponse, error) {
	var (
		request  *craneProtos.QueryJobsInfoRequest
		jobsInfo []*protos.JobInfo
		totalNum uint32
	)
	logrus.Tracef("Received request GetJobs: %v", in)

	if len(in.JobTypes) > 0 && hasUnsupportedJobTypes(in.JobTypes) {
		return nil, ce.RichError(codes.Unimplemented, "AI_JOB_TYPES_UNSUPPORTED", "Crane AI adapter does not support requested job types.")
	}
	if len(in.JobTypes) > 0 && s.JM == nil {
		return nil, ce.RichError(codes.Internal, "JOB_MANAGER_NOT_INITIALIZED", "Job manager is not initialized.")
	}

	if in.Filter != nil {
		base := &craneProtos.QueryJobsInfoRequest{
			FilterJobTypes:             getCraneJobTypesForGetJobs(in.JobTypes),
			FilterStates:               utils.GetCraneStatesList(in.Filter.States),
			FilterUsers:                in.Filter.Users,
			FilterAccounts:             in.Filter.Accounts,
			OptionIncludeCompletedJobs: true,
			NumLimit:                   99999999,
		}

		logrus.Tracef("request: %v", base)

		var startTimeFilter, endTimeFilter int64

		if in.Filter.EndTime != nil {
			startTimeFilter = in.Filter.EndTime.StartTime.GetSeconds()
			endTimeFilter = in.Filter.EndTime.EndTime.GetSeconds()
		} else if in.Filter.SubmitTime != nil {
			startTimeFilter = in.Filter.SubmitTime.StartTime.GetSeconds()
			endTimeFilter = in.Filter.SubmitTime.EndTime.GetSeconds()
		}

		if startTimeFilter != 0 || endTimeFilter != 0 {
			interval := &craneProtos.TimeInterval{}
			if startTimeFilter != 0 {
				interval.LowerBound = timestamppb.New(time.Unix(startTimeFilter, 0))
			}
			if endTimeFilter != 0 {
				interval.UpperBound = timestamppb.New(time.Unix(endTimeFilter, 0))
			}
			base.FilterEndTimeInterval = interval
		}

		if in.Filter.JobName != nil {
			base.FilterJobNames = []string{*in.Filter.JobName}
		}
		request = base
	} else {
		// 没有筛选条件的请求体
		request = &craneProtos.QueryJobsInfoRequest{
			FilterJobTypes:             getCraneJobTypesForGetJobs(in.JobTypes),
			OptionIncludeCompletedJobs: true,
			NumLimit:                   99999999,
		}
	}

	logrus.Tracef("request: %v", request)
	response, err := client.CraneCtld.QueryJobsInfo(context.Background(), request)
	logrus.Tracef("response: %v", response)

	if err != nil {
		logrus.Errorf("GetJobs failed: %v", fmt.Errorf("CRANE_CALL_FAILED"))
		return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", err.Error())
	}
	if !response.GetOk() {
		logrus.Errorf("GetJobs failed: %v", fmt.Errorf("CRANE_INTERNAL_ERROR"))
		return nil, ce.RichError(codes.Internal, "CRANE_INTERNAL_ERROR", "Crane service internal error.")
	}
	if len(response.GetJobInfoList()) == 0 {
		logrus.Infof("GetJobs: no Task found")
		totalNum = uint32(len(response.GetJobInfoList()))
		return &protos.GetJobsResponse{Jobs: jobsInfo, TotalCount: &totalNum}, nil
	}
	for _, job := range response.GetJobInfoList() {
		if len(in.JobTypes) > 0 {
			savedInfo, err := s.JM.QueryJobInfo(job.GetJobId())
			if errors.Is(err, utils.ErrJobInfoNotFound) {
				continue
			}
			if err != nil {
				logrus.Errorf("GetJobs failed to query job metadata: %v", err)
				return nil, ce.RichError(codes.Internal, "JOB_METADATA_ERROR", "Job metadata is unavailable.")
			}
			if !isJobTypeMatch(savedInfo.JobType, in.JobTypes) {
				continue
			}
		} else if s.JM != nil {
			if _, err := s.JM.QueryJobInfo(job.GetJobId()); err == nil {
				continue
			} else if !errors.Is(err, utils.ErrJobInfoNotFound) {
				logrus.Errorf("GetJobs failed to query job metadata: %v", err)
				return nil, ce.RichError(codes.Internal, "JOB_METADATA_ERROR", "Job metadata is unavailable.")
			}
		}
		var elapsedSeconds, timeLimitMinutes int64
		var state string
		var reason = "no reason"
		var nodeNum int32
		var endTime, startTime *timestamppb.Timestamp
		if job.GetStatus() == craneProtos.JobStatus_Running {
			startTime = job.GetStartTime()
			elapsedSeconds = time.Now().Unix() - job.GetStartTime().Seconds
		} else if job.GetStatus() == craneProtos.JobStatus_Pending {
			elapsedSeconds = 0
		} else {
			if job.GetNodeNum() != 0 {
				startTime = job.GetStartTime()
			}
			elapsedSeconds = job.GetEndTime().Seconds - job.GetStartTime().Seconds
		}
		cpusAlloc := job.GetAllocatedResView().GetCpuCount()
		cpusAllocInt32 := int32(cpusAlloc)

		jobMemAllocMb := job.GetAllocatedResView().GetMemoryBytes()
		memAllocMb := int64(jobMemAllocMb / (1024 * 1024))

		jobGpusAlloc := job.GetAllocatedResView().GetGresMap()
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
			state = "INVALID"
			reason = "Invalid"
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

		logrus.Tracef("GetJobs: job pod Info %v", job.GetPodMeta())
		logrus.Tracef("GetJobs: job step Info %v", job.GetStepInfoList())
		pods := utils.ConvertStepInfoToPodInfo(job.Partition, job.GetStepInfoList())
		if len(in.Fields) == 0 {
			subJobInfo := &protos.JobInfo{}
			subJobInfo = &protos.JobInfo{
				JobId:            job.GetJobId(),
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
				Pods:             pods,
			}
			jobsInfo = append(jobsInfo, subJobInfo)
			logrus.Tracef("GetJobs: jobsInfo %v", subJobInfo)
		} else {
			subJobInfo := &protos.JobInfo{}
			for _, field := range in.Fields {
				switch field {
				case "job_id":
					subJobInfo.JobId = job.GetJobId()
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
				case "pods":
					subJobInfo.Pods = pods
				case "mem_alloc_mb":
					subJobInfo.MemAllocMb = &memAllocMb
				}
			}
			logrus.Tracef("GetJobs: jobsInfo %v", subJobInfo)
			jobsInfo = append(jobsInfo, subJobInfo)
		}
	}
	if in.Sort != nil && len(jobsInfo) != 0 {
		totalNum = uint32(len(jobsInfo))
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
	totalNum = uint32(len(jobsInfo))
	logrus.Tracef("GetJobs jobs: %v", jobsInfo)
	return &protos.GetJobsResponse{Jobs: jobsInfo, TotalCount: &totalNum}, nil
}

func isAiSubmitJob(in *protos.SubmitJobRequest) bool {
	return len(in.ExtraOptions) > 0 && (in.ExtraOptions[0] == "app" || in.ExtraOptions[0] == "train")
}

func getCraneJobTypesForGetJobs(jobTypes []protos.JobType) []craneProtos.JobType {
	if len(jobTypes) > 0 {
		return []craneProtos.JobType{craneProtos.JobType_Container}
	}
	return []craneProtos.JobType{craneProtos.JobType_Batch}
}

func (s *ServerJob) submitHpcJob(in *protos.SubmitJobRequest) (*protos.SubmitJobResponse, error) {
	var (
		stdout, timeLimitString string
		scriptString            = "#!/bin/bash\n"
	)

	if in.Stdout != nil {
		stdout = *in.Stdout
	} else {
		stdout = "job.%j.out"
	}

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
			logrus.Errorf("[SubmitJob] get partition device type failed: %v", err)
			return nil, ce.RichError(codes.Aborted, "CREATE_SCRIPT_FAILED", "Create submit script failed.")
		}
		scriptString += "#CBATCH " + "--gres " + deviceType + ":" + strconv.Itoa(int(in.GpuCount)) + "\n"
	}
	scriptString += "#CBATCH " + "-c " + strconv.Itoa(int(in.CoreCount)) + "\n"
	if in.TimeLimitMinutes != nil {
		if *in.TimeLimitMinutes < 60 {
			timeLimitString = fmt.Sprintf("00:%s:00", strconv.Itoa(int(*in.TimeLimitMinutes)))
		} else if *in.TimeLimitMinutes == 60 {
			timeLimitString = "1:00:00"
		} else {
			hours, minutes := *in.TimeLimitMinutes/60, *in.TimeLimitMinutes%60
			timeLimitString = fmt.Sprintf("%s:%s:00", strconv.Itoa(int(hours)), strconv.Itoa(int(minutes)))
		}
		scriptString += "#CBATCH " + "--time " + timeLimitString + "\n"
	}
	scriptString += "#CBATCH " + "--chdir " + workdir + "\n"
	if in.Stdout != nil {
		scriptString += "#CBATCH " + "--output " + stdout + "\n"
	}

	if in.MemoryMb != nil && in.NodeCount != 0 {
		scriptString += "#CBATCH " + "--mem " + strconv.Itoa(int(*in.MemoryMb/uint64(in.NodeCount))) + "M" + "\n"
	}
	for _, extraValue := range in.ExtraOptions {
		scriptString += "#CBATCH " + extraValue + "\n"
	}
	scriptString += "#CBATCH " + "--export ALL" + "\n"
	scriptString += "#CBATCH " + "--get-user-env" + "\n"
	scriptString += in.Script

	var letters = []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")
	b := make([]rune, 10)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	filePath := "/tmp" + "/" + string(b) + ".sh"
	file, err := os.OpenFile(filePath, os.O_WRONLY|os.O_CREATE, 0777)
	if err != nil {
		logrus.Errorf("[SubmitJob] generate job script file failed: %v", err)
		return nil, ce.RichError(codes.Aborted, "CREATE_SCRIPT_FAILED", "Create submit script failed.")
	}
	defer file.Close()
	writer := bufio.NewWriter(file)
	writer.WriteString(scriptString)
	writer.Flush()

	os.Chmod(filePath, 0777)
	submitResult, err := utils.LocalSubmitJob(filePath, in.UserId)
	os.Remove(filePath)
	if err != nil {
		logrus.Errorf("[SubmitJob] submit HPC job failed: %v", err)
		return nil, ce.RichError(codes.Internal, "CRANE_INTERNAL_ERROR", submitResult)
	}

	responseList := strings.Split(strings.TrimSpace(submitResult), " ")
	if len(responseList) == 0 {
		return nil, ce.RichError(codes.Internal, "CRANE_INTERNAL_ERROR", "unexpected submit result format")
	}
	jobIdString := strings.TrimRight(responseList[len(responseList)-1], "\n\r.")
	jobId, err := strconv.Atoi(jobIdString)
	if err != nil {
		return nil, ce.RichError(codes.Internal, "CRANE_INTERNAL_ERROR", "failed to parse job id from submit result")
	}

	return &protos.SubmitJobResponse{JobId: uint32(jobId), GeneratedScript: scriptString}, nil
}

// SubmitJob 命令 ccon run --userns=false -itd alpine:latest /bin/sh
func (s *ServerJob) SubmitJob(ctx context.Context, in *protos.SubmitJobRequest) (*protos.SubmitJobResponse, error) {
	logrus.Tracef("[SubmitJob] Received request: %v", in)

	err := s.checkJob(in.Account, in.UserId, in.WorkingDirectory)
	if err != nil {
		return nil, ce.RichError(codes.Internal, "SUBMIT_JOB_FAILED", err.Error())
	}

	if !isAiSubmitJob(in) {
		return s.submitHpcJob(in)
	}

	// todo 目前只支持pytorch
	// 多机训练
	if in.ExtraOptions[0] == "train" && in.NodeCount >= 2 {
		logrus.Tracef("[SubmitJob] Starting Multi-machine training")
		var (
			stdout, timeLimitString string
			scriptString            = "#!/bin/bash\n"
		)

		if in.Stdout != nil {
			stdout = *in.Stdout
		} else { // 可选参数没传的情况
			stdout = "job.%j.out"
		}

		scriptString += "#CBATCH " + "-A " + in.Account + "\n"
		scriptString += "#CBATCH " + "-p " + in.Partition + "\n"
		if in.Qos != nil {
			scriptString += "#CBATCH " + "--qos " + *in.Qos + "\n"
		}
		scriptString += "#CBATCH " + "-J " + in.JobName + "\n"
		// -N 使用实际节点数，每节点运行一个容器（ntasks-per-node=1）
		// scriptString += "#CBATCH " + "-N " + strconv.Itoa(int(in.NodeCount)) + "\n"
		scriptString += "#CBATCH " + "-N " + strconv.Itoa(1) + "\n"
		scriptString += "#CBATCH " + "--ntasks-per-node " + strconv.Itoa(1) + "\n"
		if in.GpuCount != 0 {
			deviceType, err := utils.GetPartitionDeviceType(in.Partition)
			if err != nil {
				logrus.Errorf("[SubmitJob] get partition device type failed: %v", fmt.Errorf("CREATE_SCRIPT_FAILED"))
				return nil, ce.RichError(codes.Aborted, "CREATE_SCRIPT_FAILED", "Create submit script failed.")
			}
			scriptString += "#CBATCH " + "--gres " + deviceType + ":" + strconv.Itoa(int(in.GpuCount)*int(in.NodeCount)) + "\n"
		}
		scriptString += "#CBATCH " + "-c " + strconv.Itoa(int(in.CoreCount)*int(in.NodeCount)) + "\n"
		if in.TimeLimitMinutes != nil {
			if *in.TimeLimitMinutes < 60 {
				timeLimitString = fmt.Sprintf("00:%s:00", strconv.Itoa(int(*in.TimeLimitMinutes)))
			} else if *in.TimeLimitMinutes == 60 {
				timeLimitString = "1:00:00"
			} else {
				hours, minutes := *in.TimeLimitMinutes/60, *in.TimeLimitMinutes%60
				timeLimitString = fmt.Sprintf("%s:%s:00", strconv.Itoa(int(hours)), strconv.Itoa(int(minutes)))
			}
			scriptString += "#CBATCH " + "--time " + timeLimitString + "\n"
		}
		scriptString += "#CBATCH " + "--chdir " + in.WorkingDirectory + "\n"
		if in.Stdout != nil {
			scriptString += "#CBATCH " + "--output " + stdout + "\n"
		}

		if in.MemoryMb != nil {
			// --mem 是每节点内存限制，传入值已是单容器（单节点）所需内存，直接使用
			scriptString += "#CBATCH " + "--mem " + strconv.Itoa(int(*in.MemoryMb)*int(in.NodeCount)) + "M" + "\n"
		}

		scriptString += "#CBATCH " + "--export ALL" + "\n"
		scriptString += "#CBATCH " + "--get-user-env" + "\n"
		// 表示运行容器任务，此处通过容器来运行训练任务
		scriptString += "#CBATCH " + "--pod" + "\n"
		scriptString += "#CBATCH " + "--pod-userns true" + "\n"

		// 生成多节点训练脚本主体（包含容器启动、等待就绪、获取IP、监控等逻辑）
		scriptBody, err := GenerateMultiNodeTrainScript(in)
		if err != nil {
			logrus.Errorf("[SubmitJob] generate train job script failed: %v", err)
			return nil, ce.RichError(codes.Aborted, "CREATE_SCRIPT_FAILED", "Create submit script failed.")
		}
		scriptString += scriptBody

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
			logrus.Errorf("[SubmitJob] generate job script file failed: %v", fmt.Errorf("CREATE_SCRIPT_FAILED"))
			return nil, ce.RichError(codes.Aborted, "CREATE_SCRIPT_FAILED", "Create submit script failed.")
		}
		defer file.Close()
		writer := bufio.NewWriter(file)
		writer.WriteString(scriptString)
		writer.Flush()

		os.Chmod(filePath, 0777)
		submitResult, err := utils.LocalSubmitJob(filePath, in.UserId)
		//submitResult, err := utils.LocalSubmitJob(filePath, "root")
		if err != nil {
			logrus.Errorf("[SubmitJob] local submit job failed: %v", err)
			return nil, ce.RichError(codes.Internal, "CRANE_INTERNAL_ERROR", submitResult)
		}

		os.Remove(filePath) // 删除掉提交脚本
		responseList := strings.Split(strings.TrimSpace(submitResult), " ")
		if len(responseList) == 0 {
			logrus.Errorf("[SubmitJob] unexpected submit result format: %q", submitResult)
			return nil, ce.RichError(codes.Internal, "CRANE_INTERNAL_ERROR", "unexpected submit result format")
		}
		jobIdString := strings.TrimRight(responseList[len(responseList)-1], "\n\r.")
		if len(jobIdString) == 0 {
			logrus.Errorf("[SubmitJob] empty job id in submit result: %q", submitResult)
			return nil, ce.RichError(codes.Internal, "CRANE_INTERNAL_ERROR", "empty job id in submit result")
		}
		jobId, err := strconv.Atoi(jobIdString)
		if err != nil {
			logrus.Errorf("[SubmitJob] failed to parse job id from submit result: %q, err: %v", submitResult, err)
			return nil, ce.RichError(codes.Internal, "CRANE_INTERNAL_ERROR", "failed to parse job id from submit result")
		}
		logrus.Infof("[SubmitJob] submit Multi-machine training job success: %v", jobId)

		submitJobInfo := &utils.SubmitJobInfo{
			JobName: in.JobName,
			JobId:   uint32(jobId),
			JobType: in.ExtraOptions[0],
		}
		if err = s.JM.SaveJobInfo(submitJobInfo); err != nil {
			logrus.Warnf("save job submit info failed: %v", err)
		}

		return &protos.SubmitJobResponse{JobId: uint32(jobId), GeneratedScript: scriptString}, nil
	}

	// 构建容器作业
	coordinator := builder.NewJobBuilderCoordinator()
	task, err := coordinator.BuildJob(in)
	if err != nil {
		logrus.Errorf("[SubmitJob] build job err: %v", err)
		return nil, ce.RichError(codes.Internal, "BUILD_JOB_FAILED", err.Error())
	}

	logrus.Tracef("[SubmitJob] task info: %v", task)
	// 提交到调度器
	jobID, err := s.submitToScheduler(task)
	if err != nil {
		logrus.Errorf("[SubmitJob] submit job err: %v", err)
		return nil, ce.RichError(codes.Internal, "SUBMIT_JOB_FAILED", err.Error())
	}

	logrus.Infof("[SubmitJob] submit job sucess: %v", jobID)

	var containerPorts []int32
	for _, port := range task.PodMeta.Ports {
		containerPorts = append(containerPorts, port.ContainerPort)
	}
	submitJobInfo := &utils.SubmitJobInfo{
		JobName:        in.JobName,
		JobId:          jobID,
		JobType:        in.ExtraOptions[0],
		ContainerPorts: containerPorts,
	}
	if err = s.JM.SaveJobInfo(submitJobInfo); err != nil {
		logrus.Warnf("save job submit info failed: %v", err)
	}

	return &protos.SubmitJobResponse{
		JobId: jobID,
	}, nil
}

func (s *ServerJob) SubmitInferJob(ctx context.Context, in *protos.SubmitInferJobRequest) (*protos.SubmitInferJobResponse, error) {
	logrus.Tracef("[SubmitInferJob] Received request: %v", in)

	err := s.checkJob(in.Account, in.UserId, in.WorkingDirectory)
	if err != nil {
		return nil, ce.RichError(codes.Internal, "SUBMIT_INFERENCE_JOB_FAILED", err.Error())
	}

	// 构建容器作业
	coordinator := builder.NewJobBuilderCoordinator()
	task, err := coordinator.BuildInferenceJob(in)
	if err != nil {
		logrus.Errorf("[SubmitInferJob] build job err: %v", err)
		return nil, ce.RichError(codes.Internal, "BUILD_INFERENCE_JOB_FAILED", err.Error())
	}

	logrus.Tracef("[SubmitInferJob] task info: %v", task)
	// 提交到调度器
	jobID, err := s.submitToScheduler(task)
	if err != nil {
		logrus.Errorf("[SubmitInferJob] submit job err: %v", err)
		return nil, ce.RichError(codes.Internal, "SUBMIT_INFERENCE_JOB_FAILED", err.Error())
	}

	logrus.Infof("[SubmitInferJob] submit job sucess: %v", jobID)

	//go func() {
	//	submitJobInfo := &utils.SubmitJobInfo{
	//		JobName: in.JobName,
	//		JobType: utils.Inference,
	//	}
	//	jobInfo, err := utils.GetJobById(jobID)
	//	if err != nil {
	//		logrus.Errorf("[SubmitJob] get job info err: %v", err)
	//	}
	//	forwardInfo, err := utils.BuildJobForwardInfo(jobInfo.PodMeta, jobInfo.StepInfoList)
	//	if err != nil {
	//		logrus.Warn("build job forward info failed: %v", err)
	//	}
	//	submitJobInfo.ForwardInfo = forwardInfo
	//
	//	err = utils.GlobalProxyManager.CreateAndStartProxy(submitJobInfo)
	//	if err != nil {
	//		logrus.Warn("Failed to create proxy for app job %v: %v", in.JobName, err)
	//	}
	//}()

	var containerPorts []int32
	for _, port := range task.PodMeta.Ports {
		containerPorts = append(containerPorts, port.ContainerPort)
	}
	submitJobInfo := &utils.SubmitJobInfo{
		JobName:        in.JobName,
		JobType:        utils.Inference,
		JobId:          jobID,
		ContainerPorts: containerPorts,
	}
	if err = s.JM.SaveJobInfo(submitJobInfo); err != nil {
		logrus.Warnf("save job submit info failed: %v", err)
	}

	return &protos.SubmitInferJobResponse{
		JobId: jobID,
	}, nil
}

func (s *ServerJob) CreateDevHost(ctx context.Context, in *protos.CreateDevHostRequest) (*protos.CreateDevHostResponse, error) {
	logrus.Tracef("[CreateDevHost] Received request: %v", in)

	err := s.checkJob(in.Account, in.UserId, in.WorkingDirectory)
	if err != nil {
		return nil, ce.RichError(codes.Internal, "CREATE_DEV_HOST_FAILED", err.Error())
	}
	// 构建容器作业
	coordinator := builder.NewJobBuilderCoordinator()
	task, err := coordinator.BuildDevHostJob(in)
	if err != nil {
		logrus.Errorf("[CreateDevHost] build job err: %v", err)
		return nil, ce.RichError(codes.Internal, "BUILD_DEV_HOST_FAILED", err.Error())
	}

	logrus.Tracef("[CreateDevHost] task info: %v", task)
	// 提交到调度器
	jobID, err := s.submitToScheduler(task)
	if err != nil {
		logrus.Errorf("[CreateDevHost] submit job err: %v", err)
		return nil, ce.RichError(codes.Internal, "CREATE_DEV_HOST_FAILED", err.Error())
	}

	logrus.Infof("[CreateDevHost] submit job sucess: %v", jobID)

	var containerPorts []int32
	for _, port := range task.PodMeta.Ports {
		containerPorts = append(containerPorts, port.ContainerPort)
	}
	submitJobInfo := &utils.SubmitJobInfo{
		JobName:        in.JobName,
		JobType:        utils.DevHost,
		JobId:          jobID,
		ContainerPorts: containerPorts,
	}

	if err = s.JM.SaveJobInfo(submitJobInfo); err != nil {
		logrus.Warnf("save job submit info failed: %v", err)
	}

	//go func() {
	//	submitJobInfo := &utils.SubmitJobInfo{
	//		JobName: in.JobName,
	//		JobType: utils.DevHost,
	//	}
	//	jobInfo, err := getJobInfoWithRetry(jobID, 30, 2)
	//	if err != nil {
	//		logrus.Errorf("[SubmitJob] get job info err: %v", err)
	//	}
	//	forwardInfo, err := utils.BuildJobForwardInfo(jobInfo.PodMeta, jobInfo.StepInfoList)
	//	if err != nil {
	//		logrus.Warn("build job forward info failed: %v", err)
	//	}
	//	submitJobInfo.ForwardInfo = forwardInfo
	//
	//	err = utils.GlobalProxyManager.CreateAndStartProxy(submitJobInfo)
	//	if err != nil {
	//		logrus.Warn("Failed to create proxy for app job %v: %v", in.JobName, err)
	//	}
	//}()

	return &protos.CreateDevHostResponse{
		JobId: jobID,
	}, nil
}

func (s *ServerJob) StreamJobShell(stream protos.JobService_StreamJobShellServer) error {
	connectReq, err := s.waitForConnect(stream)
	if err != nil {
		logrus.Errorf("[StreamJobShell] wait for connect failed: %v", err)
		return ce.RichError(codes.Internal, "STREAM_JOB_SHELL_FAILED", err.Error())
	}
	logrus.Tracef("[StreamJobShell] Received request StreamJobShell connectInfo: %v", connectReq)
	jobID, stepID, nodeName, err := s.getJobIdStepIdNodeName(connectReq)
	if err != nil {
		logrus.Errorf("[StreamJobShell] get job id step id failed: %v", err)
		return ce.RichError(codes.Internal, "STREAM_JOB_SHELL_FAILED", err.Error())
	}

	taskInfo, err := utils.GetJobById(jobID, "")
	if err != nil {
		logrus.Errorf("[StreamJobShell] get job info err: %v", err)
		return ce.RichError(codes.Internal, "STREAM_JOB_SHELL_FAILED", err.Error())
	}
	// Check job step state
	if taskInfo.Status != craneProtos.JobStatus_Running {
		message := fmt.Errorf("task %v state is: %s", jobID, taskInfo.Status.String())
		logrus.Errorf("[StreamJobShell] %v", message)
		return ce.RichError(codes.Internal, "STREAM_JOB_SHELL_FAILED", message.Error())
	}
	// 创建容器执行流
	streamURL, err := s.createContainerExecStream(jobID, stepID, taskInfo.Uid, nodeName)
	if err != nil {
		logrus.Errorf("[StreamJobShell] create container exec stream failed: %v", err)
		return fmt.Errorf("create container exec stream failed: %v", err)
	}
	logrus.Tracef("[StreamJobShell] streamURL: %v", streamURL)
	executor, err := s.createContainerExecutor(streamURL)
	if err != nil {
		logrus.Errorf("[StreamJobShell] create container executor failed: %v", err)
		return ce.RichError(codes.Internal, "CREATE_CONTAINER_EXECUTOR_FAILED", err.Error())
	}

	ctx, cancel := context.WithCancel(stream.Context())
	defer cancel()

	// 初始化流管道和终端队列
	stdinR, stdinW := io.Pipe()   // 客户端输入 -> 容器 stdin
	stdoutR, stdoutW := io.Pipe() // 容器 stdout -> 客户端输出
	sizeQueue := NewTerminalSizeQueue()
	defer sizeQueue.Stop()

	// 启动容器流 Goroutine
	streamErrChan := make(chan error, 1)
	go s.runContainerStream(ctx, executor, stdinR, stdoutW, sizeQueue, streamErrChan)

	// 启动 Goroutine：转发容器输出到 gRPC 客户端
	stdoutDone := make(chan struct{})
	go s.forwardContainerOutput(stdoutR, stream, stdoutDone)

	// 处理客户端后续请求（数据输入/调整终端/断开）
	clientDone := make(chan struct{})
	go s.handleClientRequests(stream, stdinW, sizeQueue, clientDone)

	// 等待所有 Goroutine 完成
	streamErr := <-streamErrChan
	<-stdoutDone
	<-clientDone

	// 处理容器退出信息
	return s.handleStreamExit(stream, streamErr)
}

func (s *ServerJob) RunCommandOnJobNodes(ctx context.Context, in *protos.RunCommandOnJobNodesRequest) (*protos.RunCommandOnJobNodesResponse, error) {
	logrus.Infof("Received request RunCommandOnJobNodes: %v", in)

	// 查询作业信息
	filterIds := make(map[uint32]*craneProtos.JobStepIds)
	filterIds[in.JobId] = &craneProtos.JobStepIds{Steps: []uint32{1}}
	request := &craneProtos.QueryJobsInfoRequest{
		FilterIds:                  filterIds,
		OptionIncludeCompletedJobs: true,
	}

	response, err := client.CraneCtld.QueryJobsInfo(context.Background(), request)
	if err != nil {
		logrus.Errorf("RunCommandOnJobNodes failed to query job %d: %v", in.JobId, err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_CALL_FAILED", err.Error())
	}

	if !response.GetOk() || len(response.GetJobInfoList()) == 0 {
		logrus.Errorf("RunCommandOnJobNodes failed: Job %d not found", in.JobId)
		return nil, ce.RichError(codes.NotFound, "JOB_NOT_FOUND", "Job not found")
	}

	taskInfo := response.GetJobInfoList()[0]

	// 检查作业状态，只有运行中的作业才能执行命令
	if taskInfo.GetStatus() != craneProtos.JobStatus_Running {
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

func (s *ServerJob) GetPodLogs(in *protos.GetPodLogsRequest, stream grpc.ServerStreamingServer[protos.GetPodLogsResponse]) error {
	ctx := stream.Context()
	logrus.Infof("[GetPodLogs] podId=%s userId=%s", in.GetPodId(), in.GetUserId())

	// Parse "jobID-stepID-nodeName" from PodId (e.g. "381407-1-crane02")
	podId := in.GetPodId()
	parts := strings.Split(podId, utils.StepToPodNameEscape)
	if len(parts) != 3 {
		return ce.RichError(codes.InvalidArgument, "INVALID_POD_ID", fmt.Sprintf("invalid pod_id format, expected 'jobID-stepID-nodeName', got: %s", podId))
	}
	jobID64, err := strconv.ParseUint(parts[0], 10, 32)
	if err != nil {
		return ce.RichError(codes.InvalidArgument, "INVALID_POD_ID", fmt.Sprintf("invalid job ID %q: %v", parts[0], err))
	}
	jobID := uint32(jobID64)
	stepID64, err := strconv.ParseUint(parts[1], 10, 32)
	if err != nil {
		return ce.RichError(codes.InvalidArgument, "INVALID_POD_ID", fmt.Sprintf("invalid step ID %q: %v", parts[1], err))
	}
	stepID := uint32(stepID64)
	nodeName := parts[2]
	if nodeName == "" {
		return ce.RichError(codes.InvalidArgument, "INVALID_POD_ID", "nodeName field in pod_id cannot be empty")
	}

	// Query crane for job/step info
	job, step, err := utils.GetContainerStep(jobID, stepID, true)
	if err != nil {
		return ce.RichError(codes.NotFound, "CONTAINER_NOT_FOUND", err.Error())
	}
	if step.GetContainerMeta() == nil {
		return ce.RichError(codes.InvalidArgument, "NOT_A_CONTAINER", fmt.Sprintf("step %d.%d is not a container", jobID, stepID))
	}

	// Determine working directory
	cwd := step.GetCwd()
	if cwd == "" {
		cwd = job.GetCwd()
	}

	// Build log file path: {cwd}/{jobId}.out/{stepId}.{nodeName}.log
	logPath := filepath.Join(cwd, fmt.Sprintf("%d.out", jobID), fmt.Sprintf("%d.%s.log", stepID, nodeName))

	if _, statErr := os.Stat(logPath); os.IsNotExist(statErr) {
		return ce.RichError(codes.NotFound, "LOG_FILE_NOT_FOUND", fmt.Sprintf("log file not found: %s. Do you have shared storage?", logPath))
	}

	// Read initial log content, respecting optional tail line limit
	tailN := int(in.GetRowLimit()) // 0 means all lines
	lines, offset, err := podLogReadFile(logPath, tailN)
	if err != nil {
		return ce.RichError(codes.Internal, "READ_LOG_FAILED", err.Error())
	}

	if len(lines) > 0 {
		if sendErr := stream.Send(&protos.GetPodLogsResponse{Log: podLogBuildContent(lines)}); sendErr != nil {
			return sendErr
		}
	}

	// For non-running containers, sending the log snapshot is sufficient
	if step.GetStatus() != craneProtos.JobStatus_Running {
		return nil
	}

	// For running containers, poll the log file for new content every 3 seconds
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(3 * time.Second):
		}

		newContent, newOffset, readErr := podLogReadFromOffset(logPath, offset)
		offset = newOffset
		if readErr != nil || len(newContent) == 0 {
			continue
		}
		if sendErr := stream.Send(&protos.GetPodLogsResponse{Log: newContent}); sendErr != nil {
			return sendErr
		}
	}
}

func (s *ServerJob) submitToScheduler(task *craneProtos.JobToCtld) (uint32, error) {
	if err := utils.ValidateContainerJob(task); err != nil {
		return 0, fmt.Errorf("validation container job failed: %v", err)
	}

	reply, err := utils.SubmitContainerJob(task)
	if err != nil {
		return 0, fmt.Errorf(" submit container job failed: %v", err)
	}

	jobId, _, err := utils.GetContainerIDAndStepId(reply)
	if err != nil {
		return 0, fmt.Errorf(" get container job id failed: %v", err)
	}

	return jobId, nil
}

func (s *ServerJob) checkJob(accountName, userName, workdir string) error {
	// 先查询账户
	account, err := utils.GetAccountByName(accountName)
	if err != nil {
		message := fmt.Errorf("get account %v failed: %v", accountName, err)
		logrus.Errorf("[SubmitJob] %v", message)
		return message
	}
	if account.Blocked {
		message := fmt.Errorf("account %v is blocked", accountName)
		logrus.Errorf("[SubmitJob] %v", message)
		return message
	}

	user, err := utils.GetUserByName(userName)
	if err != nil {
		message := fmt.Errorf("get user %v failed: %v", userName, err)
		logrus.Errorf("[SubmitJob] %v", message)
		return message
	}
	if user.Blocked {
		message := fmt.Errorf("user %s is blocked", userName)
		logrus.Errorf("[SubmitJob]: %v", message)
		return message
	}

	// 工作目录由scow传过来一个绝对路径
	if !filepath.IsAbs(workdir) {
		message := fmt.Errorf("workdir %s is not absolute path", workdir)
		logrus.Errorf("[SubmitJob]: %v", message)
		return message
	}

	return nil
}

// isJobTypeMatch 判断已保存的作业类型字符串是否在请求的 JobTypes 列表中
func isJobTypeMatch(savedType string, jobTypes []protos.JobType) bool {
	for _, jt := range jobTypes {
		switch jt {
		case protos.JobType_JOB_TYPE_DEV_HOST:
			if savedType == utils.DevHost {
				return true
			}
		case protos.JobType_JOB_TYPE_TRAIN:
			if savedType == utils.Train {
				return true
			}
		case protos.JobType_JOB_TYPE_INFER:
			if savedType == utils.Inference {
				return true
			}
		case protos.JobType_JOB_TYPE_APP:
			if savedType == utils.APP {
				return true
			}
		}
	}
	return false
}

func hasUnsupportedJobTypes(jobTypes []protos.JobType) bool {
	for _, jt := range jobTypes {
		switch jt {
		case protos.JobType_JOB_TYPE_APP,
			protos.JobType_JOB_TYPE_TRAIN,
			protos.JobType_JOB_TYPE_INFER,
			protos.JobType_JOB_TYPE_DEV_HOST:
		default:
			return true
		}
	}
	return false
}

// podLogReadFile reads a log file and returns up to tailN last lines (0 = all) and the final file offset.
func podLogReadFile(logPath string, tailN int) ([]string, int64, error) {
	file, err := os.Open(logPath)
	if err != nil {
		return nil, 0, fmt.Errorf("open log file: %v", err)
	}
	defer file.Close()

	var lines []string
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	if err := scanner.Err(); err != nil {
		return nil, 0, fmt.Errorf("read log file: %v", err)
	}

	offset, _ := file.Seek(0, io.SeekCurrent)

	if tailN > 0 && tailN < len(lines) {
		lines = lines[len(lines)-tailN:]
	}
	return lines, offset, nil
}

// podLogReadFromOffset reads new content appended to logPath since the given byte offset.
func podLogReadFromOffset(logPath string, offset int64) (string, int64, error) {
	file, err := os.Open(logPath)
	if err != nil {
		return "", offset, fmt.Errorf("open log file: %v", err)
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil || info.Size() <= offset {
		return "", offset, err
	}

	if _, err := file.Seek(offset, io.SeekStart); err != nil {
		return "", offset, err
	}

	var lines []string
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	newOffset, _ := file.Seek(0, io.SeekCurrent)
	return podLogBuildContent(lines), newOffset, scanner.Err()
}

// podLogBuildContent strips the containerd log prefix (timestamp stream flag) and joins lines.
// Containerd format: "2025-09-19T16:56:32.827697838+08:00 stdout F <actual log line>"
func podLogBuildContent(lines []string) string {
	var sb strings.Builder
	for _, line := range lines {
		parts := strings.SplitN(line, " ", 4)
		if len(parts) >= 4 {
			sb.WriteString(parts[3])
		} else {
			sb.WriteString(line)
		}
		sb.WriteByte('\n')
	}
	return sb.String()
}
