package app

import (
	"testing"

	"scow-adapters/pkg/crane-ai/utils"
)

func TestForwardInfoForPort(t *testing.T) {
	vscode := &utils.JobForwardInfo{ContainerPort: utils.VscodePort}
	jupyter := &utils.JobForwardInfo{ContainerPort: utils.JupyterPort}
	forwardInfo := []*utils.JobForwardInfo{vscode, jupyter}

	if got := forwardInfoForPort(forwardInfo, utils.JupyterPort); got != jupyter {
		t.Fatalf("expected JupyterLab forward info, got %#v", got)
	}
	if got := forwardInfoForPort(forwardInfo, 65535); got != nil {
		t.Fatalf("expected nil for an unknown port, got %#v", got)
	}
}
