package middlewares

import (
	"context"
	"errors"
	"net/http"
	"runtime/debug"

	"connectrpc.com/connect"
	"github.com/sirupsen/logrus"
)

func PanicRecoveryHandlerOption() connect.HandlerOption {
	return connect.WithRecover(recoverRPCPanic)
}

func recoverRPCPanic(_ context.Context, spec connect.Spec, _ http.Header, recovered any) error {
	logrus.WithFields(logrus.Fields{
		"path":  spec.Procedure,
		"panic": recovered,
		"stack": string(debug.Stack()),
	}).Error("Panic occurred while handling RPC request")

	return connect.NewError(connect.CodeInternal, errors.New("internal server error"))
}
