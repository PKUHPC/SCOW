package config

import (
	cc "scow-adapters/pkg/common/config"
)

type CraneConfig struct {
	BindPort         int              `yaml:"bind-port"`
	LogLevel         string           `yaml:"log-level"`
	TensorboardImage string           `yaml:"tensorboardImage"`
	Ssl              cc.SslConfig     `yaml:"ssl"`
	Monitor          cc.MonitorConfig `yaml:"monitor"`
}
