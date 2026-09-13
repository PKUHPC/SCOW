package handlers

import (
	"context"
	"errors"
	"fmt"
	customError "github.com/PKUHPC/private-scow/apps/scowd/internal/api/rpcerror"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/api/utils"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/api/utils/process"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/process/parent"
	apiv1 "github.com/PKUHPC/private-scow/apps/scowd/protos/gen/api/application"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/PKUHPC/private-scow/apps/scowd/protos/gen/api/application/apiv1connect"

	"connectrpc.com/connect"
	"github.com/sirupsen/logrus"
)

type ShellServer struct{}

func NewShellServiceClient(httpClient *http.Client, url string) apiv1connect.ShellServiceClient {
	return apiv1connect.NewShellServiceClient(httpClient, url)
}

func (d *ShellServer) Shell(
	ctx context.Context,
	stream *connect.BidiStream[apiv1.ShellRequest, apiv1.ShellResponse],
) error {
	var (
		childClient    apiv1connect.ShellServiceClient
		childProcess   *parent.ChildProcess
		childStream    *connect.BidiStreamForClient[apiv1.ShellRequest, apiv1.ShellResponse]
		wg             sync.WaitGroup
		userID         string
		shellConnected bool
	)

	defer func() {
		wg.Wait() // Ensure all goroutines are completed
		if shellConnected && childProcess != nil {
			childProcess.DecShellConnections()
		}
		if childStream != nil {
			_ = childStream.CloseRequest()  // Safely close request stream
			_ = childStream.CloseResponse() // Safely close response stream
		}
	}()

	for {
		req, err := stream.Receive()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			if connectErr := new(connect.Error); errors.As(err, &connectErr) {
				return connectErr
			}
			return connect.NewError(connect.CodeInternal, fmt.Errorf("failed to receive request: %w", err))
		}

		switch msg := req.Message.(type) {
		case *apiv1.ShellRequest_Connect_:
			if childStream != nil {
				logrus.Warn("Received duplicate Connect request")
				continue
			}
			userID = msg.Connect.UserId

			// Create child process (with error wrapping)
			cp, err := parent.GlobalChildProcessManager.GetOrCreateChildProcess(userID)
			if err != nil {
				logrus.Errorf("Failed to create child process: %v", err)
				return connect.NewError(
					connect.CodeInternal,
					fmt.Errorf("%w: %v", errors.New(customError.MainStartChildProcessError), err),
				)
			}
			childProcess = cp
			childProcess.IncShellConnections()
			shellConnected = true
			defer childProcess.FinishedUsing()

			childClient = process.GetChildProcessClient(NewShellServiceClient, childProcess)
			childStream = childClient.Shell(ctx)

			// Start bidirectional forwarding goroutine
			wg.Add(1)
			go func() {
				defer wg.Done()
				for {
					res, err := childStream.Receive()
					childProcess.UpdateLastUsed()

					if err != nil {
						logrus.Errorf("Failed to receive response: %v, user: %s", err, userID)
						return
					}

					if sendErr := stream.Send(res); sendErr != nil {
						logrus.Errorf("Failed to send response: %v, user: %s", sendErr, userID)
						return
					}
				}
			}()

			// Send initial connection request (with retry mechanism)
			if err := retryOperation(3, 100*time.Millisecond, func() error {
				childProcess.UpdateLastUsed()
				return childStream.Send(req)
			}); err != nil {
				return connect.NewError(connect.CodeUnavailable,
					fmt.Errorf("child process connection failed: %w", err))
			}

		case *apiv1.ShellRequest_Resize_:
			if childStream == nil {
				return connect.NewError(connect.CodeFailedPrecondition,
					errors.New("child stream not initialized"))
			}

			childProcess.UpdateLastUsed()
			if err := childStream.Send(req); err != nil {
				return utils.WrapStreamError("Failed to send resize request", err)
			}
		case *apiv1.ShellRequest_Data_:
			if childStream == nil {
				return connect.NewError(connect.CodeFailedPrecondition,
					errors.New("child stream not initialized"))
			}

			childProcess.UpdateLastUsed()
			if err := childStream.Send(req); err != nil {
				return utils.WrapStreamError("Failed to send data", err)
			}
		case *apiv1.ShellRequest_Disconnect_:
			if childStream == nil {
				return connect.NewError(connect.CodeFailedPrecondition,
					errors.New("child stream not initialized"))
			}

			childProcess.UpdateLastUsed()
			if err := childStream.Send(req); err != nil {
				return utils.WrapStreamError("Failed to send disconnect request", err)
			}

			if err := childStream.CloseRequest(); err != nil {
				logrus.Warnf("Failed to close child stream: %v, user: %s", err, userID)
			}

			return nil

		default:
			return connect.NewError(connect.CodeInvalidArgument,
				errors.New("unknown message type"))
		}
	}
}

func retryOperation(attempts int, delay time.Duration, fn func() error) error {
	var err error
	for i := 0; i < attempts; i++ {
		if err = fn(); err == nil {
			return nil
		}
		time.Sleep(delay)
	}
	return err
}
