package app

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
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

const defaultAppType = "default"
const appSessionInfoFileName = "server_session_info.json"

func getAppTypeKeyAndSessionInfo(appType *pb.AppType) (string, string) {
	if appType == nil {
		return defaultAppType, "server_session_info.json"
	}

	switch *appType {
	case pb.AppType_APP_TYPE_JUPYTER_LAB:
		return utils.Jupyterlab, fmt.Sprintf("server_session_%s.json", utils.Jupyterlab)
	case pb.AppType_APP_TYPE_VSCODE:
		return utils.Vscode, fmt.Sprintf("server_session_%s.json", utils.Vscode)
	default:
		return defaultAppType, "server_session_info.json"
	}
}

func getCachedAppSession(jobID uint32, appType string) (*models.AppSessionTable, bool, error) {
	appSession := models.AppSessionTable{}
	err := client.DB.Where("job_id = ? AND app_type = ?", jobID, appType).First(&appSession).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, false, nil
		}
		return nil, false, err
	}
	return &appSession, true, nil
}

func upsertAppPassword(jobID uint32, jobName, namespace, appType, password, containerID string) error {
	now := time.Now().Unix()
	appSession := models.AppSessionTable{}
	err := client.DB.Where("job_id = ? AND app_type = ?", jobID, appType).First(&appSession).Error
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		return client.DB.Create(&models.AppSessionTable{
			JobID:       jobID,
			JobName:     jobName,
			Namespace:   namespace,
			AppType:     appType,
			Password:    password,
			ContainerID: containerID,
			CreatedAt:   now,
			UpdatedAt:   now,
		}).Error
	}

	return client.DB.Model(&appSession).Updates(map[string]interface{}{
		"job_name":     jobName,
		"namespace":    namespace,
		"password":     password,
		"container_id": containerID,
		"updated_at":   now,
	}).Error
}

func copyAndReadSessionPassword(podName, namespace string, candidatePaths []string) (string, error) {
	dstDir := "/tmp"
	currentTimestamp := time.Now().UnixMicro()
	strNum := strconv.FormatInt(currentTimestamp, 10)
	webFileDestPath := filepath.Join(dstDir, "server_session_info.json-"+strNum)
	defer func() {
		_ = os.Remove(webFileDestPath)
	}()

	var lastErr error
	for _, webFilePath := range candidatePaths {
		if webFilePath == "" {
			continue
		}
		if err := utils.CopyFromPod(podName, namespace, webFilePath, webFileDestPath); err != nil {
			lastErr = err
			logrus.Warnf("copy pod %s file %s failed: %v", podName, webFilePath, err)
			continue
		}

		logrus.Infof("copy pod %s file %s successful", podName, webFilePath)
		_, webPassword, err := utils.GetWebJobFileContent(webFileDestPath)
		if err != nil {
			return "", fmt.Errorf("parse file %s copied from %s failed: %w", webFileDestPath, webFilePath, err)
		}
		return webPassword, nil
	}

	if lastErr != nil {
		return "", lastErr
	}
	return "", fmt.Errorf("no session file path provided")
}

func getPersistentSessionInfoPath(jobTable models.JobTable) string {
	if jobTable.AppDir != "" {
		return filepath.Join(jobTable.AppDir, appSessionInfoFileName)
	}
	return ""
}

func logAppConnectionInfoResponse(message, host string, port uint32, password string) {
	logrus.Tracef("%s: host=%s, port=%d, passwordSet=%t", message, host, port, password != "")
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
			appTypeKey  string
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
		appTypeKey, sessionInfo = getAppTypeKeyAndSessionInfo(in.AppType)
		if in.AppType == nil {
			svcName = jobName
		} else {
			switch *in.AppType {
			case pb.AppType_APP_TYPE_JUPYTER_LAB:
				svcName = fmt.Sprintf("%s-%s", utils.Jupyterlab, jobName)
			case pb.AppType_APP_TYPE_VSCODE:
				svcName = fmt.Sprintf("%s-%s", utils.Vscode, jobName)
			default:
				svcName = jobName
			}
		}
		nodePort, targentPort, err := utils.GetSvcInfo(svcName, namespace, k8sClient)
		if err != nil {
			err = fmt.Errorf("get svc info failed")
			logrus.Errorf("GetAppConnectionInfo failed: %v", err)
			return nil, ce.RichError(codes.Internal, "GET_SVC_NAME_FAILED", err.Error())
		}
		logrus.Infof("nodePort: %d, targentPort: %d", nodePort, targentPort)
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

			responseMessage := &pb.GetAppConnectionInfoResponse{
				Response: &pb.GetAppConnectionInfoResponse_AppConnectionInfo_{
					AppConnectionInfo: &pb.GetAppConnectionInfoResponse_AppConnectionInfo{
						Host:     hostname,
						Port:     uint32(nodePort),
						Password: randomPassword,
					},
				},
			}
			logAppConnectionInfoResponse("GetAppConnectionInfo response", hostname, uint32(nodePort), randomPassword)
			return responseMessage, nil
		} else {
			appSession, found, err := getCachedAppSession(in.JobId, appTypeKey)
			if err != nil {
				logrus.Errorf("GetAppConnectionInfo query app session failed: %v", err)
				return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
			}
			if found {
				logrus.Infof(
					"GetAppConnectionInfo app password cache found, jobId: %d, jobName: %s, appType: %s, cacheContainerId: %s, currentContainerId: %s, passwordSet: %t",
					in.JobId, jobName, appTypeKey, appSession.ContainerID, podInfo.ContainerId, appSession.Password != "")
			}
			cacheAvailable := found && appSession.ContainerID != "" && appSession.ContainerID == podInfo.ContainerId
			var webPassword string
			if cacheAvailable {
				webPassword = appSession.Password
				logrus.Tracef(
					"GetAppConnectionInfo app password hit cache, jobId: %d, jobName: %s, appType: %s, containerId: %s",
					in.JobId, jobName, appTypeKey, podInfo.ContainerId,
				)
			} else {
				logrus.Infof(
					"GetAppConnectionInfo app password cache missed or expired, read session file, jobId: %d, jobName: %s, appType: %s, currentContainerId: %s",
					in.JobId, jobName, appTypeKey, podInfo.ContainerId,
				)
				sessionPaths := []string{
					getPersistentSessionInfoPath(jobTable),
					fmt.Sprintf("/tmp/%s", sessionInfo),
				}
				webPassword, err = copyAndReadSessionPassword(podInfo.PodName, namespace, sessionPaths)
				if err != nil {
					logrus.Errorf("GetAppConnectionInfo read app session failed: %v", err)
					return nil, ce.RichError(codes.NotFound, "APP_SESSION_INFO_NOT_FOUND", err.Error())
				}
				logrus.Infof(
					"GetAppConnectionInfo app password read from session file, jobId: %d, jobName: %s, appType: %s, passwordSet: %t",
					in.JobId, jobName, appTypeKey, webPassword != "",
				)
				if err = upsertAppPassword(in.JobId, jobName, namespace, appTypeKey, webPassword, podInfo.ContainerId); err != nil {
					logrus.Errorf("GetAppConnectionInfo save app session failed: %v", err)
					return nil, ce.RichError(codes.Internal, "SAVE_APP_SESSION_FAILED", err.Error())
				}
				logrus.Infof(
					"GetAppConnectionInfo app password saved to cache, jobId: %d, jobName: %s, appType: %s, containerId: %s, passwordSet: %t",
					in.JobId, jobName, appTypeKey, podInfo.ContainerId, webPassword != "",
				)
			}
			responseMessage := &pb.GetAppConnectionInfoResponse{
				Response: &pb.GetAppConnectionInfoResponse_AppConnectionInfo_{
					AppConnectionInfo: &pb.GetAppConnectionInfoResponse_AppConnectionInfo{
						Host:     hostname,
						Port:     uint32(nodePort),
						Password: webPassword,
					},
				},
			}
			logAppConnectionInfoResponse("GetAppConnectionInfo response", hostname, uint32(nodePort), webPassword)
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
