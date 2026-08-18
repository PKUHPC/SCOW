package utils

import (
	"context"

	"github.com/sirupsen/logrus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"scow-adapters/pkg/ai/client"
	"scow-adapters/pkg/ai/db/models"
	"volcano.sh/apis/pkg/apis/scheduling/v1beta1"
	volcano "volcano.sh/apis/pkg/client/clientset/versioned"
)

func GetQueueList() ([]models.PartitionTable, error) {
	var queues []models.PartitionTable
	if err := client.DB.Find(&queues).Error; err != nil {
		logrus.Errorf("GetQueueList error: %v", err)
		return nil, err
	}
	return queues, nil
}

func GetQueueByName(queueName string) (queue models.PartitionTable, err error) {
	if err := client.DB.Where("name = ?", queueName).First(&queue).Error; err != nil {
		logrus.Errorf("GetQueueByName error: %v", err)
		return queue, err
	}
	return queue, nil
}

func GetVolcanoQueue(client volcano.Interface) (queueList []v1beta1.Queue, err error) {
	queues, err := client.SchedulingV1beta1().Queues().List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		logrus.Errorf("GetVolcanoQueue error: %v", err)
		return queueList, err
	}
	for _, queue := range queues.Items {
		queueList = append(queueList, queue)
	}
	return queueList, nil
}
