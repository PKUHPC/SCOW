package job

import (
	"encoding/json"
	"fmt"
	"github.com/sirupsen/logrus"
	"google.golang.org/grpc/codes"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/client"
	"scow-adapters/pkg/ai/db/models"
	"scow-adapters/pkg/ai/train"
	"scow-adapters/pkg/ai/utils"
	ce "scow-adapters/pkg/common/error"
)

// 处理不支持的应用类型
func handleInvalidAppTypeError() error {
	err := fmt.Errorf("invalid app type, not support")
	logrus.Errorf("SubmitJob failed %v", err)
	return ce.RichError(codes.Internal, "APP_TYPE_ERR", err.Error())
}

func AppVCJob(in *pb.SubmitJobRequest, jobName, workDir string) error {
	var vcjob *train.VCJob
	// 设置挂载点
	mountPoints := utils.GetMountPoints(in.ExtraOptions[6], in.ExtraOptions[8])
	vcjob = train.NewVCJob(
		train.WithSubmitJobRequest(in),
		train.WithJobName(jobName),
		train.WithWorkDir(workDir),
		train.WithMountPoints(mountPoints),
		train.WithPartition(in.Partition),
		train.WithRDMA(in.Partition),
	)
	if err := vcjob.SetArgs(); err != nil {
		return err
	}
	return TrainVCJobApp(vcjob)
}

func TrainVCJob(in *pb.SubmitJobRequest, jobName, workDir string) error {
	var vcjob *train.VCJob

	if len(in.ExtraOptions) != 10 { //参数判断
		err := fmt.Errorf("invalid extraOptions")
		return ce.RichError(codes.Internal, "INVALID_EXTRA_OPTIONS", err.Error())
	}
	// 设置挂载点
	mountPoints := utils.GetMountPoints(in.ExtraOptions[6], in.ExtraOptions[9])
	vcjob = train.NewVCJob(
		train.WithSubmitJobRequest(in),
		train.WithJobName(jobName),
		train.WithWorkDir(workDir),
		train.WithMountPoints(mountPoints),
		train.WithTensorboardLog(in.GetTensorBoardDataPath()),
		train.WithPartition(in.Partition),
		train.WithRDMA(in.Partition),
	)
	if err := vcjob.SetArgs(); err != nil {
		return err
	}
	if err := vcjob.CreateJob(); err != nil {
		vcjob.DeleteResource()
		return err
	}
	return nil
}

func CancelVCJob(jobName, username string) (err error) {
	job := models.JobTable{}
	err = client.DB.Where("new_job_name = ? ", jobName).First(&job).Error // 通过作业名查作业信息
	if err != nil {
		logrus.Errorf("DB select jobName %s error: %v", jobName, err)
		return nil
	}
	//vcjob := train.NewVCJob(jobName, username, job.Partition)
	vcjob := train.NewVCJob(
		train.WithJobName(jobName),
		train.WithUserName(username),
		train.WithNamespace(job.Partition),
		train.WithAccelerator(job.GpuType),
		train.WithJobType(job.JobType),
		train.WithTensorboardLog(job.TensorboardLogPath),
	)
	if job.JupyterLabProxyPath != "" {
		vcjob.SetJupyterLabInfo(train.JupyterLabInfo{
			ProxyPath: job.JupyterLabProxyPath,
		})
	}
	if job.VscodeBinPath != "" {
		vcjob.SetVsCodeInfo(train.VsCodeInfo{
			BinPath: job.VscodeBinPath,
		})
	}
	err = vcjob.SetArgs()
	if err != nil {
		return err
	}
	return vcjob.Delete()
}

func TrainVCJobApp(vj *train.VCJob) error {
	vj.JobType = train.APP
	// 验证app类型
	if vj.In.ExtraOptions[1] != "vnc" && vj.In.ExtraOptions[1] != "web" {
		return handleInvalidAppTypeError()
	}
	// 验证extraOptions长度
	if (vj.In.ExtraOptions[1] == "vnc" || vj.In.ExtraOptions[1] == "web") && len(vj.In.ExtraOptions) != 9 {
		err := fmt.Errorf("invalid extraOptions length")
		logrus.Errorf("SubmitJob failed %v", err)
		return ce.RichError(codes.Internal, "INVALID_EXTRA_OPTIONS", err.Error())
	}
	// 生成节点端口和获取主机名
	nodePort, err := utils.GenerateNodePort(vj.K8sClient) // 生成端口 svcport
	if err != nil {
		logrus.Errorf("GenerateNodePort failed %v", err)
		return ce.RichError(codes.Internal, "GENERATE_NODEPORT_FAILED", err.Error())
	}
	hostname, err := utils.GetClusterMasterNodeHostname()
	if err != nil {
		logrus.Errorf("Get hostname failed %v", err)
		return ce.RichError(codes.Internal, "GET_HOSTNAME_FAILED", err.Error())
	}
	// 创建svc nodePort
	vj.SetSvcPort(nodePort)
	vj.SetHostName(hostname)

	err = vj.CreateService()
	if err != nil {
		return err
	}
	if err = vj.CreateJob(); err != nil {
		vj.DeleteResource()
		return err
	}
	return nil
}

func DevHostVCJob(dh *pb.CreateDevHostRequest, jobName, workDir string) error {
	var (
		vj *train.VCJob
	)
	queueInfo, err := utils.GetQueueByName(dh.Partition)
	if err != nil {
		return ce.RichError(codes.Internal, "Partition_Not_Found", err.Error())
	}
	ExtraOptions := make([]string, 10)
	ExtraOptions[7] = queueInfo.Type
	ExtraOptions[8] = utils.DevHost
	ExtraOptions[2] = dh.Image
	in := &pb.SubmitJobRequest{
		JobName:                           jobName,
		UserId:                            dh.UserId,
		Account:                           dh.Account,
		Partition:                         dh.Partition,
		Qos:                               &dh.Qos,
		NodeCount:                         1,
		GpuCount:                          dh.GpuCount,
		MemoryMb:                          dh.MemoryMb,
		CoreCount:                         dh.CoreCount,
		WorkingDirectory:                  workDir,
		ExtraOptions:                      ExtraOptions,
		PrivateImageRepositoryCredentials: dh.PrivateImageRepositoryCredentials,
		UserIdmapInfo:                     dh.UserIdmapInfo,
		EnvVariables:                      dh.EnvVariables,
	}
	mountPoints := make(map[bool][]string, 2)
	if len(dh.Mounts) != 0 {
		mounts, err := json.Marshal(dh.Mounts)
		if err != nil {
			return fmt.Errorf("marshal Mounts failed: %v", err)
		}
		logrus.Tracef("[DevHostVCJob] mounts: %v", mounts)
		mountPoints[false] = []string{string(mounts)}
	}
	if len(dh.PublicMounts) != 0 {
		mountPoints[true] = dh.PublicMounts
	}
	vj = train.NewVCJob(
		train.WithSubmitJobRequest(in),
		train.WithJobName(jobName),
		train.WithWorkDir(workDir),
		train.WithMountPoints(mountPoints),
		train.WithPartition(in.Partition),
		train.WithRDMA(in.Partition),
	)
	if err = vj.SetArgs(); err != nil {
		return err
	}

	hostname, err := utils.GetClusterMasterNodeHostname()
	if err != nil {
		logrus.Errorf("Get hostname failed %v", err)
		return ce.RichError(codes.Internal, "GET_HOSTNAME_FAILED", err.Error())
	}
	vj.SetHostName(hostname)
	// jupyter 传参
	if dh.JupyterLabInfo != nil {
		vj.SetJupyterLabInfo(train.JupyterLabInfo{
			ProxyPath: dh.JupyterLabInfo.ProxyBasePath,
		})
	}
	// vsCode 传参
	if dh.VscodeInfo != nil {
		vj.SetVsCodeInfo(train.VsCodeInfo{
			BinPath: dh.VscodeInfo.VscodeBinPath,
		})
	}
	err = vj.CreateDevHostService()
	if err != nil {
		return err
	}
	if err = vj.CreateJob(); err != nil {
		vj.DeleteResource()
		return err
	}
	return nil
}
