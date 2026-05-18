package train

import (
	"fmt"
	"strconv"

	"github.com/sirupsen/logrus"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func (vj *VCJob) GetDevHostUnstructured() (volcanoJob *unstructured.Unstructured) {
	resources := vj.GetResource(true)
	//nodeCount := vj.In.NodeCount
	nodeCount := int64(1)
	var (
		command            []interface{}
		GracePeriodSeconds int64
	)
	GracePeriodSeconds = 30
	command = []interface{}{"/opt/entry.sh"}
	logrus.Tracef("[devHost] JupyterLabInfo: %v, VsCodeInfo: %v", vj.JupyterLabInfo, vj.VsCodeInfo)
	if vj.JupyterLabInfo.ProxyPath != "" && vj.VsCodeInfo.BinPath == "" {
		strAppPort := strconv.Itoa(vj.GetDevHostPort(jupyterlab))
		command = []interface{}{
			"/opt/entry.sh",
			"--mode=jupyterlab",
			fmt.Sprintf("--host=%s", vj.GetHostName()),
			fmt.Sprintf("--jupyter-port=%s", strAppPort),
			fmt.Sprintf("--jupyter-svcport=%s", strconv.Itoa(vj.JupyterLabInfo.Port)),
			fmt.Sprintf("--jupyter-proxy=%s", vj.JupyterLabInfo.ProxyPath),
		}
	} else if vj.JupyterLabInfo.ProxyPath == "" && vj.VsCodeInfo.BinPath != "" {
		strAppPort := strconv.Itoa(vj.GetDevHostPort(vscode))
		command = []interface{}{
			"/opt/entry.sh",
			"--mode=vscode",
			fmt.Sprintf("--host=%s", vj.GetHostName()),
			fmt.Sprintf("--vscode-port=%s", strAppPort),
			fmt.Sprintf("--vscode-svcport=%s", strconv.Itoa(vj.VsCodeInfo.Port)),
			fmt.Sprintf("--vscode-bin=%s", vj.VsCodeInfo.BinPath),
		}
	} else if vj.JupyterLabInfo.ProxyPath != "" && vj.VsCodeInfo.BinPath != "" {
		jupyterStartAppPort := strconv.Itoa(vj.GetDevHostPort(jupyterlab))
		vscodeStartAppPort := strconv.Itoa(vj.GetDevHostPort(vscode))
		command = []interface{}{
			"/opt/entry.sh",
			"--mode=both",
			fmt.Sprintf("--host=%s", vj.GetHostName()),
			fmt.Sprintf("--jupyter-port=%s", jupyterStartAppPort),
			fmt.Sprintf("--jupyter-svcport=%s", strconv.Itoa(vj.JupyterLabInfo.Port)),
			fmt.Sprintf("--jupyter-proxy=%s", vj.JupyterLabInfo.ProxyPath),
			fmt.Sprintf("--vscode-port=%s", vscodeStartAppPort),
			fmt.Sprintf("--vscode-svcport=%s", strconv.Itoa(vj.VsCodeInfo.Port)),
			fmt.Sprintf("--vscode-bin=%s", vj.VsCodeInfo.BinPath),
		}
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
