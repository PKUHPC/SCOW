package config

import (
	"os"
	"path/filepath"

	"github.com/sirupsen/logrus"
)

// 纪录各个适配器公共的配置

type SslConfig struct {
	Enabled               bool   `yaml:"enabled"`
	CaCertPath            string `yaml:"caCertPath"`
	AdapterCertPath       string `yaml:"adapterCertPath"`
	AdapterPrivateKeyPath string `yaml:"adapterPrivateKeyPath"`
}

type MonitorConfig struct {
	Port int `yaml:"port"`
}

type LogConfig struct {
	Level    string `yaml:"level"`
	FilePath string `yaml:"filePath"`
}

func GetCertPath(sc SslConfig) (string, string, string) {
	currentPwd, _ := os.Getwd()
	caCertPath := filepath.Join(currentPwd, "certs/ca.crt")
	adapterCertPath := filepath.Join(currentPwd, "certs/adapter.crt")
	adapterPrivateKeyPath := filepath.Join(currentPwd, "certs/adapter.key")
	caCertPathExists, err := pathExists(caCertPath)
	if err != nil {
		return sc.CaCertPath, sc.AdapterCertPath, sc.AdapterPrivateKeyPath
	}
	adapterCertPathExists, err := pathExists(adapterCertPath)
	if err != nil {
		return sc.CaCertPath, sc.AdapterCertPath, sc.AdapterPrivateKeyPath
	}
	adapterPrivateKeyPathExists, err := pathExists(adapterPrivateKeyPath)
	if err != nil {
		return sc.CaCertPath, sc.AdapterCertPath, sc.AdapterPrivateKeyPath
	}
	logrus.Tracef("cert path: %s, %s, %s", caCertPath, adapterCertPath, adapterPrivateKeyPath)
	if caCertPathExists && adapterCertPathExists && adapterPrivateKeyPathExists {
		return caCertPath, adapterCertPath, adapterPrivateKeyPath
	}
	logrus.Tracef("cert path: %s, %s, %s", caCertPath, adapterCertPath, adapterPrivateKeyPath)
	return sc.CaCertPath, sc.AdapterCertPath, sc.AdapterPrivateKeyPath
}

func pathExists(path string) (bool, error) {
	_, err := os.Stat(path)
	if err == nil {
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, nil
	}
	return false, err
}
