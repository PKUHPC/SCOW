package config

import (
	cc "scow-adapters/pkg/common/config"
)

var (
	CraneConfigValue CraneConfig
)

type CraneConfig struct {
	BindPort   int              `yaml:"bind-port"`
	LogLevel   string           `yaml:"log-level"`
	Ssl        cc.SslConfig     `yaml:"ssl"`
	Monitor    cc.MonitorConfig `yaml:"monitor"`
	Partitions []Partitions     `yaml:"partitions"`
}

type Partitions struct { // 分区描述信息
	Name string `yaml:"name"`
	Desc string `yaml:"desc"`
}
