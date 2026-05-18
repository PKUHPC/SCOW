package informer

import (
	"github.com/sirupsen/logrus"
	"k8s.io/client-go/informers"
	k8sclient "k8s.io/client-go/kubernetes"
	corev1 "k8s.io/client-go/listers/core/v1"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/util/workqueue"
	volcanoclientset "volcano.sh/apis/pkg/client/clientset/versioned"
	vcjobinformers "volcano.sh/apis/pkg/client/informers/externalversions"
	vcjoblisters "volcano.sh/apis/pkg/client/listers/batch/v1alpha1"
	schedulerv1beat1 "volcano.sh/apis/pkg/client/listers/scheduling/v1beta1"

	"scow-adapters/pkg/ai/timer"
	"scow-adapters/pkg/ai/utils"
)

type K8sInformer struct {
	stopCh      chan struct{}
	clientSet   *k8sclient.Clientset
	VcClientSet *volcanoclientset.Clientset
	corev1.PodLister
	corev1.NodeLister
	vcjobLister     vcjoblisters.JobLister
	NamespaceLister corev1.NamespaceLister
	timer           *timer.Timer
	Queues          schedulerv1beat1.QueueLister
}

type EventHandler struct {
	Obj   interface{} // 资源的 obj
	Funcs string      // 方法类型：Add, Update, Delete
}

func Run(timer *timer.Timer, client *k8sclient.Clientset, volcanoClient *volcanoclientset.Clientset) {
	informer := NewInformer(timer, client, volcanoClient)
	informer.Start()
	defer informer.Stop()
}

func NewInformer(tm *timer.Timer, cs *k8sclient.Clientset, vc *volcanoclientset.Clientset) *K8sInformer {
	stop := make(chan struct{})
	return &K8sInformer{
		stopCh:      stop,
		clientSet:   cs,
		VcClientSet: vc,
		timer:       tm,
	}
}

func (i *K8sInformer) Start() {
	sharedInformerFactory := informers.NewSharedInformerFactory(i.clientSet, 0)
	i.PodLister = sharedInformerFactory.Core().V1().Pods().Lister()
	i.NodeLister = sharedInformerFactory.Core().V1().Nodes().Lister()
	eventQueue := workqueue.NewRateLimitingQueueWithConfig(workqueue.DefaultControllerRateLimiter(), workqueue.RateLimitingQueueConfig{
		Name: "EventQueue",
	})
	podQueue := workqueue.NewRateLimitingQueueWithConfig(workqueue.DefaultControllerRateLimiter(), workqueue.RateLimitingQueueConfig{
		Name: "PodQueue",
	})
	vcjobQueue := workqueue.NewRateLimitingQueueWithConfig(workqueue.DefaultControllerRateLimiter(), workqueue.RateLimitingQueueConfig{
		Name: "VcJobQueue",
	})
	deployQueue := workqueue.NewRateLimitingQueueWithConfig(workqueue.DefaultControllerRateLimiter(), workqueue.RateLimitingQueueConfig{
		Name: "DeployQueue",
	})
	VCQueue := workqueue.NewRateLimitingQueueWithConfig(workqueue.DefaultControllerRateLimiter(), workqueue.RateLimitingQueueConfig{
		Name: "Queue",
	})
	//event
	eventInformer := sharedInformerFactory.Core().V1().Events().Informer()
	eventInformer.AddEventHandler(i.createEventHandler(eventQueue))
	//pod
	podInformer := sharedInformerFactory.Core().V1().Pods().Informer()
	podInformer.AddEventHandler(i.createEventHandler(podQueue))
	// namespace
	i.NamespaceLister = sharedInformerFactory.Core().V1().Namespaces().Lister()

	sharedInformerFactory.Start(i.stopCh)
	sharedInformerFactory.WaitForCacheSync(i.stopCh)

	// vcjob
	vcjobSharedFactory := vcjobinformers.NewSharedInformerFactory(i.VcClientSet, 0)
	i.vcjobLister = vcjobSharedFactory.Batch().V1alpha1().Jobs().Lister()
	vcjobInformer := vcjobSharedFactory.Batch().V1alpha1().Jobs().Informer()
	vcjobInformer.AddEventHandler(i.createEventHandler(vcjobQueue))
	// queues
	i.Queues = vcjobSharedFactory.Scheduling().V1beta1().Queues().Lister()
	queueInformer := vcjobSharedFactory.Scheduling().V1beta1().Queues().Informer()
	queueInformer.AddEventHandler(i.createEventHandler(VCQueue))
	vcjobSharedFactory.Start(i.stopCh)
	vcjobSharedFactory.WaitForCacheSync(i.stopCh)

	//deployments
	deployInformer := sharedInformerFactory.Apps().V1().Deployments().Informer()
	deployInformer.AddEventHandler(i.createEventHandler(deployQueue))

	sharedInformerFactory.Start(i.stopCh)
	sharedInformerFactory.WaitForCacheSync(i.stopCh)

	resourcesMap := map[string]workqueue.RateLimitingInterface{
		utils.Pod:    podQueue,
		utils.Event:  eventQueue,
		utils.VcJob:  vcjobQueue,
		utils.Deploy: deployQueue,
		utils.Queue:  VCQueue,
	}
	for res, queue := range resourcesMap {
		go i.startWorker(queue, res)
	}
	// go i.clusterSync()
	logrus.Infof("Starting Informer")
	select {
	case <-i.stopCh:
		logrus.Info("Terminating Informer")
	}
}

func (i *K8sInformer) Stop() {
	select {
	case i.stopCh <- struct{}{}:
	default:
	}
}

func (i *K8sInformer) createEventHandler(workerQueue workqueue.RateLimitingInterface) cache.ResourceEventHandlerFuncs {
	return cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			workerQueue.Add(EventHandler{Obj: obj, Funcs: utils.Add})
		},
		UpdateFunc: func(_, newObj interface{}) {
			workerQueue.Add(EventHandler{Obj: newObj, Funcs: utils.Update})
		},
		DeleteFunc: func(obj interface{}) {
			workerQueue.Add(EventHandler{Obj: obj, Funcs: utils.Delete})
		},
	}
}

// 启动独立的worker来处理特定资源的事件
func (i *K8sInformer) startWorker(workerQueue workqueue.RateLimitingInterface, resourceType string) {
	for {
		item, shutdown := workerQueue.Get()
		if shutdown {
			break
		}
		event := item.(EventHandler)
		// 处理队列中的事件
		i.processItem(resourceType, event.Funcs, event.Obj)
		workerQueue.Done(item)
	}
}

// 根据资源类型处理不同的资源
func (i *K8sInformer) processItem(resourceType, funcs string, obj interface{}) {
	logrus.Tracef("processItem resourceType:%s, func:%s", resourceType, funcs)
	switch resourceType {
	case utils.Event:
		if funcs == utils.Delete {
			return
		}
		i.handleEventChanged(obj)
	case utils.Pod:
		switch funcs {
		case utils.Add:
			i.handlePodAdd(obj)
		case utils.Update:
			i.handlePodUpdate(obj)
		case utils.Delete:
			i.handlePodDelete(obj)
		}
	case utils.VcJob:
		switch funcs {
		case utils.Add, utils.Update:
			i.handleVcJobUpdate(obj)
		case utils.Delete:
			i.handleVcJobDelete(obj)
		}
	case utils.Deploy:
		switch funcs {
		case utils.Add, utils.Update:
			i.handleDeploymentUpdate(obj)
		case utils.Delete:
			i.handleDeploymentDelete(obj)
		}
	case utils.Queue:
		switch funcs {
		case utils.Add:
			i.handleQueueAdd(obj)
		case utils.Update:
			i.handleQueueUpdate(obj)
		case utils.Delete:
			i.handleQueueDelete(obj)
		}
	default:
		logrus.Errorf("not supported resourceType： %s", resourceType)
	}
}
