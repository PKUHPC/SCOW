package utils

import (
	"errors"
	"fmt"
	"io"

	"connectrpc.com/connect"
)

func WrapStreamError(context string, err error) *connect.Error {
	code := connect.CodeInternal
	if errors.Is(err, io.EOF) {
		code = connect.CodeCanceled
	}
	return connect.NewError(code, fmt.Errorf("%s: %w", context, err))
}
