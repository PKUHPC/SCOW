// Package scowd 提供服务入口使用的内嵌资源，保留配置和脚本的原始路径。
package scowd

import "embed"

//go:embed configs/*
var ConfigsFS embed.FS

//go:embed assets/scow-shell-file.sh
var ShellScript string
