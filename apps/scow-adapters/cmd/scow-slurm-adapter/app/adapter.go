package app

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"scow-adapters/pkg/common/utils"
	"scow-adapters/pkg/slurm/config"
)

var cfgFile string

var RootCmd = &cobra.Command{
	Use:     "scow-slurm-adapter",
	Short:   "slurm adapter for scow",
	Version: utils.GetVersion(),
	Example: `
  scow-slurm-adapter --config=config/config.yaml --addr=0.0.0.0:8972
  scow-slurm-adapter --level=debug`,
	Run: func(cmd *cobra.Command, args []string) {
		run()
	},
}

func init() {
	cobra.OnInitialize(loadConfig)
	RootCmd.SetVersionTemplate(utils.VersionTemplate())
	// 配置文件路径可以通过命令行传入
	RootCmd.PersistentFlags().StringVar(&cfgFile, "config", "config/config.yaml", "config file")
	// 传递自定义命令行参数
	RootCmd.PersistentFlags().String("addr", "", "适配器地址")
	RootCmd.PersistentFlags().String("level", "", "日志级别 info/debug/trace")
}

// loadConfig 加载配置文件
func loadConfig() {
	// 优先使用命令行传入的配置文件路径
	var configPath string
	currentPwd, _ := os.Getwd()
	if cfgFile != "" {
		configPath = fmt.Sprintf("%s/%s", currentPwd, cfgFile)
	} else {
		configPath = currentPwd + "/config/config.yaml"
	}
	config.SlurmValue = config.ParseSlurmConfig(configPath)
	// 使用命令行参数覆盖配置文件中的值
	applyFlagsToConfig()
}

// applyFlagsToConfig 使用命令行传入的参数覆盖配置
func applyFlagsToConfig() {
	if adapterAddr, _ := RootCmd.Flags().GetString("addr"); adapterAddr != "" {
		config.SlurmValue.Service.Addr = adapterAddr
	}
	if logLevel, _ := RootCmd.Flags().GetString("level"); logLevel != "" {
		config.SlurmValue.LogConfig.Level = logLevel
	}
}
