package middlewares

import (
	"context"
	"encoding/base64"
	"errors"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/process/childstate"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/process/common"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/utils/security"

	"connectrpc.com/connect"
	"github.com/sirupsen/logrus"
)

func AuthInterceptor() connect.UnaryInterceptorFunc {
	interceptor := func(next connect.UnaryFunc) connect.UnaryFunc {
		return connect.UnaryFunc(func(
			ctx context.Context,
			req connect.AnyRequest,
		) (connect.AnyResponse, error) {

			// 检查自定义请求头
			secretKey, err := base64.StdEncoding.DecodeString(req.Header().Get("X-Custom-Secret-Key"))
			if err != nil {
				logrus.Errorf("Decoding token failed: %v", err)
				return nil, connect.NewError(
					connect.CodeUnauthenticated,
					errors.New("INVALID_TOKEN"),
				)
			}

			if !security.VerifySignatureWithPublicKey(child.PublicKey, []byte(common.SecureToken), secretKey) {
				return nil, connect.NewError(
					connect.CodeUnauthenticated,
					errors.New("INVALID_TOKEN"),
				)
			}

			return next(ctx, req)
		})
	}
	return connect.UnaryInterceptorFunc(interceptor)
}
