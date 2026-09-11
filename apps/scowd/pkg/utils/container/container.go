package container

import (
	"strings"

	"github.com/sirupsen/logrus"

	"scowd/pkg/config"
)

var runtimeCommands = map[config.ContainerRuntime]string{
	config.ContainerRuntimeDocker:     "docker",
	config.ContainerRuntimeContainerd: "nerdctl -n k8s.io",
}

var runtimeContainerIDPrefix = map[config.ContainerRuntime]string{
	config.ContainerRuntimeDocker:     "docker",
	config.ContainerRuntimeContainerd: "containerd",
}

// GetContainerRuntime 返回配置中的容器运行时，未配置或异常时默认 containerd
func GetContainerRuntime() config.ContainerRuntime {
	cfg, err := config.GetScowdConfig()
	if err != nil {
		logrus.Warnf("Failed to load config for container runtime: %v, falling back to containerd", err)
		return config.ContainerRuntimeContainerd
	}

	runtime := cfg.AI.ContainerRuntime
	if runtime == "" {
		return config.ContainerRuntimeContainerd
	}

	if _, ok := runtimeCommands[runtime]; !ok {
		logrus.Warnf("Unsupported container runtime %q, falling back to containerd", runtime)
		return config.ContainerRuntimeContainerd
	}

	return runtime
}

// GetRuntimeCommand 返回指定运行时对应的 OCI 命令，缺省使用 containerd 命令
func GetRuntimeCommand(runtime config.ContainerRuntime) string {
	if cmd, ok := runtimeCommands[runtime]; ok {
		return cmd
	}
	return runtimeCommands[config.ContainerRuntimeContainerd]
}

// GetContainerIDPrefix 返回运行时对应的容器 ID 前缀，缺省为 containerd
func GetContainerIDPrefix(runtime config.ContainerRuntime) string {
	if prefix, ok := runtimeContainerIDPrefix[runtime]; ok {
		return prefix
	}
	return runtimeContainerIDPrefix[config.ContainerRuntimeContainerd]
}

// FormatContainerID 去掉容器 ID 中的运行时前缀（如 docker:// 或 containerd://）
func FormatContainerID(containerID string) string {
	if containerID == "" {
		return ""
	}
	runtime := GetContainerRuntime()
	prefix := GetContainerIDPrefix(runtime) + "://"
	return strings.TrimPrefix(containerID, prefix)
}
