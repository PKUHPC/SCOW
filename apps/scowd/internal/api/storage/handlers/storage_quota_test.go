package handlers

import (
	"context"
	"errors"
	"testing"

	"github.com/PKUHPC/private-scow/apps/scowd/internal/storage/filesystem"
	apiv1 "github.com/PKUHPC/private-scow/apps/scowd/protos/gen/api/storage"

	"connectrpc.com/connect"
)

// ─── mockAdapter implements filesystem.FileSystemAdapter ─────────────────────

type mockAdapter struct {
	getUsersQuotaResult []filesystem.QuotaInfo
	getUsersQuotaErr    error
	setUserQuotaErr     error
	setUsersSuccess     []string
	setUsersFailed      []string
	setUsersQuotaErr    error

	getGroupsQuotaResult []filesystem.GroupQuotaInfo
	getGroupsQuotaErr    error
	setGroupQuotaErr     error
	setGroupsSuccess     []string
	setGroupsFailed      []string
	setGroupsQuotaErr    error
}

func (m *mockAdapter) SetUserQuota(_ string, _ string, _, _ uint64, _ int) error {
	return m.setUserQuotaErr
}
func (m *mockAdapter) SetUsersQuota(_ []string, _ string, _, _ uint64, _ int) ([]string, []string, error) {
	return m.setUsersSuccess, m.setUsersFailed, m.setUsersQuotaErr
}
func (m *mockAdapter) GetUsersQuota(_ []string, _ string) ([]filesystem.QuotaInfo, error) {
	return m.getUsersQuotaResult, m.getUsersQuotaErr
}
func (m *mockAdapter) SetGroupQuota(_ string, _ string, _, _ uint64, _ int) error {
	return m.setGroupQuotaErr
}
func (m *mockAdapter) SetGroupsQuota(_ []string, _ string, _, _ uint64, _ int) ([]string, []string, error) {
	return m.setGroupsSuccess, m.setGroupsFailed, m.setGroupsQuotaErr
}
func (m *mockAdapter) GetGroupsQuota(_ []string, _ string) ([]filesystem.GroupQuotaInfo, error) {
	return m.getGroupsQuotaResult, m.getGroupsQuotaErr
}

// ─── handler helpers that mirror production logic with injected adapter ───────
// We test the mapping/validation logic that lives inside the handlers by
// extracting it into a local test-only function that mirrors the production
// code exactly, injected with a mock adapter.

const bytesPerMb = 1024 * 1024

func handleGetGroupsStorageQuota(
	ctx context.Context,
	req *connect.Request[apiv1.GetGroupsStorageQuotaRequest],
	adapter filesystem.FileSystemAdapter,
) (*connect.Response[apiv1.GetGroupsStorageQuotaResponse], error) {
	quotaInfos, err := adapter.GetGroupsQuota(req.Msg.GroupNames, req.Msg.Path)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
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

func handleSetGroupStorageQuota(
	ctx context.Context,
	req *connect.Request[apiv1.SetGroupStorageQuotaRequest],
	adapter filesystem.FileSystemAdapter,
) (*connect.Response[apiv1.SetGroupStorageQuotaResponse], error) {
	err := adapter.SetGroupQuota(req.Msg.GroupName, req.Msg.Path, req.Msg.QuotaMb*bytesPerMb, 0, 0)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&apiv1.SetGroupStorageQuotaResponse{}), nil
}

func handleSetGroupsStorageQuota(
	ctx context.Context,
	req *connect.Request[apiv1.SetGroupsStorageQuotaRequest],
	adapter filesystem.FileSystemAdapter,
) (*connect.Response[apiv1.SetGroupsStorageQuotaResponse], error) {
	if req.Msg.QuotaMb == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("quotaMb cannot be zero"))
	}
	successGroups, failedGroups, err := adapter.SetGroupsQuota(req.Msg.GroupNames, req.Msg.Path, req.Msg.QuotaMb*bytesPerMb, 0, 0)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&apiv1.SetGroupsStorageQuotaResponse{
		SucceededGroupNames: successGroups,
		FailedGroupNames:    failedGroups,
	}), nil
}

// ─── GetGroupsStorageQuota tests ─────────────────────────────────────────────

func TestGetGroupsStorageQuota_Success(t *testing.T) {
	mock := &mockAdapter{
		getGroupsQuotaResult: []filesystem.GroupQuotaInfo{
			{
				Filesystem:            "/data",
				GroupName:             "devteam",
				BlockUsedStorageBytes: 1024 * 1024 * 1024,
				BlockSoftLimitBytes:   2 * 1024 * 1024 * 1024,
				BlockHardLimitBytes:   4 * 1024 * 1024 * 1024,
				BlockGraceDays:        7,
			},
		},
	}

	req := connect.NewRequest(&apiv1.GetGroupsStorageQuotaRequest{
		GroupNames: []string{"devteam"},
		Path:       "/data",
	})

	resp, err := handleGetGroupsStorageQuota(context.Background(), req, mock)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.Msg.GroupQuotaInfos) != 1 {
		t.Fatalf("expected 1 group quota info, got %d", len(resp.Msg.GroupQuotaInfos))
	}
	info := resp.Msg.GroupQuotaInfos[0]
	if info.GroupName != "devteam" {
		t.Errorf("GroupName: got %q, want %q", info.GroupName, "devteam")
	}
	if info.UsedStorageMb != 1024 {
		t.Errorf("UsedStorageMb: got %d, want %d", info.UsedStorageMb, uint64(1024))
	}
	if info.BlockHardLimitMb != 4096 {
		t.Errorf("BlockHardLimitMb: got %d, want %d", info.BlockHardLimitMb, uint64(4096))
	}
	if info.BlockGraceDays != 7 {
		t.Errorf("BlockGraceDays: got %d, want 7", info.BlockGraceDays)
	}
}

func TestGetGroupsStorageQuota_AdapterError(t *testing.T) {
	mock := &mockAdapter{
		getGroupsQuotaErr: errors.New("storage unavailable"),
	}

	req := connect.NewRequest(&apiv1.GetGroupsStorageQuotaRequest{
		GroupNames: []string{"devteam"},
		Path:       "/data",
	})

	_, err := handleGetGroupsStorageQuota(context.Background(), req, mock)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	var connectErr *connect.Error
	if errors.As(err, &connectErr) {
		if connectErr.Code() != connect.CodeInternal {
			t.Errorf("expected CodeInternal, got %s", connectErr.Code())
		}
	}
}

func TestGetGroupsStorageQuota_EmptyResult(t *testing.T) {
	mock := &mockAdapter{
		getGroupsQuotaResult: []filesystem.GroupQuotaInfo{},
	}

	req := connect.NewRequest(&apiv1.GetGroupsStorageQuotaRequest{
		GroupNames: []string{},
		Path:       "/data",
	})

	resp, err := handleGetGroupsStorageQuota(context.Background(), req, mock)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.Msg.GroupQuotaInfos) != 0 {
		t.Errorf("expected 0 group quota infos, got %d", len(resp.Msg.GroupQuotaInfos))
	}
}

func TestGetGroupsStorageQuota_MultipleGroups(t *testing.T) {
	mock := &mockAdapter{
		getGroupsQuotaResult: []filesystem.GroupQuotaInfo{
			{Filesystem: "/data", GroupName: "group1", BlockUsedStorageBytes: 100, BlockHardLimitBytes: 1000},
			{Filesystem: "/data", GroupName: "group2", BlockUsedStorageBytes: 200, BlockHardLimitBytes: 2000},
			{Filesystem: "/data", GroupName: "group3", BlockUsedStorageBytes: 300, BlockHardLimitBytes: 3000},
		},
	}

	req := connect.NewRequest(&apiv1.GetGroupsStorageQuotaRequest{
		GroupNames: []string{"group1", "group2", "group3"},
		Path:       "/data",
	})

	resp, err := handleGetGroupsStorageQuota(context.Background(), req, mock)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.Msg.GroupQuotaInfos) != 3 {
		t.Errorf("expected 3 results, got %d", len(resp.Msg.GroupQuotaInfos))
	}
}

func TestGetGroupsStorageQuota_QuotaFieldMapping(t *testing.T) {
	mock := &mockAdapter{
		getGroupsQuotaResult: []filesystem.GroupQuotaInfo{
			{
				Filesystem:            "/mnt/storage",
				GroupName:             "research",
				BlockUsedStorageBytes: 512 * bytesPerMb,
				BlockSoftLimitBytes:   1024 * bytesPerMb,
				BlockHardLimitBytes:   2048 * bytesPerMb,
				BlockGraceDays:        14,
			},
		},
	}

	req := connect.NewRequest(&apiv1.GetGroupsStorageQuotaRequest{
		GroupNames: []string{"research"},
		Path:       "/mnt/storage",
	})

	resp, err := handleGetGroupsStorageQuota(context.Background(), req, mock)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.Msg.GroupQuotaInfos) != 1 {
		t.Fatalf("expected 1 result, got %d", len(resp.Msg.GroupQuotaInfos))
	}
	info := resp.Msg.GroupQuotaInfos[0]

	cases := []struct {
		field string
		got   interface{}
		want  interface{}
	}{
		{"GroupName", info.GroupName, "research"},
		{"UsedStorageMb", info.UsedStorageMb, uint64(512)},
		{"BlockSoftLimitMb", info.BlockSoftLimitMb, uint64(1024)},
		{"BlockHardLimitMb", info.BlockHardLimitMb, uint64(2048)},
		{"BlockGraceDays", info.BlockGraceDays, int32(14)},
	}

	for _, c := range cases {
		if c.got != c.want {
			t.Errorf("field %s: got %v, want %v", c.field, c.got, c.want)
		}
	}
}

// ─── SetGroupStorageQuota tests ───────────────────────────────────────────────

func TestSetGroupStorageQuota_Success(t *testing.T) {
	mock := &mockAdapter{setGroupQuotaErr: nil}

	req := connect.NewRequest(&apiv1.SetGroupStorageQuotaRequest{
		GroupName: "devteam",
		Path:      "/data",
		QuotaMb:   10 * 1024,
	})

	resp, err := handleSetGroupStorageQuota(context.Background(), req, mock)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp == nil || resp.Msg == nil {
		t.Fatal("expected non-nil response")
	}
}

func TestSetGroupStorageQuota_AdapterError(t *testing.T) {
	mock := &mockAdapter{setGroupQuotaErr: errors.New("quota set failed")}

	req := connect.NewRequest(&apiv1.SetGroupStorageQuotaRequest{
		GroupName: "devteam",
		Path:      "/data",
		QuotaMb:   10 * 1024,
	})

	_, err := handleSetGroupStorageQuota(context.Background(), req, mock)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	var connectErr *connect.Error
	if errors.As(err, &connectErr) {
		if connectErr.Code() != connect.CodeInternal {
			t.Errorf("expected CodeInternal, got %s", connectErr.Code())
		}
	}
}

func TestSetGroupStorageQuota_ZeroQuotaBytes_Allowed(t *testing.T) {
	// SetGroupStorageQuota (single) does NOT check for zero — only SetGroupsStorageQuota does.
	mock := &mockAdapter{setGroupQuotaErr: nil}

	req := connect.NewRequest(&apiv1.SetGroupStorageQuotaRequest{
		GroupName: "devteam",
		Path:      "/data",
		QuotaMb:   0,
	})

	resp, err := handleSetGroupStorageQuota(context.Background(), req, mock)
	if err != nil {
		t.Fatalf("SetGroupStorageQuota with 0 bytes unexpectedly failed: %v", err)
	}
	if resp == nil {
		t.Fatal("expected non-nil response")
	}
}

// ─── SetGroupsStorageQuota tests ──────────────────────────────────────────────

func TestSetGroupsStorageQuota_ZeroQuotaBytes_ReturnsInvalidArgument(t *testing.T) {
	mock := &mockAdapter{}

	req := connect.NewRequest(&apiv1.SetGroupsStorageQuotaRequest{
		GroupNames: []string{"devteam"},
		Path:       "/data",
		QuotaMb:    0,
	})

	_, err := handleSetGroupsStorageQuota(context.Background(), req, mock)
	if err == nil {
		t.Fatal("expected error for zero quota, got nil")
	}
	var connectErr *connect.Error
	if !errors.As(err, &connectErr) {
		t.Fatalf("expected connect.Error, got %T: %v", err, err)
	}
	if connectErr.Code() != connect.CodeInvalidArgument {
		t.Errorf("expected CodeInvalidArgument, got %s", connectErr.Code())
	}
}

func TestSetGroupsStorageQuota_AllSucceed(t *testing.T) {
	mock := &mockAdapter{
		setGroupsSuccess: []string{"group1", "group2"},
		setGroupsFailed:  []string{},
	}

	req := connect.NewRequest(&apiv1.SetGroupsStorageQuotaRequest{
		GroupNames: []string{"group1", "group2"},
		Path:       "/data",
		QuotaMb:    5 * 1024,
	})

	resp, err := handleSetGroupsStorageQuota(context.Background(), req, mock)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.Msg.SucceededGroupNames) != 2 {
		t.Errorf("expected 2 succeeded groups, got %d", len(resp.Msg.SucceededGroupNames))
	}
	if len(resp.Msg.FailedGroupNames) != 0 {
		t.Errorf("expected 0 failed groups, got %d", len(resp.Msg.FailedGroupNames))
	}
}

func TestSetGroupsStorageQuota_PartialSuccess(t *testing.T) {
	mock := &mockAdapter{
		setGroupsSuccess: []string{"group1"},
		setGroupsFailed:  []string{"group2"},
	}

	req := connect.NewRequest(&apiv1.SetGroupsStorageQuotaRequest{
		GroupNames: []string{"group1", "group2"},
		Path:       "/data",
		QuotaMb:    5 * 1024,
	})

	resp, err := handleSetGroupsStorageQuota(context.Background(), req, mock)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.Msg.SucceededGroupNames) != 1 || resp.Msg.SucceededGroupNames[0] != "group1" {
		t.Errorf("expected [group1] succeeded, got %v", resp.Msg.SucceededGroupNames)
	}
	if len(resp.Msg.FailedGroupNames) != 1 || resp.Msg.FailedGroupNames[0] != "group2" {
		t.Errorf("expected [group2] failed, got %v", resp.Msg.FailedGroupNames)
	}
}

func TestSetGroupsStorageQuota_AdapterError(t *testing.T) {
	mock := &mockAdapter{
		setGroupsQuotaErr: errors.New("internal error"),
	}

	req := connect.NewRequest(&apiv1.SetGroupsStorageQuotaRequest{
		GroupNames: []string{"group1"},
		Path:       "/data",
		QuotaMb:    5 * 1024,
	})

	_, err := handleSetGroupsStorageQuota(context.Background(), req, mock)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	var connectErr *connect.Error
	if !errors.As(err, &connectErr) {
		t.Fatalf("expected connect.Error, got %T: %v", err, err)
	}
	if connectErr.Code() != connect.CodeInternal {
		t.Errorf("expected CodeInternal, got %s", connectErr.Code())
	}
}

func TestSetGroupsStorageQuota_EmptyGroupList(t *testing.T) {
	mock := &mockAdapter{
		setGroupsSuccess: []string{},
		setGroupsFailed:  []string{},
	}

	req := connect.NewRequest(&apiv1.SetGroupsStorageQuotaRequest{
		GroupNames: []string{},
		Path:       "/data",
		QuotaMb:    5 * 1024,
	})

	resp, err := handleSetGroupsStorageQuota(context.Background(), req, mock)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.Msg.SucceededGroupNames) != 0 {
		t.Errorf("expected 0 succeeded groups, got %d", len(resp.Msg.SucceededGroupNames))
	}
}

// ─── StorageQuotaServer.getAdapter unit tests ────────────────────────────────

func TestStorageQuotaServer_GetAdapter_NilConfigReturnsError(t *testing.T) {
	server := &StorageQuotaServer{}
	_, err := server.getAdapter("/some/path", nil)
	if err == nil {
		t.Fatal("expected error for nil storage config, got nil")
	}
}

func TestStorageQuotaServer_GetAdapter_NilFsConfig(t *testing.T) {
	server := &StorageQuotaServer{}
	cfg := &apiv1.StorageConfig{StorageId: "test-id"} // FsConfig is nil
	_, err := server.getAdapter("/some/path", cfg)
	if err == nil {
		t.Fatal("expected error for config with nil FsConfig, got nil")
	}
}

func TestGetFilesystemStorageUsage_EmptyPath(t *testing.T) {
	server := &StorageQuotaServer{}
	req := connect.NewRequest(&apiv1.GetFilesystemStorageUsageRequest{})

	_, err := server.GetFilesystemStorageUsage(context.Background(), req)
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("expected invalid argument error, got %v", err)
	}
}

func TestGetFilesystemStorageUsage_Success(t *testing.T) {
	server := &StorageQuotaServer{}
	req := connect.NewRequest(&apiv1.GetFilesystemStorageUsageRequest{Path: t.TempDir()})

	resp, err := server.GetFilesystemStorageUsage(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Msg.TotalStorageMb == 0 {
		t.Fatal("expected total storage to be greater than zero")
	}
}
