package utils

type UserIdmapMode string

const (
	VGPUCore         = "volcano.sh/vgpu-cores"
	VGPUMem          = "volcano.sh/vgpu-memory"
	VGPUNum          = "volcano.sh/vgpu-number"
	Nvidia           = "nvidia.com/gpu"
	HuaweiAscend910  = "huawei.com/Ascend910"
	HuaweiAscend310P = "huawei.com/Ascend310P"
	HuaweiAscend     = "huawei.com/Ascend"
	Train            = "train"
	Inference        = "inference"
	DevHost          = "devHost"
	Jupyterlab       = "jupyterlab"
	Vscode           = "vscode"
	APP              = "app"

	QueuedJobPath = "/adapter/queued-jobs/"
	InferJob      = "inference"

	QueuedStatus    = "QUEUED"
	RunningStatus   = "RUNNING"
	PendingStatus   = "PENDING"
	CompletedStatus = "COMPLETED"
	FailedStatus    = "FAILED"
	CanceledStatus  = "CANCELED"
	TimeOutStatus   = "TIMEOUT"

	Add              = "Add"
	Update           = "Update"
	Delete           = "Delete"
	Pod              = "pod"
	Deploy           = "deployment"
	Event            = "event"
	VcJob            = "vcjob"
	PodGroup         = "PodGroup"
	Job              = "Job"
	Queue            = "queue"
	TensorBoard      = "tensorboard"
	TensorboardImage = "crpi-u0hdpwcobdb87rnx.cn-beijing.personal.cr.aliyuncs.com/qsx/tensorboard:latest"

	Volcano = "volcano"
	Creator = "creator"

	RDMANetworkKey = "k8s.v1.cni.cncf.io/networks"
	IPCLOCK        = "IPC_LOCK"

	ContainerEnvPrefix        = "SCOW_AI_"
	ModelPathEnv              = "MODEL_PATH"
	AlgorithmPathEnv          = "ALGORITHM_PATH"
	DataSetPathEnv            = "DATASET_PATH"
	DefaultAcceleratorsPerPod = 8

	// csi mount mode
	ModePlain  UserIdmapMode = "plain"
	ModeNotSet UserIdmapMode = "notSet"
	ModeIdmap  UserIdmapMode = "idmap"
	ModeBindfs UserIdmapMode = "bindfs"
	CSIDriver                = "idmapcsi.pkuhpc.com"

	// DefaultNamespace 默认命名空间
	DefaultNamespace = "default"
	// labels
	JobNameLabelKey = "volcano.sh/job-name"
)
