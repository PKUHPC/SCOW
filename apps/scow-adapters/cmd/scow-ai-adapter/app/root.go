package app

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"scow-adapters/pkg/ai/config"
	"scow-adapters/pkg/ai/utils"
	cu "scow-adapters/pkg/common/utils"
)

var cfgFile string

// RootCmd 主命令
var RootCmd = &cobra.Command{
	Use:     "scow-ai-adapter",
	Short:   "scow ai adapter",
	Long:    "支持配置文件与命令行参数启动服务",
	Version: cu.GetVersion(),
	Example: `
   scow-ai-adapter --config=config/config.yaml --port=8972
   scow-ai-adapter --log_level=debug`,
	Run: func(cmd *cobra.Command, args []string) {
		runApp()
	},
}

func init() {
	cobra.OnInitialize(loadConfig)
	RootCmd.SetVersionTemplate(cu.VersionTemplate())
	// 配置文件路径可以通过命令行传入
	RootCmd.PersistentFlags().StringVar(&cfgFile, "config", "config/config.yaml", "config file")
	// 传递自定义命令行参数
	RootCmd.PersistentFlags().Int("port", 0, "适配器端口")
	RootCmd.PersistentFlags().String("log_level", "", "日志级别 info/debug/trace")
	RootCmd.PersistentFlags().String("cluster_name", "dev-k8s", "k8s集群名字")
	RootCmd.PersistentFlags().String("kubeconfig", "/root/.kube/config", "k8s config file")
	RootCmd.PersistentFlags().String("prometheus_addr", "", "prometheus 地址")
	RootCmd.PersistentFlags().String("tensorboard_image", "", "tensorboard image")
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
	config.Value = config.ParseAIConfig(configPath)
	// 使用命令行参数覆盖配置文件中的值
	applyFlagsToConfig()
	if len(config.Value.Accelerator) < 1 {
		config.Value.Accelerator = []string{utils.HuaweiAscend910, utils.VGPUNum, utils.Nvidia, utils.HuaweiAscend310P}
	}
}

// applyFlagsToConfig 使用命令行传入的参数覆盖配置
func applyFlagsToConfig() {
	if adapterPort, _ := RootCmd.Flags().GetInt("port"); adapterPort != 0 {
		config.Value.AdapterPort = adapterPort
	}
	if logLevel, _ := RootCmd.Flags().GetString("log_level"); logLevel != "" {
		config.Value.LogConfig.Level = logLevel
	}
	if clusterName, _ := RootCmd.Flags().GetString("cluster_name"); clusterName != "" {
		config.Value.ClusterName = clusterName
	}
	if prometheusAddr, _ := RootCmd.Flags().GetString("prometheus_addr"); prometheusAddr != "" {
		config.Value.PrometheusAddr = prometheusAddr
	}
	if kubeconfig, _ := RootCmd.Flags().GetString("kubeconfig"); kubeconfig != "" {
		config.Value.KubeConfig = kubeconfig
	}
	if tensorboardImage, _ := RootCmd.Flags().GetString("tensorboard_image"); tensorboardImage != "" {
		config.Value.TensorboardImage = tensorboardImage
	} else if config.Value.TensorboardImage == "" {
		config.Value.TensorboardImage = utils.TensorboardImage
	}
}
