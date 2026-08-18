package resourcecleanup

import (
	"context"
	"errors"
	"testing"

	"gorm.io/gorm"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	k8sfake "k8s.io/client-go/kubernetes/fake"
	k8stesting "k8s.io/client-go/testing"
	schedulingv1beta1 "volcano.sh/apis/pkg/apis/scheduling/v1beta1"
	volcanofake "volcano.sh/apis/pkg/client/clientset/versioned/fake"

	"scow-adapters/pkg/ai/db/models"
)

type memoryCleanupStore struct {
	records   []models.ResourceCleanup
	findError error
}

func (s *memoryCleanupStore) Find(namespace string, kind ResourceKind, name string) (*models.ResourceCleanup, error) {
	if s.findError != nil {
		return nil, s.findError
	}
	for i := range s.records {
		if s.records[i].Namespace == namespace && s.records[i].ResourceKind == string(kind) && s.records[i].ResourceName == name {
			return &s.records[i], nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func (s *memoryCleanupStore) Create(record *models.ResourceCleanup) error {
	record.ID = uint(len(s.records) + 1)
	s.records = append(s.records, *record)
	return nil
}

func (s *memoryCleanupStore) Reset(record *models.ResourceCleanup, lastError string) error {
	record.Deleted = 0
	record.RetryCount = 0
	record.LastError = lastError
	return nil
}

func (s *memoryCleanupStore) FindUndeleted() ([]models.ResourceCleanup, error) {
	var records []models.ResourceCleanup
	for _, record := range s.records {
		if record.Deleted == 0 {
			records = append(records, record)
		}
	}
	return records, nil
}

func (s *memoryCleanupStore) Delete(record *models.ResourceCleanup) error {
	for i := range s.records {
		if s.records[i].ID == record.ID {
			s.records = append(s.records[:i], s.records[i+1:]...)
			return nil
		}
	}
	return nil
}

func (s *memoryCleanupStore) MarkRetry(record *models.ResourceCleanup, lastError string) error {
	for i := range s.records {
		if s.records[i].ID == record.ID {
			s.records[i].RetryCount++
			s.records[i].LastError = lastError
			return nil
		}
	}
	return nil
}

func TestDeleteResource(t *testing.T) {
	const (
		namespace = "test-namespace"
		name      = "test-resource"
	)

	tests := []struct {
		name       string
		kind       ResourceKind
		object     func() []runtime.Object
		assertGone func(*testing.T, *k8sfake.Clientset)
	}{
		{
			name: "service",
			kind: ResourceKindService,
			object: func() []runtime.Object {
				return []runtime.Object{&corev1.Service{ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: namespace}}}
			},
			assertGone: func(t *testing.T, cli *k8sfake.Clientset) {
				_, err := cli.CoreV1().Services(namespace).Get(context.Background(), name, metav1.GetOptions{})
				if !apierrors.IsNotFound(err) {
					t.Fatalf("service still exists or got unexpected error: %v", err)
				}
			},
		},
		{
			name: "secret",
			kind: ResourceKindSecret,
			object: func() []runtime.Object {
				return []runtime.Object{&corev1.Secret{ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: namespace}}}
			},
			assertGone: func(t *testing.T, cli *k8sfake.Clientset) {
				_, err := cli.CoreV1().Secrets(namespace).Get(context.Background(), name, metav1.GetOptions{})
				if !apierrors.IsNotFound(err) {
					t.Fatalf("secret still exists or got unexpected error: %v", err)
				}
			},
		},
		{
			name: "configmap",
			kind: ResourceKindConfigMap,
			object: func() []runtime.Object {
				return []runtime.Object{&corev1.ConfigMap{ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: namespace}}}
			},
			assertGone: func(t *testing.T, cli *k8sfake.Clientset) {
				_, err := cli.CoreV1().ConfigMaps(namespace).Get(context.Background(), name, metav1.GetOptions{})
				if !apierrors.IsNotFound(err) {
					t.Fatalf("configmap still exists or got unexpected error: %v", err)
				}
			},
		},
		{
			name: "deployment",
			kind: ResourceKindDeployment,
			object: func() []runtime.Object {
				return []runtime.Object{&appsv1.Deployment{ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: namespace}}}
			},
			assertGone: func(t *testing.T, cli *k8sfake.Clientset) {
				_, err := cli.AppsV1().Deployments(namespace).Get(context.Background(), name, metav1.GetOptions{})
				if !apierrors.IsNotFound(err) {
					t.Fatalf("deployment still exists or got unexpected error: %v", err)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			objects := tt.object()
			cli := k8sfake.NewSimpleClientset(objects[0])
			if err := deleteResource(cli, nil, tt.kind, namespace, name); err != nil {
				t.Fatalf("deleteResource failed: %v", err)
			}
			tt.assertGone(t, cli)
			if err := deleteResource(cli, nil, tt.kind, namespace, name); err != nil {
				t.Fatalf("deleteResource should ignore NotFound: %v", err)
			}
		})
	}
}

func TestDeletePodGroup(t *testing.T) {
	const (
		namespace = "test-namespace"
		name      = "test-pod-group"
	)
	volcanoCli := volcanofake.NewSimpleClientset(&schedulingv1beta1.PodGroup{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: namespace},
	})

	if err := deleteResource(nil, volcanoCli, ResourceKindPodGroup, namespace, name); err != nil {
		t.Fatalf("deleteResource failed: %v", err)
	}
	if _, err := volcanoCli.SchedulingV1beta1().PodGroups(namespace).Get(context.Background(), name, metav1.GetOptions{}); !apierrors.IsNotFound(err) {
		t.Fatalf("podGroup still exists or got unexpected error: %v", err)
	}
	if err := deleteResource(nil, volcanoCli, ResourceKindPodGroup, namespace, name); err != nil {
		t.Fatalf("deleteResource should ignore NotFound: %v", err)
	}
}

func TestRecordFailedResource(t *testing.T) {
	store := &memoryCleanupStore{}
	if err := recordFailedResource(store, ResourceKindService, "ns", "svc", errors.New("first")); err != nil {
		t.Fatalf("recordFailedResource failed: %v", err)
	}
	if len(store.records) != 1 {
		t.Fatalf("records count = %d, want 1", len(store.records))
	}

	store.records[0].Deleted = 1
	store.records[0].RetryCount = 3
	if err := recordFailedResource(store, ResourceKindService, "ns", "svc", errors.New("second")); err != nil {
		t.Fatalf("recordFailedResource reset failed: %v", err)
	}
	if len(store.records) != 1 || store.records[0].Deleted != 0 || store.records[0].RetryCount != 0 || store.records[0].LastError != "second" {
		t.Fatalf("record was not reset: %+v", store.records[0])
	}
}

func TestRecordFailedResourceReturnsQueryError(t *testing.T) {
	wantErr := errors.New("query failed")
	store := &memoryCleanupStore{findError: wantErr}
	if err := recordFailedResource(store, ResourceKindSecret, "ns", "secret", errors.New("delete failed")); !errors.Is(err, wantErr) {
		t.Fatalf("recordFailedResource error = %v, want %v", err, wantErr)
	}
	if len(store.records) != 0 {
		t.Fatalf("records count = %d, want 0", len(store.records))
	}
}

func TestRetryUndeletedResourcesUpdatesResults(t *testing.T) {
	store := &memoryCleanupStore{records: []models.ResourceCleanup{
		{ID: 1, Namespace: "ns", ResourceKind: string(ResourceKindService), ResourceName: "success"},
		{ID: 2, Namespace: "ns", ResourceKind: string(ResourceKindService), ResourceName: "failed"},
		{ID: 3, Namespace: "ns", ResourceKind: string(ResourceKindSecret), ResourceName: "already-deleted", Deleted: 1},
		{ID: 4, Namespace: "ns", ResourceKind: string(ResourceKindPodGroup), ResourceName: "success-pod-group"},
	}}
	deleteErr := errors.New("delete failed")
	cli := k8sfake.NewSimpleClientset(&corev1.Service{ObjectMeta: metav1.ObjectMeta{Name: "success", Namespace: "ns"}})
	cli.Fake.PrependReactor("delete", "services", func(action k8stesting.Action) (bool, runtime.Object, error) {
		if action.(k8stesting.DeleteAction).GetName() == "failed" {
			return true, nil, deleteErr
		}
		return false, nil, nil
	})
	volcanoCli := volcanofake.NewSimpleClientset(&schedulingv1beta1.PodGroup{
		ObjectMeta: metav1.ObjectMeta{Name: "success-pod-group", Namespace: "ns"},
	})

	if err := retryUndeletedResources(store, cli, volcanoCli); err != nil {
		t.Fatalf("retryUndeletedResources failed: %v", err)
	}
	if len(store.records) != 2 {
		t.Fatalf("records count = %d, want 2", len(store.records))
	}
	failed, err := store.Find("ns", ResourceKindService, "failed")
	if err != nil {
		t.Fatalf("failed record was removed: %v", err)
	}
	if failed.Deleted != 0 || failed.RetryCount != 1 || failed.LastError != deleteErr.Error() {
		t.Fatalf("failed record was not updated: %+v", failed)
	}
	alreadyDeleted, err := store.Find("ns", ResourceKindSecret, "already-deleted")
	if err != nil {
		t.Fatalf("already deleted record was removed: %v", err)
	}
	if alreadyDeleted.RetryCount != 0 {
		t.Fatalf("already deleted record was retried: %+v", alreadyDeleted)
	}
	if _, err := store.Find("ns", ResourceKindService, "success"); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("successful record was not removed: %v", err)
	}
	if _, err := store.Find("ns", ResourceKindPodGroup, "success-pod-group"); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("successful podGroup record was not removed: %v", err)
	}
	if _, err := volcanoCli.SchedulingV1beta1().PodGroups("ns").Get(context.Background(), "success-pod-group", metav1.GetOptions{}); !apierrors.IsNotFound(err) {
		t.Fatalf("podGroup still exists or got unexpected error: %v", err)
	}
}
