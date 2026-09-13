package handlers

import (
	"context"
	"errors"
	"fmt"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/auth"
	apiv1 "github.com/PKUHPC/private-scow/apps/scowd/protos/gen/api/application"
	"github.com/PKUHPC/private-scow/apps/scowd/protos/gen/api/application/apiv1connect"
	"net/http"

	"connectrpc.com/connect"
	"github.com/sirupsen/logrus"
)

type SystemServer struct{}

func NewSystemServiceClient(httpClient *http.Client, url string) apiv1connect.SystemServiceClient {
	return apiv1connect.NewSystemServiceClient(httpClient, url)
}

// func handleSystemRequest[T, D any](
// 	ctx context.Context,
// 	req *connect.Request[T],
// 	userID string,
// 	serviceOperation func(client apiv1connect.SystemServiceClient, ctx context.Context, req *connect.Request[T]) (*connect.Response[D], error),
// ) (*connect.Response[D], error) {
// 	childProcess, err := process.GetChildProcess(userID)
// 	if err != nil {
// 		return nil, err
// 	}
// 	defer childProcess.FinishedUsing()

// 	client := process.GetChildProcessClient(NewSystemServiceClient, childProcess.GetPort())

// 	clientReq, err := request.SetSecretHeader(req.Msg, childProcess.GetPort())
// 	if err != nil {
// 		return nil, connect.NewError(
// 			connect.CodeInternal,
// 			fmt.Errorf("set secret header for %s error: %v", childProcess.GetPort(), err),
// 		)
// 	}

// 	return serviceOperation(client, ctx, clientReq)
// }

func (d *SystemServer) CheckHealth(
	ctx context.Context,
	req *connect.Request[apiv1.CheckHealthRequest],
) (*connect.Response[apiv1.CheckHealthResponse], error) {

	res := connect.NewResponse(&apiv1.CheckHealthResponse{})

	return res, nil
}

func (s *SystemServer) GetUserIdentityInfo(
	ctx context.Context,
	req *connect.Request[apiv1.GetUserIdentityInfoRequest],
) (*connect.Response[apiv1.GetUserIdentityInfoResponse], error) {
	if req.Msg.UserId == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("user_id is required"))
	}

	logrus.Infof("get user identity info: %s", req.Msg.UserId)

	uid, gid, groups, err := auth.GetUserInfo(req.Msg.UserId)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to get user info for %s: %w", req.Msg.UserId, err))
	}

	// 转换groups类型：[]int -> []uint32
	pbGroups := make([]uint32, 0, len(groups))
	for _, g := range groups {
		pbGroups = append(pbGroups, uint32(g))
	}

	res := connect.NewResponse(&apiv1.GetUserIdentityInfoResponse{
		Uid:    uid,
		Gid:    gid,
		Groups: pbGroups,
	})

	return res, nil
}
