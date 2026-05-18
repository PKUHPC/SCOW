package train

const (
	Master     = "master"
	Worker     = "worker"
	TensorFlow = "TensorFlow"
	PyTorch    = "PyTorch"
	MindSpore  = "MindSpore"
	MPI        = "MPI"
	APP        = "app"
	TTL        = 604800 // ttlSecondsAfterFinished 任务结束后7天，自动清理k8s上面的资源
	MaxRetry   = 3      // 任务失败，最大重试次数
	jupyterlab = "jupyterlab"
	vscode     = "vscode"
)
