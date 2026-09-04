package builder

import (
	"os"
	"reflect"
	"strconv"
	"testing"

	protos "scow-adapters/gen/go"
	adapters "scow-adapters/pkg/crane-ai/services/job/internal/adapter"
	"scow-adapters/pkg/crane-ai/utils"
)

func TestSetArgsUsesReservedAppProxyPort(t *testing.T) {
	const proxyPort = 30001
	hostname, err := os.Hostname()
	if err != nil {
		t.Fatalf("get hostname: %v", err)
	}
	req := &protos.SubmitJobRequest{
		ExtraOptions: []string{utils.APP, utils.AppTypeWeb},
	}

	args := NewContainerJobBuilder().setArgs(adapters.NewJobAdapterWithAppProxyPort(req, proxyPort))
	want := []string{
		utils.ContainerEntryScript,
		strconv.Itoa(utils.AppWebContainerPort),
		hostname,
		strconv.Itoa(proxyPort),
	}
	if !reflect.DeepEqual(args, want) {
		t.Fatalf("setArgs() = %v, want %v", args, want)
	}
}

func TestSetArgsKeepsVNCAppArgumentsUnchanged(t *testing.T) {
	const unusedProxyPort = 30001
	req := &protos.SubmitJobRequest{
		ExtraOptions: []string{utils.APP, utils.AppTypeVNC},
	}

	args := NewContainerJobBuilder().setArgs(adapters.NewJobAdapterWithAppProxyPort(req, unusedProxyPort))
	want := []string{utils.ContainerEntryScript, strconv.Itoa(utils.AppVNCContainerPort)}
	if !reflect.DeepEqual(args, want) {
		t.Fatalf("setArgs() = %v, want %v", args, want)
	}
}

func TestSetArgsUsesReservedJupyterProxyPort(t *testing.T) {
	const proxyPort = 30001
	for _, tt := range []struct {
		name       string
		vscodeInfo *protos.CreateDevHostRequest_VscodeInfo
		wantMode   string
	}{
		{name: "JupyterLab only", wantMode: "--mode=jupyterlab"},
		{
			name:       "JupyterLab and VSCode",
			vscodeInfo: &protos.CreateDevHostRequest_VscodeInfo{VscodeBinPath: "/opt/code-server/bin/code-server"},
			wantMode:   "--mode=both",
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			req := &protos.CreateDevHostRequest{
				VscodeInfo: tt.vscodeInfo,
				JupyterLabInfo: &protos.CreateDevHostRequest_JupyterLabInfo{
					ProxyBasePath: "/proxy",
				},
			}
			args := NewContainerJobBuilder().setArgs(adapters.NewDevHostJobAdapter(req, proxyPort))
			assertContainsArg(t, args, tt.wantMode)
			assertContainsArg(t, args, "--jupyter-port="+strconv.Itoa(utils.JupyterPort))
			assertContainsArg(t, args, "--jupyter-svcport="+strconv.Itoa(proxyPort))
			assertNotContainsArg(t, args, "--jupyter-svcport="+strconv.Itoa(utils.JupyterPort))
		})
	}
}

func assertContainsArg(t *testing.T, args []string, want string) {
	t.Helper()
	for _, arg := range args {
		if arg == want {
			return
		}
	}
	t.Fatalf("argument %q not found in %v", want, args)
}

func assertNotContainsArg(t *testing.T, args []string, unwanted string) {
	t.Helper()
	for _, arg := range args {
		if arg == unwanted {
			t.Fatalf("unexpected argument %q found in %v", unwanted, args)
		}
	}
}
