package utils

import (
	"path/filepath"
	"testing"
)

func TestDeleteByJobIdAndPortKeepsOtherApplicationProxy(t *testing.T) {
	persistence := NewFilePersistence(filepath.Join(t.TempDir(), "proxy.json"))
	if err := persistence.Save(&ProxyMeta{JobName: "devhost", JobId: 1, ContainerPort: VscodePort, ProxyPort: 30001}); err != nil {
		t.Fatalf("save VSCode proxy metadata: %v", err)
	}
	if err := persistence.Save(&ProxyMeta{JobName: "devhost", JobId: 1, ContainerPort: JupyterPort, ProxyPort: 30002}); err != nil {
		t.Fatalf("save JupyterLab proxy metadata: %v", err)
	}

	if err := persistence.DeleteByJobIdAndPort(1, JupyterPort); err != nil {
		t.Fatalf("delete JupyterLab proxy metadata: %v", err)
	}

	metas, err := persistence.LoadAll()
	if err != nil {
		t.Fatalf("load proxy metadata: %v", err)
	}
	if len(metas) != 1 || metas[0].ContainerPort != VscodePort {
		t.Fatalf("expected only VSCode metadata to remain, got %#v", metas)
	}
}
