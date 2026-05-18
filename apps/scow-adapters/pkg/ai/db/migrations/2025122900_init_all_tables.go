package migrations

import (
	"github.com/go-gormigrate/gormigrate/v2"
	"gorm.io/gorm"

	"scow-adapters/pkg/ai/db/models"
)

func autoMigrateIfNotExists(tx *gorm.DB, model interface{}) error {
	if tx.Migrator().HasTable(model) {
		return nil
	}
	return tx.AutoMigrate(model)
}

var M2025122900 = &gormigrate.Migration{
	ID: "2025122900_init_all_tables",
	Migrate: func(tx *gorm.DB) error {
		//有外键/关联的放后面
		tables := []interface{}{
			&models.UserTable{},
			&models.AcctTable{},
			&models.PartitionTable{},
			&models.AssocTable{},
			&models.JobTable{},
			&models.PodTable{},
			&models.EventTable{},
		}

		for _, table := range tables {
			if err := autoMigrateIfNotExists(tx, table); err != nil {
				return err
			}
		}
		return nil
	},
	Rollback: func(tx *gorm.DB) error {
		//初始化 migration 一般不回滚
		return nil
	},
}
