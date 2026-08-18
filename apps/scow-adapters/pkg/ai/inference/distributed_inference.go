package inference

import (
	"context"
	"fmt"
	"strconv"

	"github.com/sirupsen/logrus"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	k8sclient "k8s.io/client-go/kubernetes"
	batchv1alpha1 "volcano.sh/apis/pkg/apis/batch/v1alpha1"
	busv1alpha1 "volcano.sh/apis/pkg/apis/bus/v1alpha1"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/resourcecleanup"
	"scow-adapters/pkg/ai/utils"
)

const (
	rayHeadRole             = "head"
	rayWorkerRole           = "worker"
	rayHeadServiceSuffix    = "-ray-head"
	rayPort                 = 6379
	rayNodePort             = 6380
	rayObjectPort           = 6381
	rayDashboardPort        = 8265
	distributedInferenceTTL = 604800
)

type DistributedInference struct {
	job *InferenceJob
}

func NewDistributedInference(job *InferenceJob) *DistributedInference {
	return &DistributedInference{job: job}
}

func (di *DistributedInference) Create() (bool, error) {
	in := di.job.GetSubmitRequest()
	if in.GetScript() == "" {
		logrus.Errorf("[DistributedInference_Create] script is required for distributed inference")
		return false, fmt.Errorf("script is required for distributed inference")
	}
	cli := di.job.GetClientSet()
	jobName := di.job.GetJobName()
	namespace := di.job.GetNamespace()
	var (
		createdConfigmap        bool
		createdRayHeadService   bool
		createdInferenceService bool
		createdSecret           bool
		createdVolcanoJob       bool
		err                     error
	)
	defer func() {
		if createdVolcanoJob {
			return
		}
		di.job.cleanupCreatedResources(
			createdConfigmap,
			createdRayHeadService || createdInferenceService,
			createdSecret,
		)
	}()

	volcanoClient := di.job.GetVolcanoClient()
	if volcanoClient == nil {
		volcanoClient, err = utils.GetVolcanoClient()
		if err != nil {
			logrus.Errorf("failed to build volcano client: %v", err)
			return false, fmt.Errorf("failed to build volcano client: %v", err)
		}
	}

	if utils.AcceleratorIsAscend(di.job.GetAccelerator()) {
		if _, err = di.job.CreateAscendInferenceConfigmap(); err != nil {
			return false, err
		}
		createdConfigmap = true
	}

	di.job.SetVolumes(appendVLLMRayScriptsVolume(di.job.GetVolumes()))
	di.job.SetVolumeMounts(appendVLLMRayScriptsVolumeMount(di.job.GetVolumeMounts()))

	// 创建ray cluster head service
	rayHeadServiceName := getRayHeadServiceName(jobName)
	if _, err = submitRayHeadService(jobName, rayHeadServiceName, namespace, cli); err != nil {
		logrus.Errorf("create ray head service failed, service name: %v, error: %v", rayHeadServiceName, err)
		return false, err
	}
	createdRayHeadService = true

	nodePort, err := utils.GenerateNodePort(cli)
	if err != nil {
		logrus.Errorf("generate node port failed, job: %v, error: %v", jobName, err)
		return false, err
	}
	// 创建推理服务的 nodeport service
	if _, err = submitDistributedInferenceService(jobName, nodePort, int(in.ContainerServicePort), namespace, cli); err != nil {
		logrus.Errorf("create distributed inference service failed, service name: %v, error: %v", jobName, err)
		return false, err
	}
	createdInferenceService = true

	flag, err := di.job.CreateSecret()
	if err != nil {
		logrus.Errorf("create secret failed, job: %v, error: %v", jobName, err)
		return false, err
	}
	createdSecret = flag

	volcanoJob := buildDistributedInferenceJob(
		di.job,
		rayHeadServiceName,
		flag,
	)

	go di.job.SaveJobInfo(volcanoJob)
	_, err = volcanoClient.BatchV1alpha1().Jobs(namespace).Create(context.TODO(), volcanoJob, metav1.CreateOptions{})
	if err != nil {
		logrus.Errorf("create distributed inference job failed, job: %v, error: %v", jobName, err)
		return false, err
	}
	createdVolcanoJob = true

	return true, nil
}

func (di *DistributedInference) Delete() error {
	job := di.job
	volcanoClient := job.GetVolcanoClient()
	if volcanoClient == nil {
		var err error
		volcanoClient, err = utils.GetVolcanoClient()
		if err != nil {
			logrus.Errorf("failed to build volcano client: %v", err)
			return fmt.Errorf("build volcano client: %w", err)
		}
	}

	err := volcanoClient.BatchV1alpha1().Jobs(job.GetNamespace()).Delete(
		context.TODO(),
		job.GetJobName(),
		metav1.DeleteOptions{},
	)
	deleteLegacyDeployment := apierrors.IsNotFound(err)
	if err != nil && !deleteLegacyDeployment {
		logrus.Errorf("delete inference volcano job failed, job name: %v, error: %v", job.GetJobName(), err)
		return fmt.Errorf("delete volcano job: %w", err)
	}
	if deleteLegacyDeployment {
		if err := job.GetClientSet().AppsV1().Deployments(job.GetNamespace()).Delete(
			context.TODO(),
			job.GetJobName(),
			metav1.DeleteOptions{},
		); err != nil && !apierrors.IsNotFound(err) {
			logrus.Errorf("delete legacy distributed inference deployment failed, job name: %v, error: %v", job.GetJobName(), err)
			return fmt.Errorf("delete legacy deployment: %w", err)
		}
	}

	if err := deleteInferenceServices(job.GetJobName(), job.GetNamespace(), job.GetClientSet()); err != nil {
		logrus.Errorf("delete inference services failed, job name: %v, error: %v", job.GetJobName(), err)
	}

	if err := job.DeleteSecret(); err != nil {
		logrus.Errorf("delete inference image pull secret failed, job name: %v, error: %v", job.GetJobName(), err)
	}

	if utils.AcceleratorIsAscend(job.GetAccelerator()) {
		cmName := fmt.Sprintf("rings-config-%s", job.GetJobName())
		if err := utils.DeleteConfigmap(cmName, job.GetNamespace(), job.GetClientSet()); err != nil {
			resourcecleanup.RecordFailure(resourcecleanup.ResourceKindConfigMap, job.GetNamespace(), cmName, err)
			logrus.Errorf("delete inference configmap failed, job name: %v, error: %v", job.GetJobName(), err)
		}
	}
	return nil
}

func buildDistributedInferenceJob(job *InferenceJob, rayHeadServiceName string, hasImagePullSecret bool) *batchv1alpha1.Job {
	in := job.GetSubmitRequest()
	jobName := job.GetJobName()

	ttl := int32(distributedInferenceTTL)
	nodeSelector := map[string]string{
		job.GetNodeSelectorKey(): "true",
	}
	if utils.AcceleratorIsAscend(job.GetAccelerator()) {
		nodeSelector["host-arch"] = "huawei-arm"
	}

	headTask := buildDistributedInferenceTask(
		job,
		rayHeadServiceName,
		rayHeadRole,
		1,
		nodeSelector,
		hasImagePullSecret,
	)
	workerTask := buildDistributedInferenceTask(
		job,
		rayHeadServiceName,
		rayWorkerRole,
		int32(in.GetNodeCount()-1),
		nodeSelector,
		hasImagePullSecret,
	)

	return &batchv1alpha1.Job{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "batch.volcano.sh/v1alpha1",
			Kind:       "Job",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      jobName,
			Namespace: job.GetNamespace(),
			Labels:    job.GetLabels(),
		},
		Spec: batchv1alpha1.JobSpec{
			SchedulerName:           utils.Volcano,
			Queue:                   in.Partition,
			PriorityClassName:       in.GetQos(),
			MinAvailable:            int32(in.GetNodeCount()),
			TTLSecondsAfterFinished: &ttl,
			MaxRetry:                3,
			Plugins: map[string][]string{
				"env": {},
			},
			Policies: []batchv1alpha1.LifecyclePolicy{
				{
					Event:  busv1alpha1.PodEvictedEvent,
					Action: busv1alpha1.RestartJobAction,
				},
				{
					Event:  busv1alpha1.PodFailedEvent,
					Action: busv1alpha1.RestartJobAction,
				},
			},
			Tasks: []batchv1alpha1.TaskSpec{
				headTask,
				workerTask,
			},
		},
	}
}

func buildDistributedInferenceTask(
	job *InferenceJob,
	rayHeadServiceName string,
	role string,
	replicas int32,
	nodeSelector map[string]string,
	hasImagePullSecret bool,
) batchv1alpha1.TaskSpec {
	in := job.GetSubmitRequest()
	jobName := job.GetJobName()

	taskLabels := copyStringMap(job.GetLabels())
	taskLabels["role"] = role
	taskLabels[utils.JobNameLabelKey] = jobName

	taskEnv := append([]corev1.EnvVar{}, job.GetEnv()...)
	taskEnv = append(taskEnv, corev1.EnvVar{
		Name: "POD_IP",
		ValueFrom: &corev1.EnvVarSource{
			FieldRef: &corev1.ObjectFieldSelector{
				FieldPath: "status.podIP",
			},
		},
	})
	if role == rayHeadRole {
		taskEnv = append(taskEnv, corev1.EnvVar{
			Name:  "RAY_ADDRESS",
			Value: fmt.Sprintf("127.0.0.1:%d", rayPort),
		})
	}
	if !utils.AcceleratorIsAscend(job.GetAccelerator()) {
		taskEnv = append(taskEnv,
			corev1.EnvVar{Name: "NCCL_IB_DISABLE", Value: "1"},
			corev1.EnvVar{Name: "UCX_TLS", Value: "tcp,cuda_copy,cuda_ipc"},
		)
	}
	taskEnv = dedupeEnvVars(taskEnv)

	container := corev1.Container{
		Name:            fmt.Sprintf("%s-%s", jobName, role),
		Image:           in.ExtraOptions[0],
		ImagePullPolicy: corev1.PullIfNotPresent,
		Command:         []string{"sh", "-c"},
		Args: []string{
			buildDistributedInferenceCommand(in, rayHeadServiceName, role),
		},
		Env:             taskEnv,
		Resources:       job.GetResources(),
		WorkingDir:      job.GetWorkDir(),
		VolumeMounts:    job.GetVolumeMounts(),
		SecurityContext: job.GetSecurityContextPtr(),
	}
	if role == rayHeadRole {
		container.Ports = []corev1.ContainerPort{
			{Name: "http", Protocol: corev1.ProtocolTCP, ContainerPort: int32(in.ContainerServicePort)},
			{Name: "ray", Protocol: corev1.ProtocolTCP, ContainerPort: rayPort},
			{Name: "ray-node", Protocol: corev1.ProtocolTCP, ContainerPort: rayNodePort},
			{Name: "ray-object", Protocol: corev1.ProtocolTCP, ContainerPort: rayObjectPort},
			{Name: "dashboard", Protocol: corev1.ProtocolTCP, ContainerPort: rayDashboardPort},
		}
		container.ReadinessProbe = newInferenceTCPReadinessProbe(int32(in.ContainerServicePort))
		// 多机需要先确保ray服务运行成功，然后才能启动entry.sh脚本，否则会出现worker无法连接ray head的情况
		container.LivenessProbe = newInferenceTCPLivenessProbe(rayPort)
	}

	podSpec := corev1.PodSpec{
		RestartPolicy:                 corev1.RestartPolicyOnFailure,
		TerminationGracePeriodSeconds: int64Ptr(30),
		NodeSelector:                  nodeSelector,
		Containers: []corev1.Container{
			container,
		},
		Volumes: job.GetVolumes(),
	}
	if hasImagePullSecret {
		podSpec.ImagePullSecrets = []corev1.LocalObjectReference{{Name: jobName}}
	}

	task := batchv1alpha1.TaskSpec{
		Name:     role,
		Replicas: replicas,
		Template: corev1.PodTemplateSpec{
			ObjectMeta: metav1.ObjectMeta{
				Labels:      taskLabels,
				Annotations: job.GetAnnotations(),
			},
			Spec: podSpec,
		},
	}
	if role == rayHeadRole {
		task.Policies = []batchv1alpha1.LifecyclePolicy{
			{
				Event:  busv1alpha1.TaskCompletedEvent,
				Action: busv1alpha1.CompleteJobAction,
			},
		}
	}
	return task
}

func buildDistributedInferenceCommand(in *pb.SubmitInferJobRequest, rayHeadServiceName string, role string) string {
	gpuCount := strconv.Itoa(int(in.GetGpuCount()))
	commonRayArgs := fmt.Sprintf(`--ray_port=%d \
                    --node-ip-address=${POD_IP} \
                    --node-manager-port=%d \
                    --object-manager-port=%d \
                    --min-worker-port=10002 \
                    --max-worker-port=19999 \
                    --num-gpus=%s`, rayPort, rayNodePort, rayObjectPort, gpuCount)
	if role == rayWorkerRole {
		return fmt.Sprintf(`/scripts/multi-node-serving.sh worker \
                    --ray_address=%s.%s.svc.cluster.local \
                    %s`, rayHeadServiceName, in.Partition, commonRayArgs)
	}
	return fmt.Sprintf(`/scripts/multi-node-serving.sh leader \
                    --ray_cluster_size=%d \
                    %s \
                    --dashboard-host=0.0.0.0 &&
                  chmod +x /opt/entry.sh && /opt/entry.sh`, in.GetNodeCount(), commonRayArgs)
}

func submitRayHeadService(jobName, serviceName, namespace string, cli k8sclient.Interface) (bool, error) {
	service := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name: serviceName,
		},
		Spec: corev1.ServiceSpec{
			Type:                     corev1.ServiceTypeClusterIP,
			PublishNotReadyAddresses: true,
			Ports: []corev1.ServicePort{
				{Name: "ray", Port: rayPort, TargetPort: intstr.FromInt32(rayPort)},
				{Name: "ray-node", Port: rayNodePort, TargetPort: intstr.FromInt32(rayNodePort)},
				{Name: "ray-object", Port: rayObjectPort, TargetPort: intstr.FromInt32(rayObjectPort)},
				{Name: "dashboard", Port: rayDashboardPort, TargetPort: intstr.FromInt32(rayDashboardPort)},
			},
			Selector: map[string]string{
				"app":  jobName,
				"role": rayHeadRole,
			},
		},
	}
	_, err := cli.CoreV1().Services(namespace).Create(context.Background(), service, metav1.CreateOptions{})
	if err != nil {
		logrus.Errorf("create ray head service failed, service name: %v, error: %v", serviceName, err)
		return false, err
	}
	return true, nil
}

func submitDistributedInferenceService(jobName string, nodePort, podPort int, namespace string, cli k8sclient.Interface) (bool, error) {
	return createInferenceNodePortService(
		jobName,
		nodePort,
		podPort,
		namespace,
		cli,
		map[string]string{
			"app":  jobName,
			"type": inferenceTypeLabelValue,
			"role": rayHeadRole,
		},
	)
}

func appendVLLMRayScriptsVolume(volumes []corev1.Volume) []corev1.Volume {
	defaultMode := int32(0755)
	return append(volumes, corev1.Volume{
		Name: "ray-scripts",
		VolumeSource: corev1.VolumeSource{
			ConfigMap: &corev1.ConfigMapVolumeSource{
				LocalObjectReference: corev1.LocalObjectReference{
					Name: utils.VLLMRayScriptsConfigMapName,
				},
				DefaultMode: &defaultMode,
			},
		},
	})
}

func appendVLLMRayScriptsVolumeMount(volumeMounts []corev1.VolumeMount) []corev1.VolumeMount {
	return append(volumeMounts, corev1.VolumeMount{
		Name:      "ray-scripts",
		MountPath: "/scripts",
		ReadOnly:  true,
	})
}

func getRayHeadServiceName(jobName string) string {
	return fmt.Sprintf("%s%s", jobName, rayHeadServiceSuffix)
}

func copyStringMap(source map[string]string) map[string]string {
	if source == nil {
		return nil
	}
	target := make(map[string]string, len(source))
	for k, v := range source {
		target[k] = v
	}
	return target
}

func int64Ptr(value int64) *int64 {
	return &value
}
