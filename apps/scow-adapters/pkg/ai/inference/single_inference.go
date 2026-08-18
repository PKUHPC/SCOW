package inference

import (
	"context"
	"fmt"

	"github.com/sirupsen/logrus"
	appv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"scow-adapters/pkg/ai/resourcecleanup"
	"scow-adapters/pkg/ai/utils"
)

type SingleInference struct {
	job *InferenceJob
}

func NewSingleInference(job *InferenceJob) *SingleInference {
	return &SingleInference{job: job}
}

func (si *SingleInference) Create() (bool, error) {
	job := si.job
	var (
		createdConfigmap  bool
		createdService    bool
		createdSecret     bool
		createdDeployment bool
	)
	defer func() {
		if createdDeployment {
			return
		}
		job.cleanupCreatedResources(createdConfigmap, createdService, createdSecret)
	}()

	container := corev1.Container{
		Name:            job.GetJobName(),
		Image:           job.GetImage(),
		ImagePullPolicy: corev1.PullIfNotPresent,
		Ports: []corev1.ContainerPort{
			{
				Name:          "http",
				Protocol:      corev1.ProtocolTCP,
				ContainerPort: job.GetPort(),
			},
		},
		Env:             job.GetEnv(),
		Resources:       job.GetResources(),
		WorkingDir:      job.GetWorkDir(),
		VolumeMounts:    job.GetVolumeMounts(),
		SecurityContext: job.GetSecurityContextPtr(),
	}
	if job.HasScript() {
		container.Command = []string{"sh", "-c"}
		container.Args = []string{"chmod +x /opt/entry.sh && /opt/entry.sh"}
	}

	deployment := &appv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:   job.GetJobName(),
			Labels: job.GetLabels(),
		},
		Spec: appv1.DeploymentSpec{
			Replicas: func() *int32 {
				replicas := job.GetReplicas()
				return &replicas
			}(),
			Selector: &metav1.LabelSelector{
				MatchLabels: job.GetLabels(),
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels:      job.GetLabels(),
					Annotations: job.GetPodAnnotations(),
				},
				Spec: corev1.PodSpec{
					SchedulerName:     utils.Volcano,
					PriorityClassName: job.GetPriorityClass(),
					NodeSelector:      job.GetNodeSelector(),
					Containers: []corev1.Container{
						container,
					},
					Volumes: job.GetVolumes(),
				},
			},
		},
	}

	if utils.AcceleratorIsAscend(job.GetAccelerator()) {
		_, err := job.CreateAscendInferenceConfigmap()
		if err != nil {
			logrus.Errorf("create inference configmap failed, job: %v, error: %v", job.GetJobName(), err)
			return false, err
		}
		createdConfigmap = true
	}

	nodePort, err := utils.GenerateNodePort(job.GetClientSet())
	if err != nil {
		logrus.Errorf("generate node port failed, job: %v, error: %v", job.GetJobName(), err)
		return false, err
	}
	_, err = job.CreateSingleInferenceService(nodePort, int(job.GetPort()))
	if err != nil {
		logrus.Errorf("create inference service failed, service name: %v, error: %v", job.GetJobName(), err)
		return false, err
	}
	createdService = true

	// create image pull secret if the image is from a private registry
	createdSecret, err = job.CreateSecret()
	if err != nil {
		logrus.Errorf("create secret failed, job: %v, error: %v", job.GetJobName(), err)
		return false, err
	}
	if createdSecret {
		deployment.Spec.Template.Spec.ImagePullSecrets = []corev1.LocalObjectReference{{Name: job.GetJobName()}}
	}

	// save job info to yaml file for future reference
	go job.SaveJobInfo(deployment)

	// create deployment
	_, err = job.GetClientSet().AppsV1().Deployments(job.GetNamespace()).Create(context.TODO(), deployment, metav1.CreateOptions{})
	if err != nil {
		logrus.Errorf("create inference job failed, job: %v, error: %v", job.GetJobName(), err)
		return false, err
	}
	createdDeployment = true

	return true, nil
}

func (si *SingleInference) Delete() error {
	job := si.job
	err := job.GetClientSet().AppsV1().Deployments(job.GetNamespace()).Delete(
		context.TODO(),
		job.GetJobName(),
		metav1.DeleteOptions{},
	)
	if err != nil && !apierrors.IsNotFound(err) {
		resourcecleanup.RecordFailure(resourcecleanup.ResourceKindDeployment, job.GetNamespace(), job.GetJobName(), err)
		logrus.Errorf("delete inference deployment failed, job name: %v, error: %v", job.GetJobName(), err)
		return fmt.Errorf("delete deployment: %w", err)
	}

	if err = deleteInferenceServices(job.GetJobName(), job.GetNamespace(), job.GetClientSet()); err != nil {
		logrus.Errorf("delete inference services failed, job name: %v, error: %v", job.GetJobName(), err)
	}

	if err = job.DeleteSecret(); err != nil {
		logrus.Errorf("delete inference image pull secret failed, job name: %v, error: %v", job.GetJobName(), err)
	}

	if utils.AcceleratorIsAscend(job.GetAccelerator()) {
		cmName := "rings-config-" + job.GetJobName()
		if err = utils.DeleteConfigmap(cmName, job.GetNamespace(), job.GetClientSet()); err != nil {
			resourcecleanup.RecordFailure(resourcecleanup.ResourceKindConfigMap, job.GetNamespace(), cmName, err)
			logrus.Errorf("delete inference configmap failed, job name: %v, error: %v", job.GetJobName(), err)
		}
	}
	return nil
}
