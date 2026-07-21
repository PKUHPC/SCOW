package models

type AppSessionTable struct {
	ID          uint64 `gorm:"column:id;primaryKey;autoIncrement"`
	JobID       uint32 `gorm:"column:job_id;not null;index:idx_job_app,unique"`
	JobName     string `gorm:"column:job_name;not null"`
	Namespace   string `gorm:"column:namespace"`
	AppType     string `gorm:"column:app_type;not null;index:idx_job_app,unique"`
	Password    string `gorm:"column:password"`
	ContainerID string `gorm:"column:container_id"`
	CreatedAt   int64  `gorm:"column:created_at"`
	UpdatedAt   int64  `gorm:"column:updated_at"`
}
