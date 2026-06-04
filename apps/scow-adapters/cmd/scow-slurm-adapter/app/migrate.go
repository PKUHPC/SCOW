package app

import (
	"os"

	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"

	"scow-adapters/pkg/common/log"
	"scow-adapters/pkg/slurm/client"
	"scow-adapters/pkg/slurm/config"
	"scow-adapters/pkg/slurm/db/migrations"
)

var migrateBlockCmd = &cobra.Command{
	Use:   "migrate-block-to-association",
	Short: "执行 AllowAccounts → MaxSubmitJobs 封锁数据迁移",
	Long: `将遗留的 AllowAccounts 分区封锁机制迁移到基于 Association MaxSubmitJobs=0 的新机制。

适配器首次启动时会自动执行此迁移。若迁移期间部分账户失败，可在修复问题后
使用此命令重新执行失败的迁移项（AllowAccounts 已恢复为 ALL 的分区会自动跳过）。

示例：
  ./scow-slurm-adapter migrate-block-to-association
  ./scow-slurm-adapter migrate-block-to-association --config=config/config.yaml`,
	Run: func(cmd *cobra.Command, args []string) {
		runMigrateBlockToAssociation()
	},
}

func init() {
	RootCmd.AddCommand(migrateBlockCmd)
}

func runMigrateBlockToAssociation() {
	log.InitLogger(log.ParseLogLevel(config.SlurmValue.LogConfig.Level), config.SlurmValue.LogConfig.FilePath)

	// 只初始化 DB 连接和 Slurm 路径，不触发 gormigrate（迁移 ID 已记录，无需重跑）
	client.InitForMigrate()

	clusterName := config.SlurmValue.MySQLConfig.ClusterName
	logrus.Infof("Start executor migrate-block-to-association，cluster=%s", clusterName)

	if err := migrations.MigrateBlockToAssociation(
		client.GetGormDB(),
		client.SACCTMGR,
		client.SCONTROL,
		clusterName,
	); err != nil {
		logrus.Errorf("migrate-block-to-association executor failed: %v", err)
		os.Exit(1)
	}

	logrus.Info("migrate-block-to-association executor success")
}
