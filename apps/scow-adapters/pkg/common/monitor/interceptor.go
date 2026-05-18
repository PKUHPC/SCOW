package monitor

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc"
)

type responseWriterWrapper struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriterWrapper) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// MetricsHandlerWithMonitoring Metrics端点包装器，用于监控/metrics端点性能
func MetricsHandlerWithMonitoring(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		startTime := time.Now()

		// 包装ResponseWriter以捕获状态码
		wrappedWriter := &responseWriterWrapper{
			ResponseWriter: w,
			statusCode:     200,
		}

		handler.ServeHTTP(wrappedWriter, r)

		// 记录指标
		duration := time.Since(startTime).Seconds()
		MetricsRequestDuration.Observe(duration)
		MetricsRequestsTotal.Inc()
	})
}

func MetricsInterceptor() grpc.UnaryServerInterceptor {
	return func(
		ctx context.Context,
		req interface{},
		info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (resp interface{}, err error) {
		startTime := time.Now()
		fullMethodName := info.FullMethod
		methodName := extractSimpleMethodName(fullMethodName)
		logrus.Infof("%s consuming=%v", methodName, time.Since(startTime))
		defer func() {
			duration := time.Since(startTime).Seconds()

			// 记录请求延迟
			GrpcRequestDuration.WithLabelValues(methodName).Observe(duration)

			// 记录请求总数和状态
			statusLabel := "success"
			if err != nil {
				statusLabel = "failed"
			}
			GrpcRequestsTotal.WithLabelValues(methodName, statusLabel).Inc()
		}()

		return handler(ctx, req)
	}
}

// 从完整gRPC方法名中提取简单方法名
func extractSimpleMethodName(fullMethod string) string {
	// 格式通常为：/package.service/method
	parts := strings.Split(fullMethod, "/")
	if len(parts) >= 3 {
		return parts[2]
	}
	return fullMethod // 如果格式不符合预期，返回原字符串
}
