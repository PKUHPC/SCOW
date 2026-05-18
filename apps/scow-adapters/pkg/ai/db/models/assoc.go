package models

type AssocTable struct {
	IdAssoc      int    `gorm:"column:id_assoc;primaryKey;autoIncrement"`
	CreationTime uint64 `gorm:"column:creation_time;not null"`
	ModTime      uint64 `gorm:"column:mod_time;not null;default:0"`
	Deleted      int    `gorm:"column:deleted;not null;default:0"`
	User         string `gorm:"column:user;index:idx_user_acct,unique;not null"`
	Acct         string `gorm:"column:acct;index:idx_user_acct,unique;not null"`
	Blocked      int    `gorm:"column:blocked;default:0"`
}
