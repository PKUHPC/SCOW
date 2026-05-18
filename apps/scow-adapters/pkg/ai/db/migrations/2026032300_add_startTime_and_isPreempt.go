package migrations

import (
	"github.com/go-gormigrate/gormigrate/v2"
	"gorm.io/gorm"
)

type podTableForStartTime struct {
	StartTime int64 `gorm:"column:start_time"`
}

func (podTableForStartTime) TableName() string {
	return "pod_table"
}

type jobTableForIsPreempt struct {
	IsPreempt int `gorm:"column:is_preempt;default:0"` // 0 未抢占，1被抢占
}

func (jobTableForIsPreempt) TableName() string {
	return "job_table"
}

func AddStartTimeAndIsPreemptMigration() *gormigrate.Migration {
	return &gormigrate.Migration{
		ID: "202603230001_add_start_time_and_isPreempt",
		Migrate: func(tx *gorm.DB) error {
			if !tx.Migrator().HasColumn(&podTableForStartTime{}, "StartTime") {
				if err := tx.Migrator().AddColumn(&podTableForStartTime{}, "StartTime"); err != nil {
					return err
				}
			}
			if !tx.Migrator().HasColumn(&jobTableForIsPreempt{}, "IsPreempt") {
				if err := tx.Migrator().AddColumn(&jobTableForIsPreempt{}, "IsPreempt"); err != nil {
					return err
				}
			}
			return nil
		},
		Rollback: func(tx *gorm.DB) error {
			if tx.Migrator().HasColumn(&podTableForStartTime{}, "StartTime") {
				if err := tx.Migrator().DropColumn(&podTableForStartTime{}, "StartTime"); err != nil {
					return err
				}
			}
			if tx.Migrator().HasColumn(&jobTableForIsPreempt{}, "IsPreempt") {
				if err := tx.Migrator().DropColumn(&jobTableForIsPreempt{}, "IsPreempt"); err != nil {
					return err
				}
			}
			return nil
		},
	}
}
