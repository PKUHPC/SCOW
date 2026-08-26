package config

import (
	"os"

	"github.com/sirupsen/logrus"
	"gopkg.in/yaml.v2"

	cc "scow-adapters/pkg/common/config"
)

var (
	Value *Config
)

type Config struct {
	LogConfig        cc.LogConfig     `yaml:"log"`
	DBConfig         DBConfig         `yaml:"dbconfig"`
	AdapterPort      int              `yaml:"adapterport"`
	ClusterName      string           `yaml:"clusterName"`
	KubeConfig       string           `yaml:"kubeconfig"`
	Ssl              cc.SslConfig     `yaml:"ssl"`
	Dns              DnsConfig        `yaml:"dns"`
	Schedule         ScheduleConfig   `yaml:"schedule"`
	PrometheusAddr   string           `yaml:"prometheusAddr"`
	Accelerator      []string         `yaml:"accelerator"`
	VGPU             VGPUConfig       `yaml:"vgpu"`
	Quota            QuotaConfig      `yaml:"quota"`
	RDMAConfig       RDMAQueueConfig  `yaml:"rdma_config"`
	Monitor          cc.MonitorConfig `yaml:"monitor"`
	TensorboardImage string           `yaml:"tensorboardImage"`
}

// DBConfig config file struct
type DBConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	DBName   string `yaml:"dbname"`
	Username string `yaml:"username"`
	Password string `yaml:"password"`
}

type DnsConfig struct {
	Enabled     bool     `yaml:"enabled"`
	NameServers []string `yaml:"nameServers"`
}

type ScheduleConfig struct {
	Enabled bool `yaml:"enabled"`
}

type VGPUConfig struct {
	Enabled bool `yaml:"enabled"`
	Cores   int  `yaml:"cores"`
	Memory  int  `yaml:"memory"`
	Number  int  `yaml:"number"`
}

type QuotaConfig struct {
	GPU uint32 `yaml:"gpu"`
}

type RDMAConfig struct {
	CNINetworks string         `yaml:"cni-networks"`
	RDMADevices map[string]int `yaml:"rdma_device"`
}

type RDMAQueueConfig struct {
	Queues map[string]RDMAConfig `yaml:",inline"`
}

// ParseAIConfig 解析配置文件
func ParseAIConfig(configFilePath string) *Config {
	confFile, err := os.ReadFile(configFilePath)
	if err != nil {
		logrus.Fatal(err)
	}
	config := &Config{LogConfig: cc.DefaultLogConfig()}
	err = yaml.Unmarshal(confFile, config)
	if err != nil {
		logrus.Fatal(err)
	}
	return config
}
