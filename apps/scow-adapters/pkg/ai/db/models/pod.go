package models

type PodTable struct {
	Uid         string        `gorm:"column:uid;primarykey"`
	Name        string        `gorm:"column:name;not null;index"`
	JobName     string        `gorm:"column:job_name;index;not null"`
	NodeName    string        `gorm:"column:node_name"`
	Namespace   string        `gorm:"column:namespace"`
	IP          string        `gorm:"column:ip;type:varchar(50)"`
	Status      string        `gorm:"column:status"`
	Events      []*EventTable `json:"events" gorm:"-"`
	Created     int64         `gorm:"column:created"`
	Updated     int64         `gorm:"column:updated"`
	StartTime   int64         `gorm:"column:start_time"`
	EndTime     int64         `gorm:"column:end_time"`
	ContainerID string        `gorm:"column:container_id;type:varchar(200)"`
	Reason      string        `gorm:"column:reason;type:varchar(200)"`
}
