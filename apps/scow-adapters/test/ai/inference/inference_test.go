package main

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	k8sclient "k8s.io/client-go/kubernetes"
	k8sfake "k8s.io/client-go/kubernetes/fake"
	k8stesting "k8s.io/client-go/testing"
	volcanofake "volcano.sh/apis/pkg/client/clientset/versioned/fake"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/config"
	"scow-adapters/pkg/ai/inference"
	"scow-adapters/pkg/ai/utils"
)

func TestSetInferenceEnvUsesMountTargetPath(t *testing.T) {
	job := newInferenceJobForEnv(
		"/workdir",
		mountOptions(t, utils.MountModel{Path: "/source/model", Target: "/container/model"}),
		20000,
	)
	job.SetEnv()

	values := inferenceEnvValuesByName(job.GetEnv())

	if got := values[utils.ContainerEnvPrefix+utils.ModelPathEnv]; got != "/container/model" {
		t.Fatalf("model env = %q, want %q", got, "/container/model")
	}
}

func TestSetInferenceEnvFallsBackToPathWhenTargetEmpty(t *testing.T) {
	job := newInferenceJobForEnv(
		"/workdir",
		mountOptions(t, utils.MountModel{Path: "/source/model"}),
		20000,
	)
	job.SetEnv()

	values := inferenceEnvValuesByName(job.GetEnv())

	if got := values[utils.ContainerEnvPrefix+utils.ModelPathEnv]; got != "/source/model" {
		t.Fatalf("model env = %q, want %q", got, "/source/model")
	}
}

func TestAscendInferenceMountsModelAtTargetPath(t *testing.T) {
	job := newInferenceJobForSubmit(t, 1, "")
	job.GetSubmitRequest().ExtraOptions[1] = mountOptions(t, utils.MountModel{
		Path:   "/source/model",
		Target: "/container/model",
	})
	job.GetSubmitRequest().ExtraOptions[3] = utils.HuaweiAscend910

	if err := job.SetInferenceParams(); err != nil {
		t.Fatalf("SetInferenceParams failed: %v", err)
	}

	assertVolumeMountExists(t, job.GetVolumeMounts(), "/container/model")
	assertVolumeMountMissing(t, job.GetVolumeMounts(), "/source/model")
}

func TestSetInferenceEnvDedupesReservedEnvNames(t *testing.T) {
	job := newInferenceJobForEnv(
		"/workdir",
		mountOptions(t, utils.MountModel{Path: "/source/model", Target: "/container/model"}),
		20000,
	)
	job.GetSubmitRequest().EnvVariables = []*pb.EnvVariable{
		{Key: "WORK_DIR", Value: "/duplicated-workdir"},
		{Key: "PORT", Value: "9000"},
		{Key: "CUSTOM_ENV", Value: "custom-value"},
	}

	job.SetEnv()

	values := inferenceEnvValuesByName(job.GetEnv())
	assertEnvCount(t, job.GetEnv(), "WORK_DIR", 1)
	assertEnvCount(t, job.GetEnv(), "PORT", 1)
	if got := values["WORK_DIR"]; got != "/workdir" {
		t.Fatalf("WORK_DIR = %q, want %q", got, "/workdir")
	}
	if got := values["PORT"]; got != "20000" {
		t.Fatalf("PORT = %q, want %q", got, "20000")
	}
	if got := values["CUSTOM_ENV"]; got != "custom-value" {
		t.Fatalf("CUSTOM_ENV = %q, want %q", got, "custom-value")
	}
}

func TestAddResource(t *testing.T) {
	tests := []struct {
		name          string
		inputRes      *corev1.ResourceRequirements
		resourceName  corev1.ResourceName
		quantity      string
		expectedReq   corev1.ResourceList
		expectedLimit corev1.ResourceList
		expectError   bool
	}{
		{
			name:         "AddToEmptyResources",
			inputRes:     &corev1.ResourceRequirements{},
			resourceName: "nvidia.com/gpu",
			quantity:     "1",
			expectedReq: corev1.ResourceList{
				"nvidia.com/gpu": resource.MustParse("1"),
			},
			expectedLimit: corev1.ResourceList{
				"nvidia.com/gpu": resource.MustParse("1"),
			},
		},
		{
			name: "AddToExistingResources",
			inputRes: &corev1.ResourceRequirements{
				Requests: corev1.ResourceList{
					"cpu": resource.MustParse("500m"),
				},
				Limits: corev1.ResourceList{
					"cpu": resource.MustParse("1"),
				},
			},
			resourceName: "memory",
			quantity:     "1Gi",
			expectedReq: corev1.ResourceList{
				"cpu":    resource.MustParse("500m"),
				"memory": resource.MustParse("1Gi"),
			},
			expectedLimit: corev1.ResourceList{
				"cpu":    resource.MustParse("1"),
				"memory": resource.MustParse("1Gi"),
			},
		},
		{
			name:         "InvalidQuantity",
			inputRes:     &corev1.ResourceRequirements{},
			resourceName: "gpu",
			quantity:     "invalid",
			expectError:  true,
		},
		{
			name:         "NilResourceRequirements",
			inputRes:     nil,
			resourceName: "gpu",
			quantity:     "1",
			expectError:  true,
		},
		{
			name: "OverrideExistingResource",
			inputRes: &corev1.ResourceRequirements{
				Requests: corev1.ResourceList{
					"gpu": resource.MustParse("2"),
				},
				Limits: corev1.ResourceList{
					"gpu": resource.MustParse("2"),
				},
			},
			resourceName: "gpu",
			quantity:     "4",
			expectedReq: corev1.ResourceList{
				"gpu": resource.MustParse("4"),
			},
			expectedLimit: corev1.ResourceList{
				"gpu": resource.MustParse("4"),
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			inputCopy := cloneResourceRequirements(tt.inputRes)

			err := (&inference.InferenceJob{}).AddResource(inputCopy, tt.resourceName, tt.quantity)

			if tt.expectError {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("AddResource failed: %v", err)
			}
			assertResourceList(t, inputCopy.Requests, tt.expectedReq)
			assertResourceList(t, inputCopy.Limits, tt.expectedLimit)
		})
	}
}

func TestAddResourceEdgeCases(t *testing.T) {
	t.Run("EmptyQuantity", func(t *testing.T) {
		res := &corev1.ResourceRequirements{}
		err := (&inference.InferenceJob{}).AddResource(res, "cpu", "")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("ZeroQuantity", func(t *testing.T) {
		res := &corev1.ResourceRequirements{}
		err := (&inference.InferenceJob{}).AddResource(res, "cpu", "0")
		if err != nil {
			t.Fatalf("AddResource failed: %v", err)
		}
		if got := res.Requests["cpu"]; got.Cmp(resource.MustParse("0")) != 0 {
			t.Fatalf("cpu request = %s, want 0", got.String())
		}
	})

	t.Run("SpecialQuantityFormats", func(t *testing.T) {
		res := &corev1.ResourceRequirements{}
		testCases := []struct {
			quantity string
			valid    bool
		}{
			{"500m", true},
			{"1.5", true},
			{"1Ki", true},
			{"1e3", true},
			{"1.2.3", false},
		}

		for _, tc := range testCases {
			err := (&inference.InferenceJob{}).AddResource(res, "resource", tc.quantity)
			if tc.valid && err != nil {
				t.Fatalf("quantity %q should be valid, got error: %v", tc.quantity, err)
			}
			if !tc.valid && err == nil {
				t.Fatalf("quantity %q should be invalid", tc.quantity)
			}
		}
	})
}

func TestSingleInferenceSubmissionPreparesParamsAndUsesSingleCreator(t *testing.T) {
	job := newInferenceJobForSubmit(t, 1, "")

	if err := job.SetInferenceParams(); err != nil {
		t.Fatalf("SetInferenceParams failed: %v", err)
	}

	if job.IsDistributed() {
		t.Fatal("single node inference should not be distributed")
	}
	creator := inference.NewInferenceInterface(job)
	if _, ok := creator.(*inference.SingleInference); !ok {
		t.Fatalf("creator type = %T, want *inference.SingleInference", creator)
	}

	values := inferenceEnvValuesByName(job.GetEnv())
	if got := values["WORK_DIR"]; got != "/workdir" {
		t.Fatalf("WORK_DIR = %q, want %q", got, "/workdir")
	}
	if got := values["PORT"]; got != "20000" {
		t.Fatalf("PORT = %q, want %q", got, "20000")
	}
	if got := job.GetLabels()["type"]; got != "inference" {
		t.Fatalf("type label = %q, want inference", got)
	}
	if got := job.GetLabels()[utils.Creator]; got != "demo_admin" {
		t.Fatalf("creator label = %q, want demo_admin", got)
	}
	assertResourceQuantity(t, job.GetResources().Requests, corev1.ResourceCPU, "2")
	assertResourceQuantity(t, job.GetResources().Requests, corev1.ResourceMemory, "8192Mi")
	assertVolumeMountExists(t, job.GetVolumeMounts(), "/workdir")
	assertVolumeMountExists(t, job.GetVolumeMounts(), "/etc/localtime")
	assertVolumeMountMissing(t, job.GetVolumeMounts(), "/opt/entry.sh")
}

func TestDistributedInferenceSubmissionPreparesParamsAndUsesDistributedCreator(t *testing.T) {
	job := newInferenceJobForSubmit(t, 2, "/tmp/entry.sh")

	if err := job.SetInferenceParams(); err != nil {
		t.Fatalf("SetInferenceParams failed: %v", err)
	}

	if !job.IsDistributed() {
		t.Fatal("multi node inference should be distributed")
	}
	if !job.HasScript() {
		t.Fatal("distributed inference should keep submitted script path")
	}
	creator := inference.NewInferenceInterface(job)
	if _, ok := creator.(*inference.DistributedInference); !ok {
		t.Fatalf("creator type = %T, want *inference.DistributedInference", creator)
	}

	values := inferenceEnvValuesByName(job.GetEnv())
	if got := values["WORK_DIR"]; got != "/workdir" {
		t.Fatalf("WORK_DIR = %q, want %q", got, "/workdir")
	}
	if got := values["PORT"]; got != "20000" {
		t.Fatalf("PORT = %q, want %q", got, "20000")
	}
	assertResourceQuantity(t, job.GetResources().Requests, corev1.ResourceCPU, "2")
	assertResourceQuantity(t, job.GetResources().Requests, corev1.ResourceMemory, "4096Mi")
	assertVolumeMountExists(t, job.GetVolumeMounts(), "/workdir")
	assertVolumeMountExists(t, job.GetVolumeMounts(), "/etc/localtime")
	assertVolumeMountExists(t, job.GetVolumeMounts(), "/opt/entry.sh")
	assertHostPathVolumeType(t, job.GetVolumes(), "script", corev1.HostPathFileOrCreate)
}

func TestSingleInferenceCreateSubmitsDeploymentAndServiceWithFakeClient(t *testing.T) {
	cli := k8sfake.NewSimpleClientset()
	job := newInferenceJobForSubmit(t, 1, "/tmp/entry.sh", cli)
	if err := job.SetInferenceParams(); err != nil {
		t.Fatalf("SetInferenceParams failed: %v", err)
	}

	creator := inference.NewInferenceInterface(job)
	created, err := creator.Create()
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}
	if !created {
		t.Fatal("Create returned false, want true")
	}

	service, err := cli.CoreV1().Services(job.GetNamespace()).Get(context.Background(), job.GetJobName(), metav1.GetOptions{})
	if err != nil {
		t.Fatalf("get service failed: %v", err)
	}
	if service.Spec.Type != corev1.ServiceTypeNodePort {
		t.Fatalf("service type = %s, want NodePort", service.Spec.Type)
	}
	if got := service.Spec.Ports[0].Port; got != int32(job.GetPort()) {
		t.Fatalf("service port = %d, want %d", got, job.GetPort())
	}
	if got := service.Spec.Ports[0].NodePort; got != 30000 {
		t.Fatalf("service nodePort = %d, want 30000", got)
	}
	assertPrometheusAnnotations(t, service, int(job.GetPort()))

	deployment, err := cli.AppsV1().Deployments(job.GetNamespace()).Get(context.Background(), job.GetJobName(), metav1.GetOptions{})
	if err != nil {
		t.Fatalf("get deployment failed: %v", err)
	}
	if got := *deployment.Spec.Replicas; got != 1 {
		t.Fatalf("deployment replicas = %d, want 1", got)
	}
	container := deployment.Spec.Template.Spec.Containers[0]
	if got := container.Ports[0].ContainerPort; got != job.GetPort() {
		t.Fatalf("container port = %d, want %d", got, job.GetPort())
	}
	if container.ReadinessProbe != nil {
		t.Fatalf("container readiness probe = %#v, want nil", container.ReadinessProbe)
	}
	if container.LivenessProbe != nil {
		t.Fatalf("container liveness probe = %#v, want nil", container.LivenessProbe)
	}
	assertStringSliceEqual(t, container.Command, []string{"sh", "-c"})
	assertStringSliceEqual(t, container.Args, []string{"chmod +x /opt/entry.sh && /opt/entry.sh"})
	assertVolumeMountExists(t, container.VolumeMounts, "/etc/localtime")
	assertVolumeMountExists(t, container.VolumeMounts, "/opt/entry.sh")
}

func TestSingleInferenceCreateAddsPrivateImagePullSecretRef(t *testing.T) {
	cli := k8sfake.NewSimpleClientset()
	job := newInferenceJobForSubmit(t, 1, "/tmp/entry.sh", cli)
	job.GetSubmitRequest().PrivateImageRepositoryCredentials = &pb.PrivateImageRepositoryCredentials{
		UserName: "demo-user",
		Password: "demo-password",
	}
	if err := job.SetInferenceParams(); err != nil {
		t.Fatalf("SetInferenceParams failed: %v", err)
	}

	creator := inference.NewInferenceInterface(job)
	created, err := creator.Create()
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}
	if !created {
		t.Fatal("Create returned false, want true")
	}

	deployment, err := cli.AppsV1().Deployments(job.GetNamespace()).Get(context.Background(), job.GetJobName(), metav1.GetOptions{})
	if err != nil {
		t.Fatalf("get deployment failed: %v", err)
	}
	secrets := deployment.Spec.Template.Spec.ImagePullSecrets
	if len(secrets) != 1 || secrets[0].Name != job.GetJobName() {
		t.Fatalf("image pull secrets = %v, want %s", secrets, job.GetJobName())
	}
}

func TestSingleInferenceCreateCleansCreatedResourcesWhenDeploymentCreateFails(t *testing.T) {
	setEmptyRDMAConfig(t)
	cli := k8sfake.NewSimpleClientset()
	cli.Fake.PrependReactor("create", "deployments", func(action k8stesting.Action) (bool, runtime.Object, error) {
		return true, nil, errors.New("create deployment failed")
	})

	req := newSubmitInferenceRequest(1, "/tmp/entry.sh")
	req.ExtraOptions[3] = utils.HuaweiAscend910
	req.PrivateImageRepositoryCredentials = &pb.PrivateImageRepositoryCredentials{
		UserName: "demo-user",
		Password: "demo-password",
	}
	jobName := "infer-create-rollback"

	created, err := inference.SubmitInferenceWithClients(req, jobName, "/workdir", cli, nil)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if created {
		t.Fatal("created = true, want false")
	}

	assertServiceNotFound(t, cli, req.GetPartition(), jobName)
	assertSecretNotFound(t, cli, req.GetPartition(), jobName)
	assertConfigMapNotFound(t, cli, req.GetPartition(), "rings-config-"+jobName)
}

func TestDistributedInferenceCreateSubmitsVolcanoJobAndServicesWithFakeClients(t *testing.T) {
	cli := k8sfake.NewSimpleClientset()
	volcanoCli := volcanofake.NewSimpleClientset()
	job := newInferenceJobForSubmit(t, 2, "/tmp/entry.sh", cli)
	job.SetVolcanoClient(volcanoCli)
	if err := job.SetInferenceParams(); err != nil {
		t.Fatalf("SetInferenceParams failed: %v", err)
	}

	creator := inference.NewInferenceInterface(job)
	created, err := creator.Create()
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}
	if !created {
		t.Fatal("Create returned false, want true")
	}

	inferenceService, err := cli.CoreV1().Services(job.GetNamespace()).Get(context.Background(), job.GetJobName(), metav1.GetOptions{})
	if err != nil {
		t.Fatalf("get inference service failed: %v", err)
	}
	if inferenceService.Spec.Type != corev1.ServiceTypeNodePort {
		t.Fatalf("inference service type = %s, want NodePort", inferenceService.Spec.Type)
	}
	if got := inferenceService.Spec.Ports[0].Port; got != int32(job.GetPort()) {
		t.Fatalf("inference service port = %d, want %d", got, job.GetPort())
	}
	assertPrometheusAnnotations(t, inferenceService, int(job.GetPort()))
	if got := inferenceService.Spec.Selector["role"]; got != "head" {
		t.Fatalf("inference service role selector = %q, want head", got)
	}

	rayHeadService, err := cli.CoreV1().Services(job.GetNamespace()).Get(
		context.Background(),
		job.GetJobName()+"-ray-head",
		metav1.GetOptions{},
	)
	if err != nil {
		t.Fatalf("get ray head service failed: %v", err)
	}
	if rayHeadService.Spec.Type != corev1.ServiceTypeClusterIP {
		t.Fatalf("ray head service type = %s, want ClusterIP", rayHeadService.Spec.Type)
	}
	if !rayHeadService.Spec.PublishNotReadyAddresses {
		t.Fatal("ray head service should publish not ready addresses")
	}

	volcanoJob, err := volcanoCli.BatchV1alpha1().Jobs(job.GetNamespace()).Get(
		context.Background(),
		job.GetJobName(),
		metav1.GetOptions{},
	)
	if err != nil {
		t.Fatalf("get volcano job failed: %v", err)
	}
	if got := volcanoJob.Spec.MinAvailable; got != 2 {
		t.Fatalf("volcano job minAvailable = %d, want 2", got)
	}
	if len(volcanoJob.Spec.Tasks) != 2 {
		t.Fatalf("volcano job tasks length = %d, want 2", len(volcanoJob.Spec.Tasks))
	}
	headContainer := volcanoJob.Spec.Tasks[0].Template.Spec.Containers[0]
	if got := headContainer.Ports[0].ContainerPort; got != job.GetPort() {
		t.Fatalf("head container port = %d, want %d", got, job.GetPort())
	}
	if got := volcanoJob.Spec.Tasks[0].Template.Spec.TerminationGracePeriodSeconds; got == nil || *got != 30 {
		t.Fatalf("termination grace period = %v, want 30", got)
	}
	assertInferenceTCPReadinessProbe(t, headContainer.ReadinessProbe, job.GetPort())
	assertVolumeMountExists(t, headContainer.VolumeMounts, "/etc/localtime")
	assertVolumeMountExists(t, headContainer.VolumeMounts, "/scripts")
	assertVolumeMountExists(t, headContainer.VolumeMounts, "/opt/entry.sh")
}

func TestSubmitInferenceWithClientsCreatesSingleInferenceResources(t *testing.T) {
	setEmptyRDMAConfig(t)
	cli := k8sfake.NewSimpleClientset()
	req := newSubmitInferenceRequest(1, "/tmp/entry.sh")

	created, err := inference.SubmitInferenceWithClients(req, "infer-submit-single", "/workdir", cli, nil)
	if err != nil {
		t.Fatalf("SubmitInferenceWithClients failed: %v", err)
	}
	if !created {
		t.Fatal("SubmitInferenceWithClients returned false, want true")
	}

	assertNamespaceExists(t, cli, req.GetPartition())
	service, err := cli.CoreV1().Services(req.GetPartition()).Get(
		context.Background(),
		"infer-submit-single",
		metav1.GetOptions{},
	)
	if err != nil {
		t.Fatalf("get service failed: %v", err)
	}
	if got := service.Spec.Ports[0].Port; got != int32(req.GetContainerServicePort()) {
		t.Fatalf("service port = %d, want %d", got, req.GetContainerServicePort())
	}

	deployment, err := cli.AppsV1().Deployments(req.GetPartition()).Get(
		context.Background(),
		"infer-submit-single",
		metav1.GetOptions{},
	)
	if err != nil {
		t.Fatalf("get deployment failed: %v", err)
	}
	if got := *deployment.Spec.Replicas; got != 1 {
		t.Fatalf("deployment replicas = %d, want 1", got)
	}
}

func TestSubmitInferenceWithClientsCreatesDistributedInferenceResources(t *testing.T) {
	setEmptyRDMAConfig(t)
	cli := k8sfake.NewSimpleClientset()
	volcanoCli := volcanofake.NewSimpleClientset()
	req := newSubmitInferenceRequest(2, "/tmp/entry.sh")

	created, err := inference.SubmitInferenceWithClients(req, "infer-submit-distributed", "/workdir", cli, volcanoCli)
	if err != nil {
		t.Fatalf("SubmitInferenceWithClients failed: %v", err)
	}
	if !created {
		t.Fatal("SubmitInferenceWithClients returned false, want true")
	}

	assertNamespaceExists(t, cli, req.GetPartition())
	assertServiceExists(t, cli, req.GetPartition(), "infer-submit-distributed")
	assertServiceExists(t, cli, req.GetPartition(), "infer-submit-distributed-ray-head")

	volcanoJob, err := volcanoCli.BatchV1alpha1().Jobs(req.GetPartition()).Get(
		context.Background(),
		"infer-submit-distributed",
		metav1.GetOptions{},
	)
	if err != nil {
		t.Fatalf("get volcano job failed: %v", err)
	}
	if got := volcanoJob.Spec.MinAvailable; got != 2 {
		t.Fatalf("volcano job minAvailable = %d, want 2", got)
	}
}

func TestSubmitInferenceWithClientsCreatesDistributedNPUInferenceResources(t *testing.T) {
	setRDMAConfig(t, "unit-test-partition", "sriov-net-npu", "huawei.com/rdma", 1)
	cli := k8sfake.NewSimpleClientset()
	volcanoCli := volcanofake.NewSimpleClientset()
	req := newSubmitInferenceRequest(2, "/tmp/entry.sh")
	req.ExtraOptions[3] = utils.HuaweiAscend910

	created, err := inference.SubmitInferenceWithClients(req, "infer-submit-npu", "/workdir", cli, volcanoCli)
	if err != nil {
		t.Fatalf("SubmitInferenceWithClients failed: %v", err)
	}
	if !created {
		t.Fatal("SubmitInferenceWithClients returned false, want true")
	}

	assertNamespaceExists(t, cli, req.GetPartition())
	assertServiceExists(t, cli, req.GetPartition(), "infer-submit-npu")
	assertServiceExists(t, cli, req.GetPartition(), "infer-submit-npu-ray-head")

	configmap, err := cli.CoreV1().ConfigMaps(req.GetPartition()).Get(
		context.Background(),
		"rings-config-infer-submit-npu",
		metav1.GetOptions{},
	)
	if err != nil {
		t.Fatalf("get ascend configmap failed: %v", err)
	}
	if got := configmap.Labels["ring-controller.atlas"]; got != "ascend-910" {
		t.Fatalf("ascend configmap label = %q, want ascend-910", got)
	}

	volcanoJob, err := volcanoCli.BatchV1alpha1().Jobs(req.GetPartition()).Get(
		context.Background(),
		"infer-submit-npu",
		metav1.GetOptions{},
	)
	if err != nil {
		t.Fatalf("get volcano job failed: %v", err)
	}
	if got := volcanoJob.Labels["ring-controller.atlas"]; got != "ascend-910" {
		t.Fatalf("volcano job ascend label = %q, want ascend-910", got)
	}
	if len(volcanoJob.Spec.Tasks) != 2 {
		t.Fatalf("volcano job tasks length = %d, want 2", len(volcanoJob.Spec.Tasks))
	}

	headTask := volcanoJob.Spec.Tasks[0]
	if got := headTask.Template.Spec.NodeSelector["host-arch"]; got != "huawei-arm" {
		t.Fatalf("head task host-arch selector = %q, want huawei-arm", got)
	}
	if got := headTask.Template.Annotations[utils.RDMANetworkKey]; got != "sriov-net-npu" {
		t.Fatalf("head task RDMA annotation = %q, want sriov-net-npu", got)
	}
	headContainer := headTask.Template.Spec.Containers[0]
	assertResourceQuantity(t, headContainer.Resources.Requests, corev1.ResourceName(utils.HuaweiAscend910), "1")
	assertResourceQuantity(t, headContainer.Resources.Requests, "huawei.com/rdma", "1")
	assertEnvExists(t, headContainer.Env, "ASCEND_VISIBLE_DEVICES")
	assertEnvMissing(t, headContainer.Env, "NCCL_IB_DISABLE")
	assertEnvMissing(t, headContainer.Env, "UCX_TLS")
	assertVolumeMountExists(t, headContainer.VolumeMounts, "/user/serverid/devindex/config")
	assertVolumeMountExists(t, headContainer.VolumeMounts, "/usr/local/Ascend/driver")
	assertVolumeMountExists(t, headContainer.VolumeMounts, "/usr/local/Ascend/add-ons")
	assertVolumeMountExists(t, headContainer.VolumeMounts, "/usr/bin/hccn_tool")
	assertVolumeMountExists(t, headContainer.VolumeMounts, "/usr/local/bin/npu-smi")
	assertVolumeMountExists(t, headContainer.VolumeMounts, "/opt/entry.sh")
}

func TestSubmitInferenceWithClientsRejectsInvalidExtraOptions(t *testing.T) {
	setEmptyRDMAConfig(t)
	cli := k8sfake.NewSimpleClientset()
	req := newSubmitInferenceRequest(1, "")
	req.ExtraOptions = []string{"image"}

	created, err := inference.SubmitInferenceWithClients(req, "infer-invalid-extra-options", "/workdir", cli, nil)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if created {
		t.Fatal("created = true, want false")
	}
}

func TestDeleteInferenceJobDeletesSingleInferenceResources(t *testing.T) {
	setEmptyRDMAConfig(t)
	cli := k8sfake.NewSimpleClientset()
	req := newSubmitInferenceRequest(1, "/tmp/entry.sh")
	jobName := "infer-delete-single"

	if created, err := inference.SubmitInferenceWithClients(req, jobName, "/workdir", cli, nil); err != nil || !created {
		t.Fatalf("SubmitInferenceWithClients created=%v err=%v", created, err)
	}
	createImagePullSecret(t, cli, req.GetPartition(), jobName)

	if err := inference.DeleteInferenceJob(jobName, "", req.GetPartition(), 1, cli, nil); err != nil {
		t.Fatalf("DeleteInferenceJob failed: %v", err)
	}

	assertDeploymentNotFound(t, cli, req.GetPartition(), jobName)
	assertServiceNotFound(t, cli, req.GetPartition(), jobName)
	assertServiceNotFound(t, cli, req.GetPartition(), jobName+"-ray-head")
	assertSecretNotFound(t, cli, req.GetPartition(), jobName)
}

func TestDeleteInferenceJobDeletesDistributedNPUInferenceResources(t *testing.T) {
	setRDMAConfig(t, "unit-test-partition", "sriov-net-npu", "huawei.com/rdma", 1)
	cli := k8sfake.NewSimpleClientset()
	volcanoCli := volcanofake.NewSimpleClientset()
	req := newSubmitInferenceRequest(2, "/tmp/entry.sh")
	req.ExtraOptions[3] = utils.HuaweiAscend910
	jobName := "infer-delete-npu"

	if created, err := inference.SubmitInferenceWithClients(req, jobName, "/workdir", cli, volcanoCli); err != nil || !created {
		t.Fatalf("SubmitInferenceWithClients created=%v err=%v", created, err)
	}
	createImagePullSecret(t, cli, req.GetPartition(), jobName)

	if err := inference.DeleteInferenceJob(jobName, utils.HuaweiAscend910, req.GetPartition(), 2, cli, volcanoCli); err != nil {
		t.Fatalf("DeleteInferenceJob failed: %v", err)
	}

	_, err := volcanoCli.BatchV1alpha1().Jobs(req.GetPartition()).Get(
		context.Background(),
		jobName,
		metav1.GetOptions{},
	)
	if !apierrors.IsNotFound(err) {
		t.Fatalf("volcano job still exists or got unexpected error: %v", err)
	}
	assertServiceNotFound(t, cli, req.GetPartition(), jobName)
	assertServiceNotFound(t, cli, req.GetPartition(), jobName+"-ray-head")
	assertSecretNotFound(t, cli, req.GetPartition(), jobName)
	assertConfigMapNotFound(t, cli, req.GetPartition(), "rings-config-"+jobName)
}

func TestDeleteInferenceJobDeletesLegacyDistributedDeploymentWhenVolcanoJobMissing(t *testing.T) {
	const (
		namespace = "unit-test-partition"
		jobName   = "infer-delete-legacy-deploy"
	)
	cli := k8sfake.NewSimpleClientset(
		&appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name:      jobName,
				Namespace: namespace,
			},
		},
		&corev1.Service{
			ObjectMeta: metav1.ObjectMeta{
				Name:      jobName,
				Namespace: namespace,
			},
		},
		&corev1.Service{
			ObjectMeta: metav1.ObjectMeta{
				Name:      jobName + "-ray-head",
				Namespace: namespace,
			},
		},
		&corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{
				Name:      jobName,
				Namespace: namespace,
			},
		},
	)
	volcanoCli := volcanofake.NewSimpleClientset()

	if err := inference.DeleteInferenceJob(jobName, "", namespace, 2, cli, volcanoCli); err != nil {
		t.Fatalf("DeleteInferenceJob failed: %v", err)
	}

	assertDeploymentNotFound(t, cli, namespace, jobName)
	assertServiceNotFound(t, cli, namespace, jobName)
	assertServiceNotFound(t, cli, namespace, jobName+"-ray-head")
	assertSecretNotFound(t, cli, namespace, jobName)
}

func TestDeleteSingleInferenceReturnsMainResourceDeleteError(t *testing.T) {
	const (
		namespace = "unit-test-partition"
		jobName   = "infer-delete-error-single"
	)
	deleteErr := errors.New("delete deployment failed")
	cli := k8sfake.NewSimpleClientset(&corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{Name: jobName, Namespace: namespace},
	})
	cli.Fake.PrependReactor("delete", "deployments", func(action k8stesting.Action) (bool, runtime.Object, error) {
		return true, nil, deleteErr
	})

	err := inference.DeleteInferenceJob(jobName, "", namespace, 1, cli, nil)
	if !errors.Is(err, deleteErr) {
		t.Fatalf("DeleteInferenceJob error = %v, want wrapped %v", err, deleteErr)
	}
}

func TestDeleteSingleInferenceIgnoresAuxiliaryDeleteErrors(t *testing.T) {
	const (
		namespace = "unit-test-partition"
		jobName   = "infer-delete-aux-error-single"
	)
	deleteErr := errors.New("delete service failed")
	cli := k8sfake.NewSimpleClientset(
		&appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{Name: jobName, Namespace: namespace},
		},
		&corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{Name: jobName, Namespace: namespace},
		},
	)
	cli.Fake.PrependReactor("delete", "services", func(action k8stesting.Action) (bool, runtime.Object, error) {
		return true, nil, deleteErr
	})

	err := inference.DeleteInferenceJob(jobName, "", namespace, 1, cli, nil)
	if err != nil {
		t.Fatalf("DeleteInferenceJob error = %v, want nil", err)
	}
	assertDeploymentNotFound(t, cli, namespace, jobName)
	assertSecretNotFound(t, cli, namespace, jobName)
}

func TestDeleteDistributedInferenceIgnoresAuxiliaryDeleteErrors(t *testing.T) {
	const (
		namespace = "unit-test-partition"
		jobName   = "infer-delete-error-distributed"
	)
	deleteErr := errors.New("delete service failed")
	cli := k8sfake.NewSimpleClientset(&corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{Name: jobName, Namespace: namespace},
	})
	cli.Fake.PrependReactor("delete", "services", func(action k8stesting.Action) (bool, runtime.Object, error) {
		return true, nil, deleteErr
	})
	volcanoCli := volcanofake.NewSimpleClientset()

	err := inference.DeleteInferenceJob(jobName, "", namespace, 2, cli, volcanoCli)
	if err != nil {
		t.Fatalf("DeleteInferenceJob error = %v, want nil", err)
	}
	assertSecretNotFound(t, cli, namespace, jobName)
}

func newInferenceJobForEnv(workDir string, modelOptions string, port uint32) *inference.InferenceJob {
	req := &pb.SubmitInferJobRequest{
		UserId:               "demo_admin",
		Partition:            "nvidia",
		NodeCount:            1,
		GpuCount:             1,
		ExtraOptions:         []string{"image", modelOptions, "", "", ""},
		ContainerServicePort: port,
	}
	return inference.NewInferenceJob(req, nil, "infer-test", workDir)
}

func newInferenceJobForSubmit(t *testing.T, nodeCount uint32, script string, clients ...k8sclient.Interface) *inference.InferenceJob {
	t.Helper()
	setEmptyRDMAConfig(t)

	var cli k8sclient.Interface
	if len(clients) > 0 {
		cli = clients[0]
	}
	req := newSubmitInferenceRequest(nodeCount, script)
	return inference.NewInferenceJob(req, cli, "infer-submit-test", "/workdir")
}

func newSubmitInferenceRequest(nodeCount uint32, script string) *pb.SubmitInferJobRequest {
	memoryMb := uint64(8192)
	qos := "normal"
	return &pb.SubmitInferJobRequest{
		UserId:               "demo_admin",
		Partition:            "unit-test-partition",
		NodeCount:            nodeCount,
		GpuCount:             1,
		MemoryMb:             &memoryMb,
		CoreCount:            2,
		Script:               script,
		ExtraOptions:         []string{"registry.local/vllm:latest", "", "", "", ""},
		ContainerServicePort: 20000,
		Qos:                  &qos,
	}
}

func setEmptyRDMAConfig(t *testing.T) {
	t.Helper()

	setRDMAConfig(t, "", "", "", 0)
}

func setRDMAConfig(t *testing.T, partition, cniNetworks, rdmaDevice string, rdmaQuantity int) {
	t.Helper()

	previous := config.Value
	queues := map[string]config.RDMAConfig{}
	if partition != "" {
		queues[partition] = config.RDMAConfig{
			CNINetworks: cniNetworks,
			RDMADevices: map[string]int{
				rdmaDevice: rdmaQuantity,
			},
		}
	}
	config.Value = &config.Config{
		RDMAConfig: config.RDMAQueueConfig{
			Queues: queues,
		},
	}
	t.Cleanup(func() {
		config.Value = previous
	})
}

func mountOptions(t *testing.T, mount utils.MountModel) string {
	t.Helper()

	mountBytes, err := json.Marshal(mount)
	if err != nil {
		t.Fatalf("marshal mount failed: %v", err)
	}

	optionsBytes, err := json.Marshal([]string{string(mountBytes)})
	if err != nil {
		t.Fatalf("marshal mount options failed: %v", err)
	}

	return string(optionsBytes)
}

func inferenceEnvValuesByName(env []corev1.EnvVar) map[string]string {
	values := map[string]string{}
	for _, item := range env {
		values[item.Name] = item.Value
	}
	return values
}

func assertEnvCount(t *testing.T, env []corev1.EnvVar, name string, want int) {
	t.Helper()

	count := 0
	for _, item := range env {
		if item.Name == name {
			count++
		}
	}
	if count != want {
		t.Fatalf("env %s count = %d, want %d", name, count, want)
	}
}

func assertEnvExists(t *testing.T, env []corev1.EnvVar, name string) {
	t.Helper()

	for _, item := range env {
		if item.Name == name {
			return
		}
	}
	t.Fatalf("env %s missing from %v", name, env)
}

func assertEnvMissing(t *testing.T, env []corev1.EnvVar, name string) {
	t.Helper()

	for _, item := range env {
		if item.Name == name {
			t.Fatalf("env %s should not exist in %v", name, env)
		}
	}
}

func assertNamespaceExists(t *testing.T, cli k8sclient.Interface, namespace string) {
	t.Helper()

	if _, err := cli.CoreV1().Namespaces().Get(context.Background(), namespace, metav1.GetOptions{}); err != nil {
		t.Fatalf("get namespace %s failed: %v", namespace, err)
	}
}

func assertServiceExists(t *testing.T, cli k8sclient.Interface, namespace string, serviceName string) {
	t.Helper()

	if _, err := cli.CoreV1().Services(namespace).Get(context.Background(), serviceName, metav1.GetOptions{}); err != nil {
		t.Fatalf("get service %s failed: %v", serviceName, err)
	}
}

func createImagePullSecret(t *testing.T, cli k8sclient.Interface, namespace string, secretName string) {
	t.Helper()

	_, err := cli.CoreV1().Secrets(namespace).Create(context.Background(), &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      secretName,
			Namespace: namespace,
		},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("create secret %s failed: %v", secretName, err)
	}
}

func assertDeploymentNotFound(t *testing.T, cli k8sclient.Interface, namespace string, deploymentName string) {
	t.Helper()

	_, err := cli.AppsV1().Deployments(namespace).Get(context.Background(), deploymentName, metav1.GetOptions{})
	if !apierrors.IsNotFound(err) {
		t.Fatalf("deployment %s still exists or got unexpected error: %v", deploymentName, err)
	}
}

func assertServiceNotFound(t *testing.T, cli k8sclient.Interface, namespace string, serviceName string) {
	t.Helper()

	_, err := cli.CoreV1().Services(namespace).Get(context.Background(), serviceName, metav1.GetOptions{})
	if !apierrors.IsNotFound(err) {
		t.Fatalf("service %s still exists or got unexpected error: %v", serviceName, err)
	}
}

func assertSecretNotFound(t *testing.T, cli k8sclient.Interface, namespace string, secretName string) {
	t.Helper()

	_, err := cli.CoreV1().Secrets(namespace).Get(context.Background(), secretName, metav1.GetOptions{})
	if !apierrors.IsNotFound(err) {
		t.Fatalf("secret %s still exists or got unexpected error: %v", secretName, err)
	}
}

func assertConfigMapNotFound(t *testing.T, cli k8sclient.Interface, namespace string, configMapName string) {
	t.Helper()

	_, err := cli.CoreV1().ConfigMaps(namespace).Get(context.Background(), configMapName, metav1.GetOptions{})
	if !apierrors.IsNotFound(err) {
		t.Fatalf("configmap %s still exists or got unexpected error: %v", configMapName, err)
	}
}

func assertResourceQuantity(t *testing.T, resources corev1.ResourceList, name corev1.ResourceName, want string) {
	t.Helper()

	got, ok := resources[name]
	if !ok {
		t.Fatalf("resource %s missing from %v", name, resources)
	}
	wantQuantity := resource.MustParse(want)
	if got.Cmp(wantQuantity) != 0 {
		t.Fatalf("resource %s = %s, want %s", name, got.String(), wantQuantity.String())
	}
}

func assertVolumeMountExists(t *testing.T, mounts []corev1.VolumeMount, mountPath string) {
	t.Helper()

	for _, mount := range mounts {
		if mount.MountPath == mountPath {
			return
		}
	}
	t.Fatalf("volume mount %s missing from %v", mountPath, mounts)
}

func assertVolumeMountMissing(t *testing.T, mounts []corev1.VolumeMount, mountPath string) {
	t.Helper()

	for _, mount := range mounts {
		if mount.MountPath == mountPath {
			t.Fatalf("volume mount %s should not exist in %v", mountPath, mounts)
		}
	}
}

func assertHostPathVolumeType(t *testing.T, volumes []corev1.Volume, name string, want corev1.HostPathType) {
	t.Helper()

	for _, volume := range volumes {
		if volume.Name != name {
			continue
		}
		if volume.HostPath == nil || volume.HostPath.Type == nil {
			t.Fatalf("host path volume %s type is nil", name)
		}
		if *volume.HostPath.Type != want {
			t.Fatalf("host path volume %s type = %s, want %s", name, *volume.HostPath.Type, want)
		}
		return
	}
	t.Fatalf("volume %s missing from %v", name, volumes)
}

func assertPrometheusAnnotations(t *testing.T, service *corev1.Service, wantPort int) {
	t.Helper()

	if got := service.Annotations["prometheus.io/path"]; got != "/metrics" {
		t.Fatalf("service %s prometheus path annotation = %q, want /metrics", service.Name, got)
	}
	if got := service.Annotations["prometheus.io/port"]; got != strconv.Itoa(wantPort) {
		t.Fatalf("service %s prometheus port annotation = %q, want %d", service.Name, got, wantPort)
	}
	if got := service.Annotations["prometheus.scow.ai/inference"]; got != "true" {
		t.Fatalf("service %s prometheus inference annotation = %q, want true", service.Name, got)
	}
}

func assertInferenceTCPReadinessProbe(t *testing.T, probe *corev1.Probe, wantPort int32) {
	t.Helper()

	if probe == nil {
		t.Fatal("readiness probe is nil")
	}
	if probe.TCPSocket == nil {
		t.Fatalf("readiness probe tcp socket is nil: %#v", probe)
	}
	if got := probe.TCPSocket.Port.IntVal; got != wantPort {
		t.Fatalf("readiness probe port = %d, want %d", got, wantPort)
	}
	if got := probe.PeriodSeconds; got != 10 {
		t.Fatalf("readiness probe period = %d, want 10", got)
	}
	if got := probe.FailureThreshold; got != 2 {
		t.Fatalf("readiness probe failure threshold = %d, want 2", got)
	}
	if got := probe.TimeoutSeconds; got != 10 {
		t.Fatalf("readiness probe timeout = %d, want 10", got)
	}
}

func assertStringSliceEqual(t *testing.T, got, want []string) {
	t.Helper()

	if len(got) != len(want) {
		t.Fatalf("slice length = %d, want %d; got=%v want=%v", len(got), len(want), got, want)
	}
	for i := range got {
		if got[i] != want[i] {
			t.Fatalf("slice[%d] = %q, want %q; got=%v want=%v", i, got[i], want[i], got, want)
		}
	}
}

func cloneResourceRequirements(source *corev1.ResourceRequirements) *corev1.ResourceRequirements {
	if source == nil {
		return nil
	}
	cloned := &corev1.ResourceRequirements{
		Requests: corev1.ResourceList{},
		Limits:   corev1.ResourceList{},
	}
	for name, quantity := range source.Requests {
		cloned.Requests[name] = quantity.DeepCopy()
	}
	for name, quantity := range source.Limits {
		cloned.Limits[name] = quantity.DeepCopy()
	}
	return cloned
}

func assertResourceList(t *testing.T, got, want corev1.ResourceList) {
	t.Helper()

	if len(got) != len(want) {
		t.Fatalf("resource list length = %d, want %d; got=%v want=%v", len(got), len(want), got, want)
	}
	for name, wantQuantity := range want {
		gotQuantity, ok := got[name]
		if !ok {
			t.Fatalf("resource %s missing from %v", name, got)
		}
		if gotQuantity.Cmp(wantQuantity) != 0 {
			t.Fatalf("resource %s = %s, want %s", name, gotQuantity.String(), wantQuantity.String())
		}
	}
}
