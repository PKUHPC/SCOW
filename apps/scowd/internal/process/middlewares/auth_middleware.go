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

type authInterceptor struct{}

func AuthInterceptor() connect.Interceptor { return authInterceptor{} }

func authenticate(header string) error {
	secretKey, err := base64.StdEncoding.DecodeString(header)
	if err != nil {
		logrus.Errorf("Decoding token failed: %v", err)
		return connect.NewError(connect.CodeUnauthenticated, errors.New("INVALID_TOKEN"))
	}
	if !security.VerifySignatureWithPublicKey(child.PublicKey, []byte(common.SecureToken), secretKey) {
		return connect.NewError(connect.CodeUnauthenticated, errors.New("INVALID_TOKEN"))
	}
	return nil
}

func (authInterceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		if err := authenticate(req.Header().Get("X-Custom-Secret-Key")); err != nil {
			return nil, err
		}
		return next(ctx, req)
	}
}

func (authInterceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return func(ctx context.Context, stream connect.StreamingHandlerConn) error {
		if err := authenticate(stream.RequestHeader().Get("X-Custom-Secret-Key")); err != nil {
			return err
		}
		return next(ctx, stream)
	}
}

func (authInterceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return next
}
