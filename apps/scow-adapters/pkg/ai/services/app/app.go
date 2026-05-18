package app

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"os"
	"strconv"
	"time"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc/codes"
	"gorm.io/gorm"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/client"
	"scow-adapters/pkg/ai/db/models"
	"scow-adapters/pkg/ai/utils"
	ce "scow-adapters/pkg/common/error"
)

type ServerApp struct {
	pb.UnimplementedAppServiceServer
}

func (s *ServerApp) GetAppConnectionInfo(ctx context.Context, in *pb.GetAppConnectionInfoRequest) (*pb.GetAppConnectionInfoResponse, error) {
	logrus.Infof("Received request GetAppConnectionInfo: %v", in)
	k8sClient, err := utils.GetK8sClient()
	if err != nil {
		logrus.Errorf("failed to build k8s client: %v", err)
		return nil, ce.RichError(codes.Internal, "NEW_K8S_CLIENT_FAILED", err.Error())
	}
	jobTable := models.JobTable{}
	err = client.DB.Where("job_db_inx = ?", in.JobId).First(&jobTable).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			err = fmt.Errorf("the job not found %v", err)
			logrus.Errorf("GetAppConnectionInfo failed: %v", err)
			return nil, ce.RichError(codes.NotFound, "JOB_NOT_FOUND", err.Error())
		} else {
			err = fmt.Errorf("sql query failed")
			logrus.Errorf("GetAppConnectionInfo failed: %v", err)
			return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
		}
	}
	hostname, _ := utils.GetClusterMasterNodeHostname()
	namespace := jobTable.Partition
	jobState := jobTable.State
	jobName := jobTable.NewJobName
	jobType := jobTable.JobType
	logrus.Infof("GetAppConnectionInfo job name: %s, job status: %s, job type: %s, hostname:%s", jobName, jobState, jobType, hostname)
	if jobState != "RUNNING" {
		if jobState == "PENDING" {
			err = fmt.Errorf("the job is pending")
			logrus.Errorf("GetAppConnectionInfo failed: %v", err)
			return nil, ce.RichError(codes.Unavailable, "JOB_PENDING", err.Error())
		} else {
			err = fmt.Errorf("the job has completed")
			logrus.Errorf("GetAppConnectionInfo failed: %v", err)
			return nil, ce.RichError(codes.PermissionDenied, "JOB_COMPLETED", err.Error())
		}
	}
	if jobType == "app" || jobType == utils.DevHost {
		var (
			svcName     string
			sessionInfo string
		)
		podInfos, err := utils.GetPodInfoByJobName(jobName)
		if err != nil || len(podInfos) == 0 {
			err = fmt.Errorf("get pod info by task failed")
			logrus.Errorf("GetAppConnectionInfo failed: %v", err)
			return nil, ce.RichError(codes.Internal, "GET_POD_NAME_FAILED", err.Error())
		}
		podInfo := podInfos[0]
		logrus.Tracef("pod info: %v", podInfo)
		svcName = jobName
		sessionInfo = "server_session_info.json"
		if in.AppType == nil {
			svcName = jobName
			sessionInfo = "server_session_info.json"
		} else {
			switch *in.AppType {
			case pb.AppType_APP_TYPE_JUPYTER_LAB:
				svcName = fmt.Sprintf("%s-%s", utils.Jupyterlab, jobName)
				sessionInfo = fmt.Sprintf("server_session_%s.json", utils.Jupyterlab)
			case pb.AppType_APP_TYPE_VSCODE:
				svcName = fmt.Sprintf("%s-%s", utils.Vscode, jobName)
				sessionInfo = fmt.Sprintf("server_session_%s.json", utils.Vscode)
			default:
				svcName = jobName
				sessionInfo = "server_session_info.json"
			}
		}
		nodePort, targentPort, err := utils.GetSvcInfo(svcName, namespace, k8sClient)
		if err != nil {
			err = fmt.Errorf("get svc info failed")
			logrus.Errorf("GetAppConnectionInfo failed: %v", err)
			return nil, ce.RichError(codes.Internal, "GET_SVC_NAME_FAILED", err.Error())
		}
		logrus.Infof("nodePort: %d, targentPort: %d", nodePort, targentPort)
		webFilePath := fmt.Sprintf("/tmp/%s", sessionInfo)
		dstDir := "/tmp"
		currentTimestamp := time.Now().UnixMicro()
		strNum := strconv.FormatInt(currentTimestamp, 10)
		webFileDestPath := dstDir + "/" + "server_session_info.json" + "-" + strNum
		if err = utils.CopyFromPod(podInfo.PodName, namespace, webFilePath, webFileDestPath); err != nil {
			logrus.Errorf("copy file failed: %v", err)
			return &pb.GetAppConnectionInfoResponse{}, nil
		}
		logrus.Tracef("copy pod %s file %s successful", podInfo.PodName, webFilePath)
		if targentPort == 6901 {
			// 生成随机密码
			rand.Seed(time.Now().UnixNano())
			charset := "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
			result := make([]byte, 10)
			for i := range result {
				result[i] = charset[rand.Intn(len(charset))]
			}
			randomPassword := string(result)
			//modifyPasswordCmd := fmt.Sprintf("kubectl exec %s -- bash -c ", podInfo.PodName)
			//fullCmd := modifyPasswordCmd + fmt.Sprintf("\" echo -e %s | vncpasswd -f > ~/.vnc/passwd\"", randomPassword)
			//reason, err := utils.RunCommand(fullCmd)
			cmd := fmt.Sprintf("echo -e %q | vncpasswd -f > ~/.vnc/passwd", randomPassword)
			output, _, err := utils.ExecPodCMD(podInfo.PodName, podInfo.Namespace, jobName, []string{"sh", "-c", cmd}, nil)
			if err != nil {
				err = fmt.Errorf("modify vnc password failed, %v", err)
				logrus.Errorf("GetAppConnectionInfo failed, output:%s, err: %v", output, err)
				return nil, ce.RichError(codes.Internal, "MODIFY_VNC_PASSWORD_FAILED", err.Error())
			}
			logrus.Info("modify vnc passwd successful")
			err = os.Remove(webFileDestPath)
			if err != nil {
				err = fmt.Errorf("remove web file failed, %v", err)
				logrus.Errorf("GetAppConnectionInfo failed: %v", err)
			}

			responseMessage := &pb.GetAppConnectionInfoResponse{
				Response: &pb.GetAppConnectionInfoResponse_AppConnectionInfo_{
					AppConnectionInfo: &pb.GetAppConnectionInfoResponse_AppConnectionInfo{
						Host:     hostname,
						Port:     uint32(nodePort),
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
				return &pb.GetAppConnectionInfoResponse{}, nil
			}
			_ = os.Remove(webFileDestPath)
			responseMessage := &pb.GetAppConnectionInfoResponse{
				Response: &pb.GetAppConnectionInfoResponse_AppConnectionInfo_{
					AppConnectionInfo: &pb.GetAppConnectionInfoResponse_AppConnectionInfo{
						Host:     hostname,
						Port:     uint32(nodePort),
						Password: webPassword,
					},
				},
			}
			logrus.Infof("GetAppConnectionInfo response: %v", responseMessage)
			return responseMessage, nil
		}
	} else if jobType == "inference" {
		nodePort, _, err := utils.GetSvcInfo(jobName, namespace, k8sClient)
		if err != nil {
			err = fmt.Errorf("get svc info: %v failed, %v", jobName, err)
			logrus.Errorf("GetAppConnectionInfo failed: %v", err)
			return nil, ce.RichError(codes.Internal, "GET_SVC_NAME_FAILED", err.Error())
		}
		responseMessage := &pb.GetAppConnectionInfoResponse{
			Response: &pb.GetAppConnectionInfoResponse_AppConnectionInfo_{
				AppConnectionInfo: &pb.GetAppConnectionInfoResponse_AppConnectionInfo{
					Host: hostname,
					Port: uint32(nodePort),
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
