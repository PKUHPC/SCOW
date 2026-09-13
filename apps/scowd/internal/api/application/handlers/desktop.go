package handlers

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/PKUHPC/private-scow/apps/scowd/internal/api/utils/process"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/api/utils/request"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/desktop/model"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/desktop/repository"

	apiv1 "github.com/PKUHPC/private-scow/apps/scowd/protos/gen/api/application"
	"github.com/PKUHPC/private-scow/apps/scowd/protos/gen/api/application/apiv1connect"

	"google.golang.org/protobuf/types/known/timestamppb"

	"connectrpc.com/connect"
	"github.com/sirupsen/logrus"
)

type DesktopServer struct{ repo repository.DesktopRepository }

func NewDesktopServer(repo repository.DesktopRepository) *DesktopServer {
	return &DesktopServer{repo: repo}
}

func handleDesktopRequest[T, D any](
	ctx context.Context,
	req *connect.Request[T],
	userID string,
	serviceOperation func(client apiv1connect.DesktopServiceClient, ctx context.Context, req *connect.Request[T]) (*connect.Response[D], error),
) (*connect.Response[D], error) {
	childProcess, err := process.GetChildProcess(userID)
	if err != nil {
		return nil, err
	}
	defer childProcess.FinishedUsing()

	client := process.GetChildProcessClient(NewDesktopServiceClient, childProcess)

	clientReq, err := request.SetSecretHeader(req.Msg, childProcess.GetPort())
	if err != nil {
		return nil, connect.NewError(
			connect.CodeInternal,
			fmt.Errorf("set secret header for %s error: %v", childProcess.GetPort(), err),
		)
	}

	return serviceOperation(client, ctx, clientReq)
}

func NewDesktopServiceClient(httpClient *http.Client, url string) apiv1connect.DesktopServiceClient {
	return apiv1connect.NewDesktopServiceClient(httpClient, url)
}

func (d *DesktopServer) CreateDesktop(
	ctx context.Context,
	req *connect.Request[apiv1.CreateDesktopRequest],
) (*connect.Response[apiv1.CreateDesktopResponse], error) {
	unlock := desktopCreateLocks.lock(req.Msg.UserId)
	defer unlock()

	// Sync DB with machine state first, then use DB count for quota check
	synced, err := d.repo.ListUserDesktops(req.Msg.DesktopDir, req.Msg.VncServerBinPath, req.Msg.UserId)
	if err != nil {
		logrus.Errorf("CreateDesktop: sync desktop status error: %v", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	if len(synced) >= int(req.Msg.MaxDesktops) {
		return nil, connect.NewError(connect.CodeResourceExhausted, errors.New("too many desktops"))
	}

	childRes, err := handleDesktopRequest(ctx, req, req.Msg.UserId, apiv1connect.DesktopServiceClient.CreateDesktop)
	if err != nil {
		errCode := connect.CodeOf(err)
		switch errCode {
		case connect.CodeInternal:
			logrus.Errorf("CreateDesktop: failed to create desktop: %v", err)
		default:
			logrus.Error("An unknown error occurred while creating the desktop")
		}
		return nil, connect.NewError(errCode, err)
	}

	desktopInfo := model.DesktopInfo{
		Host:        req.Msg.LoginNode,
		DisplayID:   int(childRes.Msg.DisplayId),
		DesktopName: req.Msg.DesktopName,
		Wm:          req.Msg.Wm,
		CreateTime:  time.Now().Format(time.RFC3339Nano),
		IsActive:    1,
	}

	err = d.repo.Add(req.Msg.UserId, &desktopInfo)
	if err != nil {
		logrus.Errorf("CreateDesktop: AddDesktopToDB error: %v", err)
		// VNC has already been started; best-effort cleanup prevents an
		// untracked desktop from consuming a future quota slot.
		cleanupReq := &apiv1.KillDesktopRequest{
			UserId:           req.Msg.UserId,
			VncServerBinPath: req.Msg.VncServerBinPath,
			DisplayId:        uint32(childRes.Msg.DisplayId),
			LoginNode:        req.Msg.LoginNode,
			DesktopDir:       req.Msg.DesktopDir,
		}
		if _, cleanupErr := handleDesktopRequest(ctx, connect.NewRequest(cleanupReq), req.Msg.UserId, apiv1connect.DesktopServiceClient.KillDesktop); cleanupErr != nil {
			logrus.Errorf("CreateDesktop: failed to clean up VNC desktop %d after DB error: %v", childRes.Msg.DisplayId, cleanupErr)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return childRes, nil
}

func (d *DesktopServer) KillDesktop(
	ctx context.Context,
	req *connect.Request[apiv1.KillDesktopRequest],
) (*connect.Response[apiv1.KillDesktopResponse], error) {

	effectiveDisplay := int(req.Msg.DisplayId)
	var targetDesktop *model.DesktopInfo
	if req.Msg.GetId() != 0 {
		if di, err := d.repo.GetDesktopByID(req.Msg.UserId, int(req.Msg.GetId())); err == nil && di != nil && di.DisplayID > 0 {
			effectiveDisplay = di.DisplayID
			targetDesktop = di
		}
	}

	// if targetDesktop is nil, we try to find it by displayID
	if targetDesktop == nil && effectiveDisplay != 0 {
		desktops, err := d.repo.GetDesktopsByDisplay(req.Msg.UserId, effectiveDisplay)
		if err == nil && len(desktops) > 0 {
			var best *model.DesktopInfo
			for _, d := range desktops {
				if best == nil {
					best = d
					continue
				}
				// Priority: Inactive (0) > Active (1)
				if d.IsActive < best.IsActive {
					best = d
				} else if d.IsActive == best.IsActive {
					// Priority: Oldest > Newest
					t1, _ := time.Parse(time.RFC3339Nano, best.CreateTime)
					t2, _ := time.Parse(time.RFC3339Nano, d.CreateTime)
					if t2.Before(t1) {
						best = d
					}
				}
			}
			targetDesktop = best
		}
	}

	// Determine if we should treat this desktop as Active
	// If we have the DB record, use its status. If not (e.g. Id not provided or not found), assume Active (force kill).
	isActive := true
	if targetDesktop != nil {
		isActive = targetDesktop.IsActive == 1
	}

	shouldKillOnMachine := true

	if !isActive {
		// If DB says it's inactive, we check the actual machine state.
		// We only want to "cleanup" if it's stale (Display exists but No PID).
		// If Display exists AND PID exists, we assume it's a NEW desktop reusing the ID, so we DO NOT kill.
		// If Display does not exist, we don't need to kill.

		listReq := &apiv1.ListUserDesktopsRequest{
			UserId:           req.Msg.UserId,
			VncServerBinPath: req.Msg.VncServerBinPath,
			DesktopDir:       req.Msg.DesktopDir,
		}
		childListRes, err := handleDesktopRequest(ctx, connect.NewRequest(listReq), req.Msg.UserId, apiv1connect.DesktopServiceClient.ListUserDesktops)
		if err != nil {
			// If we can't check, we log error.
			logrus.Errorf("KillDesktop: failed to check machine state for inactive desktop %d: %v", effectiveDisplay, err)
			return nil, connect.NewError(connect.CodeInternal, err)
		} else {
			var machineDesktop *apiv1.Desktop
			for _, d := range childListRes.Msg.UserDesktops {
				if d.DisplayId == uint32(effectiveDisplay) {
					machineDesktop = d
					break
				}
			}

			if machineDesktop != nil {
				if machineDesktop.IsActive {
					// Display exists AND Has PID -> New active desktop. Do NOT kill.
					shouldKillOnMachine = false
				} else {
					// Display exists but No PID -> Stale. Cleanup needed.
					shouldKillOnMachine = true
				}
			} else {
				// Display does not exist. No kill needed.
				shouldKillOnMachine = false
			}
		}
	}

	if shouldKillOnMachine {
		override := &apiv1.KillDesktopRequest{
			UserId:           req.Msg.UserId,
			VncServerBinPath: req.Msg.VncServerBinPath,
			DisplayId:        uint32(effectiveDisplay),
			LoginNode:        req.Msg.LoginNode,
			DesktopDir:       req.Msg.DesktopDir,
			Id:               req.Msg.Id,
		}
		_, err := handleDesktopRequest(
			ctx, connect.NewRequest(override), req.Msg.UserId,
			apiv1connect.DesktopServiceClient.KillDesktop,
		)
		if err != nil {
			errCode := connect.CodeOf(err)
			switch errCode {
			case connect.CodeInternal:
				logrus.Errorf("KillDesktop: failed to kill desktop %d: %v", effectiveDisplay, err)
			default:
				logrus.Errorf("An unknown error occurred while killing the desktop %d: %v", effectiveDisplay, err)
			}
			return nil, connect.NewError(errCode, err)
		}
	}

	if targetDesktop != nil {
		err := d.repo.Remove(targetDesktop.ID)
		if err != nil {
			logrus.Errorf("KillDesktop: remove desktop from db error: %v", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
	}

	return connect.NewResponse(&apiv1.KillDesktopResponse{}), nil
}

func (d *DesktopServer) ConnectToDesktop(
	ctx context.Context,
	req *connect.Request[apiv1.ConnectToDesktopRequest],
) (*connect.Response[apiv1.ConnectToDesktopResponse], error) {
	effectiveDisplay := int(req.Msg.DisplayId)
	if req.Msg.GetId() != 0 {
		if di, err := d.repo.GetDesktopByID(req.Msg.UserId, int(req.Msg.GetId())); err == nil && di != nil && di.DisplayID > 0 {
			effectiveDisplay = di.DisplayID
		}
	}
	override := &apiv1.ConnectToDesktopRequest{
		UserId:        req.Msg.UserId,
		DisplayId:     uint32(effectiveDisplay),
		VncPasswdPath: req.Msg.VncPasswdPath,
		Id:            req.Msg.Id,
	}
	childRes, err := handleDesktopRequest(ctx, connect.NewRequest(override), req.Msg.UserId, apiv1connect.DesktopServiceClient.ConnectToDesktop)
	if err != nil {
		return nil, err
	}
	now := time.Now().Format(time.RFC3339Nano)
	var updErr error
	if req.Msg.GetId() != 0 {
		updErr = d.repo.UpdateLastConnectTimeByID(int(req.Msg.GetId()), now)
	} else {
		updErr = d.repo.UpdateLastConnectTime(req.Msg.UserId, effectiveDisplay, now)
	}
	if updErr != nil {
		logrus.Errorf("ConnectToDesktop: update last connect time error: %v", err)
		return nil, connect.NewError(connect.CodeInternal, updErr)
	}
	return childRes, nil
}

func (d *DesktopServer) ListUserDesktops(
	ctx context.Context,
	req *connect.Request[apiv1.ListUserDesktopsRequest],
) (*connect.Response[apiv1.ListUserDesktopsResponse], error) {

	desktops, err := d.repo.ListUserDesktops(req.Msg.DesktopDir, req.Msg.VncServerBinPath, req.Msg.UserId)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	var userDesktops []*apiv1.Desktop
	for _, d := range desktops {
		parsedTime, err := time.Parse(time.RFC3339Nano, d.CreateTime)
		if err != nil {
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		userDesktops = append(userDesktops, &apiv1.Desktop{
			Id:          uint32(d.ID),
			DisplayId:   uint32(d.DisplayID),
			DesktopName: d.DesktopName,
			Wm:          d.Wm,
			CreateTime:  timestamppb.New(parsedTime),
			IsActive:    d.IsActive == 1,
		})
	}

	return connect.NewResponse(&apiv1.ListUserDesktopsResponse{UserDesktops: userDesktops}), nil
}
