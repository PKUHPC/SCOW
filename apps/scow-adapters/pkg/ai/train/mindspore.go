package train

import (
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func (vj *VCJob) GetMindSporeUnstructured() (volcanoJob *unstructured.Unstructured) {
	resources := vj.GetResource(true)
	nodeCount := vj.In.NodeCount
	var (
		GracePeriodSeconds int64
	)
	GracePeriodSeconds = 30
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
		"restartPolicy":                 "Never",
		"dnsPolicy":                     vj.DnsPolicy,
		"dnsConfig":                     vj.DnsConfig,
		"terminationGracePeriodSeconds": GracePeriodSeconds,
	}
	if vj.IsPrivateImageRegistry() {
		templateSpec["imagePullSecrets"] = []interface{}{
			map[string]interface{}{
				"name": vj.JobName,
			},
		}
	}
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
				},
				"policies": []interface{}{
					map[string]interface{}{
						"event":  "TaskCompleted",
						"action": "CompleteJob",
					},
				},
				"tasks": []interface{}{
					map[string]interface{}{
						"replicas": nodeCount,
						"name":     Worker,
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
	return volcanoJob
}
