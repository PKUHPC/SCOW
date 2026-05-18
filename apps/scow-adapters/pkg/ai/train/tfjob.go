package train

import (
	"github.com/sirupsen/logrus"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func (vj *VCJob) GetTensorFlowUnstructured() (volcanoJob *unstructured.Unstructured) {
	var (
		psUnstructured     *unstructured.Unstructured
		workerUnstructured *unstructured.Unstructured
		//chiefUnstructured  *unstructured.Unstructured
		tmpTask []interface{}
	)
	resources := vj.GetResource(true)
	logrus.Infof("resources: %v", resources)
	nodeCount := vj.In.NodeCount
	PsCount := int(*vj.In.PsNodeCount)
	WorkerCount := int(*vj.In.WorkerNodeCount)
	volcanoJob = &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "batch.volcano.sh/v1alpha1",
			"kind":       "Job",
			"metadata": map[string]interface{}{
				"name":      vj.GetJobName(),
				"namespace": vj.GetNamespace(),
				"labels":    vj.GetMetadataLabel(),
			},
			"spec": map[string]interface{}{
				"schedulerName":           "volcano",
				"queue":                   vj.In.Partition,
				"priorityClassName":       vj.GetPriorityClass(),
				"minAvailable":            nodeCount,
				"ttlSecondsAfterFinished": TTL,
				"maxRetry":                MaxRetry,
				"cleanPolicy":             "None",
				"plugins": map[string][]string{
					"env": {},
					"ssh": {},
					"svc": {},
					"tensorflow": {
						"--ps=ps",
						"--worker=worker",
						"--port=2222",
					},
				},
				"policies": []interface{}{
					map[string]interface{}{
						"event":  "TaskCompleted",
						"action": "CompleteJob",
					},
				},
				"tasks": []interface{}{},
			},
		},
	}
	container := map[string]interface{}{
		"image":           vj.In.ExtraOptions[2],
		"imagePullPolicy": "IfNotPresent",
		"name":            vj.GetJobName(),
		"env":             vj.GetEnv(),
		"resources":       resources,
		"workingDir":      vj.GetWorkDir(),
		"volumeMounts":    vj.GetVolumeMountsFinal(),
		"securityContext": vj.SecurityContext,
	}
	if len(vj.In.Script) != 0 {
		container["command"] = []interface{}{"bash", "/opt/entry.sh"}
	}
	templateSpec := map[string]interface{}{
		"securityContext": map[string]interface{}{ // 容器用root来运行
			"runAsUser":    0,
			"runAsNonRoot": false,
			"fsGroup":      0,
		},
		"volumes":      vj.GetVolumesFinal(),
		"nodeSelector": vj.GetNodeSelector(),
		"containers": []interface{}{
			container,
		},
		"restartPolicy": "Never",
		"dnsPolicy":     vj.DnsPolicy,
		"dnsConfig":     vj.DnsConfig,
	}
	if vj.IsPrivateImageRegistry() {
		templateSpec["imagePullSecrets"] = []interface{}{
			map[string]interface{}{
				"name": vj.JobName,
			},
		}
	}
	if PsCount > 0 {
		psUnstructured = &unstructured.Unstructured{
			Object: map[string]interface{}{
				"replicas": PsCount,
				"name":     "ps",
				"policies": []interface{}{
					map[string]interface{}{
						"event":  "TaskCompleted",
						"action": "CompleteJob",
					},
				},
				"template": map[string]interface{}{
					"metadata": map[string]interface{}{
						"labels":      vj.GetTmpLabel(),
						"annotations": vj.Annotations,
					},
					"spec": templateSpec,
				},
			},
		}
		tmpTask = append(volcanoJob.Object["spec"].(map[string]interface{})["tasks"].([]interface{}), psUnstructured)
		volcanoJob.Object["spec"].(map[string]interface{})["tasks"] = tmpTask
	}
	logrus.Infof("ps volcanoJob: %v", volcanoJob)
	if WorkerCount > 0 {
		workerUnstructured = &unstructured.Unstructured{
			Object: map[string]interface{}{
				"replicas": WorkerCount,
				"name":     Worker,
				"policies": []interface{}{
					map[string]interface{}{
						"event":  "TaskCompleted",
						"action": "CompleteJob",
					},
				},
				"template": map[string]interface{}{
					"metadata": map[string]interface{}{
						"labels":      vj.GetTmpLabel(),
						"annotations": vj.Annotations,
					},
					"spec": templateSpec,
				},
			},
		}
		tmpTask = append(volcanoJob.Object["spec"].(map[string]interface{})["tasks"].([]interface{}), workerUnstructured)
		volcanoJob.Object["spec"].(map[string]interface{})["tasks"] = tmpTask
		logrus.Infof("worker volcanoJob: %v", volcanoJob)
	}
	return volcanoJob
}
