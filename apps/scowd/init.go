package main

import (
	"embed"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/sirupsen/logrus"
)

//go:embed configs/*
var configsFS embed.FS

// initConfigs 初始化配置文件到当前目录的 configs 文件夹
func initConfigs() error {
	// 创建 configs 目录
	configsDir := "configs"
	if err := os.MkdirAll(configsDir, 0755); err != nil {
		return fmt.Errorf("failed to create configs directory: %v", err)
	}

	// 遍历嵌入的配置文件
	err := fs.WalkDir(configsFS, "configs", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		// 跳过目录
		if d.IsDir() {
			return nil
		}

		// 读取嵌入的文件内容
		content, err := configsFS.ReadFile(path)
		if err != nil {
			return fmt.Errorf("failed to read embedded file %s: %v", path, err)
		}

		// 获取相对于 configs 目录的文件名
		fileName := filepath.Base(path)
		targetPath := filepath.Join(configsDir, fileName)

		// 写入文件到当前目录的 configs 文件夹
		if err := os.WriteFile(targetPath, content, 0644); err != nil {
			return fmt.Errorf("failed to write file %s: %v", targetPath, err)
		}

		logrus.Infof("Config file %s initialized successfully.", fileName)
		return nil
	})

	if err != nil {
		return fmt.Errorf("failed to initialize config files: %v", err)
	}

	logrus.Infof("All config files initialized successfully.")
	return nil
}
