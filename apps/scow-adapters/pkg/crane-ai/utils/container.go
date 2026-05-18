package utils

import (
	"archive/tar"
	"bytes"
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"scow-adapters/pkg/crane-ai/client"
	"strconv"
	"strings"
	"time"

	log "github.com/sirupsen/logrus"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/known/durationpb"
	"google.golang.org/protobuf/types/known/timestamppb"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/remotecommand"

	craneProtos "scow-adapters/gen/crane-ai"
	pb "scow-adapters/gen/go"
)

func ValidateContainerJob(task *craneProtos.TaskToCtld) error {
	containerMeta := task.ContainerMeta
	if containerMeta == nil {
		return fmt.Errorf("container metadata is missing")
	}
	if task.PodMeta == nil {
		return fmt.Errorf("pod metadata is required for container tasks")
	}
	if task.Type != craneProtos.TaskType_Container {
		return fmt.Errorf("task type must be Container")
	}

	if task.Uid != 0 && !task.PodMeta.Userns {
		if task.PodMeta.RunAsUser != task.Uid || task.PodMeta.RunAsGroup != task.Gid {
			return fmt.Errorf("with --userns=false, only current user and accessible groups are allowed")
		}
	}

	// Validate image specification
	if containerMeta.Image == nil || containerMeta.Image.Image == "" {
		return fmt.Errorf("container image is required")
	}

	for _, port := range task.PodMeta.Ports {
		if port.HostPort < 1 || port.HostPort > 65535 {
			return fmt.Errorf("invalid host port %d: must be between 1 and 65535", port.HostPort)
		}
		if port.ContainerPort < 1 || port.ContainerPort > 65535 {
			return fmt.Errorf("invalid container port %d: must be between 1 and 65535", port.ContainerPort)
		}
	}

	// Validate volume mounts
	for hostPath, containerPath := range containerMeta.Mounts {
		if hostPath == "" || containerPath == "" {
			return fmt.Errorf("host path and container path cannot be empty")
		}
		// Note: Skip file existence check for now as it may not be accessible from frontend
	}

	// Validate environment variables - check for reserved names
	for envName := range containerMeta.Env {
		if strings.HasPrefix(envName, "CRANE_") {
			log.Warnf("Environment variable %s uses reserved CRANE_ prefix", envName)
		}
	}

	// Validate pull policy if specified
	if policy := containerMeta.Image.PullPolicy; policy != "" {
		if policy != "Always" && policy != "IfNotPresent" && policy != "Never" {
			return fmt.Errorf("invalid pull policy '%s': must be Always, IfNotPresent, or Never", policy)
		}
	}

	return nil
}

// SubmitContainerJob submits a container task via gRPC
func SubmitContainerJob(task *craneProtos.TaskToCtld) (*craneProtos.SubmitBatchTaskReply, error) {
	req := &craneProtos.SubmitBatchTaskRequest{Task: task}

	reply, err := client.CraneCtld.SubmitBatchTask(context.Background(), req)
	if err != nil {
		return reply, fmt.Errorf("failed to submit the container task: %v", err)
	}

	if reply.GetOk() {
		return reply, nil
	} else {
		return reply, fmt.Errorf("container task submission failed: %v", reply.GetCode())
	}
}

// GetContainerStep 获取容器步骤信息
func GetContainerStep(jobID, stepID uint32, includeCompleted bool) (*craneProtos.TaskInfo, *craneProtos.StepInfo, error) {
	idFilter := map[uint32]*craneProtos.JobStepIds{
		jobID: {Steps: []uint32{stepID}},
	}
	req := craneProtos.QueryTasksInfoRequest{
		FilterIds:                   idFilter,
		FilterTaskTypes:             []craneProtos.TaskType{craneProtos.TaskType_Container},
		OptionIncludeCompletedTasks: includeCompleted,
	}

	reply, err := client.CraneCtld.QueryTasksInfo(context.Background(), &req)
	if err != nil {
		return nil, nil, fmt.Errorf("query container steps failed: %v", err)
	}

	if !reply.GetOk() {
		return nil, nil, fmt.Errorf("query container steps failed")
	}

	if len(reply.TaskInfoList) == 0 {
		return nil, nil, fmt.Errorf("container %d.%d not found", jobID, stepID)
	}

	task := reply.TaskInfoList[0]
	var targetStep *craneProtos.StepInfo
	for _, step := range task.StepInfoList {
		if step.StepId == stepID {
			targetStep = step
			break
		}
	}

	if targetStep == nil {
		return nil, nil, fmt.Errorf("container %d.%d not found", jobID, stepID)
	}

	return task, targetStep, nil
}

func GetJobById(jobId uint32, user string) (*craneProtos.TaskInfo, error) {
	filterIds := make(map[uint32]*craneProtos.JobStepIds)
	filterIds[jobId] = &craneProtos.JobStepIds{}
	var users []string
	if user != "" {
		users = append(users, user)
	}
	request := &craneProtos.QueryTasksInfoRequest{
		FilterTaskTypes:             []craneProtos.TaskType{craneProtos.TaskType_Container},
		FilterIds:                   filterIds,
		FilterUsers:                 users,
		OptionIncludeCompletedTasks: true,
	}
	response, err := client.CraneCtld.QueryTasksInfo(context.Background(), request)
	if err != nil {
		return nil, fmt.Errorf("query tasks info failed: %v", err)
	}
	if !response.GetOk() {
		return nil, fmt.Errorf("query tasks info failed: %v", err)
	}
	if len(response.GetTaskInfoList()) == 0 {
		return nil, fmt.Errorf("the job not found in crane")
	}
	// 获取作业信息
	TaskInfo := response.GetTaskInfoList()[0]
	return TaskInfo, nil
}

func CheckJobExit(jobId uint32) (bool, error) {
	filterIds := make(map[uint32]*craneProtos.JobStepIds)
	filterIds[jobId] = &craneProtos.JobStepIds{}
	request := &craneProtos.QueryTasksInfoRequest{
		FilterTaskTypes:             []craneProtos.TaskType{craneProtos.TaskType_Container},
		FilterIds:                   filterIds,
		OptionIncludeCompletedTasks: true,
	}
	response, err := client.CraneCtld.QueryTasksInfo(context.Background(), request)
	if err != nil {
		return false, fmt.Errorf("query tasks info failed: %v", err)
	}
	if !response.GetOk() {
		return false, fmt.Errorf("query tasks info failed: %v", err)
	}
	if len(response.GetTaskInfoList()) == 0 {
		return false, nil
	}
	return true, nil
}

// CopyFromPod copyFromPod 从 Pod 复制文件到本地
func CopyFromPod(jobId, stepId, uid uint32, srcPath, localPath, nodeName string) error {
	cmd := fmt.Sprintf("tar cf - --force-local %s", srcPath)

	// 获取stream URL
	streamURL, err := CreateContainerExecStream(jobId, stepId, uid, nodeName, cmd)
	if err != nil {
		return fmt.Errorf("create exec stream failed: %v", err)
	}

	// 创建executor
	executor, err := CreateContainerExecutor(streamURL)
	if err != nil {
		return fmt.Errorf("create executor failed: %v", err)
	}

	// 创建本地文件
	localFile, err := os.OpenFile(localPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return fmt.Errorf("create local file failed: %v", err)
	}
	defer localFile.Close()

	// 超时设为5秒
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var stderr bytes.Buffer
	reader, writer := io.Pipe()

	// 协程执行StreamWithContext
	go func() {
		defer func() {
			writer.Close()
		}()
		streamErr := executor.StreamWithContext(ctx, remotecommand.StreamOptions{
			Stdin:  nil,
			Stdout: writer,
			Stderr: &stderr,
			Tty:    false,
		})
		if streamErr != nil {
			log.Errorf("goroutine StreamWithContext failed: %v, stderr: %s", streamErr, stderr.String())
			_ = writer.CloseWithError(fmt.Errorf("stream failed: %v, stderr: %s", streamErr, stderr.String()))
		} else {
			log.Infof("goroutine StreamWithContext successful，stderr: %s", stderr.String())
		}
	}()

	// 读取tar流
	tr := tar.NewReader(reader)
	fileFound := false
	for {
		// 检查超时
		select {
		case <-ctx.Done():
			return fmt.Errorf("timeout: stderr %s, err %v", stderr.String(), ctx.Err())
		default:
		}

		header, err := tr.Next()
		if err == io.EOF {
			log.Info("Read io.EOF, tar stream ends")
			break
		}
		if err != nil {
			return fmt.Errorf("failed to read tar header: %v", err)
		}

		if header.Typeflag == tar.TypeReg {
			fileFound = true
			_, err := io.Copy(localFile, tr)
			if err != nil {
				return fmt.Errorf("fail to write to file: %v", err)
			}
			break
		}
	}

	if !fileFound {
		return fmt.Errorf("there are no regular files in the tar stream, stderr: %s", stderr.String())
	}
	log.Info("CopyFromPod execution successful")
	return nil
}

func ExecContainerCMD(jobId, stepId, uid uint32, nodeName, command string) error {
	_, err := ExecContainerCMDWithOutput(jobId, stepId, uid, nodeName, command)
	return err
}

// ExecContainerCMDWithOutput 在容器中执行命令，返回 stdout 输出和错误。
func ExecContainerCMDWithOutput(jobId, stepId, uid uint32, nodeName, command string) (string, error) {
	var stdout, stderr bytes.Buffer
	streamURL, err := CreateContainerExecStream(jobId, stepId, uid, nodeName, command)
	if err != nil {
		log.Errorf("create container exec stream failed: %v", err)
		return "", fmt.Errorf("create container exec stream failed: %v", err)
	}

	executor, err := CreateContainerExecutor(streamURL)
	if err != nil {
		log.Errorf("create container executor failed: %v", err)
		return "", fmt.Errorf("create container executor failed: %v", err)
	}
	// 设置超时
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	// 执行命令
	err = executor.StreamWithContext(ctx, remotecommand.StreamOptions{
		Stdout: &stdout,
		Stderr: &stderr,
		Tty:    false,
	})
	if err != nil {
		return "", fmt.Errorf("exec container cmd %v failed: %v", command, err)
	}

	return stdout.String(), nil
}

// GetContainerIPByExec 通过容器内执行 hostname -I 获取容器的第一个IP地址。
// 使用 crane API 流式执行，比 ccon exec 更可靠。
func GetContainerIPByExec(jobId, stepId, uid uint32, nodeName string) (string, error) {
	out, err := ExecContainerCMDWithOutput(jobId, stepId, uid, nodeName, "hostname -I")
	if err != nil {
		return "", fmt.Errorf("get container IP for job %d step %d failed: %w", jobId, stepId, err)
	}
	fields := strings.Fields(strings.TrimSpace(out))
	if len(fields) == 0 {
		return "", fmt.Errorf("no IP address returned for job %d step %d", jobId, stepId)
	}
	ip := fields[0]
	if net.ParseIP(ip) == nil {
		return "", fmt.Errorf("invalid IP address for job %d step %d: %s", jobId, stepId, ip)
	}
	return ip, nil
}

func ResolveTargetNode(step *craneProtos.StepInfo) (string, error) {
	executionNodes := step.GetExecutionNode()
	switch len(executionNodes) {
	case 0:
		return "", fmt.Errorf("execution node list of this step is empty")
	case 1:
		return executionNodes[0], nil
	default:
		return "", fmt.Errorf("container is running on multiple nodes: %s; please specify --target-node to select one", step.GetCranedList())
	}
}

func CreateContainerExecStream(jobID, stepID, uid uint32, nodeName, cmd string) (string, error) {
	// 创建 exec 请求
	execReq := &craneProtos.ExecInContainerStepRequest{
		Uid:      uid,
		JobId:    jobID,
		StepId:   stepID,
		NodeName: nodeName,
		Command:  []string{"sh", "-c", cmd},
		Stdin:    false,
		Tty:      false,
		Stdout:   true,
		Stderr:   true,
	}

	log.Debugf("Calling ExecInContainerStep RPC for container %d.%d on node %q",
		jobID, stepID, nodeName)

	reply, err := client.CraneCtld.ExecInContainerStep(context.Background(), execReq)
	if err != nil {
		return "", fmt.Errorf("failed to exec into container task: %v", err)
	}

	if !reply.Ok {
		return "", fmt.Errorf("exec failed: %s", reply.GetStatus().GetDescription())
	}

	log.Debugf("Exec request successful for container %d.%d, stream URL: %s",
		jobID, stepID, reply.Url)

	return reply.Url, nil
}

// CreateContainerExecutor 创建容器流执行器
func CreateContainerExecutor(streamURL string) (remotecommand.Executor, error) {
	parsedURL, err := url.Parse(streamURL)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve stream address: %v", err)
	}

	// 构建 rest 配置
	config := &rest.Config{
		Host: fmt.Sprintf("%s://%s", parsedURL.Scheme, parsedURL.Host),
		TLSClientConfig: rest.TLSClientConfig{
			Insecure: true,
		},
	}

	return createExecutor(config, parsedURL)
}

func createExecutor(config *rest.Config, parsedURL *url.URL) (remotecommand.Executor, error) {
	tr, err := rest.TransportFor(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create transport: %w", err)
	}

	if httpTransport, ok := tr.(*http.Transport); ok {
		if httpTransport.TLSClientConfig == nil {
			httpTransport.TLSClientConfig = &tls.Config{}
		}
		httpTransport.TLSClientConfig.InsecureSkipVerify = true
	}

	return createSPDYExecutor(config, parsedURL)
}

func createSPDYExecutor(config *rest.Config, parsedURL *url.URL) (remotecommand.Executor, error) {
	spdyExecutor, err := remotecommand.NewSPDYExecutor(config, "POST", parsedURL)
	if err != nil {
		return nil, fmt.Errorf("failed to create SPDY executor: %w", err)
	}
	log.Debug("Using SPDY executor")
	return spdyExecutor, nil
}

func InvalidDuration() *durationpb.Duration {
	return &durationpb.Duration{
		Seconds: MaxJobTimeLimit,
		Nanos:   0,
	}
}

func GetContainerIDAndStepId(reply protoreflect.ProtoMessage) (uint32, uint32, error) {
	var jobId, stepId uint32
	switch r := reply.(type) {
	case *craneProtos.SubmitBatchTaskReply:
		// Primary container step
		jobId = r.GetTaskId()
		stepId = 1
	case *craneProtos.SubmitContainerStepReply:
		// Specific container step
		jobId = r.GetJobId()
		stepId = r.GetStepId()
	default:
		return 0, 0, fmt.Errorf("invalid reply type")
	}
	return jobId, stepId, nil
}

func ConvertStepInfoToPodInfo(partition string, stepList []*craneProtos.StepInfo) []*pb.JobInfo_PodInfo {
	var podInfoList []*pb.JobInfo_PodInfo

	// 遍历StepInfo列表，筛选PRIMARY类型的条目
	for _, step := range stepList {
		if step.StepType != craneProtos.StepType_PRIMARY {
			continue // 跳过DAEMON类型
		}

		// 遍历execution_node，每个节点生成一个PodInfo
		for _, node := range step.ExecutionNode {
			if node == "" {
				continue // 跳过空节点
			}

			// 构造PodName: job_id + step_id + execution_node（如22:::1:::crane02）
			podName := strconv.FormatInt(int64(step.JobId), 10) + StepToPodNameEscape +
				strconv.FormatInt(int64(step.StepId), 10) + StepToPodNameEscape +
				node

			// 映射PodStatus
			podStatus := pb.JobInfo_UNKNOWN
			switch step.Status {
			case craneProtos.TaskStatus_Running:
				podStatus = pb.JobInfo_RUNNING
			case craneProtos.TaskStatus_Completed:
				podStatus = pb.JobInfo_SUCCEEDED
			case craneProtos.TaskStatus_Failed:
				podStatus = pb.JobInfo_FAILED
			}

			// 转换时间戳（seconds转timestamppb.Timestamp）
			createdTime := timestamppb.New(time.Unix(step.StartTime.Seconds, 0))
			endTime := timestamppb.New(time.Unix(step.EndTime.Seconds, 0))

			// 构造PodInfo对象
			podInfo := &pb.JobInfo_PodInfo{
				NodeName:       node,
				Namespace:      partition,
				PodName:        podName,
				PodStatus:      podStatus,
				PodCreatedTime: createdTime,
				PodEndTime:     endTime,
			}

			podInfoList = append(podInfoList, podInfo)
		}
	}

	return podInfoList
}

func ParseStepIdList(jobStepIdListStr string, splitStr string) (map[uint32]*craneProtos.JobStepIds, error) {
	stepIds := make(map[uint32]*craneProtos.JobStepIds)

	for stepIdStr := range strings.SplitSeq(jobStepIdListStr, splitStr) {
		stepIdPair := strings.Split(stepIdStr, ".")
		if len(stepIdPair) > 2 {
			return nil, fmt.Errorf("invalid step id \"%s\"", stepIdStr)
		}
		jobId, err := strconv.ParseUint(stepIdPair[0], 10, 32)
		if err != nil || jobId == 0 {
			return nil, fmt.Errorf("invalid job id \"%s\"", stepIdStr)
		}
		if len(stepIdPair) == 1 {
			if _, exists := stepIds[uint32(jobId)]; !exists {
				stepIds[uint32(jobId)] = &craneProtos.JobStepIds{Steps: []uint32{}}
			}
			continue
		}
		stepId, err := strconv.ParseUint(stepIdPair[1], 10, 32)
		if err != nil || stepId == 0 {
			return nil, fmt.Errorf("invalid step id \"%s\"", stepIdStr)
		}
		if _, exists := stepIds[uint32(jobId)]; !exists {
			stepIds[uint32(jobId)] = &craneProtos.JobStepIds{Steps: []uint32{}}
		}
		stepIds[uint32(jobId)].Steps = append(stepIds[uint32(jobId)].Steps, uint32(stepId))
	}

	return stepIds, nil
}

func GetJobPrimaryStep(stepList []*craneProtos.StepInfo) []*craneProtos.StepInfo {
	var steps []*craneProtos.StepInfo

	for _, step := range stepList {
		if step.StepType != craneProtos.StepType_PRIMARY {
			continue // 跳过DAEMON类型
		}

		steps = append(steps, step)
	}

	return steps
}
