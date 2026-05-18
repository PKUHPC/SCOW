package models

type JobTable struct {
	JobDBInx    uint64 `gorm:"column:job_db_inx;primaryKey;autoIncrement"`
	ModTime     uint64 `gorm:"column:mod_time;default:0;not null"`
	Account     string `gorm:"column:account"`
	CPUsReq     uint   `gorm:"column:cpus_req;not null"`
	GPUsReq     uint   `gorm:"column:gpus_req;not null"`
	PODsReq     uint   `gorm:"column:pods_req;not null"`
	JobName     string `gorm:"column:job_name;not null"`
	NewJobName  string `gorm:"column:new_job_name;not null"`
	Qos         string `gorm:"column:qos"`
	UserName    string `gorm:"column:username"`
	Group       string `gorm:"column:group"`
	MemReq      uint64 `gorm:"column:mem_req"`
	MemAlloc    uint   `gorm:"column:mem_alloc"`
	CPUsAlloc   uint   `gorm:"column:cpus_alloc"`
	GPUsAlloc   uint   `gorm:"column:gpus_alloc"`
	PODsAlloc   uint   `gorm:"column:pods_alloc"`
	Partition   string `gorm:"column:partition"`
	State       string `gorm:"column:state"`
	Timelimit   uint   `gorm:"column:timelimit;default:0"`
	TimeSubmit  uint64 `gorm:"column:time_submit;index:time_submit_index;default:0"`
	TimeStart   uint64 `gorm:"column:time_start;default:0"`
	TimeEnd     uint64 `gorm:"column:time_end;index:time_end_index;default:0"`
	WorkDir     string `gorm:"column:work_dir"`
	GpuType     string `gorm:"column:gpu_type"`
	JobType     string `gorm:"column:job_type"`
	SvcPassword string `gorm:"column:svc_password"`
	//SubmitLine         string        `gorm:"column:submit_line"`
	TrainType          string        `gorm:"column:train_type"`
	Reason             string        `gorm:"column:reason"`
	Events             []*EventTable `json:"events" gorm:"-"`
	NodeCount          uint64        `gorm:"column:node_count;default:0"`
	TensorboardLogPath string        `gorm:"column:tensorboard_log_path"`
	TensorboardPort    int           `gorm:"column:tensorboard_port"`
	// dev host
	JupyterLabProxyPath string `gorm:"column:jupyter_lab_proxy_path"`
	VscodeBinPath       string `gorm:"column:vscode_bin_path"`
	IsPreempt           int    `gorm:"column:is_preempt;default:0"` // 0 未抢占，1被抢占
}
