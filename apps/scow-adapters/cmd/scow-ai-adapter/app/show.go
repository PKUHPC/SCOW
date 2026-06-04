package app

import (
	"os"

	"github.com/jedib0t/go-pretty/v6/table"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"

	"scow-adapters/pkg/ai/client"
	"scow-adapters/pkg/ai/config"
	"scow-adapters/pkg/ai/quota_cli"
	"scow-adapters/pkg/common/log"
)

var showCmd = &cobra.Command{
	Use:   "show",
	Short: "Display account information",
	Run: func(cmd *cobra.Command, args []string) {
		accountName, _ := cmd.Flags().GetString("account")

		client.InitDB()
		log.InitLogger(log.ParseLogLevel(config.Value.LogConfig.Level), config.Value.LogConfig.FilePath)

		// 查询账户信息
		accounts, err := quota_cli.GetAccounts(accountName)
		if err != nil {
			logrus.Errorf("Account query failed: %v", err)
			return
		}

		// 显示表格
		t := table.NewWriter()
		t.SetOutputMirror(os.Stdout)
		t.AppendHeader(table.Row{"账户名", "GPU 配额"})

		for _, acct := range accounts {
			quota := acct.GpuQuota
			t.AppendRow(table.Row{acct.Name, quota})
		}

		t.Render()
	},
}

func init() {
	RootCmd.AddCommand(showCmd)
	showCmd.Flags().StringP("account", "a", "", "specify account name")
}
