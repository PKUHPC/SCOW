package inference

import (
	"errors"
	"fmt"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc/codes"
	k8sclient "k8s.io/client-go/kubernetes"
	volcanoclientset "volcano.sh/apis/pkg/client/clientset/versioned"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/db/models"
	"scow-adapters/pkg/ai/resourcecleanup"
	"scow-adapters/pkg/ai/utils"
	ce "scow-adapters/pkg/common/error"
)

func SubmitInference(in *pb.SubmitInferJobRequest, jobName, workDir string) (bool, error) {
	cli, err := utils.GetK8sClient()
	if err != nil {
		logrus.Errorf("failed to build k8s client: %v", err)
		return false, fmt.Errorf("failed to build k8s client: %v", err)
	}

	var volcanoClient volcanoclientset.Interface
	if in.GetNodeCount() > 1 {
		volcanoClient, err = utils.GetVolcanoClient()
		if err != nil {
			logrus.Errorf("failed to build volcano client: %v", err)
			return false, fmt.Errorf("failed to build volcano client: %v", err)
		}
	}

	return SubmitInferenceWithClients(in, jobName, workDir, cli, volcanoClient)
}

func SubmitInferenceWithClients(
	in *pb.SubmitInferJobRequest,
	jobName, workDir string,
	cli k8sclient.Interface,
	volcanoClient volcanoclientset.Interface,
) (bool, error) {
	// ExtraOptions
	// 第一个参数为镜像地址
	// 第二个参数为模型版本地址
	// 第三个参数为多挂载点地址，以逗号分隔
	// 第四个参数为gpuType，表示训练时便件卡的类型，由getclusterconfig接口获取
	// 第五个参数为多挂载点地址，以逗号分隔(此挂载点是只读的)
	if len(in.ExtraOptions) != 5 {
		err := fmt.Errorf("invalid extraOptions")
		return false, ce.RichError(codes.Internal, "INVALID_EXTRA_OPTIONS", err.Error())
	}

	namespace := in.Partition
	// 用队列名作为namespace的名字
	exist, err := utils.CheckNameSpace(namespace, cli)
	if err != nil {
		logrus.Errorf("check namespace failed: %v", err)
		return false, err
	}
	if !exist {
		// ns 不存在的时候创建ns
		_, err = utils.CreateNameSpace(namespace, cli)
		if err != nil {
			logrus.Errorf("create namespace failed: %v", err)
			return false, err
		}
	}

	inferenceJob := NewInferenceJob(in, cli, jobName, workDir)
	if inferenceJob.IsDistributed() {
		inferenceJob.SetVolcanoClient(volcanoClient)
	}
	if err := inferenceJob.SetInferenceParams(); err != nil {
		return false, err
	}

	creator := NewInferenceInterface(inferenceJob)
	return creator.Create()
}

func CleanupInferenceResource(jobInfo *models.JobTable) (string, error) {
	k8sClient, err := utils.GetK8sClient()
	if err != nil {
		logrus.Errorf("failed to build k8s client: %v", err)
		return "NEW_K8S_CLIENT_FAILED", err
	}

	logrus.Infof("CancelJob: JobType： %v, job name: %v", jobInfo.JobType, jobInfo.NewJobName)
	return "CANCEL_INFERENCE_JOB_FAILED", DeleteInferenceJob(
		jobInfo.NewJobName,
		jobInfo.GpuType,
		jobInfo.Partition,
		uint32(jobInfo.PODsReq),
		k8sClient,
		nil,
	)
}

// 删除推理相关的service资源
func deleteInferenceServices(jobName, namespace string, cli k8sclient.Interface) error {
	serviceNames := []string{
		jobName,
		fmt.Sprintf("%s-ray-head", jobName),
	}

	var errs []error
	for _, serviceName := range serviceNames {
		if err := utils.DeleteService(serviceName, namespace, cli); err != nil {
			resourcecleanup.RecordFailure(resourcecleanup.ResourceKindService, namespace, serviceName, err)
			logrus.Errorf("delete inference service failed, service name: %v, error: %v", serviceName, err)
			errs = append(errs, err)
			continue
		}
		logrus.Infof("delete inference service successful, service name: %v", serviceName)
	}
	return errors.Join(errs...)
}
