package app

import (
	"context"
	"fmt"
	"math/rand"
	"os"
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

	if len(taskInfo.PodMeta.Ports) == 0 {
		logrus.Errorf("[GetAppConnectionInfo] no container ports found for job %v", jobID)
		return nil, ce.RichError(codes.Internal, "CRANE_FAILED", "no container ports found")
	}
	hostname, _ := os.Hostname()
	nodeName := forwardInfo[0].ExecutionNode

	jobType := jobInfo.JobType

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

	proxyInfo, err := utils.LoadJobProxyMetaByPort(jobID, containerPort)
	if err != nil {
		logrus.Errorf("load job proxy info failed: %v", err)
		return nil, ce.RichError(codes.Internal, "CRANE_FAILED", err.Error())
	}

	if proxyInfo == nil {
		// 双重检查锁：先乐观判断，拿锁后再次验证，防止并发请求重复创建同一代理。
		var setupErr error
		proxyInfo, setupErr = func() (*utils.ProxyMeta, error) {
			proxySetupMu.Lock()
			defer proxySetupMu.Unlock()

			// 锁内二次检查：若其他 goroutine 已完成创建则直接返回
			meta, err := utils.LoadJobProxyMetaByPort(jobID, containerPort)
			if err != nil {
				return nil, err
			}
			if meta != nil {
				return meta, nil
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
	}

	if proxyInfo == nil {
		logrus.Errorf("[GetAppConnectionInfo] proxy not found for job %v port %v", jobID, containerPort)
		return nil, ce.RichError(codes.Internal, "BUILD_PROXY_FAILED", "proxy not found after creation")
	}

	logrus.Infof("proxy info: %v", proxyInfo)

	// 得到step的id和uid
	primarySteps := utils.GetJobPrimaryStep(taskInfo.StepInfoList)
	if len(primarySteps) == 0 {
		logrus.Errorf("[GetAppConnectionInfo] no primary steps found for job %v", jobID)
		return nil, ce.RichError(codes.Internal, "CRANE_FAILED", "no primary steps found")
	}
	step := primarySteps[0]

	if jobType == utils.APP || jobType == utils.DevHost {
		webFilePath := fmt.Sprintf("/tmp/%s", sessionInfo)
		dstDir := "/tmp"
		currentTimestamp := time.Now().UnixMicro()
		strNum := strconv.FormatInt(currentTimestamp, 10)
		webFileDestPath := dstDir + "/" + "server_session_info.json" + "-" + strNum
		logrus.Infof("task.TaskId %v, step.StepId %v, step.Uid %v, webFilePath %v, webFileDestPath %v, nodeName %v", taskInfo.JobId, step.StepId, step.Uid, webFilePath, webFileDestPath, nodeName)
		if err = utils.CopyFromPod(taskInfo.JobId, step.StepId, step.Uid, webFilePath, webFileDestPath, nodeName); err != nil {
			logrus.Errorf("copy file failed: %v", err)
			return &protos.GetAppConnectionInfoResponse{}, nil
		}
		logrus.Tracef("copy container %s file %s successful", jobName, webFilePath)
		if containerPort == 6901 { // vnc
			// 生成随机密码
			rand.Seed(time.Now().UnixNano())
			charset := "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
			result := make([]byte, 10)
			for i := range result {
				result[i] = charset[rand.Intn(len(charset))]
			}
			randomPassword := string(result)
			cmd := fmt.Sprintf("echo -e %q | vncpasswd -f > ~/.vnc/passwd", randomPassword)
			err = utils.ExecContainerCMD(taskInfo.JobId, step.StepId, taskInfo.Uid, nodeName, cmd)
			if err != nil {
				err = fmt.Errorf("modify vnc password failed, %v", err)
				logrus.Errorf("GetAppConnectionInfo failed: %v", err)
				return nil, ce.RichError(codes.Internal, "MODIFY_VNC_PASSWORD_FAILED", err.Error())
			}
			logrus.Info("modify vnc passwd successful")
			err = os.Remove(webFileDestPath)
			if err != nil {
				err = fmt.Errorf("remove web file failed, %v", err)
				logrus.Errorf("GetAppConnectionInfo failed: %v", err)
			}

			responseMessage := &protos.GetAppConnectionInfoResponse{
				Response: &protos.GetAppConnectionInfoResponse_AppConnectionInfo_{
					AppConnectionInfo: &protos.GetAppConnectionInfoResponse_AppConnectionInfo{
						Host:     hostname,
						Port:     uint32(proxyInfo.ProxyPort),
						Password: randomPassword,
					},
				},
			}
			logrus.Infof("GetAppConnectionInfo response: %v", responseMessage)
			return responseMessage, nil
		} else {
			_, webPassword, err := utils.GetWebJobFileContent(webFileDestPath)
			if err != nil {
				logrus.Errorf("GetAppConnectionInfo parse file %s failed, %v", webFileDestPath, err)
				return &protos.GetAppConnectionInfoResponse{}, nil
			}
			_ = os.Remove(webFileDestPath)
			responseMessage := &protos.GetAppConnectionInfoResponse{
				Response: &protos.GetAppConnectionInfoResponse_AppConnectionInfo_{
					AppConnectionInfo: &protos.GetAppConnectionInfoResponse_AppConnectionInfo{
						Host:     hostname,
						Port:     uint32(proxyInfo.ProxyPort),
						Password: webPassword,
					},
				},
			}
			logrus.Infof("GetAppConnectionInfo response: %v", responseMessage)
			return responseMessage, nil
		}
	} else if jobType == utils.Inference {
		responseMessage := &protos.GetAppConnectionInfoResponse{
			Response: &protos.GetAppConnectionInfoResponse_AppConnectionInfo_{
				AppConnectionInfo: &protos.GetAppConnectionInfoResponse_AppConnectionInfo{
					Host: hostname,
					Port: uint32(proxyInfo.ProxyPort),
				},
			},
		}
		logrus.Tracef("GetAppConnectionInfo response: %v", responseMessage)
		return responseMessage, nil
	} else {
		// 目前只支持app的连接, 训练不支持连接
		err = fmt.Errorf("not support")
		logrus.Errorf("GetAppConnectionInfo failed: %v", err)
		return nil, ce.RichError(codes.Internal, "NOT_SUPPORT", err.Error())
	}
}
