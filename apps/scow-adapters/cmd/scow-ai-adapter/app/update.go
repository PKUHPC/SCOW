package app

import (
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"

	"scow-adapters/pkg/ai/client"
	"scow-adapters/pkg/ai/config"
	"scow-adapters/pkg/ai/quota_cli"
	"scow-adapters/pkg/common/log"
)

var updateCmd = &cobra.Command{
	Use:   "update",
	Short: "update account GPU quota",
	Run: func(cmd *cobra.Command, args []string) {
		accountName, _ := cmd.Flags().GetString("account")
		quota, _ := cmd.Flags().GetUint32("quota")

		if accountName == "" {
			println("Account name must be specified")
			return
		}

		client.InitDB()
		log.InitLogger(log.ParseLogLevel(config.Value.LogConfig.Level), config.Value.LogConfig.FilePath, config.Value.LogConfig.EnableStdout)

		// 更新配额
		if err := quota_cli.UpdateGpuQuota(accountName, quota); err != nil {
			logrus.Errorf("update GPU quota failed: %v", err)
			return
		}
	},
}

func init() {
	RootCmd.AddCommand(updateCmd)
	updateCmd.Flags().StringP("account", "a", "", "specify account name, single account use xxx; multiple accounts use aaa,bbb,ccc")
	updateCmd.Flags().Uint32P("quota", "q", 0, "setting GPU quota values")
	updateCmd.MarkFlagRequired("account")
	updateCmd.MarkFlagRequired("quota")
}
