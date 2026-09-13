package middlewares

import (
	"context"
	global_child "github.com/PKUHPC/private-scow/apps/scowd/internal/process/childstate"
	"time"

	"connectrpc.com/connect"
)

func UpdateRequestTimeInterceptor() connect.UnaryInterceptorFunc {
	interceptor := func(next connect.UnaryFunc) connect.UnaryFunc {
		return connect.UnaryFunc(func(
			ctx context.Context,
			req connect.AnyRequest,
		) (connect.AnyResponse, error) {

			global_child.SetLastRequestTime(time.Now())

			return next(ctx, req)
		})
	}
	return connect.UnaryInterceptorFunc(interceptor)
}
