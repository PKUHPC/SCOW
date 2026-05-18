package job

import (
	"bytes"
	"context"
	"fmt"
	"math"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc/codes"
	"google.golang.org/protobuf/types/known/timestamppb"

	pb "scow-adapters/gen/go"
	ce "scow-adapters/pkg/common/error"
	"scow-adapters/pkg/slurm/client"
	"scow-adapters/pkg/slurm/config"
	"scow-adapters/pkg/slurm/utils"
)

type ServerJob struct {
	pb.UnimplementedJobServiceServer
}

func (s *ServerJob) CancelJob(ctx context.Context, in *pb.CancelJobRequest) (*pb.CancelJobResponse, error) {
	logrus.Tracef("Received request CancelJob: %v", in)
	// 检查用户名中是否包含大写字母
	if err := utils.CheckUser(in.UserId); err != nil {
		logrus.Errorf("CancelJob failed: %v", err)
		return nil, ce.RichError(codes.Internal, "USER_CONTAIN_ILLEGAL_CHARACTERS", err.Error())
	}
	// 判断用户是否存在
	exist, err := utils.SelectUserExists(in.UserId)
	if err != nil {
		logrus.Errorf("CancelJob failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("user %s not found", in.UserId)
		logrus.Errorf("CancelJob failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "USER_NOT_FOUND", err.Error())
	}

	// 判断作业是否存在
	if err := utils.CheckJobExists(in.JobId); err != nil {
		logrus.Errorf("CancelJob failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "JOB_NOT_FOUND", err.Error())
	}

	// 取消作业
	response, err := utils.LocalCancelJob(in.UserId, in.JobId)
	if err != nil {
		logrus.Errorf("CancelJob failed: %v", err)
		return nil, ce.RichError(codes.Unknown, "CANCEL_JOB_FAILED", response)
	}

	logrus.Infof("Cancel job success")
	return &pb.CancelJobResponse{}, nil
}

func (s *ServerJob) QueryJobTimeLimit(ctx context.Context, in *pb.QueryJobTimeLimitRequest) (*pb.QueryJobTimeLimitResponse, error) {
	logrus.Tracef("Received request QueryJobTimeLimit: %v", in)

	var timeLimit uint64
	clusterName := config.SlurmValue.MySQLConfig.ClusterName
	// 通过jobId来查找作业信息
	jobSqlConfig := fmt.Sprintf("SELECT timelimit FROM %s_job_table WHERE id_job = ? AND state IN (0, 1, 2)", clusterName)
	err := client.SlurmDB.QueryRow(jobSqlConfig, in.JobId).Scan(&timeLimit)
	if err != nil {
		err = fmt.Errorf("the job does not exist")
		logrus.Errorf("QueryJobTimeLimit failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "JOB_NOT_FOUND", err.Error())
	}

	logrus.Infof("Query job timelimit success, timelimit: %v", timeLimit)
	return &pb.QueryJobTimeLimitResponse{TimeLimitMinutes: timeLimit}, nil
}

func (s *ServerJob) ChangeJobTimeLimit(ctx context.Context, in *pb.ChangeJobTimeLimitRequest) (*pb.ChangeJobTimeLimitResponse, error) {
	logrus.Tracef("Received request ChangeJobTimeLimit: %v", in)

	// 判断作业是否存在
	if err := utils.CheckJobExists(in.JobId); err != nil {
		logrus.Errorf("CancelJob failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "JOB_NOT_FOUND", err.Error())
	}

	var minutes int64
	var updateTimeLimitArgs []string
	if in.DeltaMinutes >= 0 {
		minutes = in.DeltaMinutes
		updateTimeLimitArgs = []string{"update", fmt.Sprintf("job=%d", in.JobId), fmt.Sprintf("TimeLimit+=%d", minutes)}
	} else {
		minutes = int64(math.Abs(float64(in.DeltaMinutes)))
		updateTimeLimitArgs = []string{"update", fmt.Sprintf("job=%d", in.JobId), fmt.Sprintf("TimeLimit-=%d", minutes)}
	}

	err := utils.UpdateJobTimeLimit(updateTimeLimitArgs)
	if err != nil {
		logrus.Errorf("ChangeJobTimeLimit failed: %v", err)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}
	logrus.Infof("Change job timelimit success, delta minutes: %v", in.DeltaMinutes)
	return &pb.ChangeJobTimeLimitResponse{}, nil
}

func (s *ServerJob) GetJobById(ctx context.Context, in *pb.GetJobByIdRequest) (*pb.GetJobByIdResponse, error) {
	logrus.Tracef("Received request GetJobById: %v", in)

	var (
		jobId                                                                                                                              uint32
		jobName, account, partition, gresUsed, reason, nodeList, workingDirectory, stateString, tresAlloc, tresReq, stdoutPath, stderrPath string
		idQos, state, idUser                                                                                                               int
		gpusReq, cpusReq, nodeReq, gpusAlloc, cpusAlloc, nodesAlloc                                                                        int32
		memReq, timeLimitMinutes, submitTime, startTime, timeSuspended, elapsedSeconds, memAllocMb, endTime                                int64
	)
	clusterName := config.SlurmValue.MySQLConfig.ClusterName
	// 根据jobid查询作业详细信息
	jobSqlConfig := fmt.Sprintf("SELECT account, id_user, cpus_req, job_name, id_job, id_qos, nodelist, nodes_alloc, `partition`, state, timelimit, time_submit, time_start, time_end, time_suspended, gres_used, work_dir, tres_alloc, tres_req FROM %s_job_table WHERE id_job = ?", clusterName)
	err := client.SlurmDB.QueryRow(jobSqlConfig, in.JobId).Scan(&account, &idUser, &cpusReq, &jobName, &jobId, &idQos, &nodeList, &nodesAlloc, &partition, &state, &timeLimitMinutes, &submitTime, &startTime, &endTime, &timeSuspended, &gresUsed, &workingDirectory, &tresAlloc, &tresReq)
	if err != nil {
		err = fmt.Errorf("the job does not exist")
		logrus.Errorf("Failed get job by id, error is: %v", err)
		return nil, ce.RichError(codes.NotFound, "JOB_NOT_FOUND", err.Error())
	}
	// 查询cpuTresId、memTresId、nodeTresId值
	cpuTresId, memTresId, nodeTresId, err := utils.GetCpuMemNodeTresId()
	if err != nil {
		logrus.Errorf("GetJobById, get cpu memory and node tres id failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	stateString = utils.ChangeState(state)
	submitTimeTimestamp := &timestamppb.Timestamp{Seconds: int64(time.Unix(submitTime, 0).Unix())}
	startTimeTimestamp := &timestamppb.Timestamp{Seconds: int64(time.Unix(startTime, 0).Unix())}
	endTimeTimestamp := &timestamppb.Timestamp{Seconds: int64(time.Unix(endTime, 0).Unix())}

	// username 转换，需要从ldap中拿数据
	userName, _ := utils.GetUserNameByUid(idUser)

	// 查询qos的名字
	qosName := utils.GetJobQosName(idQos)

	// 查找SelectType插件的值是否为cons_tres或者cons_res
	isTresOrRes, err := utils.IsTresOrResSelectType()
	if err != nil {
		logrus.Errorf("GetJobById, get slurm select type failed: %v", err)
		return nil, fmt.Errorf("failed to get slurm SelectType: %v", err)
	}

	// 查询gpu对应的id信息
	gpuTresIdList, err := utils.GetGpuTresIds()
	if err != nil {
		logrus.Errorf("GetJobById, get gpu tres ids failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	gpusReq = utils.GetGpuCountsFromGpuIdList(tresReq, gpuTresIdList)
	// 状态为排队和挂起的作业信息
	if state == 0 || state == 2 {
		reason, err = utils.GetJobsReasonById(jobId)
		if err != nil {
			logrus.Errorf("get job: %v reason info failed, error: %v", jobId, err)
			return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
		}

		if state == 0 {
			cpusAlloc = 0
			memAllocMb = 0
			nodeReq = int32(utils.GetResInfoNumFromTresInfo(tresReq, nodeTresId))
			elapsedSeconds = 0
			gpusAlloc = 0
		} else {
			cpusAlloc = int32(utils.GetResInfoNumFromTresInfo(tresAlloc, cpuTresId))
			memAllocMb = int64(utils.GetResInfoNumFromTresInfo(tresAlloc, memTresId))
			nodeReq = int32(utils.GetResInfoNumFromTresInfo(tresReq, nodeTresId))
			elapsedSeconds = time.Now().Unix() - startTime

			if isTresOrRes {
				if len(gpuTresIdList) == 0 {
					gpusAlloc = 0
				} else {
					gpusAlloc = utils.GetGpuCountsFromGpuIdList(tresAlloc, gpuTresIdList)
				}
			} else {
				gpusAlloc = 0
			}
		}
	} else if state == 1 {
		reason = "Running" // 正在运行的作业的信息
		cpusAlloc = int32(utils.GetResInfoNumFromTresInfo(tresAlloc, cpuTresId))
		memAllocMb = int64(utils.GetResInfoNumFromTresInfo(tresAlloc, memTresId))
		nodeReq = int32(utils.GetResInfoNumFromTresInfo(tresReq, nodeTresId))

		elapsedSeconds = time.Now().Unix() - startTime
		if isTresOrRes {
			if len(gpuTresIdList) == 0 {
				gpusAlloc = 0
			} else {
				// 从tres_alloc中解析出gpu对应的卡数
				gpusAlloc = utils.GetGpuCountsFromGpuIdList(tresAlloc, gpuTresIdList)
			}
		} else {
			gpusAlloc = 0
		}
	} else {
		reason = "end of job" // 结束状态的作业信息
		cpusAlloc = int32(utils.GetResInfoNumFromTresInfo(tresAlloc, cpuTresId))
		memAllocMb = int64(utils.GetResInfoNumFromTresInfo(tresAlloc, memTresId))
		nodeReq = int32(utils.GetResInfoNumFromTresInfo(tresReq, nodeTresId))
		elapsedSeconds = endTime - startTime
		if isTresOrRes {
			if len(gpuTresIdList) == 0 {
				gpusAlloc = 0
			} else {
				gpusAlloc = utils.GetGpuCountsFromGpuIdList(tresAlloc, gpuTresIdList)
			}
		} else {
			gpusAlloc = 0
		}
	}
	if len(in.Fields) == 0 {
		jobInfo := &pb.JobInfo{
			JobId:            in.JobId,
			Name:             jobName,
			User:             userName,
			Reason:           &reason,
			Account:          account,
			Partition:        partition,
			Qos:              qosName,
			State:            stateString,
			GpusReq:          gpusReq,
			CpusReq:          cpusReq,
			MemReqMb:         memReq,
			TimeLimitMinutes: timeLimitMinutes,
			SubmitTime:       submitTimeTimestamp,
			WorkingDirectory: workingDirectory,
			NodeList:         &nodeList,
			StartTime:        startTimeTimestamp,
			EndTime:          endTimeTimestamp,
			NodesAlloc:       &nodesAlloc,
			CpusAlloc:        &cpusAlloc,
			MemAllocMb:       &memAllocMb,
			NodesReq:         nodeReq,
			StdoutPath:       &stdoutPath,
			StderrPath:       &stderrPath,
			ElapsedSeconds:   &elapsedSeconds,
			GpusAlloc:        &gpusAlloc,
		}
		logrus.Infof("Get job by id success, job info: %v", jobInfo)
		return &pb.GetJobByIdResponse{Job: jobInfo}, nil
	} else {
		jobInfo := &pb.JobInfo{}
		for _, field := range in.Fields {
			switch field {
			case "job_id":
				jobInfo.JobId = in.JobId
			case "name":
				jobInfo.Name = jobName
			case "account":
				jobInfo.Account = account
			case "user":
				jobInfo.User = userName
			case "partition":
				jobInfo.Partition = partition
			case "qos":
				jobInfo.Qos = qosName
			case "state":
				jobInfo.State = stateString
			case "gpus_req":
				jobInfo.GpusReq = gpusReq
			case "cpus_req":
				jobInfo.CpusReq = cpusReq
			case "mem_req_mb":
				jobInfo.MemReqMb = memReq
			case "nodes_req":
				jobInfo.NodesReq = nodeReq
			case "time_limit_minutes":
				jobInfo.TimeLimitMinutes = timeLimitMinutes
			case "submit_time":
				jobInfo.SubmitTime = submitTimeTimestamp
			case "working_directory":
				jobInfo.WorkingDirectory = workingDirectory
			case "stdout_path":
				jobInfo.StdoutPath = &stdoutPath
			case "stderr_path":
				jobInfo.StderrPath = &stderrPath
			case "start_time":
				jobInfo.StartTime = startTimeTimestamp
			case "elapsed_seconds":
				jobInfo.ElapsedSeconds = &elapsedSeconds
			case "reason":
				jobInfo.Reason = &reason
			case "node_list":
				jobInfo.NodeList = &nodeList
			case "gpus_alloc":
				jobInfo.GpusAlloc = &gpusAlloc
			case "cpus_alloc":
				jobInfo.CpusAlloc = &cpusAlloc
			case "mem_alloc_mb":
				jobInfo.MemAllocMb = &memAllocMb
			case "nodes_alloc":
				jobInfo.NodesAlloc = &nodesAlloc
			case "end_time":
				jobInfo.EndTime = endTimeTimestamp
			}
		}
		logrus.Infof("Get job by id success, job info: %v", jobInfo)
		return &pb.GetJobByIdResponse{Job: jobInfo}, nil
	}
}

func (s *ServerJob) GetJobs(ctx context.Context, in *pb.GetJobsRequest) (*pb.GetJobsResponse, error) {
	logrus.Tracef("Received getJobs request: %v", in)

	// 查询未结束作业，使用命令行查询时效性更高
	if utils.IsGetUnfinishedJobs(in) {
		response, err := utils.GetUnfinishedJobs(in)
		if err != nil {
			logrus.Errorf("Get unfinished jobs failed: %v", err)
			return nil, ce.RichError(codes.Internal, "GET_UNFINISHED_JOB_FAILED", err.Error())
		}
		logrus.Infof("Get unfinished jobs success: jobs count %v", len(response.Jobs))
		return response, nil
	}

	response, err := utils.GetJobs(in)
	if err != nil {
		logrus.Errorf("Get finished jobs failed: %v", err)
		return nil, ce.RichError(codes.Internal, "GET_FINISHED_JOB_FAILED", err.Error())
	}
	logrus.Infof("Get finished jobs success: jobs count %v", len(response.Jobs))
	return response, nil
}

func (s *ServerJob) SubmitJob(ctx context.Context, in *pb.SubmitJobRequest) (*pb.SubmitJobResponse, error) {
	logrus.Tracef("Received request SubmitJob: %v", in)

	scriptString := "#!/bin/bash\n"
	// 检查账户名和用户名中是否包含大写字母
	if err := utils.CheckAccount(in.Account); err != nil {
		logrus.Errorf("SubmitJob failed: %v", err)
		return nil, ce.RichError(codes.Internal, "ACCOUNT_CONTAIN_ILLEGAL_CHARACTERS", err.Error())
	}
	if err := utils.CheckUser(in.UserId); err != nil {
		logrus.Errorf("SubmitJob failed: %v", err)
		return nil, ce.RichError(codes.Internal, "USER_CONTAIN_ILLEGAL_CHARACTERS", err.Error())
	}

	// 检查用户是否在slurm中
	exist, err := utils.SelectUserExists(in.UserId)
	if err != nil {
		logrus.Errorf("SubmitJob failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("user %s not found", in.UserId)
		logrus.Errorf("SubmitJob failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "USER_NOT_FOUND", err.Error())
	}

	// 拼接提交作业的batch脚本
	scriptString += "#SBATCH " + "-A " + in.Account + "\n"
	scriptString += "#SBATCH " + "--partition=" + in.Partition + "\n"
	if in.Qos != nil {
		scriptString += "#SBATCH " + "--qos=" + *in.Qos + "\n"
	}
	scriptString += "#SBATCH " + "-J " + in.JobName + "\n"
	scriptString += "#SBATCH " + "--nodes=" + strconv.Itoa(int(in.NodeCount)) + "\n"
	scriptString += "#SBATCH " + "-c " + strconv.Itoa(int(in.CoreCount)) + "\n"
	if in.TimeLimitMinutes != nil {
		scriptString += "#SBATCH " + "--time=" + strconv.Itoa(int(*in.TimeLimitMinutes)) + "\n"
	}

	// 工作目录由scow传过来一个绝对路径
	workdir := in.WorkingDirectory
	if !filepath.IsAbs(workdir) {
		err = fmt.Errorf("homedir %s is not absolute path", workdir)
		logrus.Errorf("SubmitJob failed: %v", err)
		return nil, ce.RichError(codes.Internal, "WORKDIR_IS_NOT_ABSOLUTE_PATH", err.Error())
	}

	// scriptString += "#SBATCH " + "--chdir=" + in.WorkingDirectory + "\n"
	scriptString += "#SBATCH " + "--chdir=" + workdir + "\n"

	if in.Stdout != nil {
		scriptString += "#SBATCH " + "--output=" + *in.Stdout + "\n"
	}
	if in.Stderr != nil {
		scriptString += "#SBATCH " + "--error=" + *in.Stderr + "\n"
	}

	scriptString += "#SBATCH " + "--get-user-env" + "\n"
	// 强行删除
	// if in.MemoryMb != nil {
	// 	scriptString += "#SBATCH " + "--mem=" + strconv.Itoa(int(*in.MemoryMb)) + "MB" + "\n"
	// }
	if in.GpuCount != 0 {
		deviceName, err := utils.GetPartitionDeviceName(in.Partition)
		if err != nil {
			return nil, ce.RichError(codes.Internal, "GET_DEVICE_TYPE_FAILED", "get device type failed.")
		}
		scriptString += "#SBATCH " + "--gres=" + deviceName + ":" + strconv.Itoa(int(in.GpuCount)) + "\n"
	}

	if len(in.ExtraOptions) != 0 {
		for _, extraVale := range in.ExtraOptions {
			scriptString += "#SBATCH " + extraVale + "\n"
		}
	}

	scriptString += in.Script

	// 提交作业
	submitResponse, err := utils.LocalSubmitJob(scriptString, in.UserId)
	if err != nil {
		logrus.Errorf("SubmitJob failed: %v, out: %v", err, submitResponse)
		return nil, ce.RichError(codes.Unknown, "SBATCH_FAILED", submitResponse)
	}
	responseList := strings.Split(strings.TrimSpace(submitResponse), " ")
	jobIdString := responseList[len(responseList)-1]
	jobId, _ := strconv.Atoi(jobIdString)
	logrus.Infof("Submit job success, job id: %v", jobId)
	return &pb.SubmitJobResponse{JobId: uint32(jobId), GeneratedScript: scriptString}, nil
}

func (s *ServerJob) SubmitScriptAsJob(ctx context.Context, in *pb.SubmitScriptAsJobRequest) (*pb.SubmitScriptAsJobResponse, error) {
	logrus.Tracef("Received request SubmitFileAsJob: %v", in)
	if err := utils.CheckUser(in.UserId); err != nil {
		logrus.Errorf("SubmitScriptAsJob failed: %v", err)
		return nil, ce.RichError(codes.Internal, "USER_CONTAIN_ILLEGAL_CHARACTERS", err.Error())
	}

	// 检查用户是否在slurm中
	exist, err := utils.SelectUserExists(in.UserId)
	if err != nil {
		logrus.Errorf("SubmitScriptAsJob failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("user %s not found", in.UserId)
		logrus.Errorf("SubmitScriptAsJob failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "USER_NOT_FOUND", err.Error())
	}

	// todo 获取用户的shell环境
	// 具体的提交逻辑
	updateScript := "#!/bin/bash\n"
	trimmedScript := strings.TrimLeft(in.Script, "\n") // 去除最前面的空行
	// 通过换行符 "\n" 分割字符串
	checkBool1 := strings.Contains(trimmedScript, "--chdir")
	checkBool2 := strings.Contains(trimmedScript, " -D ")
	if !checkBool1 && !checkBool2 {
		if in.ScriptFileFullPath == nil {
			logrus.Errorf("SubmitScriptAsJob failed: %v", err)
			return nil, ce.RichError(codes.Unknown, "SCRIPT_FILE_FULL_PATH_NOT_SETTING", err.Error())
		}
		chdirString := fmt.Sprintf("#SBATCH --chdir=%s\n", *in.ScriptFileFullPath)
		updateScript = updateScript + chdirString
		for _, value := range strings.Split(trimmedScript, "\n")[1:] {
			updateScript = updateScript + value + "\n"
		}
		in.Script = updateScript
	}

	submitResponse, err := utils.LocalSubmitJob(in.Script, in.UserId)
	if err != nil {
		logrus.Errorf("SubmitScriptAsJob failed: %v", err)
		return nil, ce.RichError(codes.Unknown, "SBATCH_FAILED", submitResponse)
	}

	// 获取jobid
	responseList := strings.Split(strings.TrimSpace(string(submitResponse)), " ")
	jobIdString := responseList[len(responseList)-1]
	jobId, _ := strconv.Atoi(jobIdString)
	logrus.Infof("Submit script job success, job id: %v", jobId)
	return &pb.SubmitScriptAsJobResponse{JobId: uint32(jobId)}, nil
}

func (s *ServerJob) RunCommandOnJobNodes(ctx context.Context, in *pb.RunCommandOnJobNodesRequest) (*pb.RunCommandOnJobNodesResponse, error) {
	logrus.Tracef("Received request RunCommandOnJobNodes: %v", in)

	// 1. 获取作业信息以得到 id_user
	clusterName := config.SlurmValue.MySQLConfig.ClusterName
	var idUser int
	// 只查询 id_user 即可
	jobSqlConfig := fmt.Sprintf("SELECT id_user FROM %s_job_table WHERE id_job = ?", clusterName)
	err := client.SlurmDB.QueryRow(jobSqlConfig, in.JobId).Scan(&idUser)
	if err != nil {
		logrus.Errorf("RunCommandOnJobNodes failed to get job info: %v", err)
		return nil, ce.RichError(codes.NotFound, "JOB_NOT_FOUND", fmt.Sprintf("job %d not found", in.JobId))
	}
	logrus.Debugf("RunCommandOnJobNodes: job %d belongs to user id %d", in.JobId, idUser)

	// 2. 获取用户名
	userName, err := utils.GetUserNameByUid(idUser)
	if err != nil {
		logrus.Errorf("RunCommandOnJobNodes failed to get username: %v", err)
		return nil, ce.RichError(codes.Internal, "GET_USER_FAILED", err.Error())
	}
	logrus.Debugf("RunCommandOnJobNodes: job %d belongs to user %s", in.JobId, userName)

	// 3. 构建 srun 命令
	// srun --jobid=<JobId> [-w <Nodes>] /bin/bash -c '<Command>'
	srunArgs := []string{"--jobid=" + strconv.Itoa(int(in.JobId))}
	if len(in.Nodes) > 0 {
		nodesStr := strings.Join(in.Nodes, ",")
		srunArgs = append(srunArgs, "-w", nodesStr)
	}

	// 转义 Command
	quotedCommand := "'" + strings.ReplaceAll(in.Command, "'", "'\\''") + "'"
	// 使用 /bin/bash -c 来执行命令，确保复杂的命令也能被正确解析
	srunArgs = append(srunArgs, "/bin/bash", "-c", quotedCommand)

	// 构建完整的 srun 命令字符串
	// 注意：这里的 srunArgs 中的每个元素如果是分开传给 exec.Command 的话是不需要再 quote 的
	// 但是我们要把整个 srun 命令作为一个字符串传给 su -c
	// 所以我们需要把 srunArgs 拼接起来，并且确保其中的 quote 不会丢失

	// 重新构建 srun 命令部分
	// srunArgs[last] 是 quotedCommand，它本身已经被单引号包裹了
	// 其他参数通常没有特殊字符，直接 join 即可

	baseSrunCmd := fmt.Sprintf("%s %s", client.SRUN, strings.Join(srunArgs[:len(srunArgs)-1], " "))
	// 拼接最后一部分 (quotedCommand)
	fullSrunCmd := fmt.Sprintf("%s %s", baseSrunCmd, srunArgs[len(srunArgs)-1])
	logrus.Debugf("RunCommandOnJobNodes: full srun command: %s", fullSrunCmd)

	// 4. 处理超时
	timeout := 30 * time.Second
	if in.TimeoutSeconds > 0 {
		timeout = time.Duration(in.TimeoutSeconds) * time.Second
	}
	// 使用传入的 ctx 创建带超时的子 context
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	// 5. 切换用户执行
	// 使用 exec.CommandContext
	// su - <username> -c <fullSrunCmd>

	cmd := exec.CommandContext(ctx, "su", "-", userName, "-c", fullSrunCmd)

	// 捕获输出
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	logrus.Infof("Executing command: %v", cmd.Args)

	err = cmd.Run()

	output := stdout.String()
	stderrStr := stderr.String()
	logrus.Debugf("RunCommandOnJobNodes: command output: stdout=%s, stderr=%s", output, stderrStr)

	if err != nil {
		// 检查是否是超时
		if ctx.Err() == context.DeadlineExceeded {
			logrus.Errorf("RunCommandOnJobNodes timeout")
			return nil, ce.RichError(codes.DeadlineExceeded, "COMMAND_TIMEOUT", "command execution timeout")
		}

		logrus.Errorf("RunCommandOnJobNodes failed: %v, stderr: %s", err, stderrStr)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", fmt.Sprintf("err: %v, stderr: %s", err, stderrStr))
	}

	return &pb.RunCommandOnJobNodesResponse{Stdout: output, Stderr: stderrStr}, nil
}
