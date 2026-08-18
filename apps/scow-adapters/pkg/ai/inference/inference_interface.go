package inference

import (
	k8sclient "k8s.io/client-go/kubernetes"
	volcanoclientset "volcano.sh/apis/pkg/client/clientset/versioned"

	pb "scow-adapters/gen/go"
)

type InferenceInterface interface {
	Create() (bool, error)
	Delete() error
}

func NewInferenceInterface(job *InferenceJob) InferenceInterface {
	if job.IsDistributed() {
		return NewDistributedInference(job)
	}
	return NewSingleInference(job)
}

func NewInferenceDeleteJob(
	jobName, gpuType, namespace string,
	nodeCount uint32,
	cli k8sclient.Interface,
	volcanoCli volcanoclientset.Interface,
) *InferenceJob {
	if nodeCount == 0 {
		nodeCount = 1
	}
	job := NewInferenceJob(&pb.SubmitInferJobRequest{
		Partition:    namespace,
		NodeCount:    nodeCount,
		ExtraOptions: []string{"", "", "", gpuType, ""},
	}, cli, jobName, "")
	job.SetVolcanoClient(volcanoCli)
	return job
}

func DeleteInferenceJob(
	jobName, gpuType, namespace string,
	nodeCount uint32,
	cli k8sclient.Interface,
	volcanoCli volcanoclientset.Interface,
) error {
	job := NewInferenceDeleteJob(jobName, gpuType, namespace, nodeCount, cli, volcanoCli)
	return NewInferenceInterface(job).Delete()
}
