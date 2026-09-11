package handlers

import (
	"context"
	"fmt"
	"net/http"

	"scowd/pkg/api/utils/process"
	"scowd/pkg/api/utils/request"

	apiv1 "scowd/protos/gen/api/application"
	"scowd/protos/gen/api/application/apiv1connect"

	"connectrpc.com/connect"
)

type AppServer struct{}

func handleAppRequest[T, D any](
	ctx context.Context,
	req *connect.Request[T],
	userID string,
	serviceOperation func(client apiv1connect.AppServiceClient, ctx context.Context, req *connect.Request[T]) (*connect.Response[D], error),
) (*connect.Response[D], error) {
	childProcess, err := process.GetChildProcess(userID)
	if err != nil {
		return nil, err
	}
	defer childProcess.FinishedUsing()

	client := process.GetChildProcessClient(NewAppServiceClient, childProcess)

	clientReq, err := request.SetSecretHeader(req.Msg, childProcess.GetPort())
	if err != nil {
		return nil, connect.NewError(
			connect.CodeInternal,
			fmt.Errorf("set secret header for %s error: %v", childProcess.GetPort(), err),
		)
	}

	return serviceOperation(client, ctx, clientReq)
}

func NewAppServiceClient(httpClient *http.Client, url string) apiv1connect.AppServiceClient {
	return apiv1connect.NewAppServiceClient(httpClient, url)
}

func (d *AppServer) GetAppLastSubmission(
	ctx context.Context,
	req *connect.Request[apiv1.GetAppLastSubmissionRequest],
) (*connect.Response[apiv1.GetAppLastSubmissionResponse], error) {
	return handleAppRequest(ctx, req, req.Msg.UserId, apiv1connect.AppServiceClient.GetAppLastSubmission)
}

func (d *AppServer) RefreshVncPassword(
	ctx context.Context,
	req *connect.Request[apiv1.RefreshVncPasswordRequest],
) (*connect.Response[apiv1.RefreshVncPasswordResponse], error) {
	return handleAppRequest(ctx, req, req.Msg.UserId, apiv1connect.AppServiceClient.RefreshVncPassword)
}

func (d *AppServer) RunScript(
	ctx context.Context,
	req *connect.Request[apiv1.RunScriptRequest],
) (*connect.Response[apiv1.RunScriptResponse], error) {
	return handleAppRequest(ctx, req, req.Msg.UserId, apiv1connect.AppServiceClient.RunScript)
}
