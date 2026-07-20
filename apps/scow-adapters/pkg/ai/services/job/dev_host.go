package job

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc/codes"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/client"
	"scow-adapters/pkg/ai/db/models"
	"scow-adapters/pkg/ai/utils"
	ce "scow-adapters/pkg/common/error"
)

func (s *ServerJob) CreateDevHost(ctx context.Context, in *pb.CreateDevHostRequest) (*pb.CreateDevHostResponse, error) {
	var (
		gpuType   string
		jobTable  models.JobTable
		nodeCount int = 1
	)
	logrus.Infof("Received request dev_host: %v", in)
	checkJobName := utils.IsValidString(in.JobName)
	if !checkJobName {
		err := fmt.Errorf("regex used for validation is '[a-zA-Z]([-a-zA-Z0-9]*[a-zA-Z0-9])?'")
		logrus.Errorf("SubmitJob failed %v", err)
		return nil, ce.RichError(codes.Internal, "JOB_NAME_INVALID", err.Error())
	}
	if err := CheckUserInfo(in.Account, in.UserId, in.Partition); err != nil {
		return nil, err
	}
	queueInfo, err := utils.GetQueueByName(in.Partition)
	if err != nil {
		return nil, ce.RichError(codes.Internal, "Partition_Not_Found", err.Error())
	}
	currentTimestamp := time.Now().Unix()
	strNum := strconv.FormatInt(currentTimestamp, 10)
	// 获取group名字
	//groupName, err := utils.GetGroupName(in.UserId)
	//if err != nil {
	//	logrus.Errorf("SubmitJob failed %v", err)
	//	return nil, ce.RichError(codes.Internal, "FETCH_GROUP_FAILED", err.Error())
	//}
	// 校验队列最大卡数
	if in.GpuCount > queueInfo.MaxAcceleratorsPerPod {
		return nil, ce.RichError(codes.Internal, "MAX_ACCELERATORS_PER_POD_LIMIT", fmt.Sprintf("The maximum acceleration limit for the queue is %d", queueInfo.MaxAcceleratorsPerPod))
	}
	// 校验申请资源
	reqMem := int64(*in.MemoryMb / uint64(nodeCount))
	if err := utils.CheckQueueAllocateResource(in.Partition, int64(in.CoreCount), reqMem, int64(nodeCount)); err != nil {
		return nil, ce.RichError(codes.Internal, "REQUEST_RESOURCE_FAILED", err.Error())
	}
	// 生成的新的作业名
	newJobName := strings.ToLower(in.JobName) + "-" + strNum
	if in.GpuCount == 0 {
		gpuType = "-"
	} else {
		gpuType = queueInfo.Type
	}
	jobTable = models.JobTable{
		Account:    in.Account,
		CPUsReq:    uint(in.CoreCount) * uint(nodeCount),
		GPUsReq:    uint(in.GpuCount) * uint(nodeCount),
		PODsReq:    uint(nodeCount),
		JobName:    in.JobName,
		NewJobName: newJobName,
		UserName:   in.UserId,
		//Group:      groupName,
		MemReq:     *in.MemoryMb,
		Partition:  in.Partition,
		State:      utils.PendingStatus,
		Timelimit:  uint(*in.TimeLimitMinutes),
		TimeSubmit: uint64(currentTimestamp),
		WorkDir:    in.WorkingDirectory,
		GpuType:    gpuType,
		JobType:    utils.DevHost,
		Qos:        in.GetQos(),
	}
	if in.JupyterLabInfo != nil {
		jobTable.JupyterLabProxyPath = in.JupyterLabInfo.ProxyBasePath
	}
	if in.VscodeInfo != nil {
		jobTable.VscodeBinPath = in.VscodeInfo.VscodeBinPath
	}
	err = client.DB.Create(&jobTable).Error
	if err != nil {
		logrus.Errorf("Submit devHost sql create failed: %v", err)
		return nil, err
	}
	err = DevHostVCJob(in, newJobName, in.WorkingDirectory)
	if err != nil {
		go func() {
			err = client.DB.Where("job_db_inx = ?", jobTable.JobDBInx).Delete(&models.JobTable{}).Error
			logrus.Infof("delete DB jobname %s, err: %v", jobTable.NewJobName, err)
		}()
		logrus.Infof("Submit devHost %s to k8s failed, err: %s", newJobName, err)
		return nil, ce.RichError(codes.Internal, "Submit_DevHost_K8s_Failed", err.Error())
	}
	return &pb.CreateDevHostResponse{JobId: uint32(jobTable.JobDBInx)}, nil
}
