package handlers

import (
	"context"
	"errors"
	"strings"

	apiv1 "github.com/PKUHPC/private-scow/apps/scowd/protos/gen/api/storage"

	storageUtils "github.com/PKUHPC/private-scow/apps/scowd/internal/storage/disk"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/storage/filesystem"

	"connectrpc.com/connect"
	"github.com/sirupsen/logrus"
)

const bytesPerMB = 1024 * 1024

type StorageQuotaServer struct{}

// getAdapter 根据请求中的 StorageConfig 创建对应的文件系统适配器
func (s *StorageQuotaServer) getAdapter(path string, storage *apiv1.StorageConfig) (filesystem.FileSystemAdapter, error) {

	if storage == nil {
		logrus.Errorf("Storage config is nil")
		return nil, errors.New("storage config is required")
	}

	adapter, err := filesystem.NewAdapter(path, storage)
	if err != nil {
		logrus.WithError(err).
			WithField("path", path).
			WithField("storageId", storage.StorageId).
			Error("Get filesystem adapter failed")
		return nil, err
	}

	return adapter, nil
}

func (s *StorageQuotaServer) GetFilesystemStorageUsage(
	ctx context.Context,
	req *connect.Request[apiv1.GetFilesystemStorageUsageRequest],
) (*connect.Response[apiv1.GetFilesystemStorageUsageResponse], error) {
	path := strings.TrimSpace(req.Msg.GetPath())
	if path == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("path is required"))
	}

	totalBytes, usedBytes, err := storageUtils.GetDiskSpace(path)
	if err != nil {
		logrus.WithError(err).
			WithField("path", path).
			Error("Failed to get filesystem storage usage")
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&apiv1.GetFilesystemStorageUsageResponse{
		TotalStorageMb: totalBytes / bytesPerMB,
		UsedStorageMb:  usedBytes / bytesPerMB,
	}), nil
}

func (s *StorageQuotaServer) GetUsersStorageQuota(
	ctx context.Context,
	req *connect.Request[apiv1.GetUsersStorageQuotaRequest],
) (*connect.Response[apiv1.GetUsersStorageQuotaResponse], error) {

	log := logrus.WithFields(logrus.Fields{
		"path":      req.Msg.GetPath(),
		"storageId": req.Msg.GetStorage().GetStorageId(),
	})

	adapter, err := s.getAdapter(req.Msg.Path, req.Msg.Storage)
	if err != nil {
		log.WithError(err).Errorf("Failed to get the file adapter")
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	quotaInfos, err := adapter.GetUsersQuota(req.Msg.UserIds, req.Msg.Path)
	if err != nil {
		log.WithError(err).Errorf("Failed to get user's quota info")
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	var results []*apiv1.UserStorageQuotaInfo
	for _, info := range quotaInfos {
		userQuotaInfo := &apiv1.UserStorageQuotaInfo{
			UserId:           info.UserID,
			UsedStorageMb:    info.BlockUsedStorageBytes / bytesPerMB,
			BlockHardLimitMb: info.BlockHardLimitBytes / bytesPerMB,
			BlockSoftLimitMb: info.BlockSoftLimitBytes / bytesPerMB,
			BlockGraceDays:   int32(info.BlockGraceDays),
		}

		results = append(results, userQuotaInfo)
	}

	return connect.NewResponse(&apiv1.GetUsersStorageQuotaResponse{
		UserQuotaInfos: results,
	}), nil
}

func (s *StorageQuotaServer) SetUserStorageQuota(
	ctx context.Context,
	req *connect.Request[apiv1.SetUserStorageQuotaRequest],
) (*connect.Response[apiv1.SetUserStorageQuotaResponse], error) {

	log := logrus.WithFields(logrus.Fields{
		"path":      req.Msg.GetPath(),
		"storageId": req.Msg.GetStorage().GetStorageId(),
	})

	adapter, err := s.getAdapter(req.Msg.Path, req.Msg.Storage)
	if err != nil {
		log.WithError(err).Errorf("Failed to get the file adapter")
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	err = adapter.SetUserQuota(req.Msg.UserId, req.Msg.Path, req.Msg.QuotaMb*bytesPerMB, 0, 0)
	if err != nil {
		log.WithError(err).Errorf("Failed to set user's quota info")
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&apiv1.SetUserStorageQuotaResponse{}), nil
}

func (s *StorageQuotaServer) GetGroupsStorageQuota(
	ctx context.Context,
	req *connect.Request[apiv1.GetGroupsStorageQuotaRequest],
) (*connect.Response[apiv1.GetGroupsStorageQuotaResponse], error) {

	log := logrus.WithFields(logrus.Fields{
		"path":      req.Msg.GetPath(),
		"storageId": req.Msg.GetStorage().GetStorageId(),
	})

	adapter, err := s.getAdapter(req.Msg.Path, req.Msg.Storage)
	if err != nil {
		log.WithError(err).Errorf("Failed to get the file adapter")
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	quotaInfos, err := adapter.GetGroupsQuota(req.Msg.GroupNames, req.Msg.Path)
	if err != nil {
		log.WithError(err).Errorf("Failed to get group's quota info")
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	const bytesPerMb = 1024 * 1024
	var results []*apiv1.GroupStorageQuotaInfo
	for _, info := range quotaInfos {
		results = append(results, &apiv1.GroupStorageQuotaInfo{
			GroupName:        info.GroupName,
			UsedStorageMb:    info.BlockUsedStorageBytes / bytesPerMb,
			BlockHardLimitMb: info.BlockHardLimitBytes / bytesPerMb,
			BlockSoftLimitMb: info.BlockSoftLimitBytes / bytesPerMb,
			BlockGraceDays:   int32(info.BlockGraceDays),
		})
	}

	return connect.NewResponse(&apiv1.GetGroupsStorageQuotaResponse{
		GroupQuotaInfos: results,
	}), nil
}

func (s *StorageQuotaServer) SetGroupStorageQuota(
	ctx context.Context,
	req *connect.Request[apiv1.SetGroupStorageQuotaRequest],
) (*connect.Response[apiv1.SetGroupStorageQuotaResponse], error) {

	log := logrus.WithFields(logrus.Fields{
		"path":      req.Msg.GetPath(),
		"storageId": req.Msg.GetStorage().GetStorageId(),
	})

	adapter, err := s.getAdapter(req.Msg.Path, req.Msg.Storage)
	if err != nil {
		log.WithError(err).Errorf("Failed to get the file adapter")
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	const bytesPerMb = 1024 * 1024
	err = adapter.SetGroupQuota(req.Msg.GroupName, req.Msg.Path, req.Msg.QuotaMb*bytesPerMb, 0, 0)
	if err != nil {
		log.WithError(err).Errorf("Failed to set group's quota info")
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&apiv1.SetGroupStorageQuotaResponse{}), nil
}

func (s *StorageQuotaServer) SetGroupsStorageQuota(
	ctx context.Context,
	req *connect.Request[apiv1.SetGroupsStorageQuotaRequest],
) (*connect.Response[apiv1.SetGroupsStorageQuotaResponse], error) {

	log := logrus.WithFields(logrus.Fields{
		"path":      req.Msg.GetPath(),
		"storageId": req.Msg.GetStorage().GetStorageId(),
	})

	adapter, err := s.getAdapter(req.Msg.Path, req.Msg.Storage)
	if err != nil {
		log.WithError(err).Errorf("Failed to get the file adapter")
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	if req.Msg.QuotaMb == 0 {
		log.Error("Cannot set quota to 0")
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("quotaMb cannot be zero"))
	}

	const bytesPerMb = 1024 * 1024
	successGroups, failedGroups, err := adapter.SetGroupsQuota(req.Msg.GroupNames, req.Msg.Path, req.Msg.QuotaMb*bytesPerMb, 0, 0)
	if err != nil {
		log.Errorf("Failed to set group's quota info")
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if len(failedGroups) > 0 {
		log.Warnf("Failed to set quota for %d/%d groups: %v. Please ensure quota is enabled on the filesystem at path %s",
			len(failedGroups), len(req.Msg.GroupNames), failedGroups, req.Msg.GetPath())
	}

	return connect.NewResponse(&apiv1.SetGroupsStorageQuotaResponse{
		SucceededGroupNames: successGroups,
		FailedGroupNames:    failedGroups,
	}), nil
}

func (s *StorageQuotaServer) SetUsersStorageQuota(
	ctx context.Context,
	req *connect.Request[apiv1.SetUsersStorageQuotaRequest],
) (*connect.Response[apiv1.SetUsersStorageQuotaResponse], error) {

	log := logrus.WithFields(logrus.Fields{
		"path":      req.Msg.GetPath(),
		"storageId": req.Msg.GetStorage().GetStorageId(),
	})

	adapter, err := s.getAdapter(req.Msg.Path, req.Msg.Storage)
	if err != nil {
		log.WithError(err).Errorf("Failed to get the file adapter")
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	if req.Msg.QuotaMb == 0 {
		log.Error("Cannot set quota to 0")
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("quotaMb cannot be zero"))
	}

	successUsers, failedUsers, err := adapter.SetUsersQuota(req.Msg.UserIds, req.Msg.Path, req.Msg.QuotaMb*bytesPerMB, 0, 0)
	if err != nil {
		log.Errorf("Failed to set user's quota info")
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if len(failedUsers) > 0 {
		log.Warnf("Failed to set quota for %d/%d users: %v. Please ensure quota is enabled on the filesystem at path %s",
			len(failedUsers), len(req.Msg.UserIds), failedUsers, req.Msg.GetPath())
	}

	return connect.NewResponse(&apiv1.SetUsersStorageQuotaResponse{
		SucceededUserIds: successUsers,
		FailedUserIds:    failedUsers,
	}), nil
}
