package utils

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"math"
	"os"
	"os/exec"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/sirupsen/logrus"
	"google.golang.org/protobuf/types/known/timestamppb"
	v1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8sclient "k8s.io/client-go/kubernetes"
	volcanoclientset "volcano.sh/apis/pkg/client/clientset/versioned"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/client"
	"scow-adapters/pkg/ai/db/models"
)

type queueInfo struct {
	Name     string `yaml:"name"`
	Cpu      int64  `yaml:"cpu"`
	Memory   int64  `yaml:"memory"`
	Gpu      int64  `yaml:"gpu"`
	Comment  string `yaml:"comment"`
	Type     string `yaml:"type"`
	Ram      int64  `yaml:"ram"`
	AllocMem int64  `yaml:"allocMemory"`
	AllocCpu int64  `yaml:"allocCpu"`
	AllocGpu int64  `yaml:"allocGpu"`
}

type jobCount struct {
	JobCount        uint32
	RunningJobCount uint32
	PendingJobCount uint32
}

// ServerSessionContent web json file
type ServerSessionContent struct {
	HOST     string `json:"HOST"`
	PORT     string `json:"PORT"`
	PASSWORD string `json:"PASSWORD"`
}

// MountModel 挂载点路径及模式，如公共数据集或者私有数据集
type MountModel struct {
	Path     string `json:"path"`
	IsPublic bool   `json:"isPublic"`
	Target   string `json:"target"`
}

type PathMap struct {
	Path   string `json:"path"`
	Target string `json:"target"`
}

// GetWebJobFileContent 获取web类应用文件内容
func GetWebJobFileContent(filePath string) (int, string, error) {
	var serverSessionContent ServerSessionContent
	fileContent, err := ioutil.ReadFile(filePath)
	if err != nil {
		return 0, "", err
	}
	logrus.Tracef("[GetWebJobFileContent] %s", string(fileContent))
	err = json.Unmarshal(fileContent, &serverSessionContent)
	if err != nil {
		return 0, "", err
	}

	port, _ := strconv.Atoi(serverSessionContent.PORT)
	return port, serverSessionContent.PASSWORD, nil
}

// GenerateNodePort 生成nodeport 端口
func GenerateNodePort(cli *k8sclient.Clientset) (int, error) {
	var (
		nodePort int
		minPort  = 30000
		maxPort  = 32767
	) // nodeport 高位端口 30000 - 32767 的范围
	nodePortStr, _ := GetSvcNodePort(cli)
	logrus.Infof("[GenerateNodePort] nodePortStr: %s", nodePortStr)
	if nodePortStr == "" {
		// 如果没有的话就取最新的端口来起service
		nodePort = minPort
	} else {
		for port := minPort; port <= maxPort; port++ {
			index := strings.Contains(nodePortStr, strconv.Itoa(port))
			if !index {
				nodePort = port
				break
			}
		}
	}
	return nodePort, nil
}

// RunCommand 简单执行shell命令函数
func RunCommand(command string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "sh", "-c", command)
	cmd.Env = append(os.Environ(), "KUBECONFIG="+os.Getenv("KUBECONFIG")) // 传递环境变量
	output, err := cmd.CombinedOutput()
	outputStr := strings.TrimSpace(string(output))
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return "", fmt.Errorf("command execution timed out")
	}

	if err != nil {
		logrus.Errorf("RunCommand: %s, output： %s, err: %v", command, outputStr, err)
		return "", err
	}
	return outputStr, nil
}

func LocalCancelInferenceJob(jobName, gpuType, namespace string, cli *k8sclient.Clientset) error {
	err := cli.AppsV1().Deployments(namespace).Delete(context.TODO(), jobName, metav1.DeleteOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil
		}
		logrus.Errorf("delete inference job failed, job name: %v, error: %v", jobName, err)
		return err
	}
	// delete podGroup
	//if err = DeletePodGroup(jobName, namespace); err != nil {
	//	logrus.Errorf("delete podGroup %s failed due to %s", jobName, err)
	//}

	err = DeleteService(jobName, namespace, cli)
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil
		}
		logrus.Errorf("delete inference service failed, service name: %v, error: %v", jobName, err)
		return err
	}

	if AcceleratorIsAscend(gpuType) {
		cmName := fmt.Sprintf("rings-config-%s", jobName)
		err = DeleteConfigmap(cmName, namespace, cli)
		if err != nil {
			if apierrors.IsNotFound(err) {
				return nil
			}
			logrus.Errorf("Delete inference configmap failed.")
			return err
		}
	}
	return nil
}

func LocalCancelVcJob(jobName, gpuType, namespace string, cli *k8sclient.Clientset, vcClient *volcanoclientset.Clientset) error {
	err := vcClient.BatchV1alpha1().Jobs(namespace).Delete(context.TODO(), jobName, metav1.DeleteOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil
		} else {
			return err
		}
	}

	err = DeleteService(jobName, namespace, cli)
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil
		}
		logrus.Errorf("delete inference service failed, service name: %v, error: %v", jobName, err)
		return err
	}

	if AcceleratorIsAscend(gpuType) {
		cmName := fmt.Sprintf("rings-config-%s", jobName)
		err = DeleteConfigmap(cmName, namespace, cli)
		if err != nil {
			if apierrors.IsNotFound(err) {
				return nil
			}
			logrus.Errorf("Delete inference configmap failed.")
			return err
		}
	}
	return nil
}

func GetJobInfo(jobs []models.JobTable, fields []string) (jobDetail []*pb.JobInfo) {
	for _, job := range jobs {
		var (
			elapsedSeconds     int64
			stdoutPath         string
			stderrPath         string
			gpusAlloc          int32
			cpusAlloc          int32
			memAllocMb         int64
			nodesAllocTemp     int32
			nodeListTemp       string
			reason             string
			startTimeTimestamp *timestamppb.Timestamp
			endTimeTimestamp   *timestamppb.Timestamp
			pods               []*pb.JobInfo_PodInfo
		)
		jobId := strconv.Itoa(int(job.JobDBInx))
		if job.State != "PENDING" {
			nodesAllocTemp = int32(job.PODsReq)
			gpusAlloc = int32(job.GPUsReq)
			memAllocMb = int64(job.MemReq)
			cpusAlloc = int32(job.CPUsReq)
		}
		if job.State == "PENDING" || job.State == "FAILED" {
			reason = GetJobReason(job.NewJobName)
		} else {
			reason = job.Reason
		}
		submitTimeTimestamp := &timestamppb.Timestamp{Seconds: int64(time.Unix(int64(job.TimeSubmit), 0).Unix())}
		if job.TimeStart == 0 {
			startTimeTimestamp = &timestamppb.Timestamp{Seconds: int64(time.Unix(int64(job.TimeEnd), 0).Unix())}
		} else {
			startTimeTimestamp = &timestamppb.Timestamp{Seconds: int64(time.Unix(int64(job.TimeStart), 0).Unix())}
		}
		endTimeTimestamp = &timestamppb.Timestamp{Seconds: int64(time.Unix(int64(job.TimeEnd), 0).Unix())}

		podTables := GetPodsByJobName(job.NewJobName)
		if job.State == PendingStatus && len(podTables) <= int(job.PODsReq) {
			elapsedSeconds = 0
		} else if job.JobType == Inference { // deploy 类型的作业，计费单独算
			elapsedSeconds = GetElapsedSecondsByDeployPods(&job, podTables)
		} else {
			elapsedSeconds = GetVCJobDurationByJobName(&job, podTables)
		}

		if job.State != QueuedStatus {
			pods = GetPodInfoFromPodTables(podTables)
			if len(pods) == 0 {
				logrus.Warnf("get job %s pod info is empty", job.NewJobName)
			}
			nodeLists := make([]string, 0, len(pods))
			seen := make(map[string]bool, len(pods))
			for _, pod := range pods {
				if !seen[pod.NodeName] {
					seen[pod.NodeName] = true
					nodeLists = append(nodeLists, pod.NodeName)
				}
			}
			nodeListTemp = strings.Join(nodeLists, ",")
			logrus.Tracef("job:%s, nodelists:%s", job.NewJobName, nodeListTemp)
		}
		events := GetEventsById(jobId, Job)
		if len(fields) == 0 {
			jobDetail = append(jobDetail, &pb.JobInfo{
				JobId:            uint32(job.JobDBInx),
				Name:             job.JobName,
				Account:          job.Account,
				User:             job.UserName,
				Partition:        job.Partition,
				State:            job.State,
				CpusReq:          int32(job.CPUsReq),
				MemReqMb:         int64(job.MemReq),
				TimeLimitMinutes: int64(job.Timelimit),
				SubmitTime:       submitTimeTimestamp,
				WorkingDirectory: job.WorkDir,
				NodeList:         &nodeListTemp,
				StartTime:        startTimeTimestamp,
				EndTime:          endTimeTimestamp,
				StdoutPath:       &stdoutPath,
				StderrPath:       &stderrPath,
				NodesReq:         int32(job.PODsReq),
				ElapsedSeconds:   &elapsedSeconds,
				Reason:           &reason,
				CpusAlloc:        &cpusAlloc,
				MemAllocMb:       &memAllocMb,
				GpusAlloc:        &gpusAlloc,
				NodesAlloc:       &nodesAllocTemp,
				Qos:              job.Qos,
				Pods:             pods,
				Events:           events,
				GpusReq:          int32(job.GPUsReq),
				UniqueJobName:    job.NewJobName,
			})
		} else {
			subJobInfo := &pb.JobInfo{}
			for _, field := range fields {
				switch field {
				case "job_id":
					subJobInfo.JobId = uint32(job.JobDBInx)
				case "name":
					subJobInfo.Name = job.JobName
				case "account":
					subJobInfo.Account = job.Account
				case "user":
					subJobInfo.User = job.UserName
				case "partition":
					subJobInfo.Partition = job.Partition
				case "state":
					subJobInfo.State = job.State
				case "cpus_req":
					subJobInfo.CpusReq = int32(job.CPUsReq)
				case "mem_req_mb":
					subJobInfo.MemReqMb = int64(job.MemReq)
				case "nodes_req":
					subJobInfo.NodesReq = int32(job.PODsReq)
				case "time_limit_minutes":
					subJobInfo.TimeLimitMinutes = int64(job.Timelimit)
				case "submit_time":
					subJobInfo.SubmitTime = submitTimeTimestamp
				case "working_directory":
					subJobInfo.WorkingDirectory = job.WorkDir
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
				case "qos":
					subJobInfo.Qos = job.Qos
				case "pods":
					subJobInfo.Pods = pods
				case "events":
					subJobInfo.Events = events
				case "gpus_req":
					subJobInfo.GpusReq = int32(job.GPUsReq)
				case "adapter_job_name":
					subJobInfo.UniqueJobName = job.NewJobName
				}
			}
			jobDetail = append(jobDetail, subJobInfo)
		}
	}
	return jobDetail
}

func IsValidString(s string) bool {
	//// Kubernetes Pod 名称的正则表达式
	//re := regexp.MustCompile(`^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`)
	//return re.MatchString(s)

	// 检查空字符串
	if len(s) == 0 {
		return false
	}
	// 检查第一个字符是否是数字
	if unicode.IsDigit(rune(s[0])) {
		return false
	}
	// 检查是否包含大写字母或特殊字符（除连字符外）
	for _, char := range s {
		if string(char) != "-" && !unicode.IsLetter(char) && !unicode.IsDigit(char) {
			return false
		}
	}
	// 检查连字符是否是首个字符
	if strings.HasPrefix(s, "-") {
		return false
	} else {
		return true
	}
}

func GetLocalQueue(client *volcanoclientset.Clientset) ([]queueInfo, error) {
	var queueList []queueInfo

	queues, err := client.SchedulingV1beta1().Queues().List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("error listing Queues: %v", err)
	}

	for _, queue := range queues.Items {
		// volcano 1.11版本新增 root 队列
		if queue.Name == "default" || queue.Name == "root" {
			continue
		}

		var (
			cpu, memory, gpu, allocCpu, allocMemory, allocGpu, ram int64
			gpuType                                                v1.ResourceName
			comment                                                string
		)

		// 解析资源容量
		if capability := queue.Spec.Capability; capability != nil {
			if v, ok := capability["cpu"]; ok {
				cpu, _ = v.AsInt64()
			}
			if v, ok := capability["memory"]; ok {
				memory, _ = v.AsInt64()
			}
			// 动态识别加速器资源
			for resName, quantity := range capability {
				if resName == "cpu" || resName == "memory" {
					continue
				}
				gpuType = resName
				gpu, _ = quantity.AsInt64()
				break // 只取第一个非标准资源
			}
		}

		// 解析已分配资源
		if allocated := queue.Status.Allocated; allocated != nil {
			if v, ok := allocated["cpu"]; ok {
				allocCpu, _ = v.AsInt64()
			}
			if v, ok := allocated["memory"]; ok {
				allocMemory, _ = v.AsInt64()
			}
			if gpuType != "" {
				if v, ok := allocated[gpuType]; ok {
					allocGpu, _ = v.AsInt64()
				}
			}
		}

		queueList = append(queueList, queueInfo{
			Name:     queue.Name,
			Cpu:      cpu,
			Memory:   memory / (1024 * 1024), // 转换为MB
			Gpu:      gpu,
			Comment:  comment,
			Type:     string(gpuType),
			Ram:      ram,
			AllocMem: allocMemory / (1024 * 1024), // 转换为MB
			AllocCpu: allocCpu,
			AllocGpu: allocGpu,
		})
	}
	logrus.Tracef("GetLocalQueue: %v", queueList)
	return queueList, nil
}

func GetGroupName(userName string) (string, error) {
	cmd := fmt.Sprintf("id %s | awk '{print $2}'", userName) // 直接利用shell command 获取
	result, err := RunCommand(cmd)
	if err != nil {
		return "", err
	}
	re := regexp.MustCompile(`\((.*?)\)`)
	match := re.FindStringSubmatch(result)
	if len(match) > 1 {
		content := match[1]
		return content, nil
	} else {
		return "", fmt.Errorf("no group")
	}
}

func GetPodLogByPodName(podName, nameSpace string, k8sClient *k8sclient.Clientset) (string, error) {
	var logOutput string

	logOptions := &v1.PodLogOptions{
		Follow:     false, // false获取历史日志，true则跟随新日志
		Timestamps: false, // 是否在日志前添加时间戳
	}
	req := k8sClient.CoreV1().Pods(nameSpace).GetLogs(podName, logOptions)
	podLogs, err := req.Stream(context.TODO())
	if err != nil {
		return "", err
	}
	defer podLogs.Close()
	reader := bufio.NewReader(podLogs)
	for {
		line, _, err := reader.ReadLine()
		if err != nil {
			if err == io.EOF {
				break
			}
			break
		}
		logOutput += strings.TrimSpace(string(line))
	}
	return logOutput, nil
}

func GetPartitionsInfo(k8sClient *k8sclient.Clientset, allPods []v1.Pod) ([]*pb.PartitionInfo, error) {
	var (
		parts       []*pb.PartitionInfo
		runningJobs []models.JobTable
		pendingJobs []models.JobTable
	)
	queueNodes, err := GetQueueNodes(k8sClient)
	if err != nil {
		logrus.Errorf("GetClusterConfig failed: %v", err)
		return nil, err
	}

	for queue, nodes := range queueNodes {
		var (
			CpuCoreCount    uint32
			RunningCpuCount uint32
			GpuCoreCount    uint32
			RunningGpuCount uint32
			MemCount        uint32
			RunningMemCount uint32
			PartitionInfo   models.PartitionTable
		)
		wg := &sync.WaitGroup{}
		mutex := &sync.Mutex{}
		wg.Add(len(nodes))
		for _, node := range nodes {
			logrus.Tracef("GetPartitionsInfo: queue name: %v, node: %v", queue, node.Name)
			nodeTmp := node
			go func() {
				defer wg.Done()
				allocateCpu, allocateMem, allocateGpu, _ := GetNodeAllocatedResources(nodeTmp, allPods)
				//resource := GetResource(&nodeTmp.Status.Capacity)
				mutex.Lock()
				//CpuCoreCount += uint32(resource.CPU)
				//GpuCoreCount += uint32(resource.AcceleratorCount)
				//MemCount += uint32(resource.Mem)
				RunningCpuCount += uint32(allocateCpu)
				RunningGpuCount += uint32(allocateGpu)
				RunningMemCount += uint32(allocateMem)
				mutex.Unlock()
			}()
		}
		wg.Wait()
		totalNodes, runningNodes, idleNodes, notAvailableNodes, err := GetClusterNodesStatus(k8sClient, nodes, allPods)
		logrus.Tracef("GetPartitionsInfo: totalNodes: %v, runningNodes: %v, idleNodes: %v, notAvailableNodes: %v", totalNodes, runningNodes, idleNodes, notAvailableNodes)
		if err != nil {
			return nil, fmt.Errorf("failed get nodes: %v", err)
		}
		if PartitionInfo, err = GetQueueByName(queue); err != nil {
			return nil, fmt.Errorf("get partition info failed, %v", err)
		}
		CpuCoreCount = uint32(*PartitionInfo.CPUCap)
		GpuCoreCount = uint32(*PartitionInfo.GPUCap)
		MemCount = uint32(*PartitionInfo.MemCap)
		// 查数据库, partition是关键字需要转义
		errRunning := client.DB.Where("`partition` = ? AND state = ?", queue, "RUNNING").Find(&runningJobs).Error
		errPending := client.DB.Where("`partition` = ? AND state = ?", queue, "PENDING").Find(&pendingJobs).Error
		if errRunning != nil || errPending != nil {
			return nil, fmt.Errorf("failed get job")
		}
		runningJobCount := len(runningJobs) // 正在运行作业的总数
		pendingJobCount := len(pendingJobs) // 正在排队作业的总数

		resultRatio := float64(runningNodes) / float64(totalNodes)
		percentage := int(resultRatio * 100) // 保留整数

		parts = append(parts, &pb.PartitionInfo{
			PartitionName:           queue,
			NodeCount:               totalNodes,
			RunningNodeCount:        runningNodes,
			IdleNodeCount:           idleNodes,
			NotAvailableNodeCount:   notAvailableNodes,
			CpuCoreCount:            CpuCoreCount,
			RunningCpuCount:         RunningCpuCount,
			IdleCpuCount:            CpuCoreCount - RunningCpuCount,
			NotAvailableCpuCount:    0,
			GpuCoreCount:            GpuCoreCount,
			RunningGpuCount:         RunningGpuCount,
			IdleGpuCount:            GpuCoreCount - RunningGpuCount,
			NotAvailableGpuCount:    0,
			JobCount:                uint32(runningJobCount + pendingJobCount),
			RunningJobCount:         uint32(runningJobCount),
			PendingJobCount:         uint32(pendingJobCount),
			UsageRatePercentage:     uint32(percentage),
			PartitionStatus:         pb.PartitionInfo_AVAILABLE,
			TotalMemMb:              MemCount,
			AllocMemMb:              RunningMemCount,
			GpuModel:                &PartitionInfo.GPUModel,
			AcceleratorDescriptions: strings.Split(PartitionInfo.AcceleratorDescriptions, ","),
		})
	}
	logrus.Tracef("GetPartitionsInfo, parts: %v", parts)
	return parts, nil
}

// 获取特定nodeList节点列表中，totalNodes, runningNodes, idleNodes, notAvailableNodes的值

func GetClusterNodesStatus(client *k8sclient.Clientset, nodeList []*v1.Node, allPods []v1.Pod) (uint32, uint32, uint32, uint32, error) {
	var (
		totalNodes, runningNodes, idleNodes, notAvailableNodes uint32
		handleNodes                                            []*v1.Node
		err                                                    error
	)
	if nodeList == nil {
		nodes, err := GetWorkNodes(client)
		if err != nil {
			return totalNodes, runningNodes, idleNodes, notAvailableNodes, err
		}
		for _, node := range nodes.Items {
			vnode := node
			handleNodes = append(handleNodes, &vnode)
		}
	} else {
		handleNodes = nodeList
	}
	totalNodes = uint32(len(handleNodes))
	for _, node := range handleNodes {
		podList := GetNodeRunningPods(node.Name, allPods)
		logrus.Tracef("[GetClusterNodesStatus] node %s len podlist: %d", node.Name, len(podList))
		isReady := isReadyNode(node)
		if len(podList) > 0 && isReady {
			runningNodes += 1
		} else if node.Spec.Unschedulable && len(podList) > 0 {
			runningNodes += 1
		} else if !isReady {
			notAvailableNodes += 1
		}
	}
	idleNodes = totalNodes - runningNodes - notAvailableNodes
	return totalNodes, runningNodes, idleNodes, notAvailableNodes, err
}

func GetMountPoints(RWPath, ROPath string) map[bool][]string {
	/*
				RWPath 读写挂载点
			    ROPath 只读挂载点
		        同时兼容[]string  和  map{path:"", target:""}
	*/
	mountPoints := make(map[bool][]string)
	if RWPath != "" {
		if strings.Contains(RWPath, "{") && strings.Contains(RWPath, "}") {
			mountPoints[false] = []string{RWPath}
		} else {
			mountPoints[false] = strings.Split(RWPath, ",")
		}
	}
	if ROPath != "" {
		if strings.Contains(ROPath, "{") && strings.Contains(ROPath, "}") {
			mountPoints[true] = []string{ROPath}
		} else {
			mountPoints[true] = strings.Split(ROPath, ",")
		}
	}
	return mountPoints
}

func SetMountPoints(mountPoints map[bool][]string, workDir string, in *pb.SubmitJobRequest) ([]interface{}, []interface{}, error) {
	uid, gid, mountMode, err := GetCsiInfoFromIdmap(in.UserIdmapInfo)
	if err != nil {
		return nil, nil, err
	}
	volumeMounts := []interface{}{
		map[string]interface{}{
			"mountPath": workDir,
			"name":      "workdir",
		},
		map[string]interface{}{
			"mountPath": "/dev/shm",
			"name":      "dshm",
		},
	}
	workerVolume, err := buildVolume("workdir", PathMap{Path: workDir, Target: workDir}, uid, gid, mountMode)
	if err != nil {
		return nil, nil, err
	}
	volumes := []interface{}{
		workerVolume,
		map[string]interface{}{
			"name": "dshm",
			"emptyDir": map[string]interface{}{
				"medium":    "Memory",
				"sizeLimit": strconv.Itoa(int(*in.MemoryMb)/2) + "Mi",
			},
		},
	}
	if in.Script != "" {
		volumeMounts = append(volumeMounts, map[string]interface{}{
			"mountPath": "/opt/entry.sh",
			"name":      "script",
		})
		volumes = append(volumes, map[string]interface{}{
			"name": "script",
			"hostPath": map[string]interface{}{
				"path": in.Script,
				"type": "File",
			},
		})
	} else {
		volumeMounts = append(volumeMounts, map[string]interface{}{
			"mountPath": "/opt/entry.sh",
			"name":      "script",
			"subPath":   "entry.sh",
		})
		volumes = append(volumes, map[string]interface{}{
			"name": "script",
			"configMap": map[string]interface{}{
				"name":        "dev-tools-startup",
				"defaultMode": 0755,
			},
		})
	}

	suffix := 1
	logrus.Tracef("[SetMountPoints] mountsPoint: %v", mountPoints)
	if len(mountPoints) != 0 {
		for flag, path := range mountPoints {
			logrus.Tracef("[SetMountPoints]path string: %s", strings.Join(path, ""))
			var data []PathMap
			err := json.Unmarshal([]byte(strings.Join(path, "")), &data)
			if err != nil {
				for index, value := range path {
					logrus.Tracef("[SetMountPoints] value: %s, err: %s", value, err)
					volumes = append(volumes, map[string]interface{}{
						"name": "extramount" + strconv.Itoa(suffix) + strconv.Itoa(index),
						"hostPath": map[string]interface{}{
							"path": value,
						},
					})
					volumeMounts = append(volumeMounts, map[string]interface{}{
						"mountPath": value,
						"name":      "extramount" + strconv.Itoa(suffix) + strconv.Itoa(index),
						"readOnly":  flag,
					})
				}
			} else {
				logrus.Tracef("[SetMountPoints] data: %s", data)
				for index, v := range data {
					name := "extramount" + strconv.Itoa(suffix) + strconv.Itoa(index)
					volume, err := buildVolume(name, v, uid, gid, mountMode)
					if err != nil {
						return nil, nil, err
					}
					volumes = append(volumes, volume)
					volumeMounts = append(volumeMounts, map[string]interface{}{
						"mountPath": v.Target,
						"name":      name,
						"readOnly":  flag,
					})
				}
			}
			suffix++
		}
	}

	algorithm, dataSet, model, err := GetAlgorithmDataSetModelInfo(in.ExtraOptions[3], in.ExtraOptions[4], in.ExtraOptions[5])
	if err != nil {
		return volumes, volumeMounts, err
	}
	v, vm, err := setMountPointByAddition(algorithm, dataSet, model, uid, gid, mountMode)
	if err != nil {
		return nil, nil, err
	}
	volumes = append(volumes, v...)
	volumeMounts = append(volumeMounts, vm...)

	return volumes, volumeMounts, nil
}
func SetAscendVcjobMountPoints(mountPoints map[bool][]string, workDir string, in *pb.SubmitJobRequest) ([]interface{}, []interface{}, error) {
	uid, gid, mountMode, err := GetCsiInfoFromIdmap(in.UserIdmapInfo)
	if err != nil {
		return nil, nil, err
	}
	volumeMounts := []interface{}{
		map[string]interface{}{
			"mountPath": "/user/serverid/devindex/config",
			"name":      "ascend-910-config",
		},
		map[string]interface{}{
			"mountPath": workDir,
			"name":      "workdir",
		},
		map[string]interface{}{
			"mountPath": "/usr/local/Ascend/driver",
			"name":      "ascend",
			"readOnly":  true,
		},
		map[string]interface{}{
			"mountPath": "/usr/bin/hccn_tool",
			"name":      "hccn-tool",
		},
		map[string]interface{}{
			"name":      "ascend-add-ons",
			"mountPath": "/usr/local/Ascend/add-ons",
			"readOnly":  true,
		},
		map[string]interface{}{
			"mountPath": "/usr/local/bin/npu-smi",
			"name":      "npu-smi",
		},
		map[string]interface{}{
			"mountPath": "/etc/localtime",
			"name":      "localtime",
		},
		map[string]interface{}{
			"mountPath": "/dev/shm",
			"name":      "dshm",
		},
	}
	workerVolume, err := buildVolume("workdir", PathMap{Path: workDir, Target: workDir}, uid, gid, mountMode)
	if err != nil {
		return nil, nil, err
	}
	volumes := []interface{}{
		map[string]interface{}{
			"name": "ascend-910-config",
			"configMap": map[string]interface{}{
				"name": fmt.Sprintf("rings-config-%s", in.JobName),
			},
		},
		workerVolume,
		map[string]interface{}{
			"name": "ascend",
			"hostPath": map[string]interface{}{
				"path": "/usr/local/Ascend/driver",
			},
		},
		map[string]interface{}{
			"name": "hccn-tool",
			"hostPath": map[string]interface{}{
				"path": "/usr/bin/hccn_tool",
				"type": "FileOrCreate",
			},
		},
		map[string]interface{}{
			"name": "ascend-add-ons",
			"hostPath": map[string]interface{}{
				"path": "/usr/local/Ascend/add-ons",
			},
		},
		map[string]interface{}{
			"name": "npu-smi",
			"hostPath": map[string]interface{}{
				"path": "/usr/local/bin/npu-smi",
			},
		},
		map[string]interface{}{
			"name": "localtime",
			"hostPath": map[string]interface{}{
				"path": "/etc/localtime",
			},
		},
		map[string]interface{}{
			"name": "dshm",
			"emptyDir": map[string]interface{}{
				"medium":    "Memory",
				"sizeLimit": strconv.Itoa(int(*in.MemoryMb)/2) + "Mi",
			},
		},
	}
	if in.Script != "" {
		volumeMounts = append(volumeMounts, map[string]interface{}{
			"mountPath": "/opt/entry.sh",
			"name":      "script",
		})
		volumes = append(volumes, map[string]interface{}{
			"name": "script",
			"hostPath": map[string]interface{}{
				"path": in.Script,
				"type": "File",
			},
		})
	} else {
		volumeMounts = append(volumeMounts, map[string]interface{}{
			"mountPath": "/opt/entry.sh",
			"name":      "script",
			"subPath":   "entry.sh",
		})
		volumes = append(volumes, map[string]interface{}{
			"name": "script",
			"configMap": map[string]interface{}{
				"name":        "dev-tools-startup",
				"defaultMode": 0755,
			},
		})
	}

	suffix := 1
	logrus.Tracef("[SetAscendVcjobMountPoints] mountsPoint: %v", mountPoints)
	if len(mountPoints) != 0 {
		for flag, path := range mountPoints {
			logrus.Tracef("[SetAscendVcjobMountPoints]path string: %s", strings.Join(path, ""))
			var data []PathMap
			err := json.Unmarshal([]byte(strings.Join(path, "")), &data)
			if err != nil {
				// 公共路径还没统一格式，需降级处理
				for index, value := range path {
					logrus.Tracef("[SetMountPoints] value: %s, err: %s", value, err)
					volumes = append(volumes, map[string]interface{}{
						"name": "extramount" + strconv.Itoa(suffix) + strconv.Itoa(index),
						"hostPath": map[string]interface{}{
							"path": value,
						},
					})
					volumeMounts = append(volumeMounts, map[string]interface{}{
						"mountPath": value,
						"name":      "extramount" + strconv.Itoa(suffix) + strconv.Itoa(index),
						"readOnly":  flag,
					})
				}
			} else {
				logrus.Tracef("[SetAscendVcjobMountPoints] data: %s", data)
				for index, v := range data {
					name := "extramount" + strconv.Itoa(suffix) + strconv.Itoa(index)
					volume, err := buildVolume(name, v, uid, gid, mountMode)
					if err != nil {
						return nil, nil, err
					}
					volumes = append(volumes, volume)
					volumeMounts = append(volumeMounts, map[string]interface{}{
						"mountPath": v.Target,
						"name":      name,
						"readOnly":  flag,
					})
				}
			}
			suffix++
		}
	}
	algorithm, dataSet, model, err := GetAlgorithmDataSetModelInfo(in.ExtraOptions[3], in.ExtraOptions[4], in.ExtraOptions[5])
	if err != nil {
		return volumes, volumeMounts, err
	}

	v, vm, err := setMountPointByAddition(algorithm, dataSet, model, uid, gid, mountMode)
	if err != nil {
		return nil, nil, err
	}
	volumes = append(volumes, v...)
	volumeMounts = append(volumeMounts, vm...)

	return volumes, volumeMounts, nil
}

func buildVolume(name string, v PathMap, uid, gid uint32, mountMode UserIdmapMode) (map[string]interface{}, error) {
	volume := GetMountPathVolume(uid, gid, v.Path, name, mountMode)
	volumeByte, err := json.Marshal(volume)
	if err != nil {
		logrus.Errorf("[buildVolume] transfer to byte err: %s", err)
		return nil, err
	}
	var volumeMap map[string]interface{}
	err = json.Unmarshal(volumeByte, &volumeMap)
	if err != nil {
		logrus.Errorf("[buildVolume] transfer to json err: %s", err)
		return nil, err
	}
	return volumeMap, nil
}

func setMountPointByAddition(algorithm, dataSet, model []MountModel, uid, gid uint32, mountMode UserIdmapMode) ([]interface{}, []interface{}, error) {
	var v, vm []interface{}
	for i, al := range algorithm {
		name := "algorithm" + strconv.Itoa(i)
		volume, err := buildVolume(name, PathMap{Path: al.Path, Target: al.Path}, uid, gid, mountMode)
		if err != nil {
			return nil, nil, err
		}
		v = append(v, volume)
		vm = append(vm, map[string]interface{}{
			"mountPath": al.Target,
			"name":      name,
			"readOnly":  al.IsPublic,
		})
	}
	for i, ds := range dataSet {
		name := "dataset" + strconv.Itoa(i)
		volume, err := buildVolume(name, PathMap{Path: ds.Path, Target: ds.Path}, uid, gid, mountMode)
		if err != nil {
			return nil, nil, err
		}
		v = append(v, volume)
		vm = append(vm, map[string]interface{}{
			"mountPath": ds.Target,
			"name":      name,
			"readOnly":  ds.IsPublic,
		})
	}
	for i, m := range model {
		name := "model" + strconv.Itoa(i)
		volume, err := buildVolume(name, PathMap{Path: m.Path, Target: m.Path}, uid, gid, mountMode)
		if err != nil {
			return nil, nil, err
		}
		v = append(v, volume)
		vm = append(vm, map[string]interface{}{
			"mountPath": m.Target,
			"name":      name,
			"readOnly":  m.IsPublic,
		})
	}
	return v, vm, nil
}

func SetContainerEnv(workDir string, in *pb.SubmitJobRequest) ([]interface{}, error) {
	// 定义 Container 的env对象
	env := []interface{}{
		// 环境变量注入容器ip地址
		map[string]interface{}{
			"name": "SCOW_CONTAINER_IP",
			"valueFrom": map[string]interface{}{
				"fieldRef": map[string]interface{}{
					"fieldPath": "status.podIP",
				},
			},
		},
	}

	algorithm, dataSet, model, err := GetAlgorithmDataSetModelInfo(in.ExtraOptions[3], in.ExtraOptions[4], in.ExtraOptions[5])
	if err != nil {
		return env, err
	}

	env = append(env, setEnvByAddition(algorithm, dataSet, model)...)

	return env, nil
}

func SetAscendContainerEnv(workDir string, in *pb.SubmitJobRequest) ([]interface{}, error) {
	// 定义 Container 的env对象
	env := []interface{}{
		// 环境变量注入容器ip地址
		map[string]interface{}{
			"name": "SCOW_CONTAINER_IP",
			"valueFrom": map[string]interface{}{
				"fieldRef": map[string]interface{}{
					"fieldPath": "status.podIP",
				},
			},
		},
		map[string]interface{}{
			"name": in.JobName,
			"valueFrom": map[string]interface{}{
				"fieldRef": map[string]interface{}{
					"fieldPath": "metadata.name",
				},
			},
		},
		map[string]interface{}{
			"name": "XDL_IP",
			"valueFrom": map[string]interface{}{
				"fieldRef": map[string]interface{}{
					"fieldPath": "status.hostIP",
				},
			},
		},
		//map[string]interface{}{
		//	"name": "ASCEND_VISIBLE_DEVICES",
		//	"valueFrom": map[string]interface{}{
		//		"fieldRef": map[string]interface{}{
		//			"fieldPath": "metadata.annotations['huawei.com/Ascend910']",
		//		},
		//	},
		//},
	}
	algorithm, dataSet, model, err := GetAlgorithmDataSetModelInfo(in.ExtraOptions[3], in.ExtraOptions[4], in.ExtraOptions[5])
	if err != nil {
		return env, err
	}
	env = append(env, setEnvByAddition(algorithm, dataSet, model)...)

	return env, nil
}

func setEnvByAddition(algorithm, dataSet, model []MountModel) []interface{} {
	var env []interface{}
	// algorithm
	if algorithm != nil {
		paths := make([]string, len(algorithm))
		for i, mount := range algorithm {
			paths[i] = GetMountTargetPath(mount)
		}
		algorithmValue := strings.Join(paths, ":")
		env = append(env, map[string]interface{}{
			"name":  ContainerEnvPrefix + AlgorithmPathEnv,
			"value": algorithmValue,
		})
	}

	// dataSet
	if dataSet != nil {
		paths := make([]string, len(dataSet))
		for i, mount := range dataSet {
			paths[i] = GetMountTargetPath(mount)
		}
		dataSetValue := strings.Join(paths, ":")
		env = append(env, map[string]interface{}{
			"name":  ContainerEnvPrefix + DataSetPathEnv,
			"value": dataSetValue,
		})
	}

	// model
	if model != nil {
		paths := make([]string, len(model))
		for i, mount := range model {
			paths[i] = GetMountTargetPath(mount)
		}
		modelValue := strings.Join(paths, ":")
		env = append(env, map[string]interface{}{
			"name":  ContainerEnvPrefix + ModelPathEnv,
			"value": modelValue,
		})
	}
	return env
}

func GetMountTargetPath(mount MountModel) string {
	if mount.Target != "" {
		return mount.Target
	}
	return mount.Path
}

func GetAlgorithmDataSetModelInfo(algorithmPath, dataSetPath, modelPath string) ([]MountModel, []MountModel, []MountModel, error) {
	var algorithm, dataSet, model []MountModel
	var err error
	// algorithm
	if algorithmPath != "" {
		algorithm, err = ParseMountModel(algorithmPath)
		if err != nil {
			logrus.Errorf("Failed parse algorithm path: %v", err)
			return nil, nil, nil, err
		}
	}

	// dataSet
	if dataSetPath != "" {
		dataSet, err = ParseMountModel(dataSetPath)
		if err != nil {
			logrus.Errorf("Failed parse dataSet path: %v", err)
			return nil, nil, nil, err
		}
	}

	// model
	if modelPath != "" {
		model, err = ParseMountModel(modelPath)
		if err != nil {
			logrus.Errorf("Failed parse model path: %v", err)
			return nil, nil, nil, err
		}
	}
	return algorithm, dataSet, model, nil
}

func ParseMountModel(mount string) ([]MountModel, error) {
	var info []MountModel

	var rawStrings []string
	err := json.Unmarshal([]byte(mount), &rawStrings)
	if err != nil {
		logrus.Errorf("Outer JSON parsing failed: %v", err)
		return info, err
	}

	for _, s := range rawStrings {
		var mm MountModel
		err = json.Unmarshal([]byte(s), &mm)
		if err != nil {
			logrus.Errorf("Unmarshal error: %v", err)
			return info, err
		}
		if mm.Target == "" {
			mm.Target = mm.Path
		}
		info = append(info, mm)
	}

	return info, nil
}

// GenerateQueueNodeAffinity 返回一个使得作业能调度到对应队列下节点的节点亲和力配置
func GenerateQueueNodeAffinity(key string) map[string]interface{} {
	return map[string]interface{}{
		"nodeAffinity": map[string]interface{}{
			"requiredDuringSchedulingIgnoredDuringExecution": map[string]interface{}{
				"nodeSelectorTerms": []map[string]interface{}{
					{
						"matchExpressions": []map[string]interface{}{
							{
								"key":      "queue-" + key,
								"operator": "In",
								"values":   []string{"true"},
							},
						},
					},
				},
			},
		},
	}
}

// GenerateQueueToleration 生成分区污点容忍配置
func GenerateQueueToleration(enabled bool, key string) []interface{} {
	var tolerations []interface{}
	if enabled {
		tolerations = []interface{}{
			map[string]interface{}{
				"key":      "queue-" + key,
				"operator": "Equal",
				"value":    "true",
				"effect":   "NoSchedule",
			},
		}
	}

	return tolerations
}

func ParseHostList(hostStr string) ([]string, bool) {
	nameStr := strings.ReplaceAll(hostStr, " ", "")
	nameStr += ","

	var nameMeta string
	var strList []string
	var charQueue string

	for _, c := range nameStr {
		switch c {
		case '[':
			if charQueue == "" {
				charQueue = string(c)
			} else {
				logrus.Errorf("Illegal node name string format: duplicate brackets")
				return nil, false
			}
		case ']':
			if charQueue == "" {
				logrus.Errorf("Illegal node name string format: isolated bracket")
				return nil, false
			} else {
				nameMeta += charQueue
				nameMeta += string(c)
				charQueue = ""
			}
		case ',':
			if charQueue == "" {
				strList = append(strList, nameMeta)
				nameMeta = ""
			} else {
				charQueue += string(c)
			}
		default:
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
	bracketsRegex := regexp.MustCompile(`.*\[(.*)\]`)
	numRegex := regexp.MustCompile(`^\d+$`)
	scopeRegex := regexp.MustCompile(`^(\d+)-(\d+)$`)

	if !bracketsRegex.MatchString(nodeStr) {
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
		unitList := []string{}
		headStr := nodeNum[0]

		for _, numStr := range nodeNum[1:] {
			if numRegex.MatchString(numStr) {
				unitList = append(unitList, fmt.Sprintf("%s%s", headStr, numStr))
			} else if scopeRegex.MatchString(numStr) {
				locIndex := scopeRegex.FindStringSubmatch(numStr)
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

		tempList := []string{}
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

func GetQueueName() ([]string, error) {
	var queueList []string

	volcanoClient, err := GetVolcanoClient()
	if err != nil {
		logrus.Errorf("failed to build volcano client: %v", err)
		return nil, err
	}

	queues, err := volcanoClient.SchedulingV1beta1().Queues().List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("error listing Queues: %v", err)
	}

	for _, queue := range queues.Items {
		if queue.Name == "default" {
			continue
		}

		queueList = append(queueList, queue.Name)
	}
	return queueList, nil
}

// ExcludeBlockedPartitions 从账户分区列表中排除需要封锁的分区（存在性检查+过滤）
// 账户本来的分区减去需要封锁的分区，需要封锁的分区不在本来的分区中时提示该分区已封锁
func ExcludeBlockedPartitions(accountPartitions string, needBlockPartitions []string) string {
	accountPartitionsList := strings.Split(accountPartitions, ",")

	blockPartitions := make(map[string]bool)
	for _, partition := range needBlockPartitions {
		blockPartitions[partition] = true
	}

	// 检查 needBlockPartitions 中是否有 accountPartitions 不存在的分区
	for _, partition := range needBlockPartitions {
		found := false
		for _, accPartition := range accountPartitionsList {
			if accPartition == partition {
				found = true
				break
			}
		}
		if !found {
			logrus.Infof("partition '%s' is already blocked in account", partition)
		}
	}

	// 过滤掉需要封锁的分区
	var filteredPartitions []string
	for _, partition := range accountPartitionsList {
		if !blockPartitions[partition] {
			filteredPartitions = append(filteredPartitions, partition)
		}
	}

	return strings.Join(filteredPartitions, ",")
}

// IncludeUnblockedPartitions 将需要解封的分区合并到账户分区列表中（存在性检查+合并）
// 账户本来的分区加上需要解封的分区，需要解封的分区在本来的分区中时提示该分区已解封
func IncludeUnblockedPartitions(accountPartitions string, needUnblockPartitions []string) string {
	existingPartitions := strings.Split(accountPartitions, ",")

	// 过滤空字符串
	filtered := make([]string, 0, len(existingPartitions))
	for _, p := range existingPartitions {
		if p != "" { // 剔除空元素
			filtered = append(filtered, p)
		}
	}
	existingPartitions = filtered

	partitionMap := make(map[string]bool)
	for _, partition := range existingPartitions {
		partitionMap[partition] = true
	}

	// 检查 needUnblockPartitions 中是否有 accountPartitions 已经存在的分区
	for _, partition := range needUnblockPartitions {
		if partitionMap[partition] {
			logrus.Infof("partition '%s' is already unblocked in account", partition)
		}
	}

	// 合并分区（去重）
	for _, partition := range needUnblockPartitions {
		if !partitionMap[partition] {
			existingPartitions = append(existingPartitions, partition)
			partitionMap[partition] = true // 标记为已添加
		}
	}

	return strings.Join(existingPartitions, ",")
}

func AccountHasAuthorizedPartition(accountPartitions string, partition string) bool {
	partition = strings.TrimSpace(partition)
	if partition == "" {
		return false
	}

	for _, p := range strings.Split(accountPartitions, ",") {
		if strings.TrimSpace(p) == partition {
			return true
		}
	}
	return false
}

func AcceleratorIsAscend(accelerator string) bool {
	if strings.Contains(accelerator, HuaweiAscend) {
		return true
	}
	return false
}

func GetJobReason(jobName string) string {
	var modelsPod []*models.PodTable
	err := client.DB.Where("job_name = ?", jobName).Find(&modelsPod).Error
	if err != nil {
		logrus.Errorf("[GetJobReason] DB select pod failed by jobname %s, error: %v", jobName, err)
		return ""
	}
	for _, pod := range modelsPod {
		if pod.Status == string(v1.PodRunning) {
			continue
		}
		if pod.Reason != "" {
			return pod.Reason
		}
	}
	return ""
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
		if account.Blocked != 0 {
			continue
		}

		for _, p := range strings.Split(account.Partitions, ",") {
			p = strings.TrimSpace(p) // 去掉前后空格
			if p == "" {             // 跳过空串
				continue
			}
			if _, ok := seen[p]; !ok {
				seen[p] = struct{}{}
				AuthorizedPartitions = append(AuthorizedPartitions, p)
			}
		}
	}

	return AuthorizedPartitions, nil
}

func GetAuthorizedPartitionsNodes(cli *k8sclient.Clientset, partitions []string) ([]*v1.Node, error) {
	queueNodes, err := GetQueueNodes(cli)
	if err != nil {
		return nil, fmt.Errorf("get queue nodes failed: %v", err)
	}
	seen := make(map[string]*v1.Node)
	for queueName, nodes := range queueNodes {
		if !slices.Contains(partitions, queueName) {
			continue
		}
		for _, n := range nodes {
			seen[n.Name] = n
		}
	}

	result := make([]*v1.Node, 0, len(seen))
	for _, n := range seen {
		result = append(result, n)
	}

	return result, nil
}

func GetJobsStatusDistribution(authorizedPartitions []string) (map[string]*jobCount, error) {
	partitionJobs := make(map[string]*jobCount)

	queues, err := GetQueueList()
	if err != nil {
		return nil, fmt.Errorf("get queues failed: %v", err)
	}
	for _, queue := range queues {
		if !slices.Contains(authorizedPartitions, queue.Name) {
			continue
		}
		var (
			runningJobs []models.JobTable
			pendingJobs []models.JobTable
		)
		errRunning := client.DB.Where("`partition` = ? AND state = ?", queue.Name, "RUNNING").Find(&runningJobs).Error
		errPending := client.DB.Where("`partition` = ? AND state = ?", queue.Name, "PENDING").Find(&pendingJobs).Error
		if errRunning != nil || errPending != nil {
			return nil, fmt.Errorf("failed get job")
		}
		runningJobCount := len(runningJobs) // 正在运行作业的总数
		pendingJobCount := len(pendingJobs) // 正在排队作业的总数

		totalJobNum := runningJobCount + pendingJobCount
		partitionJobs[queue.Name] = &jobCount{
			JobCount:        uint32(totalJobNum),
			RunningJobCount: uint32(runningJobCount),
			PendingJobCount: uint32(pendingJobCount),
		}
	}
	return partitionJobs, nil
}

func GetSummaryPartitionsInfo(k8sClient *k8sclient.Clientset, authorizedPartitions []string) ([]*pb.SummaryPartitionInfo, error) {
	var (
		parts       []*pb.SummaryPartitionInfo
		pendingJobs []models.JobTable
	)
	queueNodes, err := GetQueueNodes(k8sClient)
	if err != nil {
		logrus.Errorf("GetClusterConfig failed: %v", err)
		return nil, err
	}
	allPods, err := AllActivePods(k8sClient)
	if err != nil {
		logrus.Errorf("GetAllActivePods failed: %v", err)
		return nil, err
	}

	for queue, nodes := range queueNodes {
		if !slices.Contains(authorizedPartitions, queue) {
			continue
		}
		var (
			CpuCoreCount    uint32
			RunningCpuCount uint32
			GpuCoreCount    uint32
			RunningGpuCount uint32
			RunningMemCount uint32
			PartitionInfo   models.PartitionTable
		)
		wg := &sync.WaitGroup{}
		mutex := &sync.Mutex{}
		wg.Add(len(nodes))
		for _, node := range nodes {
			logrus.Tracef("GetPartitionsInfo: queue name: %v, node: %v", queue, node.Name)
			nodeTmp := node
			go func() {
				defer wg.Done()
				allocateCpu, allocateMem, allocateGpu, _ := GetNodeAllocatedResources(nodeTmp, allPods)
				mutex.Lock()
				RunningCpuCount += uint32(allocateCpu)
				RunningGpuCount += uint32(allocateGpu)
				RunningMemCount += uint32(allocateMem)
				mutex.Unlock()
			}()
		}
		wg.Wait()
		totalNodes, runningNodes, idleNodes, notAvailableNodes, err := GetClusterNodesStatus(k8sClient, nodes, allPods)
		logrus.Tracef("GetPartitionsInfo: totalNodes: %v, runningNodes: %v, idleNodes: %v, notAvailableNodes: %v", totalNodes, runningNodes, idleNodes, notAvailableNodes)
		if err != nil {
			return nil, fmt.Errorf("failed get nodes: %v", err)
		}
		if PartitionInfo, err = GetQueueByName(queue); err != nil {
			return nil, fmt.Errorf("get partition info failed, %v", err)
		}
		CpuCoreCount = uint32(*PartitionInfo.CPUCap)
		GpuCoreCount = uint32(*PartitionInfo.GPUCap)
		// 查数据库, partition是关键字需要转义
		errPending := client.DB.Where("`partition` = ? AND state = ?", queue, "PENDING").Find(&pendingJobs).Error
		if errPending != nil {
			return nil, fmt.Errorf("failed get job")
		}
		pendingJobCount := len(pendingJobs) // 正在排队作业的总数

		var nodeUsage, cpuUsage, gpuUsage float32
		if totalNodes > 0 {
			resultRatio := float32(runningNodes) / float32(totalNodes)
			nodeUsage = float32(math.Round(float64(resultRatio)*100*100) / 100)
		}
		if CpuCoreCount > 0 {
			resultRatio := float32(RunningCpuCount) / float32(CpuCoreCount)
			cpuUsage = float32(math.Round(float64(resultRatio)*100*100) / 100)
		}
		if GpuCoreCount > 0 {
			resultRatio := float32(RunningGpuCount) / float32(GpuCoreCount)
			gpuUsage = float32(math.Round(float64(resultRatio)*100*100) / 100)
		}

		parts = append(parts, &pb.SummaryPartitionInfo{
			PartitionName:   queue,
			NodeCount:       totalNodes,
			NodeUsage:       nodeUsage,
			CpuCoreCount:    CpuCoreCount,
			CpuUsage:        cpuUsage,
			GpuCoreCount:    GpuCoreCount,
			GpuUsage:        gpuUsage,
			PendingJobCount: uint32(pendingJobCount),
			PartitionStatus: pb.SummaryPartitionInfo_AVAILABLE,
		})
	}
	logrus.Tracef("GetPartitionsInfo, parts: %v", parts)
	return parts, nil
}

func GetCsiInfoFromIdmap(idmapInfo *pb.UserIdmapInfo) (uid, gid uint32, mode UserIdmapMode, err error) {
	logrus.Tracef("[GetCsiInfoFromIdmap] idmapInfo: %v", idmapInfo)
	if idmapInfo == nil {
		return 0, 0, "", nil
	}
	uid = idmapInfo.GetUid()
	gid = idmapInfo.GetGid()
	if uid == 0 || gid == 0 {
		logrus.Errorf("[GetCsiInfoFromIdmap] uid or gid is 0")
		return 0, 0, "", fmt.Errorf("uid or gid is 0")
	}
	switch idmapInfo.GetMode() {
	case pb.UserIdmapMode_MODE_NOT_SET:
		mode = ModeNotSet
	case pb.UserIdmapMode_MODE_PLAIN:
		mode = ModePlain
	case pb.UserIdmapMode_MODE_IDMAP:
		mode = ModeIdmap
	case pb.UserIdmapMode_MODE_BINDFS:
		mode = ModeBindfs
	default:
		logrus.Errorf("[GetCsiInfoFromIdmap] mode %s not support", idmapInfo.GetMode())
		mode = ModeNotSet
	}
	logrus.Tracef("[GetCsiInfoFromIdmap] uid: %d, gid: %d, mode: %s", uid, gid, mode)
	return uid, gid, mode, nil
}

func GetMountPathVolume(uid, gid uint32, mountPath, mountName string, mountMode UserIdmapMode) (volume v1.Volume) {
	if mountMode == "" {
		volume = v1.Volume{
			Name: mountName,
			VolumeSource: v1.VolumeSource{
				HostPath: &v1.HostPathVolumeSource{
					Path: mountPath,
				},
			},
		}
	} else {
		uidStr := strconv.FormatUint(uint64(uid), 10)
		gidStr := strconv.FormatUint(uint64(gid), 10)
		attrs := map[string]string{
			"path": mountPath,
			"uid":  uidStr,
			"gid":  gidStr,
		}
		if mountMode != ModeNotSet {
			attrs["mountMode"] = string(mountMode)
		}
		volume = v1.Volume{
			Name: mountName,
			VolumeSource: v1.VolumeSource{
				CSI: &v1.CSIVolumeSource{
					Driver:           CSIDriver,
					VolumeAttributes: attrs,
				},
			},
		}
	}
	return volume
}
