package client

import (
	"fmt"
	"github.com/go-gormigrate/gormigrate/v2"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/schema"
	"scow-adapters/pkg/ai/config"
	"scow-adapters/pkg/ai/db/migrations"
)

var (
	DB *gorm.DB
)

func InitDB() {
	host := config.Value.DBConfig.Host
	userName := config.Value.DBConfig.Username
	passWord := config.Value.DBConfig.Password
	dbName := config.Value.DBConfig.DBName
	port := config.Value.DBConfig.Port
	DB = initDBDetail(userName, passWord, dbName, host, int64(port))
	//MyDB.AutoMigrate(&models.JobTable{})
	//MyDB.AutoMigrate(&models.UserTable{})
	//MyDB.AutoMigrate(&models.AcctTable{})
	//MyDB.AutoMigrate(&models.AssocTable{})
	//MyDB.AutoMigrate(&models.PodTable{})
	//MyDB.AutoMigrate(&models.EventTable{})
	//MyDB.AutoMigrate(&models.PartitionTable{})
	m := gormigrate.New(DB, gormigrate.DefaultOptions, []*gormigrate.Migration{
		migrations.M2025122900, // 初始化所有表
		// 给pod表添加start_time字段，给job表添加is_preempt字段
		migrations.AddStartTimeAndIsPreemptMigration(),
	})
	if err := m.Migrate(); err != nil {
		panic(fmt.Sprintf("Could not migrate: %v", err))
	}
}

func initDBDetail(userName, passWord, dbName, host string, port int64) *gorm.DB {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=%s", userName, passWord, host, port, dbName, "utf8")
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{
			SingularTable: true, // 去掉创建表时默认的复数形式
		},
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		panic(err)
	}
	return db
}
