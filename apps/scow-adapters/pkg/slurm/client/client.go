package client

import (
	"database/sql"
	"fmt"
	"os/exec"

	"github.com/go-gormigrate/gormigrate/v2"
	_ "github.com/go-sql-driver/mysql"
	"github.com/sirupsen/logrus"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"scow-adapters/pkg/slurm/config"
	"scow-adapters/pkg/slurm/db/migrations"
)

var (
	SlurmDB *sql.DB
	gormDB  *gorm.DB

	SINFO    string
	SACCTMGR string
	SQUEUE   string
	SCONTROL string
	SRUN     string
	SBATCH   string
	SALLOC   string
	SBCAST   string
	SATTACH  string
	SACCT    string
	SCANCEL  string
)

// InitSlurmClient 初始化数据库连接、运行 gormigrate 迁移、初始化 Slurm 命令路径。
// 适配器正常启动时调用。
func InitSlurmClient() {
	initDBConn()
	runMigrations()
	initSlurm()
}

// InitForMigrate 仅初始化数据库连接和 Slurm 命令路径，不执行 gormigrate 迁移。
// 供 migrate-block-to-association 子命令使用，避免重复执行已记录的迁移。
func InitForMigrate() {
	initDBConn()
	initSlurm()
}

// GetGormDB 返回 gorm.DB 实例，需在 InitSlurmClient 或 InitForMigrate 之后调用。
func GetGormDB() *gorm.DB {
	return gormDB
}

func initDBConn() {
	var err error

	host := config.SlurmValue.MySQLConfig.Host
	userName := config.SlurmValue.MySQLConfig.User
	passWord := config.SlurmValue.MySQLConfig.Password
	dbName := config.SlurmValue.MySQLConfig.DBName
	port := config.SlurmValue.MySQLConfig.Port
	databaseEncode := config.SlurmValue.MySQLConfig.DatabaseEncode

	dbConfig := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=%s", userName, passWord, host, port, dbName, databaseEncode)
	SlurmDB, err = sql.Open("mysql", dbConfig)
	if err != nil {
		logrus.Fatal(err)
	}
	err = SlurmDB.Ping()
	if err != nil {
		logrus.Fatal(err)
	}
	gormDB, err = gorm.Open(mysql.New(mysql.Config{
		Conn: SlurmDB,
	}), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Error),
	})
	if err != nil {
		logrus.Fatalf("init GORM failed: %v", err)
	}
}

func runMigrations() {
	slurmPath := config.SlurmValue.Slurm.Slurmpath
	if slurmPath == "" {
		slurmPath = "/usr"
	}
	m := gormigrate.New(gormDB, gormigrate.DefaultOptions, []*gormigrate.Migration{
		migrations.NewM2026031000(
			slurmPath+"/bin/sacctmgr",
			slurmPath+"/bin/scontrol",
			config.SlurmValue.MySQLConfig.ClusterName,
		),
		// 将旧版混用 Max*、Grp* 的封锁数据迁移为：账户封锁使用 Grp*，用户封锁使用 Max*。
		// 迁移需要调用 sacctmgr 修改 Slurm association，因此同时传入命令路径和集群名。
		migrations.NewM2026072900(
			slurmPath+"/bin/sacctmgr",
			config.SlurmValue.MySQLConfig.ClusterName,
		),
	})
	if err := m.Migrate(); err != nil {
		logrus.Fatalf("Could not migrate: %v", err)
	}
}

func initSlurm() {
	slurmPath := config.SlurmValue.Slurm.Slurmpath
	if slurmPath == "" {
		// 如果未定义，则将其设置为默认值 "/usr"
		slurmPath = "/usr"
	}

	SINFO = slurmPath + "/bin/sinfo"
	SACCTMGR = slurmPath + "/bin/sacctmgr"
	SQUEUE = slurmPath + "/bin/squeue"
	SCONTROL = slurmPath + "/bin/scontrol"
	SRUN = slurmPath + "/bin/srun"
	SBATCH = slurmPath + "/bin/sbatch"
	SALLOC = slurmPath + "/bin/salloc"
	SBCAST = slurmPath + "/bin/sbcast"
	SATTACH = slurmPath + "/bin/sattach"
	SACCT = slurmPath + "/bin/sacct"
	SCANCEL = slurmPath + "/bin/scancel"

	// 简单测试命令是否可用
	err := exec.Command(SINFO).Run()
	if err != nil {
		logrus.Fatal(err)
	}
}
