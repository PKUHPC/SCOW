package monitor

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// 适配器指标
var (
	// ProcessCpuUsage 系统资源指标
	ProcessCpuUsage = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "process_cpu_usage_percent",
		Help: "Current CPU usage percentage of the process",
	})

	ProcessMemoryUsage = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "process_memory_usage_bytes",
		Help: "Current memory usage in bytes",
	})

	ProcessGoroutines = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "process_goroutines_count",
		Help: "Current number of goroutines",
	})

	// GrpcRequestsTotal gRPC接口指标
	GrpcRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "grpc_requests_total",
		Help: "Total number of gRPC requests",
	}, []string{"method", "status"})

	GrpcRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "grpc_request_duration_seconds",
		Help:    "Duration of gRPC requests",
		Buckets: []float64{0.01, 0.05, 0.1, 0.5, 1, 5},
	}, []string{"method"})

	// DatabaseConnections 数据库连接指标
	DatabaseConnections = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "database_connections",
		Help: "Number of active database connections",
	}, []string{"database", "type"})

	DatabaseSize = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "database_size_bytes",
		Help: "Size of database in bytes",
	}, []string{"database"})

	// MetricsRequestDuration Metrics接口性能指标
	MetricsRequestDuration = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "metrics_endpoint_duration_seconds",
		Help:    "Duration of metrics endpoint requests",
		Buckets: []float64{0.001, 0.005, 0.01, 0.05, 0.1},
	})

	MetricsRequestsTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "metrics_requests_total",
		Help: "Total number of metrics endpoint requests",
	})
)
