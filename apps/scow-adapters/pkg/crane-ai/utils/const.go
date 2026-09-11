package utils

import (
	"os"
	"path/filepath"
)

const (
	DefaultUserConfigPrefix = ".config/crane"
	MaxJobTimeLimit         = 315576000000 // 10000 years

	MinPort = 30000
	MaxPort = 65535

	NetworkMode = "default"

	StepToPodNameEscape = "-"

	PullAlways       = "Always"
	PullNever        = "Never"
	PullIfNotPresent = "IfNotPresent"

	ContainerEnvPrefix = "SCOW_AI_"
	ModelPathEnv       = "MODEL_PATH"
	AlgorithmPathEnv   = "ALGORITHM_PATH"
	DataSetPathEnv     = "DATASET_PATH"

	HuaweiAscend = "huawei.com/Ascend"

	Train     = "train"
	Inference = "inference"
	DevHost   = "devHost"
	APP       = "app"

	AppTypeVNC = "vnc"
	AppTypeWeb = "web"

	PyTorch = "pytorch"

	AppVNCContainerPort = 6901
	AppWebContainerPort = 20000

	Jupyterlab  = "jupyterlab"
	Vscode      = "vscode"
	VscodePort  = 20002
	JupyterPort = 20003

	TensorBoard            = "tensorboard"
	TensorBoardPort        = 6006
	TensorBoardLogMountDir = "/output/training_logs"
	TensorBoardCpu         = 1
	TensorBoardMemoryMb    = 512
	TensorBoardEntryScript = "tensorBoard_entry.sh"

	ContainerScriptDir   = "/opt/crane/"
	ContainerEntryScript = "/opt/crane/entry.sh"
	DevHostEntryFileName = "devhost_entry.sh"
	DevHostScriptDirName = "crane"

	DefaultAdapterPath = "/adapter"
)

// UserNs controls whether container jobs use a user namespace. It defaults to
// true and is overridden by the adapter configuration at startup.
var UserNs = true

var (
	AdapterPath      = resolveAdapterPath()
	JobsInfos        = filepath.Join(AdapterPath, "jobs", "jobs.json")
	ProxyInfos       = filepath.Join(AdapterPath, "jobs", "proxy.json")
	DevHostEntryPath = filepath.Join(AdapterPath, DevHostEntryFileName)
	TensorboardImage = ""
)

func resolveAdapterPath() string {
	workingDir, err := os.Getwd()
	if err != nil || workingDir == "" {
		return DefaultAdapterPath
	}
	return workingDir
}
