package utils

import (
	"encoding/json"
	"testing"
)

func TestSubmitJobInfoJupyterLabProxyPortJSONCompatibility(t *testing.T) {
	var oldJobInfo SubmitJobInfo
	if err := json.Unmarshal([]byte(`{"new_job_name":"old-devhost","job_id":1,"container_ports":[20003]}`), &oldJobInfo); err != nil {
		t.Fatalf("unmarshal old job info: %v", err)
	}
	if oldJobInfo.JupyterLabProxyPort != 0 {
		t.Fatalf("old job info proxy port should default to 0, got %d", oldJobInfo.JupyterLabProxyPort)
	}

	data, err := json.Marshal(&SubmitJobInfo{JobName: "new-devhost", JobId: 2, JupyterLabProxyPort: 30001})
	if err != nil {
		t.Fatalf("marshal new job info: %v", err)
	}
	var newJobInfo SubmitJobInfo
	if err := json.Unmarshal(data, &newJobInfo); err != nil {
		t.Fatalf("unmarshal new job info: %v", err)
	}
	if newJobInfo.JupyterLabProxyPort != 30001 {
		t.Fatalf("expected proxy port 30001, got %d", newJobInfo.JupyterLabProxyPort)
	}
}
