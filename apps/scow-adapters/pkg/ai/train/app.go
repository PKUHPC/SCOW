package train

import (
	"strconv"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func (vj *VCJob) GetAppUnstructured() (volcanoJob *unstructured.Unstructured) {
	resources := vj.GetResource(true)
	strAppPort := strconv.Itoa(vj.GetPodPort())
	strSvcPort := strconv.Itoa(vj.GetSvcPort())
	command := []interface{}{"bash", "/opt/entry.sh", strAppPort, vj.GetHostName(), strSvcPort}
	templateSpec := map[string]interface{}{
		"securityContext": map[string]interface{}{ // 容器用root来运行
			"runAsUser":    0,
			"runAsNonRoot": false,
			"fsGroup":      0,
		},
		"volumes":      vj.GetVolumesFinal(),
		"nodeSelector": vj.GetNodeSelector(),
		"containers": []interface{}{
			map[string]interface{}{
				"image":           vj.In.ExtraOptions[2],
				"imagePullPolicy": "IfNotPresent",
				"name":            vj.GetJobName(),
				"command":         command,
				"env":             vj.GetEnv(),
				"resources":       resources,
				"workingDir":      vj.GetWorkDir(),
				"volumeMounts":    vj.GetVolumeMountsFinal(),
				"securityContext": vj.SecurityContext,
			},
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
				"minAvailable":            1,
				"ttlSecondsAfterFinished": TTL,
				"maxRetry":                MaxRetry,
				"plugins": map[string][]string{
					"env": {},
				},
				"policies": []interface{}{
					map[string]interface{}{
						"event":  "TaskCompleted",
						"action": "CompleteJob",
					},
				},
				"tasks": []interface{}{
					map[string]interface{}{
						"replicas": 1,
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
