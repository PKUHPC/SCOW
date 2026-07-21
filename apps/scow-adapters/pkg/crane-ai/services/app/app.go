package app

import (
	"context"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc/codes"

	craneProtos "scow-adapters/gen/crane-ai"
	protos "scow-adapters/gen/go"
	ce "scow-adapters/pkg/common/error"
	"scow-adapters/pkg/crane-ai/utils"
)

// proxySetupMu 防止并发请求为同一作业重复创建代理（双重检查锁）。
// 代理创建是低频操作（每作业仅首次触发），全局粗粒度锁开销可忽略。
var proxySetupMu sync.Mutex

type cachedAppConnectionInfo struct {
	Host          string
	Port          uint32
	Password      string
	ContainerPort int32
	StepId        uint32
	ExecutionNode string
	UpdatedAt     int64
}

var appConnectionCache = struct {
	sync.RWMutex
	data map[string]*cachedAppConnectionInfo
}{
	data: make(map[string]*cachedAppConnectionInfo),
}

type ServerApp struct {
	protos.UnimplementedAppServiceServer
	JM *utils.JobManager
}

func (s *ServerApp) GetAppConnectionInfo(ctx context.Context, in *protos.GetAppConnectionInfoRequest) (*protos.GetAppConnectionInfoResponse, error) {
	logrus.Tracef("[GetAppConnectionInfo] request is: %v", in)
	jobID := in.JobId
	taskInfo, err := utils.GetJobById(jobID, "")
	if err != nil {
		logrus.Errorf("[GetAppConnectionInfo] get job info err: %v", err)
		return nil, ce.RichError(codes.Internal, "CRANE_FAILED", err.Error())
	}
	jobName := taskInfo.Name
	// Check job step state
	if taskInfo.Status != craneProtos.JobStatus_Running {
		message := fmt.Errorf("task %v state is: %s", in.JobId, taskInfo.Status.String())
		logrus.Errorf("[GetAppConnectionInfo] %v", message)
		return nil, ce.RichError(codes.Internal, "CRANE_FAILED", message.Error())
	}

	logrus.Tracef("[GetAppConnectionInfo] task %v info is: %s", in.JobId, taskInfo)
	// 获取保存的作业信息
	jobInfo, err := s.JM.QueryJobInfo(jobID)
	if err != nil {
		logrus.Errorf("load job submit info failed: %v", err)
		return nil, ce.RichError(codes.Internal, "CRANE_FAILED", err.Error())
	}

	jobType := jobInfo.JobType
	if jobType != utils.APP && jobType != utils.DevHost && jobType != utils.Inference {
		err = fmt.Errorf("not support")
		logrus.Errorf("GetAppConnectionInfo failed: %v", err)
		return nil, ce.RichError(codes.Internal, "NOT_SUPPORT", err.Error())
	}

	if len(taskInfo.PodMeta.Ports) == 0 {
		logrus.Errorf("[GetAppConnectionInfo] no container ports found for job %v", jobID)
		return nil, ce.RichError(codes.Internal, "CRANE_FAILED", "no container ports found")
	}
	hostname, _ := os.Hostname()

	// 根据 AppType 确定本次连接使用的容器端口，同时确定 session 文件名
	containerPort := taskInfo.PodMeta.Ports[0].ContainerPort
	sessionInfo := "server_session_info.json"
	if in.AppType != nil {
		switch *in.AppType {
		case protos.AppType_APP_TYPE_JUPYTER_LAB:
			containerPort = utils.JupyterPort
			sessionInfo = fmt.Sprintf("server_session_%s.json", utils.Jupyterlab)
		case protos.AppType_APP_TYPE_VSCODE:
			containerPort = utils.VscodePort
			sessionInfo = fmt.Sprintf("server_session_%s.json", utils.Vscode)
		}
	}
	logrus.Tracef(
		"[GetAppConnectionInfo] resolved app connection target, jobId=%d, jobName=%s, jobType=%s, containerPort=%d, sessionInfo=%s",
		jobID, jobName, jobType, containerPort, sessionInfo,
	)

	proxyInfo, err := utils.LoadJobProxyMetaByPort(jobID, containerPort)
	if err != nil {
		logrus.Errorf("load job proxy info failed: %v", err)
		return nil, ce.RichError(codes.Internal, "CRANE_FAILED", err.Error())
	}
	if proxyInfo == nil {
		logrus.Infof("[GetAppConnectionInfo] proxy metadata cache missed, jobId=%d, containerPort=%d", jobID, containerPort)
	} else {
		logrus.Tracef(
			"[GetAppConnectionInfo] proxy metadata cache hit, jobId=%d, containerPort=%d, proxyPort=%d",
			jobID, containerPort, proxyInfo.ProxyPort,
		)
	}
	if proxyInfo != nil && !utils.GlobalProxyManager.IsProxyRunning(proxyInfo) {
		logrus.Warnf("[GetAppConnectionInfo] proxy metadata exists but service is not running for job %d port %d, rebuild it", jobID, containerPort)
		if err := utils.GlobalProxyManager.StopAndRemoveProxy(jobID); err != nil {
			logrus.Warnf("[GetAppConnectionInfo] remove stale proxy metadata failed for job %d: %v", jobID, err)
		}
		proxyInfo = nil
	}

	if cachedInfo := loadConnectionInfoCache(jobID, containerPort); isUsableConnectionCache(cachedInfo, proxyInfo, containerPort) {
		logrus.Tracef("[GetAppConnectionInfo] use cached connection info for job %d, containerPort=%d", jobID, containerPort)
		if containerPort == utils.AppVNCContainerPort {
			stepId, nodeName, err := getConnectionStepAndNode(taskInfo, cachedInfo)
			if err != nil {
				return nil, ce.RichError(codes.Internal, "CRANE_FAILED", err.Error())
			}
			randomPassword, err := resetVNCPassword(taskInfo.JobId, stepId, taskInfo.Uid, nodeName)
			if err != nil {
				return nil, ce.RichError(codes.Internal, "MODIFY_VNC_PASSWORD_FAILED", err.Error())
			}
			responseMessage := buildAppConnectionInfoResponse(cachedInfo.Host, cachedInfo.Port, randomPassword)
			logAppConnectionInfoResponse("GetAppConnectionInfo response from cache", cachedInfo.Host, cachedInfo.Port, randomPassword)
			return responseMessage, nil
		}

		responseMessage := buildAppConnectionInfoResponse(cachedInfo.Host, cachedInfo.Port, cachedInfo.Password)
		logAppConnectionInfoResponse("GetAppConnectionInfo response from cache", cachedInfo.Host, cachedInfo.Port, cachedInfo.Password)
		return responseMessage, nil
	}

	submitJobProxyInfo := &utils.SubmitJobProxyInfo{
		JobName: jobName,
		JobId:   jobID,
	}

	forwardInfo, err := utils.BuildJobForwardInfo(taskInfo.PodMeta, taskInfo.StepInfoList)
	if err != nil {
		logrus.Errorf("build job forward info failed: %v", err)
		return nil, ce.RichError(codes.Internal, "BUILD_PROXY_FAILED", err.Error())
	}
	if len(forwardInfo) == 0 {
		logrus.Errorf("[GetAppConnectionInfo] no forward info found for job %v", jobID)
		return nil, ce.RichError(codes.Internal, "BUILD_PROXY_FAILED", "no forward nodes found")
	}
	submitJobProxyInfo.ForwardInfo = forwardInfo
	nodeName := forwardInfo[0].ExecutionNode

	if proxyInfo == nil {
		// 双重检查锁：先乐观判断，拿锁后再次验证，防止并发请求重复创建同一代理。
		logrus.Infof("[GetAppConnectionInfo] start creating proxy, jobId=%d, containerPort=%d", jobID, containerPort)
		var setupErr error
		proxyInfo, setupErr = func() (*utils.ProxyMeta, error) {
			proxySetupMu.Lock()
			defer proxySetupMu.Unlock()

			// 锁内二次检查：若其他 goroutine 已完成创建则直接返回
			meta, err := utils.LoadJobProxyMetaByPort(jobID, containerPort)
			if err != nil {
				return nil, err
			}
			if meta != nil && utils.GlobalProxyManager.IsProxyRunning(meta) {
				return meta, nil
			}
			if meta != nil {
				logrus.Warnf("[GetAppConnectionInfo] proxy metadata exists but service is not running for job %d port %d, rebuild it", jobID, containerPort)
				if err := utils.GlobalProxyManager.StopAndRemoveProxy(jobID); err != nil {
					return nil, err
				}
			}

			// 为相同容器（同一 StepId）只查询一次 IP，避免重复调用
			ipCache := make(map[uint32]string)
			for _, fn := range forwardInfo {
				if ip, ok := ipCache[fn.StepId]; ok {
					fn.ContainerIP = ip
					continue
				}
				containerIP, err := utils.GetContainerIPByExec(taskInfo.JobId, fn.StepId, taskInfo.Uid, fn.ExecutionNode)
				if err != nil {
					logrus.Errorf("Failed to get container IP for job %v step %v: %v", jobID, fn.StepId, err)
					return nil, err
				}
				ipCache[fn.StepId] = containerIP
				fn.ContainerIP = containerIP
			}

			if err := utils.GlobalProxyManager.CreateAndStartProxy(submitJobProxyInfo); err != nil {
				logrus.Errorf("Failed to create proxy for app job %v: %v", jobName, err)
				return nil, err
			}

			return utils.LoadJobProxyMetaByPort(jobID, containerPort)
		}()
		if setupErr != nil {
			return nil, ce.RichError(codes.Internal, "BUILD_PROXY_FAILED", setupErr.Error())
		}
		if proxyInfo != nil {
			logrus.Infof(
				"[GetAppConnectionInfo] proxy created, jobId=%d, containerPort=%d, proxyPort=%d",
				jobID, containerPort, proxyInfo.ProxyPort,
			)
		}
	}

	if proxyInfo == nil {
		logrus.Errorf("[GetAppConnectionInfo] proxy not found for job %v port %v", jobID, containerPort)
		return nil, ce.RichError(codes.Internal, "BUILD_PROXY_FAILED", "proxy not found after creation")
	}

	logrus.Tracef("proxy info: %v", proxyInfo)

	// 得到step的id和uid
	primarySteps := utils.GetJobPrimaryStep(taskInfo.StepInfoList)
	if len(primarySteps) == 0 {
		logrus.Errorf("[GetAppConnectionInfo] no primary steps found for job %v", jobID)
		return nil, ce.RichError(codes.Internal, "CRANE_FAILED", "no primary steps found")
	}
	step := primarySteps[0]

	if jobType == utils.APP || jobType == utils.DevHost {
		if containerPort == utils.AppVNCContainerPort {
			randomPassword, err := resetVNCPassword(taskInfo.JobId, step.StepId, step.Uid, nodeName)
			if err != nil {
				return nil, ce.RichError(codes.Internal, "MODIFY_VNC_PASSWORD_FAILED", err.Error())
			}

			cacheConnectionInfo(jobID, hostname, uint32(proxyInfo.ProxyPort), "", containerPort, step.StepId, nodeName)
			responseMessage := buildAppConnectionInfoResponse(hostname, uint32(proxyInfo.ProxyPort), randomPassword)
			logAppConnectionInfoResponse("GetAppConnectionInfo response", hostname, uint32(proxyInfo.ProxyPort), randomPassword)
			return responseMessage, nil
		} else {
			logrus.Infof(
				"[GetAppConnectionInfo] connection info cache missed, read session password, jobId=%d, jobName=%s, jobType=%s, sessionInfo=%s",
				jobID, jobName, jobType, sessionInfo,
			)
			webPassword, err := readSessionPassword(taskInfo, jobInfo, sessionInfo, step, nodeName)
			if err != nil {
				logrus.Errorf("GetAppConnectionInfo read session password failed, %v", err)
				return &protos.GetAppConnectionInfoResponse{}, nil
			}
			cacheConnectionInfo(jobID, hostname, uint32(proxyInfo.ProxyPort), webPassword, containerPort, step.StepId, nodeName)
			logrus.Infof(
				"[GetAppConnectionInfo] connection info saved to cache, jobId=%d, jobName=%s, jobType=%s, containerPort=%d, proxyPort=%d",
				jobID, jobName, jobType, containerPort, proxyInfo.ProxyPort,
			)
			responseMessage := buildAppConnectionInfoResponse(hostname, uint32(proxyInfo.ProxyPort), webPassword)
			logAppConnectionInfoResponse("GetAppConnectionInfo response", hostname, uint32(proxyInfo.ProxyPort), webPassword)
			return responseMessage, nil
		}
	} else if jobType == utils.Inference {
		cacheConnectionInfo(jobID, hostname, uint32(proxyInfo.ProxyPort), "", containerPort, step.StepId, nodeName)
		responseMessage := buildAppConnectionInfoResponse(hostname, uint32(proxyInfo.ProxyPort), "")
		logAppConnectionInfoResponse("GetAppConnectionInfo response", hostname, uint32(proxyInfo.ProxyPort), "")
		return responseMessage, nil
	}

	err = fmt.Errorf("not support")
	logrus.Errorf("GetAppConnectionInfo failed: %v", err)
	return nil, ce.RichError(codes.Internal, "NOT_SUPPORT", err.Error())
}

func readSessionPassword(taskInfo *craneProtos.JobInfo, jobInfo *utils.SubmitJobInfo, sessionInfo string, step *craneProtos.StepInfo, nodeName string) (string, error) {
	if jobInfo.JobType == utils.APP {
		sessionInfoPath := filepath.Join(jobInfo.ScriptDir, "server_session_info.json")
		if jobInfo.ScriptDir == "" {
			sessionInfoPath = filepath.Join(taskInfo.GetCwd(), "server_session_info.json")
		}
		logrus.Infof("read app session file %s", sessionInfoPath)
		_, webPassword, err := utils.GetWebJobFileContent(sessionInfoPath)
		if err == nil {
			logrus.Infof("read app session file %s successful", sessionInfoPath)
			return webPassword, nil
		}

		logrus.Warnf("read app session file %s failed: %v, fallback to copy from container /tmp", sessionInfoPath, err)
		return copyAndReadContainerSessionPassword(taskInfo, sessionInfo, step, nodeName)
	}

	if jobInfo.JobType == utils.DevHost {
		sessionInfoPath := filepath.Join(taskInfo.GetCwd(), taskInfo.GetName(), sessionInfo)
		logrus.Infof("read dev host session file %s", sessionInfoPath)
		_, webPassword, err := utils.GetWebJobFileContent(sessionInfoPath)
		if err == nil {
			logrus.Infof("read dev host session file %s successful", sessionInfoPath)
			return webPassword, nil
		}
		logrus.Warnf("read dev host session file %s failed: %v, fallback to copy from container", sessionInfoPath, err)
	}

	return copyAndReadContainerSessionPassword(taskInfo, sessionInfo, step, nodeName)
}

func copyAndReadContainerSessionPassword(taskInfo *craneProtos.JobInfo, sessionInfo string, step *craneProtos.StepInfo, nodeName string) (string, error) {
	webFilePath := fmt.Sprintf("/tmp/%s", sessionInfo)
	dstDir := "/tmp"
	currentTimestamp := time.Now().UnixMicro()
	strNum := strconv.FormatInt(currentTimestamp, 10)
	webFileDestPath := filepath.Join(dstDir, "server_session_info.json-"+strNum)
	defer func() {
		_ = os.Remove(webFileDestPath)
	}()

	logrus.Infof("task.TaskId %v, step.StepId %v, step.Uid %v, webFilePath %v, webFileDestPath %v, nodeName %v",
		taskInfo.JobId, step.StepId, step.Uid, webFilePath, webFileDestPath, nodeName)
	if err := utils.CopyFromPod(taskInfo.JobId, step.StepId, step.Uid, webFilePath, webFileDestPath, nodeName); err != nil {
		return "", fmt.Errorf("copy container session file %s failed: %w", webFilePath, err)
	}
	logrus.Infof("copy container %s file %s successful", taskInfo.Name, webFilePath)

	_, webPassword, err := utils.GetWebJobFileContent(webFileDestPath)
	if err != nil {
		return "", fmt.Errorf("parse container session file %s failed: %w", webFileDestPath, err)
	}

	return webPassword, nil
}

func logAppConnectionInfoResponse(message, host string, port uint32, password string) {
	logrus.Tracef("%s: host=%s, port=%d, passwordSet=%t", message, host, port, password != "")
}

func isUsableConnectionCache(cachedInfo *cachedAppConnectionInfo, proxyInfo *utils.ProxyMeta, containerPort int32) bool {
	return cachedInfo != nil &&
		proxyInfo != nil &&
		cachedInfo.ContainerPort == containerPort &&
		proxyInfo.ContainerPort == containerPort &&
		cachedInfo.Port == uint32(proxyInfo.ProxyPort) &&
		cachedInfo.Host != ""
}

func buildAppConnectionInfoResponse(host string, port uint32, password string) *protos.GetAppConnectionInfoResponse {
	return &protos.GetAppConnectionInfoResponse{
		Response: &protos.GetAppConnectionInfoResponse_AppConnectionInfo_{
			AppConnectionInfo: &protos.GetAppConnectionInfoResponse_AppConnectionInfo{
				Host:     host,
				Port:     port,
				Password: password,
			},
		},
	}
}

func connectionCacheKey(jobId uint32, containerPort int32) string {
	return fmt.Sprintf("%d-%d", jobId, containerPort)
}

func loadConnectionInfoCache(jobId uint32, containerPort int32) *cachedAppConnectionInfo {
	appConnectionCache.RLock()
	defer appConnectionCache.RUnlock()
	return appConnectionCache.data[connectionCacheKey(jobId, containerPort)]
}

func cacheConnectionInfo(jobId uint32, host string, port uint32, password string, containerPort int32, stepId uint32, nodeName string) {
	appConnectionCache.Lock()
	defer appConnectionCache.Unlock()

	appConnectionCache.data[connectionCacheKey(jobId, containerPort)] = &cachedAppConnectionInfo{
		Host:          host,
		Port:          port,
		Password:      password,
		ContainerPort: containerPort,
		StepId:        stepId,
		ExecutionNode: nodeName,
		UpdatedAt:     time.Now().Unix(),
	}
}

func getConnectionStepAndNode(taskInfo *craneProtos.JobInfo, cachedInfo *cachedAppConnectionInfo) (uint32, string, error) {
	if cachedInfo.StepId != 0 && cachedInfo.ExecutionNode != "" {
		return cachedInfo.StepId, cachedInfo.ExecutionNode, nil
	}

	primarySteps := utils.GetJobPrimaryStep(taskInfo.StepInfoList)
	if len(primarySteps) == 0 {
		return 0, "", fmt.Errorf("no primary steps found for job %v", taskInfo.JobId)
	}
	step := primarySteps[0]
	nodes := step.GetExecutionNode()
	if len(nodes) == 0 {
		return 0, "", fmt.Errorf("no execution node found for job %v step %v", taskInfo.JobId, step.StepId)
	}
	return step.StepId, nodes[0], nil
}

func resetVNCPassword(jobId, stepId, uid uint32, nodeName string) (string, error) {
	rand.Seed(time.Now().UnixNano())
	charset := "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	result := make([]byte, 10)
	for i := range result {
		result[i] = charset[rand.Intn(len(charset))]
	}
	randomPassword := string(result)
	cmd := fmt.Sprintf("echo -e %q | vncpasswd -f > ~/.vnc/passwd", randomPassword)
	if err := utils.ExecContainerCMD(jobId, stepId, uid, nodeName, cmd); err != nil {
		err = fmt.Errorf("modify vnc password failed, %v", err)
		logrus.Errorf("GetAppConnectionInfo failed: %v", err)
		return "", err
	}
	logrus.Info("modify vnc passwd successful")
	return randomPassword, nil
}
