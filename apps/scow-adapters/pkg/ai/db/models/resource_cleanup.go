package models

type ResourceCleanup struct {
	ID           uint   `gorm:"column:id;primaryKey;autoIncrement"`
	Namespace    string `gorm:"column:namespace;size:255;not null;uniqueIndex:uk_resource_cleanup"`
	ResourceKind string `gorm:"column:resource_kind;size:64;not null;uniqueIndex:uk_resource_cleanup"`
	ResourceName string `gorm:"column:resource_name;size:255;not null;uniqueIndex:uk_resource_cleanup"`
	Deleted      int    `gorm:"column:deleted;not null;default:0;index"`
	RetryCount   int    `gorm:"column:retry_count;not null;default:0"`
	LastError    string `gorm:"column:last_error;type:text"`
	CreatedAt    int64  `gorm:"column:created_at;autoCreateTime"`
	UpdatedAt    int64  `gorm:"column:updated_at;autoUpdateTime"`
}

func (ResourceCleanup) TableName() string {
	return "resource_cleanup"
}
