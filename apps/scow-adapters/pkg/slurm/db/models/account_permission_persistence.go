package models

type AcctPermissionPersistenceTable struct {
	ID                    uint64 `gorm:"column:id;primaryKey;autoIncrement;not null"`
	CreationTime          uint64 `gorm:"column:creation_time;not null"`
	ModTime               uint64 `gorm:"column:mod_time;not null;default:0"`
	AccountName           string `gorm:"column:account_name;not null"`
	PartitionName         string `gorm:"column:partition_name;not null;default:''"`
	UserName              string `gorm:"column:user_name;not null"`
	OriginalMaxSubmitJobs int32  `gorm:"column:original_max_submit_jobs;not null;default:-1"`
}

func (AcctPermissionPersistenceTable) TableName() string {
	return "acct_permission_persistence"
}
