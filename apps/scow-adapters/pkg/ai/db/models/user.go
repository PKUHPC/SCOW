package models

type UserTable struct {
	CreationTime uint64 `gorm:"column:creation_time;not null"`
	ModTime      uint64 `gorm:"column:mod_time;not null;default:0"`
	Deleted      *int   `gorm:"column:deleted;default:0"`
	Name         string `gorm:"column:name;primaryKey;not null"`
}
