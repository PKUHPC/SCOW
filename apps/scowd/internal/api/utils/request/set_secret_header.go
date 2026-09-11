package request

import (
	"encoding/base64"
	"scowd/internal/process/parent"

	"connectrpc.com/connect"
)

func SetSecretHeader[T any](message *T, port string) (*connect.Request[T], error) {
	req := connect.NewRequest(message)

	signToken, err := parent.GlobalSecureKeyManager.GetSignToken(port)
	if err != nil {
		return nil, err
	}

	secretKey := string(base64.StdEncoding.EncodeToString(signToken))
	req.Header().Set("X-Custom-Secret-Key", secretKey)

	return req, nil
}
