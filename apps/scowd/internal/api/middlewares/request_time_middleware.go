package middlewares

import (
	"context"
	"time"

	"connectrpc.com/connect"
	"github.com/sirupsen/logrus"
)

// RequestTimeInterceptor 记录请求响应时间的中间件
// logPrefix 用于区分不同服务的日志前缀，如 "API" 或 "Service"
func RequestTimeInterceptor(logPrefix string) connect.UnaryInterceptorFunc {
	interceptor := func(next connect.UnaryFunc) connect.UnaryFunc {
		return connect.UnaryFunc(func(
			ctx context.Context,
			req connect.AnyRequest,
		) (connect.AnyResponse, error) {
			// 记录开始时间
			startTime := time.Now()

			// 获取请求路径
			requestPath := req.Spec().Procedure

			// 执行下一个处理器
			resp, err := next(ctx, req)

			// 计算响应时间
			duration := time.Since(startTime)

			// 记录日志
			logrus.WithFields(logrus.Fields{
				"path":        requestPath,
				"duration":    duration.String(),
				"duration_ms": duration.Milliseconds(),
			}).Infof("%s request completed", logPrefix)

			return resp, err
		})
	}
	return connect.UnaryInterceptorFunc(interceptor)
}
