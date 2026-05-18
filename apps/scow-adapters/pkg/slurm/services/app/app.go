package app

import (
	"context"

	pb "scow-adapters/gen/go"
)

type ServerAppServer struct {
	pb.UnimplementedAppServiceServer
}

func (s *ServerAppServer) GetAppConnectionInfo(ctx context.Context, in *pb.GetAppConnectionInfoRequest) (*pb.GetAppConnectionInfoResponse, error) {
	return &pb.GetAppConnectionInfoResponse{}, nil
}
