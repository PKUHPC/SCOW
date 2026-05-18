package train

import (
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func (vj *VCJob) GetMPIUnstructured() (volcanoJob *unstructured.Unstructured) {
	resources := vj.GetResource(true)
	nodeCount := vj.In.NodeCount
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
	// 定义单机mpi 的yaml
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
				"cleanPolicy":             "None",
				"ttlSecondsAfterFinished": TTL,
				"maxRetry":                MaxRetry,
				"policies": []interface{}{
					map[string]interface{}{
						"event":  "TaskCompleted",
						"action": "CompleteJob",
					},
				},
				"plugins": map[string][]string{
					"env": {},
					"ssh": {},
					"mpi": {
						"--master=master",
						"--worker=worker",
						"--port=22",
					},
				},
				"tasks": []interface{}{
					map[string]interface{}{
						"replicas": 1,
						"name":     Master,
						"template": map[string]interface{}{
							"metadata": map[string]interface{}{
								"labels":      vj.GetTmpLabel(),
								"annotations": vj.Annotations,
							},
							"spec": templateSpec,
						},
					},
				},
			},
		},
	}
	// 单机 mpi 任务
	if nodeCount == 1 {
		return volcanoJob
	}
	workTemplateSpec := map[string]interface{}{
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
		workTemplateSpec["imagePullSecrets"] = []interface{}{
			map[string]interface{}{
				"name": vj.JobName,
			},
		}
	}
	workTemplateSpec["containers"].([]interface{})[0].(map[string]interface{})["command"] = []interface{}{"bash", "/usr/sbin/sshd -D"}
	workerUnstructured := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"replicas": nodeCount - 1,
			"name":     Worker,
			"template": map[string]interface{}{
				"metadata": map[string]interface{}{
					"labels":      vj.GetTmpLabel(),
					"annotations": vj.Annotations,
				},
				"spec": workTemplateSpec,
			},
		},
	}
	// 多机mpi，需要增加worker节点
	tmpTask := append(volcanoJob.Object["spec"].(map[string]interface{})["tasks"].([]interface{}), workerUnstructured)
	volcanoJob.Object["spec"].(map[string]interface{})["tasks"] = tmpTask

	return volcanoJob
}
