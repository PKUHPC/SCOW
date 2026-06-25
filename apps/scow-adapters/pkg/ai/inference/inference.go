package inference

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc/codes"
	appv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	k8sclient "k8s.io/client-go/kubernetes"
	scheduling "volcano.sh/apis/pkg/apis/scheduling/v1beta1"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/utils"
	ce "scow-adapters/pkg/common/error"
)

func SubmitInference(in *pb.SubmitInferJobRequest, jobName, workDir string) (bool, error) {
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

	mountPoints := utils.GetMountPoints(in.ExtraOptions[2], in.ExtraOptions[4])

	var (
		volumesFinal      []corev1.Volume
		volumeMountsFinal []corev1.VolumeMount
		resources         corev1.ResourceRequirements
		err               error
	)
	replicas := int32(in.GetNodeCount())
	if in.ExtraOptions[3] != "" {
		resources = corev1.ResourceRequirements{
			Requests: corev1.ResourceList{
				corev1.ResourceCPU:                      resource.MustParse(strconv.Itoa(int(in.CoreCount))),
				corev1.ResourceMemory:                   resource.MustParse(strconv.Itoa(int(*in.MemoryMb)/int(in.NodeCount)) + "Mi"),
				corev1.ResourceName(in.ExtraOptions[3]): resource.MustParse(strconv.Itoa(int(in.GpuCount))),
			},
			Limits: corev1.ResourceList{
				corev1.ResourceCPU:                      resource.MustParse(strconv.Itoa(int(in.CoreCount))),
				corev1.ResourceMemory:                   resource.MustParse(strconv.Itoa(int(*in.MemoryMb)/int(in.NodeCount)) + "Mi"),
				corev1.ResourceName(in.ExtraOptions[3]): resource.MustParse(strconv.Itoa(int(in.GpuCount))),
			},
		}
	} else { // 没有加速卡，使用cpu资源
		resources = corev1.ResourceRequirements{
			Requests: corev1.ResourceList{
				corev1.ResourceCPU:    resource.MustParse(strconv.Itoa(int(in.CoreCount))),
				corev1.ResourceMemory: resource.MustParse(strconv.Itoa(int(*in.MemoryMb)/int(in.NodeCount)) + "Mi"),
			},
			Limits: corev1.ResourceList{
				corev1.ResourceCPU:    resource.MustParse(strconv.Itoa(int(in.CoreCount))),
				corev1.ResourceMemory: resource.MustParse(strconv.Itoa(int(*in.MemoryMb)/int(in.NodeCount)) + "Mi"),
			},
		}
	}

	resourceName, resourceQuantity, securityContext, annotations := utils.GetRDMAConfig(in.Partition)
	if resourceName != "" {
		err = AddResource(&resources, corev1.ResourceName(resourceName), strconv.Itoa(resourceQuantity))
		if err != nil {
			logrus.Errorf("add %v resource failed: %v", "rdma.scow.ai.pku.edu.cn/hca_cx5", err)
			return false, err
		}
	}

	port := int32(in.ContainerServicePort)
	env := SetInferenceEnv(workDir, in.ExtraOptions[1], port)
	// 增加自定义环境变量
	if in.GetEnvVariables() != nil {
		for _, envMap := range in.GetEnvVariables() {
			env = append(env, corev1.EnvVar{
				Name:  envMap.GetKey(),
				Value: envMap.GetValue(),
			})
		}
	}
	if utils.AcceleratorIsAscend(in.ExtraOptions[3]) {
		env = append(env, addAscendEnv()...)
		volumesFinal, volumeMountsFinal, err = setAscendInferenceMountPoints(mountPoints, workDir, jobName, in)
	} else {
		volumesFinal, volumeMountsFinal, err = setInferenceMountPoints(mountPoints, workDir, in)
	}
	if err != nil {
		return false, err
	}

	labels := setInferenceLabels(jobName, in.ExtraOptions[3])
	labels[utils.Creator] = in.UserId

	nodeSelectorKey := fmt.Sprintf("queue-%s", in.Partition)

	container := corev1.Container{

		Name:            jobName,
		Image:           in.ExtraOptions[0],
		ImagePullPolicy: corev1.PullIfNotPresent,
		Ports: []corev1.ContainerPort{
			{
				Name:          "http",
				Protocol:      corev1.ProtocolTCP,
				ContainerPort: port,
			},
		},
		Env:             env,
		Resources:       resources,
		WorkingDir:      workDir,
		VolumeMounts:    volumeMountsFinal,
		SecurityContext: &securityContext,
	}
	if len(in.Script) > 0 {
		container.Command = []string{"bash", "/opt/entry.sh"}
	}

	deployment := &appv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:   jobName,
			Labels: labels,
		},
		Spec: appv1.DeploymentSpec{
			Replicas: &replicas,
			Selector: &metav1.LabelSelector{
				MatchLabels: labels,
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: labels,
					Annotations: func() map[string]string {
						if annotations == nil {
							annotations = map[string]string{}
						}
						annotations[scheduling.QueueNameAnnotationKey] = in.Partition
						return annotations
					}(),
				},
				Spec: corev1.PodSpec{
					SchedulerName:     utils.Volcano,
					PriorityClassName: in.GetQos(),
					NodeSelector: map[string]string{
						nodeSelectorKey: "true",
					},
					Containers: []corev1.Container{
						container,
					},
					Volumes: volumesFinal,
				},
			},
		},
	}

	cli, err := utils.GetK8sClient()
	if err != nil {
		logrus.Errorf("failed to build k8s client: %v", err)
		return false, fmt.Errorf("failed to build k8s client: %v", err)
	}

	namespace := in.Partition
	exist, err := utils.CheckNameSpace(namespace, cli) // 用用户名作为namespace的名字
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
	if utils.AcceleratorIsAscend(in.ExtraOptions[3]) {
		_, err = submitInferenceConfigmap(jobName, namespace, cli)
	}

	nodePort, _ := utils.GenerateNodePort(cli) // 生成端口
	podPort := in.ContainerServicePort
	_, err = submitInferenceService(jobName, nodePort, int(podPort), namespace, cli) // 6901 是vnc默认的端口
	if err != nil {
		logrus.Errorf("create inference service failed, service name: %v, error: %v", jobName, err)
		return false, err
	}
	go utils.SaveJobInfoToFile(deployment, jobName)
	flag, err := CreateSecret(in)
	if err != nil {
		logrus.Errorf("create secret failed, job: %v, error: %v", jobName, err)
		return false, err
	}
	if flag {
		deployment.Spec.Template.Spec.ImagePullSecrets = []corev1.LocalObjectReference{{Name: jobName}}
	}
	_, err = cli.AppsV1().Deployments(namespace).Create(context.TODO(), deployment, metav1.CreateOptions{})
	if err != nil {
		logrus.Errorf("create inference job failed, job: %v, error: %v", jobName, err)
		return false, err
	}

	return true, nil
}

func SetInferenceEnv(workDir, paths string, port int32) []corev1.EnvVar {
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
			Value: workDir,
		},
		{
			Name:  "PORT",
			Value: strconv.Itoa(int(port)),
		},
	}

	if paths != "" {
		model, err := utils.ParseMountModel(paths)
		if err != nil {
			logrus.Errorf("Failed parse model path: %v", err)
			return env
		}
		if model != nil {
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

func addAscendEnv() []corev1.EnvVar {
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

func setAscendInferenceMountPoints(mountPoints map[bool][]string, workDir, jobName string, in *pb.SubmitInferJobRequest) ([]corev1.Volume, []corev1.VolumeMount, error) {
	uid, gid, mountMode, err := utils.GetCsiInfoFromIdmap(in.UserIdmapInfo)
	if err != nil {
		return nil, nil, err
	}
	volumeMount := corev1.VolumeMount{
		MountPath: "/opt/entry.sh",
		Name:      "script",
	}
	volumeMounts := []corev1.VolumeMount{
		{
			MountPath: "/user/serverid/devindex/config",
			Name:      "ascend-910-config",
		},
		{
			MountPath: workDir,
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
			MountPath: "/usr/local/bin/npu-smi",
			Name:      "npu-smi",
		},
		{
			MountPath: "/etc/localtime",
			Name:      "localtime",
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
	workdirVolume := utils.GetMountPathVolume(uid, gid, workDir, "workdir", mountMode)
	volumes := []corev1.Volume{
		{
			Name: "ascend-910-config",
			VolumeSource: corev1.VolumeSource{
				ConfigMap: &corev1.ConfigMapVolumeSource{
					LocalObjectReference: corev1.LocalObjectReference{
						Name: fmt.Sprintf("rings-config-%s", jobName),
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
	if len(in.Script) > 0 {
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
		if model != nil {
			for i, m := range model {
				name := "model" + strconv.Itoa(i)
				volumes = append(volumes, utils.GetMountPathVolume(uid, gid, m.Path, name, mountMode))
				volumeMounts = append(volumeMounts, corev1.VolumeMount{
					MountPath: m.Path,
					Name:      name,
					ReadOnly:  m.IsPublic,
				})
			}
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

func setInferenceMountPoints(mountPoints map[bool][]string, workDir string, in *pb.SubmitInferJobRequest) ([]corev1.Volume, []corev1.VolumeMount, error) {
	uid, gid, mountMode, err := utils.GetCsiInfoFromIdmap(in.UserIdmapInfo)
	if err != nil {
		return nil, nil, err
	}
	volumeMount := corev1.VolumeMount{
		MountPath: "/opt/entry.sh",
		Name:      "script",
	}
	volumeMounts := []corev1.VolumeMount{

		{
			MountPath: workDir,
			Name:      "workdir",
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
	workdirVolume := utils.GetMountPathVolume(uid, gid, workDir, "workdir", mountMode)
	volumes := []corev1.Volume{
		workdirVolume,
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
	if len(in.Script) > 0 { // 传了脚本路径需要挂载到容器里面
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
		if model != nil {
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

func setInferenceLabels(jobName string, acceleratorType string) map[string]string {
	labels := map[string]string{
		"type":                "inference",
		"app":                 jobName,
		utils.JobNameLabelKey: jobName,
	}

	if utils.AcceleratorIsAscend(acceleratorType) {
		labels["ring-controller.atlas"] = "ascend-910"
	}

	return labels
}

func submitInferenceService(jobName string, nodePort, podPort int, namespace string, cli *k8sclient.Clientset) (bool, error) {
	service := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name: jobName,
		},
		Spec: corev1.ServiceSpec{
			Type: corev1.ServiceTypeNodePort,
			Ports: []corev1.ServicePort{
				{
					Port:       80,
					TargetPort: intstr.FromInt(podPort),
					NodePort:   int32(nodePort),
				},
			},
			Selector: map[string]string{
				"app":  jobName,
				"type": "inference",
			},
		},
	}

	exist, err := utils.CheckNameSpace(namespace, cli) // 用用户名作为namespace的名字
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

	_, err = cli.CoreV1().Services(namespace).Create(context.Background(), service, metav1.CreateOptions{})
	if err != nil {
		logrus.Errorf("create service failed, service name: %v, error: %v", jobName, err)
		return false, err
	}
	return true, nil
}

func submitInferenceConfigmap(jobName, namespace string, cli *k8sclient.Clientset) (bool, error) {
	cmName := fmt.Sprintf("rings-config-%s", jobName)
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
	_, err := cli.CoreV1().ConfigMaps(namespace).Create(context.Background(), configmap, metav1.CreateOptions{})
	if err != nil {
		logrus.Errorf("create inference configmap failed, configmap name: %v, error: %v", jobName, err)
		return false, err
	}
	return true, nil
}

// AddResource 向 ResourceRequirements 中添加资源
func AddResource(resources *corev1.ResourceRequirements, name corev1.ResourceName, quantity string) error {
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

func CreateSecret(in *pb.SubmitInferJobRequest) (bool, error) {
	if in.PrivateImageRepositoryCredentials == nil {
		logrus.Tracef("private image registry credentials is nil")
		return false, nil
	}
	if in.PrivateImageRepositoryCredentials.UserName != "" && in.PrivateImageRepositoryCredentials.Password != "" {
		logrus.Tracef("The username or password for the image registry is missing")
		return false, nil
	}
	if len(in.ExtraOptions[0]) == 0 {
		return false, fmt.Errorf("image address is null")
	}
	registry := strings.Split(in.ExtraOptions[0], ":")[0]
	err := utils.CreateImageRegistrySecret(in.Partition, in.JobName, registry, in.PrivateImageRepositoryCredentials.UserName, in.PrivateImageRepositoryCredentials.Password)
	if err != nil {
		return false, err
	}
	return true, nil
}
