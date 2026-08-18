package migrations

import (
	"github.com/go-gormigrate/gormigrate/v2"
	"gorm.io/gorm"

	"scow-adapters/pkg/ai/db/models"
)

func AddResourceCleanupMigration() *gormigrate.Migration {
	return &gormigrate.Migration{
		ID: "202607200001_add_resource_cleanup",
		Migrate: func(tx *gorm.DB) error {
			return autoMigrateIfNotExists(tx, &models.ResourceCleanup{})
		},
		Rollback: func(tx *gorm.DB) error {
			return tx.Migrator().DropTable(&models.ResourceCleanup{})
		},
	}
}
