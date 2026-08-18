package inference

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/sirupsen/logrus"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	k8sclient "k8s.io/client-go/kubernetes"
	scheduling "volcano.sh/apis/pkg/apis/scheduling/v1beta1"
	volcanoclientset "volcano.sh/apis/pkg/client/clientset/versioned"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/resourcecleanup"
	"scow-adapters/pkg/ai/utils"
)

const inferenceTypeLabelValue = "inference"

func inferenceMetricsAnnotations(port int) map[string]string {
	return map[string]string{
		"prometheus.io/path":           "/metrics",
		"prometheus.io/port":           strconv.Itoa(port),
		"prometheus.scow.ai/inference": "true",
	}
}

func newInferenceTCPReadinessProbe(port int32) *corev1.Probe {
	return &corev1.Probe{
		PeriodSeconds:    10,
		FailureThreshold: 2,
		TimeoutSeconds:   10,
		ProbeHandler: corev1.ProbeHandler{
			TCPSocket: &corev1.TCPSocketAction{Port: intstr.FromInt32(port)},
		},
	}
}

func newInferenceTCPLivenessProbe(port int32) *corev1.Probe {
	return &corev1.Probe{
		PeriodSeconds:    30,
		FailureThreshold: 3,
		ProbeHandler: corev1.ProbeHandler{
			TCPSocket: &corev1.TCPSocketAction{Port: intstr.FromInt32(port)},
		},
	}
}

type InferenceJob struct {
	in              *pb.SubmitInferJobRequest
	cli             k8sclient.Interface
	volcanoCli      volcanoclientset.Interface
	jobName         string
	workDir         string
	volumes         []corev1.Volume
	volumeMounts    []corev1.VolumeMount
	resources       corev1.ResourceRequirements
	env             []corev1.EnvVar
	labels          map[string]string
	securityContext corev1.SecurityContext
	annotations     map[string]string
	nodeSelectorKey string
}

func NewInferenceJob(
	in *pb.SubmitInferJobRequest,
	cli k8sclient.Interface,
	jobName string,
	workDir string,
) *InferenceJob {
	return &InferenceJob{
		in:              in,
		cli:             cli,
		jobName:         jobName,
		workDir:         workDir,
		nodeSelectorKey: fmt.Sprintf("queue-%s", in.Partition),
	}
}

func (j *InferenceJob) SetInferenceParams() error {
	if err := j.SetResources(); err != nil {
		return err
	}
	j.SetEnv()
	if err := j.SetMountPoints(); err != nil {
		return err
	}
	j.SetLabels()
	return nil
}

func (j *InferenceJob) SetResources() error {
	in := j.GetSubmitRequest()
	memory := resource.MustParse(strconv.Itoa(int(*in.MemoryMb)/int(in.NodeCount)) + "Mi")

	requests := corev1.ResourceList{
		corev1.ResourceCPU:    resource.MustParse(strconv.Itoa(int(in.CoreCount))),
		corev1.ResourceMemory: memory,
	}
	limits := corev1.ResourceList{
		corev1.ResourceCPU:    resource.MustParse(strconv.Itoa(int(in.CoreCount))),
		corev1.ResourceMemory: memory,
	}

	if j.GetAccelerator() != "" {
		accelerator := corev1.ResourceName(j.GetAccelerator())
		quantity := resource.MustParse(strconv.Itoa(int(in.GpuCount)))
		requests[accelerator] = quantity
		limits[accelerator] = quantity
	}

	j.resources = corev1.ResourceRequirements{
		Requests: requests,
		Limits:   limits,
	}

	resourceName, resourceQuantity, securityContext, annotations := utils.GetRDMAConfig(in.Partition)
	j.securityContext = securityContext
	j.annotations = annotations
	if resourceName == "" {
		return nil
	}

	if err := j.AddResource(&j.resources, corev1.ResourceName(resourceName), strconv.Itoa(resourceQuantity)); err != nil {
		logrus.Errorf("add %v resource failed: %v", resourceName, err)
		return err
	}
	return nil
}

func (j *InferenceJob) SetEnv() {
	in := j.GetSubmitRequest()
	env := j.SetInferenceEnv()
	// 增加自定义环境变量
	if in.GetEnvVariables() != nil {
		for _, envMap := range in.GetEnvVariables() {
			env = append(env, corev1.EnvVar{
				Name:  envMap.GetKey(),
				Value: envMap.GetValue(),
			})
		}
	}
	// 增加ascend的环境变量
	if utils.AcceleratorIsAscend(j.GetAccelerator()) {
		env = append(env, j.AddAscendEnv()...)
	}
	j.env = dedupeEnvVars(env)
}

func dedupeEnvVars(env []corev1.EnvVar) []corev1.EnvVar {
	seen := make(map[string]bool, len(env))
	deduped := make([]corev1.EnvVar, 0, len(env))
	for _, e := range env {
		if seen[e.Name] {
			logrus.Warnf("skip duplicate inference env: %s", e.Name)
			continue
		}
		seen[e.Name] = true
		deduped = append(deduped, e)
	}
	return deduped
}

func (j *InferenceJob) AddAscendEnv() []corev1.EnvVar {
	env := []corev1.EnvVar{
		{
			Name: "ASCEND_VISIBLE_DEVICES",
			ValueFrom: &corev1.EnvVarSource{
				FieldRef: &corev1.ObjectFieldSelector{
					FieldPath: "metadata.annotations['huawei.com/Ascend910']",
				},
			},
		},
	}

	return env
}

// AddResource 向 ResourceRequirements 中添加资源
func (j *InferenceJob) AddResource(resources *corev1.ResourceRequirements, name corev1.ResourceName, quantity string) error {
	if resources == nil {
		return fmt.Errorf("resources is nil")
	}

	q, err := resource.ParseQuantity(quantity)
	if err != nil {
		return fmt.Errorf("failed to parse quantity: %v", err)
	}

	// 初始化 Requests 和 Limits 如果为 nil
	if resources.Requests == nil {
		resources.Requests = make(corev1.ResourceList)
	}
	if resources.Limits == nil {
		resources.Limits = make(corev1.ResourceList)
	}

	// 添加资源
	resources.Requests[name] = q
	resources.Limits[name] = q
	return nil
}

func (j *InferenceJob) SetMountPoints() error {
	var (
		volumes      []corev1.Volume
		volumeMounts []corev1.VolumeMount
		err          error
	)
	in := j.GetSubmitRequest()
	mountPoints := utils.GetMountPoints(in.ExtraOptions[2], in.ExtraOptions[4])

	if utils.AcceleratorIsAscend(j.GetAccelerator()) {
		volumes, volumeMounts, err = j.SetAscendInferenceMountPoints(mountPoints)
	} else {
		volumes, volumeMounts, err = j.SetInferenceMountPoints(mountPoints)
	}
	if err != nil {
		return err
	}

	j.SetVolumes(volumes)
	j.SetVolumeMounts(volumeMounts)
	return nil
}

func (j *InferenceJob) SetLabels() {
	labels := j.SetInferenceLabels()
	labels[utils.Creator] = j.GetSubmitRequest().UserId
	j.labels = labels
}

func (j *InferenceJob) SetInferenceEnv() []corev1.EnvVar {
	env := []corev1.EnvVar{
		{
			Name: "SCOW_CONTAINER_IP",
			ValueFrom: &corev1.EnvVarSource{
				FieldRef: &corev1.ObjectFieldSelector{
					FieldPath: "status.podIP",
				},
			},
		},
		{
			Name:  "WORK_DIR",
			Value: j.GetWorkDir(),
		},
		{
			Name:  "PORT",
			Value: strconv.Itoa(int(j.GetPort())),
		},
	}

	modelPaths := j.GetSubmitRequest().ExtraOptions[1]
	if modelPaths != "" {
		model, err := utils.ParseMountModel(modelPaths)
		if err != nil {
			logrus.Errorf("Failed parse model path: %v", err)
			return env
		}
		if len(model) > 0 {
			var paths []string
			for _, m := range model {
				paths = append(paths, utils.GetMountTargetPath(m))
			}
			modelPath := strings.Join(paths, ":")
			env = append(env, corev1.EnvVar{
				Name:  utils.ContainerEnvPrefix + utils.ModelPathEnv,
				Value: modelPath,
			})
		}
	}
	return env
}

func (j *InferenceJob) SetAscendInferenceMountPoints(mountPoints map[bool][]string) ([]corev1.Volume, []corev1.VolumeMount, error) {
	in := j.GetSubmitRequest()
	uid, gid, mountMode, err := utils.GetCsiInfoFromIdmap(in.UserIdmapInfo)
	if err != nil {
		return nil, nil, err
	}
	volumeMount := corev1.VolumeMount{
		MountPath: "/opt/entry.sh",
		Name:      "script",
		ReadOnly:  false,
	}
	volumeMounts := []corev1.VolumeMount{
		{
			MountPath: "/user/serverid/devindex/config",
			Name:      "ascend-910-config",
		},
		{
			MountPath: j.GetWorkDir(),
			Name:      "workdir",
		},
		{
			MountPath: "/usr/local/Ascend/driver",
			Name:      "ascend-driver",
		},
		{
			MountPath: "/usr/local/Ascend/add-ons",
			Name:      "ascend-add-ons",
		},
		{
			MountPath: "/usr/bin/hccn_tool",
			Name:      "hccn-tool",
		},
		{
			MountPath: "/usr/local/bin/npu-smi",
			Name:      "npu-smi",
		},
		{
			MountPath: "/etc/localtime",
			Name:      "localtime",
			ReadOnly:  true,
		},
		{
			MountPath: "/dev/shm",
			Name:      "dshm",
		},
	}

	hostPathType := new(corev1.HostPathType)
	*hostPathType = corev1.HostPathFile

	volume := corev1.Volume{
		Name: "script",
		VolumeSource: corev1.VolumeSource{
			HostPath: &corev1.HostPathVolumeSource{
				Path: in.Script,
				Type: hostPathType,
			},
		},
	}
	workdirVolume := utils.GetMountPathVolume(uid, gid, j.GetWorkDir(), "workdir", mountMode)
	volumes := []corev1.Volume{
		{
			Name: "ascend-910-config",
			VolumeSource: corev1.VolumeSource{
				ConfigMap: &corev1.ConfigMapVolumeSource{
					LocalObjectReference: corev1.LocalObjectReference{
						Name: fmt.Sprintf("rings-config-%s", j.GetJobName()),
					},
				},
			},
		},
		workdirVolume,
		{
			Name: "ascend-driver",
			VolumeSource: corev1.VolumeSource{
				HostPath: &corev1.HostPathVolumeSource{
					Path: "/usr/local/Ascend/driver",
				},
			},
		},
		{
			Name: "ascend-add-ons",
			VolumeSource: corev1.VolumeSource{
				HostPath: &corev1.HostPathVolumeSource{
					Path: "/usr/local/Ascend/add-ons",
				},
			},
		},
		{
			Name: "hccn-tool",
			VolumeSource: corev1.VolumeSource{
				HostPath: &corev1.HostPathVolumeSource{
					Path: "/usr/bin/hccn_tool",
				},
			},
		},
		{
			Name: "npu-smi",
			VolumeSource: corev1.VolumeSource{
				HostPath: &corev1.HostPathVolumeSource{
					Path: "/usr/local/bin/npu-smi",
				},
			},
		},
		{
			Name: "localtime",
			VolumeSource: corev1.VolumeSource{
				HostPath: &corev1.HostPathVolumeSource{
					Path: "/etc/localtime",
				},
			},
		},
		{
			Name: "dshm",
			VolumeSource: corev1.VolumeSource{
				EmptyDir: &corev1.EmptyDirVolumeSource{
					Medium:    "Memory",
					SizeLimit: resource.NewQuantity(int64(*in.MemoryMb)*1024*1024/2, resource.BinarySI),
				},
			},
		},
	}
	if j.HasScript() {
		volumeMounts = append(volumeMounts, volumeMount)
		volumes = append(volumes, volume)
	}

	// model
	if in.ExtraOptions[1] != "" {
		model, err := utils.ParseMountModel(in.ExtraOptions[1])
		if err != nil {
			logrus.Errorf("Failed parse model path: %v", err)
			return nil, nil, err
		}
		for i, m := range model {
			name := "model" + strconv.Itoa(i)
			volumes = append(volumes, utils.GetMountPathVolume(uid, gid, m.Path, name, mountMode))
			volumeMounts = append(volumeMounts, corev1.VolumeMount{
				MountPath: utils.GetMountTargetPath(m),
				Name:      name,
				ReadOnly:  m.IsPublic,
			})
		}
	}

	suffix := 1
	if len(mountPoints) != 0 {
		for flag, path := range mountPoints {
			logrus.Tracef("[setAscendInferenceMountPoints]path string: %s", strings.Join(path, ""))
			var data []utils.PathMap
			err := json.Unmarshal([]byte(strings.Join(path, "")), &data)
			if err != nil {
				for index, value := range path {
					logrus.Tracef("[setAscendInferenceMountPoints] value: %s, err: %s", value, err)
					volumes = append(volumes, corev1.Volume{
						Name: "extramount" + strconv.Itoa(suffix) + strconv.Itoa(index),
						VolumeSource: corev1.VolumeSource{
							HostPath: &corev1.HostPathVolumeSource{
								Path: value,
							},
						},
					})
					volumeMounts = append(volumeMounts, corev1.VolumeMount{
						MountPath: value,
						Name:      "extramount" + strconv.Itoa(suffix) + strconv.Itoa(index),
						ReadOnly:  flag,
					})
				}
			} else {
				logrus.Tracef("[setAscendInferenceMountPoints] data: %s", data)
				for index, v := range data {
					name := "extramount" + strconv.Itoa(suffix) + strconv.Itoa(index)
					volumes = append(volumes, utils.GetMountPathVolume(uid, gid, v.Path, name, mountMode))
					volumeMounts = append(volumeMounts, corev1.VolumeMount{
						MountPath: v.Target,
						Name:      name,
						ReadOnly:  flag,
					})
				}
			}
			suffix++
		}
	}
	return volumes, volumeMounts, nil
}

func (j *InferenceJob) SetInferenceMountPoints(mountPoints map[bool][]string) ([]corev1.Volume, []corev1.VolumeMount, error) {
	in := j.GetSubmitRequest()
	uid, gid, mountMode, err := utils.GetCsiInfoFromIdmap(in.UserIdmapInfo)
	if err != nil {
		return nil, nil, err
	}
	volumeMount := corev1.VolumeMount{
		MountPath: "/opt/entry.sh",
		Name:      "script",
		ReadOnly:  false,
	}
	volumeMounts := []corev1.VolumeMount{
		{
			MountPath: j.GetWorkDir(),
			Name:      "workdir",
		},
		{
			MountPath: "/etc/localtime",
			Name:      "localtime",
			ReadOnly:  true,
		},
		{
			MountPath: "/dev/shm",
			Name:      "dshm",
		},
	}

	hostPathType := new(corev1.HostPathType)
	*hostPathType = corev1.HostPathFileOrCreate
	volume := corev1.Volume{
		Name: "script",
		VolumeSource: corev1.VolumeSource{
			HostPath: &corev1.HostPathVolumeSource{
				Path: in.Script,
				Type: hostPathType,
			},
		},
	}
	workdirVolume := utils.GetMountPathVolume(uid, gid, j.GetWorkDir(), "workdir", mountMode)
	volumes := []corev1.Volume{
		workdirVolume,
		{
			Name: "localtime",
			VolumeSource: corev1.VolumeSource{
				HostPath: &corev1.HostPathVolumeSource{
					Path: "/etc/localtime",
				},
			},
		},
		{
			Name: "dshm",
			VolumeSource: corev1.VolumeSource{
				EmptyDir: &corev1.EmptyDirVolumeSource{
					Medium:    "Memory",
					SizeLimit: resource.NewQuantity(int64(*in.MemoryMb)*1024*1024/2, resource.BinarySI),
				},
			},
		},
	}
	if j.HasScript() { // 传了脚本路径需要挂载到容器里面
		volumeMounts = append(volumeMounts, volumeMount)
		volumes = append(volumes, volume)
	}

	// model
	if in.ExtraOptions[1] != "" {
		model, err := utils.ParseMountModel(in.ExtraOptions[1])
		if err != nil {
			logrus.Errorf("[setInferenceMountPoints] parse model failed: %s", err)
			return nil, nil, err
		}
		for i, m := range model {
			name := "model" + strconv.Itoa(i)
			volumes = append(volumes, utils.GetMountPathVolume(uid, gid, m.Path, name, mountMode))
			volumeMounts = append(volumeMounts, corev1.VolumeMount{
				MountPath: m.Target,
				Name:      name,
				ReadOnly:  m.IsPublic,
			})
		}
	}
	suffix := 1
	logrus.Tracef("[setInferenceMountPoints] mountsPoint: %v", mountPoints)
	if len(mountPoints) != 0 {
		for flag, path := range mountPoints {
			logrus.Tracef("[setInferenceMountPoints]path string: %s", strings.Join(path, ""))
			var data []utils.PathMap
			err := json.Unmarshal([]byte(strings.Join(path, "")), &data)
			if err != nil {
				for index, value := range path {
					logrus.Tracef("[SetMountPoints] value: %s, err: %s", value, err)
					volumes = append(volumes, corev1.Volume{
						Name: "extramount" + strconv.Itoa(suffix) + strconv.Itoa(index),
						VolumeSource: corev1.VolumeSource{
							HostPath: &corev1.HostPathVolumeSource{
								Path: value,
							},
						},
					})
					volumeMounts = append(volumeMounts, corev1.VolumeMount{
						MountPath: value,
						Name:      "extramount" + strconv.Itoa(suffix) + strconv.Itoa(index),
						ReadOnly:  flag,
					})
				}
			} else {
				logrus.Tracef("[setInferenceMountPoints] data: %s", data)
				for index, v := range data {
					name := "extramount" + strconv.Itoa(suffix) + strconv.Itoa(index)
					volumes = append(volumes, utils.GetMountPathVolume(uid, gid, v.Path, name, mountMode))
					volumeMounts = append(volumeMounts, corev1.VolumeMount{
						MountPath: v.Target,
						Name:      name,
						ReadOnly:  flag,
					})
				}
			}
			suffix++
		}
	}
	return volumes, volumeMounts, nil
}

func (j *InferenceJob) SetInferenceLabels() map[string]string {
	labels := map[string]string{
		"type":                inferenceTypeLabelValue,
		"app":                 j.GetJobName(),
		utils.JobNameLabelKey: j.GetJobName(),
	}

	if utils.AcceleratorIsAscend(j.GetAccelerator()) {
		labels["ring-controller.atlas"] = "ascend-910"
	}

	return labels
}

func (j *InferenceJob) CreateSingleInferenceService(nodePort, podPort int) (bool, error) {
	return createInferenceNodePortService(
		j.GetJobName(),
		nodePort,
		podPort,
		j.GetNamespace(),
		j.GetClientSet(),
		map[string]string{
			"app":  j.GetJobName(),
			"type": inferenceTypeLabelValue,
		},
	)
}

func createInferenceNodePortService(
	serviceName string,
	nodePort,
	podPort int,
	namespace string,
	cli k8sclient.Interface,
	selector map[string]string,
) (bool, error) {
	service := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:        serviceName,
			Annotations: inferenceMetricsAnnotations(podPort),
		},
		Spec: corev1.ServiceSpec{
			Type: corev1.ServiceTypeNodePort,
			Ports: []corev1.ServicePort{
				{
					Port:       int32(podPort),
					TargetPort: intstr.FromInt(podPort),
					NodePort:   int32(nodePort),
				},
			},
			Selector: selector,
		},
	}

	_, err := cli.CoreV1().Services(namespace).Create(context.Background(), service, metav1.CreateOptions{})
	if err != nil {
		logrus.Errorf("create service failed, service name: %v, error: %v", serviceName, err)
		return false, err
	}
	return true, nil
}

func (j *InferenceJob) CreateAscendInferenceConfigmap() (bool, error) {
	cmName := fmt.Sprintf("rings-config-%s", j.GetJobName())
	configmap := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name: cmName,
			Labels: map[string]string{
				"ring-controller.atlas": "ascend-910",
			},
		},
		Data: map[string]string{
			"hccl.json": `{"status":"initializing"}`,
		},
	}
	_, err := j.GetClientSet().CoreV1().ConfigMaps(j.GetNamespace()).Create(context.Background(), configmap, metav1.CreateOptions{})
	if err != nil {
		logrus.Errorf("create inference configmap failed, configmap name: %v, error: %v", j.GetJobName(), err)
		return false, err
	}
	return true, nil
}

func (j *InferenceJob) CreateSecret() (bool, error) {
	in := j.GetSubmitRequest()
	if !j.IsPrivateImageRegistry() {
		logrus.Tracef("private image registry credentials is incomplete")
		return false, nil
	}
	if len(in.ExtraOptions[0]) == 0 {
		return false, fmt.Errorf("image address is null")
	}
	registry := strings.Split(in.ExtraOptions[0], ":")[0]
	err := utils.CreateImageRegistrySecretWithClient(
		j.GetNamespace(),
		j.GetJobName(),
		registry,
		in.PrivateImageRepositoryCredentials.UserName,
		in.PrivateImageRepositoryCredentials.Password,
		j.GetClientSet(),
	)
	if err != nil {
		return false, err
	}
	return true, nil
}

func (j *InferenceJob) DeleteSecret() error {
	err := utils.DeleteImageRegistrySecretWithClient(j.GetNamespace(), j.GetJobName(), j.GetClientSet())
	if err != nil {
		resourcecleanup.RecordFailure(resourcecleanup.ResourceKindSecret, j.GetNamespace(), j.GetJobName(), err)
	}
	return err
}

func (j *InferenceJob) cleanupCreatedResources(createdConfigmap, createdService, createdSecret bool) {
	if createdService {
		if err := deleteInferenceServices(j.GetJobName(), j.GetNamespace(), j.GetClientSet()); err != nil {
			logrus.Errorf("cleanup inference services failed, job: %v, error: %v", j.GetJobName(), err)
		}
	}
	if createdSecret {
		if err := j.DeleteSecret(); err != nil {
			logrus.Errorf("cleanup inference image pull secret failed, job: %v, error: %v", j.GetJobName(), err)
		}
	}
	if createdConfigmap {
		cmName := fmt.Sprintf("rings-config-%s", j.GetJobName())
		if err := utils.DeleteConfigmap(cmName, j.GetNamespace(), j.GetClientSet()); err != nil {
			resourcecleanup.RecordFailure(resourcecleanup.ResourceKindConfigMap, j.GetNamespace(), cmName, err)
			logrus.Errorf("cleanup inference configmap failed, job: %v, error: %v", j.GetJobName(), err)
		}
	}
}

func (j *InferenceJob) IsPrivateImageRegistry() bool {
	c := j.GetSubmitRequest().PrivateImageRepositoryCredentials
	return c != nil && c.UserName != "" && c.Password != ""
}

func (j *InferenceJob) SaveJobInfo(jobInfo interface{}) {
	utils.SaveJobInfoToFile(jobInfo, j.GetJobName())
}

func (j *InferenceJob) GetSubmitRequest() *pb.SubmitInferJobRequest {
	return j.in
}

func (j *InferenceJob) GetClientSet() k8sclient.Interface {
	return j.cli
}

func (j *InferenceJob) SetVolcanoClient(volcanoCli volcanoclientset.Interface) {
	j.volcanoCli = volcanoCli
}

func (j *InferenceJob) GetVolcanoClient() volcanoclientset.Interface {
	return j.volcanoCli
}

func (j *InferenceJob) GetJobName() string {
	return j.jobName
}

func (j *InferenceJob) GetImage() string {
	return j.in.ExtraOptions[0]
}

func (j *InferenceJob) GetWorkDir() string {
	return j.workDir
}

func (j *InferenceJob) GetVolumes() []corev1.Volume {
	return j.volumes
}

func (j *InferenceJob) SetVolumes(volumes []corev1.Volume) {
	j.volumes = volumes
}

func (j *InferenceJob) GetVolumeMounts() []corev1.VolumeMount {
	return j.volumeMounts
}

func (j *InferenceJob) SetVolumeMounts(volumeMounts []corev1.VolumeMount) {
	j.volumeMounts = volumeMounts
}

func (j *InferenceJob) GetResources() corev1.ResourceRequirements {
	return j.resources
}

func (j *InferenceJob) GetEnv() []corev1.EnvVar {
	return j.env
}

func (j *InferenceJob) GetLabels() map[string]string {
	return j.labels
}

func (j *InferenceJob) GetSecurityContext() corev1.SecurityContext {
	return j.securityContext
}

func (j *InferenceJob) GetSecurityContextPtr() *corev1.SecurityContext {
	return &j.securityContext
}

func (j *InferenceJob) GetAnnotations() map[string]string {
	return j.annotations
}

func (j *InferenceJob) GetNodeSelectorKey() string {
	return j.nodeSelectorKey
}

func (j *InferenceJob) GetNodeSelector() map[string]string {
	return map[string]string{
		j.nodeSelectorKey: "true",
	}
}

func (j *InferenceJob) GetNamespace() string {
	return j.in.Partition
}

func (j *InferenceJob) GetAccelerator() string {
	return j.in.ExtraOptions[3]
}

func (j *InferenceJob) GetReplicas() int32 {
	return int32(j.in.GetNodeCount())
}

func (j *InferenceJob) IsDistributed() bool {
	return j.in.GetNodeCount() > 1
}

func (j *InferenceJob) GetPort() int32 {
	return int32(j.in.GetContainerServicePort())
}

func (j *InferenceJob) GetPriorityClass() string {
	return j.in.GetQos()
}

func (j *InferenceJob) HasScript() bool {
	return len(j.in.Script) > 0
}

func (j *InferenceJob) GetPodAnnotations() map[string]string {
	annotations := copyStringMap(j.annotations)
	if annotations == nil {
		annotations = map[string]string{}
	}
	annotations[scheduling.QueueNameAnnotationKey] = j.GetNamespace()
	return annotations
}
