package monitor

import (
	"os"
	"runtime"
	"time"

	"github.com/shirou/gopsutil/v3/process"
	"github.com/sirupsen/logrus"
)

// StartSystemMetricsCollector 启动后台 goroutine，每 MetricsCollectInterval 采集一次进程级指标
// （CPU 使用率、内存、goroutine 数量）。
// DB 指标及集群指标由各适配器通过 StartClusterMetricsCollector 提供。
func StartSystemMetricsCollector() {
	go func() {
		proc, err := process.NewProcess(int32(os.Getpid()))
		if err != nil {
			logrus.Fatalf("Failed to get process info: %v", err)
		}

		ticker := time.NewTicker(MetricsCollectInterval)
		defer ticker.Stop()

		for range ticker.C {
			collectProcessMetrics(proc)
		}
	}()
}

func collectProcessMetrics(proc *process.Process) {
	if cpuPercent, err := proc.Percent(0); err == nil {
		ProcessCpuUsage.Set(cpuPercent)
	}
	if memInfo, err := proc.MemoryInfo(); err == nil {
		ProcessMemoryUsage.Set(float64(memInfo.RSS))
	}
	ProcessGoroutines.Set(float64(runtime.NumGoroutine()))
}
