package informer

import (
	"strconv"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
	"k8s.io/apimachinery/pkg/labels"
	"volcano.sh/apis/pkg/apis/scheduling/v1beta1"

	"scow-adapters/pkg/ai/client"
	"scow-adapters/pkg/ai/db/models"
	"scow-adapters/pkg/ai/utils"
)

var (
	QueueMux sync.Mutex
)

func (i *K8sInformer) IsQueue(name string) bool {
	queues, _ := i.Queues.List(labels.Everything())
	if queues == nil {
		return true
	}
	for _, queue := range queues {
		if queue.Name == name {
			return true
		}
	}
	return false
}

func (i *K8sInformer) handleQueueAdd(obj interface{}) {
	logrus.Tracef("queue:%v", obj)
	queue := obj.(*v1beta1.Queue)
	if queue == nil || queue.Name == "default" || queue.Name == "root" {
		return
	}
	name := queue.Name
	resourceCap := utils.GetResource(&queue.Spec.Capability)
	resourceAlloc := utils.GetResource(&queue.Status.Allocated)
	logrus.Infof("queue resource: %v, %v", resourceCap, resourceAlloc)
	memCap, memAlloc := resourceCap.Mem, resourceAlloc.Mem
	modelPartition := &models.PartitionTable{
		Name:        name,
		Created:     queue.CreationTimestamp.Unix(),
		Updated:     time.Now().Unix(),
		Weight:      int64(queue.Spec.Weight),
		State:       string(queue.Status.State),
		Reclaimable: *queue.Spec.Reclaimable,
		CPUCap:      &resourceCap.CPU,
		MemCap:      &memCap,
		GPUCap:      &resourceCap.AcceleratorCount,
		CPUAlloc:    &resourceAlloc.CPU,
		MemAlloc:    &memAlloc,
		GPUAlloc:    &resourceAlloc.AcceleratorCount,
		Type:        resourceCap.Accelerator,
	}
	annoLabels := queue.ObjectMeta.Annotations
	if annoLabels != nil {
		if ad, ok := annoLabels["accelerator_descriptions"]; ok {
			modelPartition.AcceleratorDescriptions = ad
		}
		if gm, ok := annoLabels["gpu_model"]; ok {
			modelPartition.GPUModel = gm
		}
		if vm, ok := annoLabels["vram_mb"]; ok {
			value, _ := strconv.ParseInt(vm, 10, 64)
			modelPartition.VramMb = value
		}
		if cm, ok := annoLabels["cpu_model"]; ok {
			modelPartition.CPUModel = cm
		}
		if ma, ok := annoLabels["max_accelerators_per_pod"]; ok {
			if tmp, err := strconv.Atoi(ma); err == nil {
				modelPartition.MaxAcceleratorsPerPod = uint32(tmp)
			} else {
				modelPartition.MaxAcceleratorsPerPod = utils.DefaultAcceleratorsPerPod
			}
		}
	}
	if err := client.DB.Create(modelPartition).Error; err != nil {
		logrus.Errorf("db save queue %v failed, err:%v", name, err)
		i.handleQueueUpdate(obj)
		return
	}
	logrus.Infof("db save queue %v successful", name)
}

func (i *K8sInformer) handleQueueUpdate(obj interface{}) {
	logrus.Tracef("queue:%v", obj)
	queue := obj.(*v1beta1.Queue)
	if queue == nil || queue.Name == "default" || queue.Name == "root" {
		return
	}
	name := queue.Name
	QueueTable := &models.PartitionTable{}
	// 通过name查找queue信息
	if err := client.DB.Where("name = ? ", name).First(QueueTable).Error; err != nil {
		logrus.Errorf("DB select queue name %s error: %v", name, err)
		return
	}
	resourceCap := utils.GetResource(&queue.Spec.Capability)
	resourceAlloc := utils.GetResource(&queue.Status.Allocated)
	logrus.Infof("queue resource: %v, %v", resourceCap, resourceAlloc)
	memCap, memAlloc := resourceCap.Mem, resourceAlloc.Mem
	modelPartition := models.PartitionTable{
		Weight:      int64(queue.Spec.Weight),
		State:       string(queue.Status.State),
		Reclaimable: *queue.Spec.Reclaimable,
		CPUCap:      &resourceCap.CPU,
		MemCap:      &memCap,
		GPUCap:      &resourceCap.AcceleratorCount,
		CPUAlloc:    &resourceAlloc.CPU,
		MemAlloc:    &memAlloc,
		GPUAlloc:    &resourceAlloc.AcceleratorCount,
		Type:        resourceCap.Accelerator,
		Updated:     time.Now().Unix(),
	}
	annoLabels := queue.ObjectMeta.Annotations
	if annoLabels != nil {
		if ad, ok := annoLabels["accelerator_descriptions"]; ok {
			modelPartition.AcceleratorDescriptions = ad
		}
		if gm, ok := annoLabels["gpu_model"]; ok {
			modelPartition.GPUModel = gm
		}
		if vm, ok := annoLabels["vram_mb"]; ok {
			value, _ := strconv.ParseInt(vm, 10, 64)
			modelPartition.VramMb = value
		}
		if cm, ok := annoLabels["cpu_model"]; ok {
			modelPartition.CPUModel = cm
		}
		if ma, ok := annoLabels["max_accelerators_per_pod"]; ok {
			if tmp, err := strconv.Atoi(ma); err == nil {
				modelPartition.MaxAcceleratorsPerPod = uint32(tmp)
			} else {
				logrus.Errorf("[handleQueueUpdate] err:%s", err)
				modelPartition.MaxAcceleratorsPerPod = utils.DefaultAcceleratorsPerPod
			}
		}
	}
	logrus.Tracef("[handleQueueUpdate] modelPartition: %v", modelPartition)
	if err := client.DB.Model(QueueTable).Updates(modelPartition).Error; err != nil {
		logrus.Errorf("queue name %s DB update failed due to: %s", name, err)
		return
	}
	logrus.Infof(" Update queue %s succeed", name)
	return
}

func (i *K8sInformer) handleQueueDelete(obj interface{}) {
	logrus.Tracef("queue:%v", obj)
	queue := obj.(*v1beta1.Queue)
	if queue == nil || queue.Name == "default" || queue.Name == "root" {
		return
	}
	name := queue.Name
	if err := client.DB.Where("name = ? ", name).Delete(&models.PartitionTable{}).Error; err != nil {
		logrus.Errorf("db delete queue %s error: %v", name, err)
		return
	}
	logrus.Infof("delete queue %s succeed", name)
}
