package app

import (
	"context"

	protos "scow-adapters/gen/go"
)

type ServerApp struct {
	protos.UnimplementedAppServiceServer
}

func (s *ServerApp) GetAppConnectionInfo(ctx context.Context, in *protos.GetAppConnectionInfoRequest) (*protos.GetAppConnectionInfoResponse, error) {
	return &protos.GetAppConnectionInfoResponse{}, nil
}
