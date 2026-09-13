package request

import (
	"encoding/base64"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/process/parent"
	"net/http"

	"connectrpc.com/connect"
)

func SetSecretHeader[T any](message *T, port string) (*connect.Request[T], error) {
	req := connect.NewRequest(message)
	if err := SetSecretHeaderValue(req.Header(), port); err != nil {
		return nil, err
	}
	return req, nil
}

func SetSecretHeaderValue(header http.Header, port string) error {
	signToken, err := parent.GlobalSecureKeyManager.GetSignToken(port)
	if err != nil {
		return err
	}

	secretKey := string(base64.StdEncoding.EncodeToString(signToken))
	header.Set("X-Custom-Secret-Key", secretKey)
	return nil
}
