package train

import (
	"fmt"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func (vj *VCJob) GetAscendConfigmap() (configmap *corev1.ConfigMap) {
	configmap = &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name: fmt.Sprintf("rings-config-%s", vj.GetJobName()),
			Labels: map[string]string{
				"ring-controller.atlas": "ascend-910",
			},
		},
		Data: map[string]string{
			"hccl.json": `{"status":"initializing"}`,
		},
	}
	return configmap
}
