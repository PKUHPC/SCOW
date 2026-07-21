package migrations

import (
	"github.com/go-gormigrate/gormigrate/v2"
	"gorm.io/gorm"

	"scow-adapters/pkg/ai/db/models"
)

type jobTableForAppDir struct {
	AppDir string `gorm:"column:app_dir"`
}

func (jobTableForAppDir) TableName() string {
	return "job_table"
}

func AddAppSessionTableMigration() *gormigrate.Migration {
	return &gormigrate.Migration{
		ID: "2026070100_add_app_session_table",
		Migrate: func(tx *gorm.DB) error {
			if !tx.Migrator().HasTable(&models.AppSessionTable{}) {
				if err := tx.AutoMigrate(&models.AppSessionTable{}); err != nil {
					return err
				}
			}
			if !tx.Migrator().HasColumn(&jobTableForAppDir{}, "AppDir") {
				if err := tx.Migrator().AddColumn(&jobTableForAppDir{}, "AppDir"); err != nil {
					return err
				}
			}
			return nil
		},
		Rollback: func(tx *gorm.DB) error {
			if tx.Migrator().HasTable(&models.AppSessionTable{}) {
				if err := tx.Migrator().DropTable(&models.AppSessionTable{}); err != nil {
					return err
				}
			}
			if tx.Migrator().HasColumn(&jobTableForAppDir{}, "AppDir") {
				if err := tx.Migrator().DropColumn(&jobTableForAppDir{}, "AppDir"); err != nil {
					return err
				}
			}
			return nil
		},
	}
}
