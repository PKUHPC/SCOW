package utils

import (
	"context"
	"github.com/sirupsen/logrus"
	apiv1 "k8s.io/api/core/v1"
	schedulingv1 "k8s.io/api/scheduling/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/yaml"
	"strings"
)

var QosList []string

type PriorityClass struct {
	Name             string
	Weight           int32
	PreemptionPolicy apiv1.PreemptionPolicy //是否允许抢占,Never or PreemptLowerPriority
	globalDefault    bool
	description      string
}

type Option func(*PriorityClass)

func NewPriorityClass(options ...Option) (pc *PriorityClass) {
	pc = &PriorityClass{
		globalDefault: false,
	}
	for _, option := range options {
		option(pc)
	}
	return pc
}

func WithName(name string) Option {
	return func(pc *PriorityClass) {
		pc.Name = name
	}
}

func WithWeight(weight int32) Option {
	return func(pc *PriorityClass) {
		pc.Weight = weight
	}
}

func WithPreemptionPolicy(preemptionPolicy apiv1.PreemptionPolicy) Option {
	return func(pc *PriorityClass) {
		pc.PreemptionPolicy = preemptionPolicy
	}
}

func WithDescription(description string) Option {
	return func(pc *PriorityClass) {
		pc.description = description
	}
}

func (pc *PriorityClass) Create() error {
	var exists bool
	k8sClientSet, err := GetK8sClient()
	if err != nil {
		logrus.Errorf("PriorityClass get k8s client failed: %v", err)
		return err
	}
	priorityClass := &schedulingv1.PriorityClass{
		ObjectMeta: metav1.ObjectMeta{
			Name: pc.Name,
		},
		Value:            pc.Weight,
		GlobalDefault:    pc.globalDefault,
		PreemptionPolicy: &pc.PreemptionPolicy,
		Description:      pc.description,
	}
	// 先尝试获取
	current, err := k8sClientSet.SchedulingV1().PriorityClasses().Get(context.TODO(), pc.Name, metav1.GetOptions{})
	if err != nil {
		if !apierrors.IsNotFound(err) {
			logrus.Errorf("Get priority class %s failed: %v", pc.Name, err)
			return err
		}
		logrus.Infof("PriorityClass %s not found, creating...", pc.Name)
	} else {
		// PreemptionPolicy 不支持patch，只能删除重建
		logrus.Infof("current PriorityClass PreemptionPolicy: %s, new PreemptionPolicy: %s", *current.PreemptionPolicy, pc.PreemptionPolicy)
		if current.PreemptionPolicy != nil && *current.PreemptionPolicy == pc.PreemptionPolicy {
			exists = true
		} else {
			if err = k8sClientSet.SchedulingV1().PriorityClasses().Delete(context.TODO(), pc.Name, metav1.DeleteOptions{}); err != nil {
				logrus.Infof("PriorityClass %s delete failed: %v", pc.Name, err)
				return err
			}
			logrus.Infof("PriorityClass %s deleted successfully", pc.Name)
			exists = false
		}
	}
	if !exists {
		// ----------- create -----------
		_, err = k8sClientSet.SchedulingV1().PriorityClasses().
			Create(context.TODO(), priorityClass, metav1.CreateOptions{})
		if err != nil {
			logrus.Errorf("PriorityClass create failed: %v", err)
			return err
		}
		logrus.Infof("PriorityClass %s created", pc.Name)
		return nil
	}
	logrus.Infof("PriorityClass %s already exists, not update", pc.Name)
	return nil
}

func InitPriorityClass() {
	var (
		PriorityClassList []PriorityClass
		preemptionPolicy  apiv1.PreemptionPolicy
	)
	PriorityClassList = append(PriorityClassList, PriorityClass{
		Name:        "high",
		Weight:      600,
		description: "high priority job",
	})
	PriorityClassList = append(PriorityClassList, PriorityClass{
		Name:        "normal",
		Weight:      400,
		description: "normal priority job",
	})
	PriorityClassList = append(PriorityClassList, PriorityClass{
		Name:        "low",
		Weight:      200,
		description: "low priority job",
	})
	preemptionPolicy = apiv1.PreemptNever
	if IsK8sPreemptionEnabled() {
		preemptionPolicy = apiv1.PreemptLowerPriority
	}
	for _, priorityClass := range PriorityClassList {
		QosList = append(QosList, priorityClass.Name)
		PC := NewPriorityClass(
			WithName(priorityClass.Name),
			WithWeight(priorityClass.Weight),
			WithPreemptionPolicy(preemptionPolicy),
			WithDescription(priorityClass.description),
		)
		err := PC.Create()
		if err != nil {
			logrus.Errorf("PriorityClass  %s create failed: %v", priorityClass.Name, err)
			continue
		}
	}
}

func IsK8sPreemptionEnabled() bool {
	type SchedulerConfig struct {
		Actions string `yaml:"actions"`
		Tiers   []struct {
			Plugins []struct {
				Name              string `yaml:"name"`
				EnablePreemptable bool   `yaml:"enablePreemptable"`
			} `yaml:"plugins"`
		} `yaml:"tiers"`
	}
	var (
		volcanoSchedulerConfigmap = "volcano-scheduler-configmap"
		volcanoNamespace          = "volcano-system"
		schedulerConfig           SchedulerConfig
	)
	k8sClientSet, err := GetK8sClient()
	if err != nil {
		logrus.Errorf("[IsK8sPreemptionEnabled] get k8s clientset err: %s", err)
		return false
	}
	cm, err := k8sClientSet.CoreV1().ConfigMaps(volcanoNamespace).Get(context.TODO(), volcanoSchedulerConfigmap, metav1.GetOptions{})
	if err != nil {
		logrus.Errorf("get configmap error: %v", err)
		return false
	}
	rawConf, ok := cm.Data["volcano-scheduler.conf"]
	if !ok {
		logrus.Errorf("volcano-scheduler.conf not found in configmap")
		return false
	}
	if err := yaml.Unmarshal([]byte(rawConf), &schedulerConfig); err != nil {
		logrus.Errorf("yaml unmarshal error: %v", err)
		return false
	}
	logrus.Infof("volcano actions: %v", schedulerConfig.Actions)
	return strings.Contains(schedulerConfig.Actions, "preempt")
}
