package train

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc/codes"
	appv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	scheduling "volcano.sh/apis/pkg/apis/scheduling/v1beta1"

	"scow-adapters/pkg/ai/client"
	"scow-adapters/pkg/ai/config"
	"scow-adapters/pkg/ai/db/models"
	"scow-adapters/pkg/ai/utils"
	ce "scow-adapters/pkg/common/error"
)

var (
	TensorBoardPort       = int32(6006)
	TensorBoardLogsVolume = "training-logs-volume"
)

func (vj *VCJob) GetTensorboardName() string {
	return fmt.Sprintf("%s-%s", utils.TensorBoard, vj.GetJobName())
}

func (vj *VCJob) GetTensorboardResource() (res corev1.ResourceRequirements) {
	res = corev1.ResourceRequirements{
		Requests: corev1.ResourceList{
			corev1.ResourceCPU:    resource.MustParse("0"),
			corev1.ResourceMemory: resource.MustParse("0Mi"),
		},
		//Limits: corev1.ResourceList{
		//	corev1.ResourceCPU:    resource.MustParse("1"),
		//	corev1.ResourceMemory: resource.MustParse("2048Mi"),
		//},
	}
	return res
}

func (vj *VCJob) CreatePodGroup() error {
	return utils.CreatePodGroup(vj.GetTensorboardName(), vj.Namespace, 1, vj.GetTensorboardResource())
}

func (vj *VCJob) CreateTensorboardService() (err error) {
	svcName := vj.GetTensorboardName()
	// 生成节点端口
	nodePort, err := utils.GenerateNodePort(vj.K8sClient)
	if err != nil {
		logrus.Errorf("GenerateNodePort failed %v", err)
		return ce.RichError(codes.Internal, "GENERATE_NODEPORT_FAILED", err.Error())
	}
	service := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name: svcName,
		},
		Spec: corev1.ServiceSpec{
			Type: corev1.ServiceTypeNodePort,
			Ports: []corev1.ServicePort{
				{
					Port:       int32(nodePort),
					TargetPort: intstr.FromInt32(TensorBoardPort),
					NodePort:   int32(nodePort),
				},
			},
			Selector: map[string]string{
				utils.TensorBoard: vj.GetJobName(),
			},
		},
	}
	_, err = vj.K8sClient.CoreV1().Services(vj.GetNamespace()).Create(context.Background(), service, metav1.CreateOptions{})
	if err != nil {
		logrus.Errorf("create service failed, service name: %v, error: %v", svcName, err)
		return err
	}
	vj.SetNodePort(nodePort)
	logrus.Infof("create service success, service name: %v", svcName)
	return nil
}

func (vj *VCJob) CreateTensorboard() (err error) {
	var (
		command []string
	)
	name := vj.GetTensorboardName()
	if err := vj.CreatePodGroup(); err != nil {
		return err
	}
	if err := vj.CreateTensorboardService(); err != nil {
		return err
	}
	hostname, err := utils.GetClusterMasterNodeHostname()
	if err != nil {
		logrus.Errorf("Get hostname failed %v", err)
		return ce.RichError(codes.Internal, "GET_HOSTNAME_FAILED", err.Error())
	}
	labels := map[string]string{
		utils.TensorBoard: vj.GetJobName(),
	}
	command = append(command,
		"tensorboard",
		"--logdir", "/output/training_logs",
		"--host", "0.0.0.0",
		"--path_prefix", vj.GetTensorboardPathPrefix(hostname, vj.GetNodePort()),
	)
	logrus.Infof("tensorboard %s, command: %s", name, command)
	deployment := &appv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Labels:    labels,
			Namespace: vj.Namespace,
		},
		Spec: appv1.DeploymentSpec{
			Selector: &metav1.LabelSelector{
				MatchLabels: labels,
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: labels,
					Annotations: map[string]string{
						scheduling.KubeGroupNameAnnotationKey: name,
					},
				},
				Spec: corev1.PodSpec{
					SchedulerName: "volcano",
					Volumes: []corev1.Volume{
						{
							Name: TensorBoardLogsVolume,
							VolumeSource: corev1.VolumeSource{
								HostPath: &corev1.HostPathVolumeSource{
									Path: vj.TensorboardLog,
								},
							},
						},
					},
					Containers: []corev1.Container{
						{
							Name:            utils.TensorBoard,
							Image:           config.Value.TensorboardImage,
							ImagePullPolicy: corev1.PullIfNotPresent,
							Ports: []corev1.ContainerPort{
								{
									Name:          "http",
									Protocol:      corev1.ProtocolTCP,
									ContainerPort: TensorBoardPort,
								},
							},
							Command:   command,
							Resources: vj.GetTensorboardResource(),
							VolumeMounts: []corev1.VolumeMount{
								{
									Name:      TensorBoardLogsVolume,
									MountPath: "/output/training_logs",
								},
							},
						},
					},
				},
			},
		},
	}
	_, err = vj.K8sClient.AppsV1().Deployments(vj.GetNamespace()).Create(context.TODO(), deployment, metav1.CreateOptions{})
	if err != nil {
		logrus.Errorf("create tensorboard deploy %s failed due to %s", vj.GetJobName(), err)
		return err
	}
	_ = SetTensorboardNodePortToDB(vj.JobName, vj.GetNodePort()) // port 写库
	logrus.Infof("create tensorboard deploy %s successfully", vj.GetJobName())
	return nil
}

func (vj *VCJob) GetTensorboardPathPrefix(host string, port int) string {
	pathPrefix := ""
	if vj.In != nil {
		pathPrefix = vj.In.GetTensorboardProxyPathPrefix()
	}
	if pathPrefix == "" {
		logrus.Errorf("tensorboard path prefix is empty, please check the job %s input", vj.GetJobName())
	}
	if pathPrefix != "" && !strings.HasSuffix(pathPrefix, "/") {
		pathPrefix += "/"
	}
	return fmt.Sprintf("%s%s/%d/", pathPrefix, host, port)
}

func (vj *VCJob) DeleteTensorboard() {
	name := vj.GetTensorboardName()
	wg := sync.WaitGroup{}
	wg.Add(2)
	go func() {
		defer wg.Done()
		_ = utils.DeletePodGroup(name, vj.GetNamespace())
	}()
	go func() {
		defer wg.Done()
		_ = vj.K8sClient.CoreV1().Services(vj.GetNamespace()).Delete(context.TODO(), name, metav1.DeleteOptions{})
	}()
	err := vj.K8sClient.AppsV1().Deployments(vj.GetNamespace()).Delete(context.TODO(), name, metav1.DeleteOptions{})
	wg.Wait()
	if err != nil {
		logrus.Errorf("delete tensorboard deploy %s failed due to %s", name, err)
		return
	}
	return
}

func SetTensorboardNodePortToDB(name string, port int) (err error) {
	err = client.DB.Model(&models.JobTable{}).Where("new_job_name = ?", name).Updates(
		map[string]interface{}{
			"tensorboard_port": port,
		}).Error
	if err != nil {
		logrus.Errorf("update job %s tensorboard port failed due to %s", name, err)
		return err
	}
	logrus.Infof("update job %s tensorboard port successfully", name)
	return nil
}
