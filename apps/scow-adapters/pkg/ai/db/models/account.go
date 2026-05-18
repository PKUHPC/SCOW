package models

type AcctTable struct {
	CreationTime uint64 `gorm:"column:creation_time;not null"`
	ModTime      uint64 `gorm:"column:mod_time;not null;default:0"`
	Deleted      *int   `gorm:"column:deleted;default:0"`
	Name         string `gorm:"column:name;primaryKey;not null"`
	Partitions   string `gorm:"column:partitions;not null;default:''"`
	Description  string `gorm:"column:description; not null"`
	Blocked      int    `gorm:"column:blocked;default:0"`
	// 账户的GPU资源限制。默认 0，0 表示无限制，若为4，表示该账户最多只能用4张卡
	GpuQuota uint32 `gorm:"column:gpu_quota;default:0"`
}
