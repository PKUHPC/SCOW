package config

import (
	"os"

	"github.com/sirupsen/logrus"
	"gopkg.in/yaml.v2"

	cc "scow-adapters/pkg/common/config"
)

var (
	SlurmValue *SlurmConfig
)

type SlurmConfig struct {
	LogConfig      cc.LogConfig     `yaml:"log"`
	MySQLConfig    MySQLConfig      `yaml:"mysql"`
	Service        Service          `yaml:"service"`
	Slurm          Slurm            `yaml:"slurm"`
	Partitions     []Partitions     `yaml:"partitions"`
	Ssl            cc.SslConfig     `yaml:"ssl"`
	SlurmConfCache SlurmConfCache   `yaml:"slurmConfCache"`
	Monitor        cc.MonitorConfig `yaml:"monitor"`
	Json           Json             `yaml:"json"`
}

type MySQLConfig struct {
	Host           string `yaml:"host"`
	Port           int    `yaml:"port"`
	User           string `yaml:"user"`
	DBName         string `yaml:"dbname"`
	Password       string `yaml:"password"`
	ClusterName    string `yaml:"clustername"`
	DatabaseEncode string `yaml:"databaseencode"`
}

type Service struct {
	Addr string `yaml:"addr"`
}

type Slurm struct {
	DefaultQOS string `yaml:"defaultqos"`
	Slurmpath  string `yaml:"slurmpath,omitempty"`
}

type Partitions struct {
	Name       string `yaml:"name"`
	Desc       string `yaml:"desc"`
	Nodes      uint32 `yaml:"nodes"`
	CpuPerNode uint32 `yaml:"cpuPerNode"`
	GpuPerNode uint32 `yaml:"gpuPerNode"`
	MemPerNode string `yaml:"memPerNode"`
}

type Json struct {
	Enabled bool `yaml:"enabled"`
}

type SlurmConfCache struct {
	RefreshInterval int    `yaml:"refreshInterval"`
	SlurmConfigPath string `yaml:"slurmConfigPath"`
}

// ParseSlurmConfig 解析配置文件
func ParseSlurmConfig(configFilePath string) *SlurmConfig {
	confFile, err := os.ReadFile(configFilePath)
	if err != nil {
		logrus.Fatal(err)
	}
	config := &SlurmConfig{LogConfig: cc.DefaultLogConfig()}

	err = yaml.Unmarshal(confFile, config)
	if err != nil {
		logrus.Fatal(err)
	}
	return config
}
