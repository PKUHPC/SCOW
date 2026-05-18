package utils

const (
	DefaultUserConfigPrefix = ".config/crane"
	MaxJobTimeLimit         = 315576000000 // 10000 years

	MinPort = 30000
	MaxPort = 65535

	NetworkMode = "default"
	//UserNs      = false
	UserNs = true

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

	Jupyterlab  = "jupyterlab"
	Vscode      = "vscode"
	VscodePort  = 20002
	JupyterPort = 20003

	AdapterPath = "/adapter/"

	JobsInfos  = "/adapter/jobs/jobs.json"
	ProxyInfos = "/adapter/jobs/proxy.json"
)
