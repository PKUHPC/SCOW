package resourcecleanup

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/wait"
	k8sclient "k8s.io/client-go/kubernetes"
	volcanoclientset "volcano.sh/apis/pkg/client/clientset/versioned"

	"scow-adapters/pkg/ai/client"
	"scow-adapters/pkg/ai/db/models"
)

type ResourceKind string

type cleanupStore interface {
	Find(namespace string, kind ResourceKind, name string) (*models.ResourceCleanup, error)
	Create(record *models.ResourceCleanup) error
	Reset(record *models.ResourceCleanup, lastError string) error
	FindUndeleted() ([]models.ResourceCleanup, error)
	Delete(record *models.ResourceCleanup) error
	MarkRetry(record *models.ResourceCleanup, lastError string) error
}

type gormCleanupStore struct {
	db *gorm.DB
}

const (
	ResourceKindService    ResourceKind = "Service"
	ResourceKindSecret     ResourceKind = "Secret"
	ResourceKindConfigMap  ResourceKind = "ConfigMap"
	ResourceKindDeployment ResourceKind = "Deployment"
	ResourceKindPodGroup   ResourceKind = "PodGroup"

	RetryInterval = time.Minute * 60
)

func RecordFailure(kind ResourceKind, namespace, name string, deleteErr error) {
	if client.DB == nil {
		logrus.Errorf("save resource cleanup record failed, kind: %s, namespace: %s, name: %s, error: database is not initialized", kind, namespace, name)
		return
	}
	if recordErr := recordFailedResource(&gormCleanupStore{db: client.DB}, kind, namespace, name, deleteErr); recordErr != nil {
		logrus.Errorf("save resource cleanup record failed, kind: %s, namespace: %s, name: %s, error: %v", kind, namespace, name, recordErr)
	}
}

func recordFailedResource(store cleanupStore, kind ResourceKind, namespace, name string, deleteErr error) error {
	existing, err := store.Find(namespace, kind, name)
	if err == nil {
		return store.Reset(existing, deleteErr.Error())
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	// 不存在则记录信息
	record := models.ResourceCleanup{
		Namespace:    namespace,
		ResourceKind: string(kind),
		ResourceName: name,
		Deleted:      0,
		LastError:    deleteErr.Error(),
	}
	return store.Create(&record)
}

func (s *gormCleanupStore) Find(namespace string, kind ResourceKind, name string) (*models.ResourceCleanup, error) {
	var record models.ResourceCleanup
	err := s.db.Where("namespace = ? AND resource_kind = ? AND resource_name = ?", namespace, string(kind), name).
		First(&record).Error
	return &record, err
}

func (s *gormCleanupStore) Create(record *models.ResourceCleanup) error {
	return s.db.Create(record).Error
}

func (s *gormCleanupStore) Reset(record *models.ResourceCleanup, lastError string) error {
	return s.db.Model(record).Updates(map[string]interface{}{
		"deleted":     0,
		"retry_count": 0,
		"last_error":  lastError,
	}).Error
}

func (s *gormCleanupStore) FindUndeleted() ([]models.ResourceCleanup, error) {
	var records []models.ResourceCleanup
	err := s.db.Where("deleted = ?", 0).Order("id ASC").Find(&records).Error
	return records, err
}

func (s *gormCleanupStore) Delete(record *models.ResourceCleanup) error {
	return s.db.Delete(record).Error
}

func (s *gormCleanupStore) MarkRetry(record *models.ResourceCleanup, lastError string) error {
	return s.db.Model(record).Updates(map[string]interface{}{
		"retry_count": gorm.Expr("retry_count + 1"),
		"last_error":  lastError,
	}).Error
}

func deleteResource(
	cli k8sclient.Interface,
	volcanoCli volcanoclientset.Interface,
	kind ResourceKind,
	namespace, name string,
) error {
	var err error
	if kind == ResourceKindPodGroup {
		if volcanoCli == nil {
			return fmt.Errorf("volcano client is nil")
		}
		err = volcanoCli.SchedulingV1beta1().PodGroups(namespace).Delete(context.TODO(), name, metav1.DeleteOptions{})
	} else if cli == nil {
		return fmt.Errorf("k8s client is nil")
	} else {
		switch kind {
		case ResourceKindService:
			zero := int64(0)
			err = cli.CoreV1().Services(namespace).Delete(context.TODO(), name, metav1.DeleteOptions{GracePeriodSeconds: &zero})
		case ResourceKindSecret:
			err = cli.CoreV1().Secrets(namespace).Delete(context.TODO(), name, metav1.DeleteOptions{})
		case ResourceKindConfigMap:
			err = cli.CoreV1().ConfigMaps(namespace).Delete(context.TODO(), name, metav1.DeleteOptions{})
		case ResourceKindDeployment:
			err = cli.AppsV1().Deployments(namespace).Delete(context.TODO(), name, metav1.DeleteOptions{})
		default:
			return fmt.Errorf("unsupported Kubernetes resource kind %q", kind)
		}
	}
	if err == nil || apierrors.IsNotFound(err) {
		logrus.Infof("resource cleanup successful, kind: %s, namespace: %s, name: %s", kind, namespace, name)
		return nil
	}
	logrus.Errorf("resource cleanup failed, kind: %s, namespace: %s, name: %s, error: %v", kind, namespace, name, err)
	return err
}

func RetryUndeletedResources(db *gorm.DB, cli k8sclient.Interface, volcanoCli volcanoclientset.Interface) error {
	if db == nil {
		return fmt.Errorf("database is not initialized")
	}
	return retryUndeletedResources(&gormCleanupStore{db: db}, cli, volcanoCli)
}

func retryUndeletedResources(store cleanupStore, cli k8sclient.Interface, volcanoCli volcanoclientset.Interface) error {
	records, err := store.FindUndeleted()
	if err != nil {
		return err
	}

	for i := range records {
		record := &records[i]
		err := deleteResource(cli, volcanoCli, ResourceKind(record.ResourceKind), record.Namespace, record.ResourceName)
		if err == nil {
			if deleteErr := store.Delete(record); deleteErr != nil {
				logrus.Errorf("delete resource cleanup record failed, id: %d, error: %v", record.ID, deleteErr)
			}
			continue
		}
		logrus.Errorf("retry Kubernetes resource cleanup failed, kind: %s, namespace: %s, name: %s, error: %v", record.ResourceKind, record.Namespace, record.ResourceName, err)
		// 记录删除失败次数和错误信息
		if updateErr := store.MarkRetry(record, err.Error()); updateErr != nil {
			logrus.Errorf("update resource cleanup retry record failed, id: %d, error: %v", record.ID, updateErr)
		}
	}
	return nil
}

func StartCleanupTimer(
	stop <-chan struct{},
	db *gorm.DB,
	cli k8sclient.Interface,
	volcanoCli volcanoclientset.Interface,
	interval time.Duration,
) {
	if interval <= 0 {
		interval = RetryInterval
	}

	wait.Until(func() {
		if err := RetryUndeletedResources(db, cli, volcanoCli); err != nil {
			logrus.Errorf("retry undeleted Kubernetes resources failed: %v", err)
		}
	}, interval, stop)
}
