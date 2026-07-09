package job

import (
	"context"
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc/codes"
	"google.golang.org/protobuf/types/known/timestamppb"
	"gorm.io/gorm"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/client"
	"scow-adapters/pkg/ai/db/models"
	"scow-adapters/pkg/ai/inference"
	"scow-adapters/pkg/ai/timer"
	"scow-adapters/pkg/ai/utils"
	ce "scow-adapters/pkg/common/error"
)

type ServerJob struct {
	pb.UnimplementedJobServiceServer
	Timer *timer.Timer
}

func OrderByStatusAndCreatedAt(db *gorm.DB) *gorm.DB {
	return db.Order(`
        CASE State
            WHEN 'Running' THEN 1
            WHEN 'Pending' THEN 2
            ELSE 3
        END
    `).Order("job_db_inx DESC")
}

func (s *ServerJob) SubmitScriptAsJob(ctx context.Context, in *pb.SubmitScriptAsJobRequest) (*pb.SubmitScriptAsJobResponse, error) {
	err := fmt.Errorf("not support")
	logrus.Warnf("SubmitScriptAsJob: %v", err)
	return nil, ce.RichError(codes.Internal, "NOT_SUPPORT", err.Error())
}

func (s *ServerJob) SubmitJob(ctx context.Context, in *pb.SubmitJobRequest) (*pb.SubmitJobResponse, error) {
	var (
		jobTable models.JobTable
		//appPort  = 20000 // 固定容器内应用的端口号
		gpuType string
		err     error
	)
	logrus.Infof("Received request SubmitJob: %v", in)
	if len(in.ExtraOptions) == 0 || (in.ExtraOptions[0] != utils.APP && in.ExtraOptions[0] != utils.Train) {
		return nil, ce.RichError(codes.Unimplemented, "HPC_JOBS_UNSUPPORTED", "AI adapter does not support HPC jobs.")
	}
	checkJobName := utils.IsValidString(in.JobName)
	if !checkJobName {
		err := fmt.Errorf("regex used for validation is '[a-zA-Z]([-a-zA-Z0-9]*[a-zA-Z0-9])?'")
		logrus.Errorf("SubmitJob failed %v", err)
		return nil, ce.RichError(codes.Internal, "JOB_NAME_INVALID", err.Error())
	}
	if err := CheckUserInfo(in.Account, in.UserId); err != nil {
		return nil, err
	}
	account, _ := utils.GetAccountByName(in.Account)
	currentTimestamp := time.Now().Unix()
	strNum := strconv.FormatInt(currentTimestamp, 10)

	// 获取group名字
	//groupName, err := utils.GetGroupName(in.UserId)
	//if err != nil {
	//	logrus.Errorf("SubmitJob failed %v", err)
	//	return nil, ce.RichError(codes.Internal, "FETCH_GROUP_FAILED", err.Error())
	//}
	// 工作目录由scow传过来一个绝对路径
	workdir := in.WorkingDirectory
	if !filepath.IsAbs(workdir) {
		err = fmt.Errorf("workdir %s is not absolute path", workdir)
		logrus.Errorf("SubmitJob failed: %v", err)
		return nil, ce.RichError(codes.Internal, "WORKDIR_IS_NOT_ABSOLUTE_PATH", err.Error())
	}
	// 校验队列最大卡数
	queue, err := utils.GetQueueByName(in.Partition)
	if err != nil {
		return nil, ce.RichError(codes.Internal, "GET_QUEUE_FAILED", err.Error())
	}
	if in.GpuCount > queue.MaxAcceleratorsPerPod {
		return nil, ce.RichError(codes.Internal, "MAX_ACCELERATORS_PER_POD_LIMIT", fmt.Sprintf("The maximum acceleration limit for the queue is %d", queue.MaxAcceleratorsPerPod))
	}
	// 校验申请资源
	reqMem := int64(*in.MemoryMb / uint64(in.NodeCount))
	if err := utils.CheckQueueAllocateResource(in.Partition, int64(in.CoreCount), reqMem, int64(in.NodeCount)); err != nil {
		return nil, ce.RichError(codes.Internal, "REQUEST_RESOURCE_FAILED", err.Error())
	}
	// 生成的新的作业
	newJobName := strings.ToLower(in.JobName) + "-" + strNum

	// 先写库，再提交到k8s
	currentTime := time.Now().Unix()
	// 报错作业信息
	if in.GpuCount == 0 {
		gpuType = "-"
	} else {
		gpuType = in.ExtraOptions[7]
	}
	jobTable = models.JobTable{
		Account:    in.Account,
		CPUsReq:    uint(in.CoreCount) * uint(in.NodeCount),
		GPUsReq:    uint(in.GpuCount) * uint(in.NodeCount),
		PODsReq:    uint(in.NodeCount),
		JobName:    in.JobName,
		NewJobName: newJobName,
		UserName:   in.UserId,
		//Group:      groupName,
		MemReq:     *in.MemoryMb,
		Partition:  in.Partition,
		State:      utils.PendingStatus,
		Timelimit:  uint(*in.TimeLimitMinutes),
		TimeSubmit: uint64(currentTime),
		WorkDir:    in.WorkingDirectory,
		GpuType:    gpuType,
		JobType:    in.ExtraOptions[0],
		Qos:        in.GetQos(),
	}

	if in.GetTensorBoardDataPath() != "" {
		jobTable.TensorboardLogPath = *in.TensorBoardDataPath
	}

	usedGpuNum, err := utils.GetAccountUsedGpuNum(in.Account)
	if err != nil {
		logrus.Errorf("SubmitJob failed %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	if account.GpuQuota > 0 && in.GpuCount > 0 && usedGpuNum+in.GpuCount > account.GpuQuota {
		logrus.Infof("SubmitJob account %v gpu request %v has exceeded the remaining %v", in.Account, in.GpuCount, account.GpuQuota-usedGpuNum)
		jobTable.State = utils.QueuedStatus
		jobTable.Reason = fmt.Sprintf("The account %v gpu quota: %v, used: %v, req %v will exceed the quota. "+
			"job will be queued and submit automatically after the gpu meets the quota", account.Name, account.GpuQuota, usedGpuNum, in.GpuCount)
		err = client.DB.Create(&jobTable).Error
		if err != nil {
			logrus.Errorf("SubmitJob sql create failed: %v", err)
			return nil, err
		}

		err := SaveJobSubmitInfoToFile(in, nil, newJobName, workdir)
		if err != nil {
			go func() {
				err = client.DB.Where("job_db_inx = ?", jobTable.JobDBInx).Delete(&models.JobTable{}).Error
				logrus.Infof("delete DB jobname %s, err: %v", jobTable.NewJobName, err)
			}()
			logrus.Errorf("SubmitJob queued job info file create failed: %v", err)
			return nil, err
		}

		return &pb.SubmitJobResponse{JobId: uint32(jobTable.JobDBInx)}, nil
	}

	err = client.DB.Create(&jobTable).Error
	if err != nil {
		logrus.Errorf("SubmitJob sql create failed: %v", err)
		return nil, err
	}
	if in.ExtraOptions[0] == utils.Train {
		err = TrainVCJob(in, newJobName, workdir)
	} else {
		err = AppVCJob(in, newJobName, workdir)
	}
	// 提交到k8s失败，需要删除数据库信息
	if err != nil {
		go func() {
			err = client.DB.Where("job_db_inx = ?", jobTable.JobDBInx).Delete(&models.JobTable{}).Error
			logrus.Infof("delete DB jobname %s, err: %v", jobTable.NewJobName, err)
		}()
		logrus.Infof("SubmitJob %s to k8s failed, err: %s", newJobName, err)
		return nil, ce.RichError(codes.Internal, "SubmitJob_K8s_Failed", err.Error())
	}
	logrus.Infof("SubmitJob success, job: %v, job index: %v", in.JobName, jobTable.JobDBInx)

	return &pb.SubmitJobResponse{JobId: uint32(jobTable.JobDBInx)}, nil
}

func (s *ServerJob) GetJobs(ctx context.Context, in *pb.GetJobsRequest) (*pb.GetJobsResponse, error) {
	var (
		totalCount      int64
		startTimeFilter int64
		endTimeFilter   int64
		submitStartTime int64
		submitEndTime   int64
		pageLimit       int
		jobDetail       []*pb.JobInfo
		fields          = in.Fields // 筛选需要返回的字段
		orderStr        string
		conditions      []string
		values          []interface{}
		queryJobs       *gorm.DB
	)
	logrus.Infof("Received request GetJobs: %v", in)

	if len(in.JobTypes) == 0 {
		return nil, ce.RichError(codes.Unimplemented, "HPC_JOBS_UNSUPPORTED", "AI adapter does not support HPC jobs.")
	}
	if len(GetJobTypes(in.JobTypes)) != len(in.JobTypes) {
		return nil, ce.RichError(codes.Unimplemented, "AI_JOB_TYPES_UNSUPPORTED", "AI adapter does not support requested job types.")
	}

	// 状态筛选、用户筛选、时间筛选、分页
	var jobs []models.JobTable
	if in.Sort != nil {
		orderStr = fmt.Sprintf("job_db_inx %s", in.Sort.GetOrder().String())
	} else {
		orderStr = "job_db_inx ASC" // 默认就是升序排列
	}
	logrus.Tracef("job type: %v", in.JobTypes)
	if len(in.JobTypes) > 0 {
		conditions = append(conditions, "job_type IN (?)")
		values = append(values, GetJobTypes(in.JobTypes))
	}

	if in.Filter != nil {
		if in.Filter.EndTime != nil {
			if in.Filter.EndTime.StartTime != nil {
				startTimeFilter = in.Filter.EndTime.StartTime.GetSeconds()
				conditions = append(conditions, "time_end >= ? OR ? = ?")
				values = append(values, startTimeFilter, startTimeFilter, time.Time{})
			}
			if in.Filter.EndTime.EndTime != nil {
				endTimeFilter = in.Filter.EndTime.EndTime.GetSeconds()
				conditions = append(conditions, "time_end <= ? OR ? = ?")
				values = append(values, endTimeFilter, endTimeFilter, time.Time{})
			}
		}
		if in.Filter.SubmitTime != nil {
			if in.Filter.SubmitTime.StartTime != nil {
				submitStartTime = in.Filter.SubmitTime.StartTime.GetSeconds()
				conditions = append(conditions, "time_submit >= ? OR ? = ?")
				values = append(values, submitStartTime, submitStartTime, time.Time{})
			}
			if in.Filter.SubmitTime.EndTime != nil {
				submitEndTime = in.Filter.SubmitTime.EndTime.GetSeconds()
				conditions = append(conditions, "time_submit <= ? OR ? = ?")
				values = append(values, submitEndTime, submitEndTime, time.Time{})
			}
		}
		if in.Filter.Users != nil {
			conditions = append(conditions, "username IN (?)")
			values = append(values, in.Filter.Users)
		}
		if in.Filter.States != nil {
			conditions = append(conditions, "state IN (?)")
			values = append(values, in.Filter.States)
		}
		if in.Filter.Accounts != nil {
			conditions = append(conditions, "account IN (?)")
			values = append(values, in.Filter.Accounts)
		}
		// 多加两个查询条件
		if in.Filter.JobName != nil {
			conditions = append(conditions, "job_name = ?")
			values = append(values, *in.Filter.JobName)
		}
		if in.Filter.JobId != nil {
			conditions = append(conditions, "job_db_inx = ?")
			values = append(values, *in.Filter.JobId)
		}
		// 将所有条件组合成一个字符串
		combinedConditions := strings.Join(conditions, " AND ")
		if len(in.JobTypes) > 0 && ContainsJobType(in.JobTypes, pb.JobType_JOB_TYPE_DEV_HOST) {
			queryJobs = client.DB.Where(combinedConditions, values...).Scopes(OrderByStatusAndCreatedAt)
		} else {
			queryJobs = client.DB.Where(combinedConditions, values...).Order(orderStr)
		}

		if in.PageInfo != nil {
			page := in.PageInfo.Page         // 每页记录数
			pageSize := in.PageInfo.PageSize // 当前页码， 从1开始
			pageLimit = int(pageSize)
			offset := (int(page) - 1) * pageLimit
			if err := queryJobs.Limit(pageLimit).Offset(offset).Find(&jobs).Error; err != nil {
				logrus.Errorf("GetJobs failed %v", err)
				return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
			}
			jobDetail = utils.GetJobInfo(jobs, fields)
			queryTotal := queryJobs.Model(&models.JobTable{}).Where(combinedConditions, values...)
			if err := queryTotal.Count(&totalCount).Error; err != nil {
				logrus.Errorf("GetJobs failed %v", err)
				return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
			}
			totalNum := uint32(totalCount)
			logrus.Tracef("GetJobs Jobs: %v, total: %v", jobDetail, totalNum)
			return &pb.GetJobsResponse{Jobs: jobDetail, TotalCount: &totalNum}, nil
		} else {
			if err := queryJobs.Find(&jobs).Error; err != nil {
				logrus.Errorf("GetJobs failed %v", err)
				return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
			}
			jobDetail = utils.GetJobInfo(jobs, fields)
			queryTotal := queryJobs.Model(&models.JobTable{}).Where(combinedConditions, values...)
			if err := queryTotal.Count(&totalCount).Error; err != nil {
				logrus.Errorf("GetJobs failed %v", err)
				return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
			}
			totalNum := uint32(totalCount)
			logrus.Tracef("GetJobs Jobs: %v, total: %v", jobDetail, totalNum)
			return &pb.GetJobsResponse{Jobs: jobDetail, TotalCount: &totalNum}, nil
		}
	} else {
		combinedConditions := strings.Join(conditions, " AND ")
		logrus.Tracef("combinedConditions: %s，values：%v", combinedConditions, values)
		if len(in.JobTypes) > 0 && ContainsJobType(in.JobTypes, pb.JobType_JOB_TYPE_DEV_HOST) {
			queryJobs = client.DB.Where(combinedConditions, values...).Scopes(OrderByStatusAndCreatedAt)
		} else {
			queryJobs = client.DB.Where(combinedConditions, values...).Order(orderStr)
		}
		// 不带查询条件
		if in.PageInfo != nil {
			page := in.PageInfo.Page         // 每页记录数
			pageSize := in.PageInfo.PageSize // 当前页码， 从1开始
			pageLimit = int(pageSize)
			offset := (int(page) - 1) * pageLimit
			// 将所有条件组合成一个字符串
			if err := queryJobs.Limit(pageLimit).Offset(offset).Find(&jobs).Error; err != nil {
				logrus.Errorf("GetJobs failed %v", err)
				return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
			}
			jobDetail = utils.GetJobInfo(jobs, fields)
			// 获取总的页数
			if err := queryJobs.Model(&models.JobTable{}).Count(&totalCount).Error; err != nil {
				logrus.Errorf("GetJobs failed %v", err)
				return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
			}
			totalNum := uint32(totalCount)
			logrus.Tracef("GetJobs Jobs: %v, total: %v", jobDetail, totalNum)
			return &pb.GetJobsResponse{Jobs: jobDetail, TotalCount: &totalNum}, nil
		} else {
			if err := queryJobs.Find(&jobs).Error; err != nil {
				logrus.Errorf("GetJobs failed %v", err)
				return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
			}
			jobDetail = utils.GetJobInfo(jobs, fields)
			// 获取总的页数
			if err := queryJobs.Model(&models.JobTable{}).Count(&totalCount).Error; err != nil {
				logrus.Errorf("GetJobs failed %v", err)
				return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
			}
			totalNum := uint32(totalCount)
			logrus.Tracef("GetJobs Jobs: %v, total: %v", jobDetail, totalNum)
			return &pb.GetJobsResponse{Jobs: jobDetail, TotalCount: &totalNum}, nil
		}
	}
}

// GetJobById 获取单个作业接口
func (s *ServerJob) GetJobById(ctx context.Context, in *pb.GetJobByIdRequest) (*pb.GetJobByIdResponse, error) {
	var (
		elapsedSeconds     int64
		nodeList           string
		cpusAlloc          int32
		memAllocMb         int64
		nodesAlloc         int32
		stdoutPath         string
		stderrPath         string
		gpusAlloc          int32
		podInfo            []*pb.JobInfo_PodInfo
		TensorBoardInfo    *pb.JobInfo_TensorboardInfo
		startTimeTimestamp *timestamppb.Timestamp
	)
	TensorBoardInfo = &pb.JobInfo_TensorboardInfo{}
	jobId := strconv.Itoa(int(in.JobId))
	logrus.Infof("Received request GetJobById: %v", in)
	var fields []string = in.Fields
	jobInfo := models.JobTable{}
	err := client.DB.Where("job_db_inx = ?", jobId).First(&jobInfo).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			err = fmt.Errorf("job not found")
			logrus.Errorf("GetJobById failed %v", err)
			return nil, ce.RichError(codes.NotFound, "JOB_NOT_FOUND", err.Error())
		} else {
			logrus.Errorf("GetJobById failed %v", err)
			return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
		}
	}
	logrus.Infof("GetJobById jobname: %s", jobInfo.NewJobName)
	if jobInfo.State != "PENDING" {
		nodesAlloc = int32(jobInfo.PODsReq)
		cpusAlloc = int32(jobInfo.CPUsReq)
		memAllocMb = int64(jobInfo.MemReq)
		gpusAlloc = int32(jobInfo.GPUsReq)
	}
	// 类型转换
	submitTimeTimestamp := &timestamppb.Timestamp{Seconds: int64(time.Unix(int64(jobInfo.TimeSubmit), 0).Unix())}
	if jobInfo.TimeStart == 0 {
		startTimeTimestamp = &timestamppb.Timestamp{Seconds: int64(time.Unix(int64(jobInfo.TimeEnd), 0).Unix())}
	} else {
		startTimeTimestamp = &timestamppb.Timestamp{Seconds: int64(time.Unix(int64(jobInfo.TimeStart), 0).Unix())}
	}
	endTimeTimestamp := &timestamppb.Timestamp{Seconds: int64(time.Unix(int64(jobInfo.TimeEnd), 0).Unix())}

	podTables := utils.GetPodsByJobName(jobInfo.NewJobName)
	if jobInfo.State == utils.PendingStatus && len(podTables) <= int(jobInfo.PODsReq) {
		elapsedSeconds = 0
	} else if jobInfo.JobType == utils.Inference { // deploy 类型的作业，计费单独算
		elapsedSeconds = utils.GetElapsedSecondsByDeployPods(&jobInfo, podTables)
	} else {
		elapsedSeconds = utils.GetVCJobDurationByJobName(&jobInfo, podTables)
	}
	if podInfo = utils.GetPodInfoFromPodTables(podTables); len(podInfo) == 0 {
		logrus.Warnf("GetPodInfo  is null")
	}
	events := utils.GetEventsById(jobId, Job)
	logrus.Tracef("GetJobById, len fields %d, podInfo %v, events: %v", len(fields), podInfo, events)
	logrus.Infof("job %s, TensorboardPort: %d", jobInfo.NewJobName, jobInfo.TensorboardPort)
	if jobInfo.TensorboardPort != 0 {
		hostname, _ := utils.GetClusterMasterNodeHostname()
		TensorBoardInfo.Node = hostname
		TensorBoardInfo.Port = int32(jobInfo.TensorboardPort)
	}
	if len(fields) == 0 {
		jobInfoDetail := &pb.JobInfo{
			JobId:            in.JobId,
			Name:             jobInfo.JobName,
			User:             jobInfo.UserName,
			Reason:           &jobInfo.Reason,
			Account:          jobInfo.Account,
			Partition:        jobInfo.Partition,
			State:            jobInfo.State,
			CpusReq:          int32(jobInfo.CPUsReq),
			MemReqMb:         int64(jobInfo.MemReq),
			TimeLimitMinutes: int64(jobInfo.Timelimit),
			SubmitTime:       submitTimeTimestamp,
			WorkingDirectory: jobInfo.WorkDir,
			NodeList:         &nodeList,
			StartTime:        startTimeTimestamp,
			EndTime:          endTimeTimestamp,
			NodesAlloc:       &nodesAlloc,
			CpusAlloc:        &cpusAlloc,
			MemAllocMb:       &memAllocMb,
			NodesReq:         int32(jobInfo.PODsReq),
			StdoutPath:       &stdoutPath,
			StderrPath:       &stderrPath,
			ElapsedSeconds:   &elapsedSeconds,
			GpusAlloc:        &gpusAlloc,
			Qos:              jobInfo.Qos,
			Pods:             podInfo,
			Events:           events,
			GpusReq:          int32(jobInfo.GPUsReq),
			TensorBoardInfo:  TensorBoardInfo,
			UniqueJobName:    jobInfo.NewJobName,
		}
		logrus.Infof("GetJobById Response: %v", jobInfoDetail)
		return &pb.GetJobByIdResponse{Job: jobInfoDetail}, nil
	}

	jobInfoDetail := &pb.JobInfo{}

	for _, field := range fields {
		switch field {
		case "job_id":
			jobInfoDetail.JobId = in.JobId
		case "name":
			jobInfoDetail.Name = jobInfo.JobName
		case "account":
			jobInfoDetail.Account = jobInfo.Account
		case "user":
			jobInfoDetail.User = jobInfo.UserName
		case "partition":
			jobInfoDetail.Partition = jobInfo.Partition
		case "state":
			jobInfoDetail.State = jobInfo.State
		case "cpus_req":
			jobInfoDetail.CpusReq = int32(jobInfo.CPUsReq)
		case "mem_req_mb":
			jobInfoDetail.MemReqMb = int64(jobInfo.MemReq)
		case "nodes_req":
			jobInfoDetail.NodesReq = int32(jobInfo.PODsReq)
		case "time_limit_minutes":
			jobInfoDetail.TimeLimitMinutes = int64(jobInfo.Timelimit)
		case "submit_time":
			jobInfoDetail.SubmitTime = submitTimeTimestamp
		case "working_directory":
			jobInfoDetail.WorkingDirectory = jobInfo.WorkDir
		case "stdout_path":
			jobInfoDetail.StdoutPath = &stdoutPath
		case "stderr_path":
			jobInfoDetail.StderrPath = &stderrPath
		case "start_time":
			jobInfoDetail.StartTime = startTimeTimestamp
		case "elapsed_seconds":
			jobInfoDetail.ElapsedSeconds = &elapsedSeconds
		case "reason":
			jobInfoDetail.Reason = &jobInfo.Reason
		case "node_list":
			jobInfoDetail.NodeList = &nodeList
		case "gpus_alloc":
			jobInfoDetail.GpusAlloc = &gpusAlloc
		case "cpus_alloc":
			jobInfoDetail.CpusAlloc = &cpusAlloc
		case "mem_alloc_mb":
			jobInfoDetail.MemAllocMb = &memAllocMb
		case "nodes_alloc":
			jobInfoDetail.NodesAlloc = &nodesAlloc
		case "end_time":
			jobInfoDetail.EndTime = endTimeTimestamp
		case "qos":
			jobInfoDetail.Qos = jobInfo.Qos
		case "pods":
			jobInfoDetail.Pods = podInfo
		case "events":
			jobInfoDetail.Events = events
		case "gpus_req":
			jobInfoDetail.GpusReq = int32(jobInfo.GPUsReq)
		case "tensor_board_info":
			jobInfoDetail.TensorBoardInfo = TensorBoardInfo
		case "unique_job_name":
			jobInfoDetail.UniqueJobName = jobInfo.NewJobName
		}
	}
	logrus.Infof("GetJobById Response: %v", jobInfoDetail)
	return &pb.GetJobByIdResponse{Job: jobInfoDetail}, nil
}

func (s *ServerJob) CancelJob(ctx context.Context, in *pb.CancelJobRequest) (*pb.CancelJobResponse, error) {
	logrus.Infof("Received request CancelJob: %v", in)
	var NewState string
	jobInfo, err := utils.GetJobsByUserAndId(in.UserId, in.JobId)
	if err != nil {
		logrus.Errorf("CancelJob failed %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if jobInfo == nil {
		logrus.Errorf("CancelJob failed: job  %d not found", in.JobId)
		return nil, ce.RichError(codes.NotFound, "JOB_NOT_FOUND", fmt.Sprintf("job %d not found", in.JobId))
	}

	jobName := jobInfo.NewJobName
	state := jobInfo.State
	logrus.Infof("job name: %s, status:%s", jobName, state)

	if state == utils.QueuedStatus {
		err = utils.DeleteJobById(in.JobId)
		if err != nil {
			logrus.Errorf("CancelJob failed %v", err)
			return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
		}
		logrus.Infof("Cancel job %s success！", jobName)
		return &pb.CancelJobResponse{}, nil
	}
	if state == utils.CanceledStatus {
		logrus.Infof("Cancel job %s ignored because it is already canceled", jobName)
		return &pb.CancelJobResponse{}, nil
	}
	if state == utils.FailedStatus {
		// 失败状态保留在数据库中；取消请求只作为幂等资源清理入口。
		if errCode, err := cleanupJobResource(jobInfo); err != nil {
			logrus.Errorf("CancelJob cleanup failed job %s: %v", jobName, err)
			return nil, ce.RichError(codes.Internal, errCode, err.Error())
		}
		logrus.Infof("Cancel failed job %s cleanup success", jobName)
		return &pb.CancelJobResponse{}, nil
	}
	NewState = utils.CanceledStatus
	if state == utils.PendingStatus || state == utils.RunningStatus {
		timeEnd := time.Now().Unix()
		jobInfo.JobDBInx = uint64(in.JobId)
		jobInfo.ModTime = uint64(timeEnd)
		jobInfo.TimeEnd = uint64(timeEnd)

		if state == "PENDING" {
			jobInfo.CPUsAlloc = 0
			jobInfo.GPUsAlloc = 0
			jobInfo.MemAlloc = 0
			jobInfo.TimeStart = uint64(timeEnd)
			jobInfo.PODsAlloc = 0
		} else {
			jobInfo.CPUsAlloc = jobInfo.CPUsReq
			jobInfo.MemAlloc = uint(jobInfo.MemReq)
			jobInfo.PODsAlloc = jobInfo.PODsReq
			switch jobInfo.JobType {
			case utils.Inference, utils.APP:
				NewState = utils.CanceledStatus
			case utils.Train:
				NewState = utils.CanceledStatus
			default:
				NewState = utils.CanceledStatus
			}
		}

		// 取消任务
		if errCode, err := cleanupJobResource(jobInfo); err != nil {
			logrus.Errorf("CancelJob failed %v", err)
			return nil, ce.RichError(codes.Internal, errCode, err.Error())
		}

		// 取消作业成功后更新数据库
		if err := client.DB.Model(&jobInfo).Updates(models.JobTable{
			Reason:    "Cancel",
			ModTime:   jobInfo.ModTime,
			State:     NewState,
			PODsAlloc: jobInfo.PODsAlloc,
			TimeStart: jobInfo.TimeStart,
			MemAlloc:  jobInfo.MemAlloc,
			TimeEnd:   jobInfo.TimeEnd,
			CPUsAlloc: jobInfo.CPUsAlloc,
			GPUsAlloc: jobInfo.GPUsAlloc}).Error; err != nil {
			logrus.Errorf("CancelJob failed %v", err)
			return nil, ce.RichError(codes.Internal, "SQL_UPDATE_FAILED", err.Error())
		}
		logrus.Infof("Cancel job %s success！", jobName)
		return &pb.CancelJobResponse{}, nil
	}

	err = fmt.Errorf("the job %v state %s", jobName, state)
	logrus.Errorf("CancelJob failed %v", err)
	return nil, ce.RichError(codes.Internal, "JOB_COMPLETED", err.Error())
}

func cleanupJobResource(jobInfo *models.JobTable) (string, error) {
	if jobInfo.JobType == utils.InferJob {
		k8sClient, err := utils.GetK8sClient()
		if err != nil {
			logrus.Errorf("failed to build k8s client: %v", err)
			return "NEW_K8S_CLIENT_FAILED", err
		}
		logrus.Infof("CancelJob: JobType： %v, job name: %v", jobInfo.JobType, jobInfo.NewJobName)
		return "CANCEL_INFERENCE_JOB_FAILED", utils.LocalCancelInferenceJob(jobInfo.NewJobName, jobInfo.GpuType, jobInfo.Partition, k8sClient)
	}
	return "CANCEL_JOB_FAILED", CancelVCJob(jobInfo.NewJobName, jobInfo.UserName)
}

func (s *ServerJob) ChangeJobTimeLimit(ctx context.Context, in *pb.ChangeJobTimeLimitRequest) (*pb.ChangeJobTimeLimitResponse, error) {
	logrus.Infof("Received request ChangeJobTimeLimit: %v", in)
	job, exits, err := utils.GetJobInfoById(in.JobId)
	if err != nil {
		logrus.Errorf("ChangeJobTimeLimit failed %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exits {
		err = fmt.Errorf("job not found")
		logrus.Errorf("ChangeJobTimeLimit failed %v", err)
		return nil, ce.RichError(codes.NotFound, "JOB_NOT_FOUND", err.Error())
	}

	state := job.State
	timeLimit := int64(job.Timelimit)
	pods := utils.GetPodsByJobName(job.NewJobName)
	if state == "PENDING" || state == "RUNNING" {
		var elapsedSeconds int64
		if state == "RUNNING" {
			if job.JobType == utils.Inference { // deploy 类型的作业，计费单独算
				elapsedSeconds = utils.GetElapsedSecondsByDeployPods(job, pods)
			} else {
				elapsedSeconds = utils.GetVCJobDurationByJobName(job, pods)
			}
			logrus.Infof("job %v elapsed seconds %v", job.NewJobName, elapsedSeconds)
		}

		timeLimit = timeLimit + in.DeltaMinutes
		remaining := timeLimit*60 - elapsedSeconds
		// 更新后的值不能小于0
		if timeLimit <= 0 {
			err = fmt.Errorf("the job timelimit is negative")
			logrus.Errorf("ChangeJobTimeLimit failed %v", err)
			return nil, ce.RichError(codes.Internal, "JOB_TIMELIMIT_NEGATIVE", err.Error())
		}
		// 更新数据库的值
		currentTime := time.Now().Unix()
		job.JobDBInx = uint64(in.JobId)
		job.Timelimit = uint(timeLimit)
		job.ModTime = uint64(currentTime)
		if err := client.DB.Model(&job).Updates(models.JobTable{
			ModTime:   job.ModTime,
			Timelimit: job.Timelimit}).Error; err != nil {
			logrus.Errorf("ChangeJobTimeLimit failed %v", err)
			return nil, ce.RichError(codes.Internal, "SQL_UPDATE_FAILED", err.Error())
		}

		logrus.Infof("Updated timeout for job %s, new timeout: %d seconds", job.NewJobName, remaining)
		if state == "RUNNING" {
			// 原子获取并删除定时器
			cancel, loaded := s.Timer.Timers.LoadAndDelete(job.NewJobName)
			if loaded {
				if cancelFn, ok := cancel.(context.CancelFunc); ok {
					// 带有限等待和强制取消
					done := make(chan struct{})
					go func() {
						cancelFn()
						close(done)
					}()

					// 等待合理时间
					select {
					case <-done:
					case <-time.After(3 * time.Second): //
						logrus.Warnf("failed delete timer, force delete now")
						// 强制清理老定时器
						s.Timer.Timers.Delete(job.NewJobName)
					}
				}
			}

			// 启动新定时器
			s.Timer.StartTimer(job, remaining)
		}

		return &pb.ChangeJobTimeLimitResponse{}, nil
	}

	err = fmt.Errorf("job is %s state, no need to modify time limit", job.State)
	logrus.Errorf("ChangeJobTimeLimit failed %v", err)
	return nil, ce.RichError(codes.Internal, "JOB_COMPLETED", err.Error())
}

func (s *ServerJob) QueryJobTimeLimit(ctx context.Context, in *pb.QueryJobTimeLimitRequest) (*pb.QueryJobTimeLimitResponse, error) {
	logrus.Infof("Received request QueryJobTimeLimit: %v", in)
	job, exits, err := utils.GetJobInfoById(in.JobId)
	if err != nil {
		logrus.Errorf("ChangeJobTimeLimit failed %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exits {
		err = fmt.Errorf("job not found")
		logrus.Errorf("ChangeJobTimeLimit failed %v", err)
		return nil, ce.RichError(codes.NotFound, "JOB_NOT_FOUND", err.Error())
	}

	state := job.State
	if state == "PENDING" || state == "RUNNING" {
		timeLimit := job.Timelimit
		logrus.Infof("QueryJobTimeLimit timeLimit %v", timeLimit)
		return &pb.QueryJobTimeLimitResponse{TimeLimitMinutes: uint64(timeLimit)}, nil
	}
	err = fmt.Errorf("job is %s state, no need to modify time limit", job.State)
	logrus.Errorf("QueryJobTimeLimit failed %v", err)
	return nil, ce.RichError(codes.Internal, "JOB_COMPLETED", err.Error())
}

func (s *ServerJob) SubmitInferJob(ctx context.Context, in *pb.SubmitInferJobRequest) (*pb.SubmitInferJobResponse, error) {
	var jobTable models.JobTable
	logrus.Infof("Received request SubmitInferJob: %v", in)

	checkJobName := utils.IsValidString(in.JobName)
	if !checkJobName {
		err := fmt.Errorf("regex used for validation is '[a-zA-Z]([-a-zA-Z0-9]*[a-zA-Z0-9])?'")
		logrus.Errorf("SubmitInferJob failed %v", err)
		return nil, ce.RichError(codes.Internal, "JOB_NAME_INVALID", err.Error())
	}

	// 检查账号名是否存在
	exist, err := utils.SelectAccountExists(in.Account)
	if err != nil {
		logrus.Errorf("SubmitJob failed %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("account %s not found", in.Account)
		logrus.Errorf("SubmitJob failed %v", err)
		return nil, ce.RichError(codes.NotFound, "ACCOUNT_NOT_FOUND", err.Error())
	}

	account, err := utils.GetAccountByName(in.Account)
	if err != nil {
		logrus.Errorf("SubmitJob query account %s failed: %v", in.Account, err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	if account.Blocked == 1 {
		err = fmt.Errorf("the account has been blocked")
		logrus.Errorf("SubmitJob failed %v", err)
		return nil, ce.RichError(codes.Internal, "ACCOUNT_BLOCKED", err.Error())
	}

	// 检查用户名是否在
	exist, err = utils.SelectUserExists(in.UserId)
	if err != nil {
		logrus.Errorf("SubmitJob failed %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("user %s not found", in.UserId)
		logrus.Errorf("SubmitJob failed %v", err)
		return nil, ce.RichError(codes.NotFound, "USER_NOT_FOUND", err.Error())
	}

	// 判断账户与用户关联是否存在
	associate, err := utils.GetAssociateByAccountAndUser(in.Account, in.UserId)
	if err != nil {
		logrus.Errorf("SubmitJob get associate by account %v and user: %v failed: %v", in.Account, in.UserId, err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if associate == nil {
		err = fmt.Errorf("the assoc not found")
		logrus.Errorf("SubmitJob failed %v", err)
		return nil, ce.RichError(codes.NotFound, "ASSOC_NOT_FOUND", err.Error())
	}

	// 获取配置信息
	if associate.Blocked == 1 {
		err = fmt.Errorf("the user has been blocked")
		logrus.Errorf("SubmitJob failed %v", err)
		return nil, ce.RichError(codes.Internal, "USER_BLOCKED", err.Error())
	}

	currentTimestamp := time.Now().Unix()
	strNum := strconv.FormatInt(currentTimestamp, 10)

	// 获取group名字
	//groupName, err := utils.GetGroupName(in.UserId)
	//if err != nil {
	//	logrus.Errorf("SubmitJob failed %v", err)
	//	return nil, ce.RichError(codes.Internal, "FETCH_GROUP_FAILED", err.Error())
	//}
	// 工作目录由scow传过来一个绝对路径
	workdir := in.WorkingDirectory
	if !filepath.IsAbs(workdir) {
		err = fmt.Errorf("workdir %s is not absolute path", workdir)
		logrus.Errorf("SubmitJob failed: %v", err)
		return nil, ce.RichError(codes.Internal, "WORKDIR_IS_NOT_ABSOLUTE_PATH", err.Error())
	}
	// 校验队列最大卡数
	queue, err := utils.GetQueueByName(in.Partition)
	if err != nil {
		return nil, ce.RichError(codes.Internal, "GET_QUEUE_FAILED", err.Error())
	}
	if in.GpuCount > queue.MaxAcceleratorsPerPod {
		return nil, ce.RichError(codes.Internal, "MAX_ACCELERATORS_PER_POD_LIMIT", fmt.Sprintf("The maximum acceleration limit for the queue is %d", queue.MaxAcceleratorsPerPod))
	}
	// 校验申请资源
	reqMem := int64(*in.MemoryMb / uint64(in.NodeCount))
	if err := utils.CheckQueueAllocateResource(in.Partition, int64(in.CoreCount), reqMem, int64(in.NodeCount)); err != nil {
		return nil, ce.RichError(codes.Internal, "REQUEST_RESOURCE_FAILED", err.Error())
	}
	newJobName := strings.ToLower(in.JobName) + "-" + strNum

	timeLimit := *in.TimeLimitMinutes
	currentTime := time.Now().Unix()
	var gpuType string
	if in.GpuCount == 0 {
		gpuType = "-"
	} else {
		gpuType = in.ExtraOptions[3]
	}
	jobTable = models.JobTable{
		Account:    in.Account,
		CPUsReq:    uint(in.CoreCount) * uint(in.NodeCount),
		GPUsReq:    uint(in.GpuCount),
		PODsReq:    uint(in.NodeCount),
		JobName:    in.JobName,
		NewJobName: newJobName,
		UserName:   in.UserId,
		//Group:      groupName,
		MemReq:     *in.MemoryMb,
		Partition:  in.Partition,
		State:      utils.PendingStatus,
		Timelimit:  uint(timeLimit),
		TimeSubmit: uint64(currentTime),
		WorkDir:    in.WorkingDirectory,
		GpuType:    gpuType,
		JobType:    utils.Inference,
		Qos:        in.GetQos(),
	}

	usedGpuNum, err := utils.GetAccountUsedGpuNum(in.Account)
	if err != nil {
		logrus.Errorf("SubmitJob failed %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	if account.GpuQuota > 0 && in.GpuCount > 0 && usedGpuNum+in.GpuCount > account.GpuQuota {
		logrus.Infof("SubmitInferJob account %v gpu request %v has exceeded the remaining %v", in.Account, in.GpuCount, account.GpuQuota-usedGpuNum)
		jobTable.State = utils.QueuedStatus
		jobTable.Reason = fmt.Sprintf("The account %v gpu quota: %v, used: %v, req %v will exceed the quota. "+
			"job will be queued and submit automatically after the gpu meets the quota", account.Name, account.GpuQuota, usedGpuNum, in.GpuCount)
		err = client.DB.Create(&jobTable).Error
		if err != nil {
			logrus.Errorf("SubmitInferJob sql create failed: %v", err)
			return nil, err
		}

		err := SaveJobSubmitInfoToFile(nil, in, newJobName, workdir)
		if err != nil {
			go func() {
				err = client.DB.Where("job_db_inx = ?", jobTable.JobDBInx).Delete(&models.JobTable{}).Error
				logrus.Infof("delete DB jobname %s, err: %v", jobTable.NewJobName, err)
			}()
			logrus.Errorf("SubmitInferJob queued job info file create failed: %v", err)
			return nil, err
		}
		return &pb.SubmitInferJobResponse{JobId: uint32(jobTable.JobDBInx)}, nil
	}

	err = client.DB.Create(&jobTable).Error
	if err != nil {
		logrus.Errorf("SubmitInferJob sql create failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_CREATE_FAILED", err.Error())
	}

	_, err = inference.SubmitInference(in, newJobName, workdir)
	if err != nil {
		go func() {
			err = client.DB.Where("job_db_inx = ?", jobTable.JobDBInx).Delete(&models.JobTable{}).Error
			logrus.Infof("delete DB jobname %s, err: %v", jobTable.NewJobName, err)
		}()
		logrus.Errorf("SubmitInferJob failed %v", err)
		return nil, ce.RichError(codes.Internal, "SUBMIT_INFERENCE_JOB_FAILED", err.Error())
	}

	logrus.Tracef("SubmitInferJob success, job name: %v, job index: %v", in.JobName, jobTable.JobDBInx)
	return &pb.SubmitInferJobResponse{JobId: uint32(jobTable.JobDBInx)}, nil
}

func (s *ServerJob) StreamJobShell(stream pb.JobService_StreamJobShellServer) error {
	// 接收初始化请求
	initReq, err := stream.Recv()
	if err != nil {
		message := fmt.Errorf("recv init request failed: %v", err)
		logrus.Errorf("[StreamJobShell]: %v", message)
		return ce.RichError(codes.Internal, "STREAM_JOB_SHELL_FAILED", message.Error())
	}

	// 第一个消息必须是连接请求
	connectInfo := initReq.GetConnect()
	if connectInfo == nil {
		message := fmt.Errorf("init request connectInfo is nil")
		logrus.Errorf("[StreamJobShell]: %v", message)
		return ce.RichError(codes.Internal, "STREAM_JOB_SHELL_FAILED", message.Error())
	}

	logrus.Tracef("[StreamJobShell] Received request StreamJobShell connectInfo: %v", connectInfo)
	jobInfo := models.JobTable{}
	err = client.DB.Where("job_db_inx = ?", connectInfo.JobId).First(&jobInfo).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			message := fmt.Errorf("get job by id failed: job not found")
			logrus.Errorf("[StreamJobShell]: %v", message)
			return ce.RichError(codes.Internal, "STREAM_JOB_SHELL_FAILED", message.Error())
		} else {
			message := fmt.Errorf("get job by id failed %v", err)
			logrus.Errorf("[StreamJobShell]: %v", message)
			return ce.RichError(codes.Internal, "STREAM_JOB_SHELL_FAILED", message.Error())
		}
	}

	if jobInfo.State != utils.RunningStatus {
		message := fmt.Errorf("job %v not running", jobInfo.JobName)
		logrus.Errorf("[StreamJobShell]: %v", message)
		return ce.RichError(codes.Internal, "STREAM_JOB_SHELL_FAILED", message.Error())
	}

	k8sClient, err := utils.GetK8sClient()
	if err != nil {
		message := fmt.Errorf("failed to build k8s client: %v", err)
		logrus.Errorf("[StreamJobShell]: %v", message)
		return ce.RichError(codes.Internal, "STREAM_JOB_SHELL_FAILED", message.Error())
	}

	err = utils.CheckPodRunning(k8sClient, connectInfo.Namespace, connectInfo.PodName)
	if err != nil {
		message := fmt.Errorf("check pod running failed %v", err)
		logrus.Errorf("[StreamJobShell]: %v", message)
		return ce.RichError(codes.Internal, "STREAM_JOB_SHELL_FAILED", message.Error())
	}

	// 创建 Pod Exec
	exec, err := utils.NewPodExec(connectInfo.Namespace, connectInfo.PodName)
	if err != nil {
		message := fmt.Errorf("build pod exec failed %v", err)
		logrus.Errorf("[StreamJobShell]: %v", message)
		return ce.RichError(codes.Internal, "STREAM_JOB_SHELL_FAILED", message.Error())
	}
	defer exec.Close()

	// 使用 select 处理多个 channel
	ctx, cancel := context.WithCancel(stream.Context())
	defer cancel()

	// 创建接收通道
	clientChan := make(chan *pb.StreamJobShellRequest, 100)
	stdoutChan := make(chan []byte, 100)
	stderrChan := make(chan []byte, 100)
	errChan := make(chan error, 3)

	// 启动 goroutines
	go func() {
		for {
			req, err := stream.Recv()
			if err != nil {
				if err == io.EOF {
					close(clientChan)
					return
				}
				errChan <- fmt.Errorf("recv from client: %w", err)
				return
			}
			clientChan <- req
		}
	}()

	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := exec.Stdout.Read(buf)
			if err != nil {
				if err != io.EOF {
					errChan <- fmt.Errorf("read stdout: %w", err)
				}
				close(stdoutChan)
				return
			}
			if n > 0 {
				stdoutChan <- append([]byte{}, buf[:n]...)
			}
		}
	}()

	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := exec.Stderr.Read(buf)
			if err != nil {
				if err != io.EOF {
					errChan <- fmt.Errorf("read stderr: %w", err)
				}
				close(stderrChan)
				return
			}
			if n > 0 {
				stderrChan <- append([]byte{}, buf[:n]...)
			}
		}
	}()

	// 主循环：处理所有事件
	for {
		select {
		case <-ctx.Done():
			logrus.Infof("[StreamJobShell] shell done")
			return ce.RichError(codes.Internal, "STREAM_JOB_SHELL_FAILED", ctx.Err().Error())

		case req, ok := <-clientChan:
			if !ok {
				clientChan = nil
				break
			}
			if err := s.handleClientRequest(req, exec, stream); err != nil {
				logrus.Infof("[StreamJobShell] handle client request failed: %v", err)
				return ce.RichError(codes.Internal, "STREAM_JOB_SHELL_FAILED", err.Error())
			}

		case data, ok := <-stdoutChan:
			if !ok {
				stdoutChan = nil
				break
			}
			if err := stream.Send(&pb.StreamJobShellResponse{
				Payload: &pb.StreamJobShellResponse_Data{
					Data: &pb.StreamJobShellResponse_DataOutput{Data: data},
				},
			}); err != nil {
				logrus.Infof("[StreamJobShell] send out info to client failed: %v", err)
				return ce.RichError(codes.Internal, "STREAM_JOB_SHELL_FAILED", err.Error())
			}

		case data, ok := <-stderrChan:
			if !ok {
				stderrChan = nil
				break
			}
			if err := stream.Send(&pb.StreamJobShellResponse{
				Payload: &pb.StreamJobShellResponse_Data{
					Data: &pb.StreamJobShellResponse_DataOutput{Data: data},
				},
			}); err != nil {
				logrus.Infof("[StreamJobShell] send error info to client failed: %v", err)
				return ce.RichError(codes.Internal, "STREAM_JOB_SHELL_FAILED", err.Error())
			}

		case err := <-errChan:
			logrus.Infof("[StreamJobShell] exec shell failed: %v", err)
			return ce.RichError(codes.Internal, "STREAM_JOB_SHELL_FAILED", err.Error())
		}

		// 检查是否所有通道都已完成
		if clientChan == nil && stdoutChan == nil && stderrChan == nil {
			break
		}
	}

	return nil
}

func (s *ServerJob) handleClientRequest(
	req *pb.StreamJobShellRequest,
	exec *utils.PodExec,
	stream pb.JobService_StreamJobShellServer,
) error {
	switch payload := req.Payload.(type) {
	case *pb.StreamJobShellRequest_Data:
		if _, err := exec.Stdin.Write([]byte(payload.Data.Data)); err != nil {
			return fmt.Errorf("write stdin: %w", err)
		}

	case *pb.StreamJobShellRequest_Resize:
		resizeCmd := fmt.Sprintf("stty cols %d rows %d\n",
			payload.Resize.Cols, payload.Resize.Rows)
		if _, err := exec.Stdin.Write([]byte(resizeCmd)); err != nil {
			return fmt.Errorf("write resize: %w", err)
		}

	case *pb.StreamJobShellRequest_Disconnect:
		// 可以在这里发送退出消息
		return stream.Send(&pb.StreamJobShellResponse{
			Payload: &pb.StreamJobShellResponse_Exit{
				Exit: &pb.StreamJobShellResponse_ExitOutput{Code: 0},
			},
		})
	}
	return nil
}

func ContainsJobType(jobTypes []pb.JobType, item pb.JobType) bool {
	for _, v := range jobTypes {
		if v == item {
			return true
		}
	}
	logrus.Tracef("[ContainsJobType] %v, %v", jobTypes, item)
	return false
}

func GetJobTypes(jobTypes []pb.JobType) (jt []string) {
	for _, v := range jobTypes {
		switch v {
		case pb.JobType_JOB_TYPE_INFER:
			jt = append(jt, utils.Inference)
		case pb.JobType_JOB_TYPE_APP:
			jt = append(jt, utils.APP)
		case pb.JobType_JOB_TYPE_TRAIN:
			jt = append(jt, utils.Train)
		case pb.JobType_JOB_TYPE_DEV_HOST:
			jt = append(jt, utils.DevHost)
		}
	}
	return jt
}
