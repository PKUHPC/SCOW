package utils

import (
	"context"

	"github.com/sirupsen/logrus"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	scheduling "volcano.sh/apis/pkg/apis/scheduling/v1beta1"
)

func CreatePodGroup(pgName, queue string, replicas int32, res corev1.ResourceRequirements) error {
	podGroup := &scheduling.PodGroup{
		ObjectMeta: metav1.ObjectMeta{
			Name:      pgName,
			Namespace: queue,
		},
		Spec: scheduling.PodGroupSpec{
			MinMember:    replicas,
			Queue:        queue,
			MinResources: &res.Requests,
		},
	}
	volcanoClientSet, err := GetVolcanoClient()
	if err != nil {
		logrus.Errorf("[CreatePodGroup] get volcano clientSet failed, err:%v", err)
		return err
	}
	if _, err = volcanoClientSet.SchedulingV1beta1().PodGroups(queue).Create(context.TODO(), podGroup, metav1.CreateOptions{}); err != nil {
		logrus.Errorf("[CreatePodGroup] create podGroup %s failed, err:%v", pgName, err)
		return err
	}
	logrus.Infof("[CreatePodGroup] create podGroup %s successfully", pgName)
	return nil
}

func DeletePodGroup(pgName, queue string) error {
	volcanoClientSet, err := GetVolcanoClient()
	if err != nil {
		logrus.Errorf("[DeletePodGroup] get volcano clientSet failed, err:%v", err)
		return err
	}
	if err = volcanoClientSet.SchedulingV1beta1().PodGroups(queue).Delete(context.TODO(), pgName, metav1.DeleteOptions{}); err != nil {
		logrus.Errorf("[DeletePodGroup] delete podGroup %s failed, err:%v", pgName, err)
		return err
	}
	logrus.Infof("[DeletePodGroup] delete podGroup %s successfully", pgName)
	return nil
}
