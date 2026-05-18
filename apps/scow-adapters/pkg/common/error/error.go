package error

import (
	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// RichError rich error model 封装
func RichError(code codes.Code, reason string, message string) error {
	errInfo := &errdetails.ErrorInfo{
		Reason: reason,
	}
	st := status.New(code, message)
	st, _ = st.WithDetails(errInfo)
	return st.Err()
}
