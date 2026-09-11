package handlers

import (
	"testing"

	apiv1 "scowd/protos/gen/api/storage"
)

// ─── buildChownArg ────────────────────────────────────────────────────────────

func uint32Ptr(v uint32) *uint32 { return &v }

// TestBuildChownArg 验证 buildChownArg 根据可选的 uid/gid 生成正确的 chown 参数字符串。
func TestBuildChownArg(t *testing.T) {
	tests := []struct {
		name string
		uid  *uint32
		gid  *uint32
		want string
	}{
		{
			// 同时传入 uid 和 gid，应生成 "uid:gid" 格式
			name: "both uid and gid provided",
			uid:  uint32Ptr(1000),
			gid:  uint32Ptr(2000),
			want: "1000:2000",
		},
		{
			// 只传入 uid，应生成 "uid:" 格式（gid 保持不变）
			name: "only uid provided",
			uid:  uint32Ptr(1000),
			gid:  nil,
			want: "1000:",
		},
		{
			// 只传入 gid，应生成 ":gid" 格式（uid 保持不变）
			name: "only gid provided",
			uid:  nil,
			gid:  uint32Ptr(2000),
			want: ":2000",
		},
		{
			// uid 和 gid 均为 0（root），应生成 "0:0"，0 是合法值而非空值
			name: "uid zero and gid provided",
			uid:  uint32Ptr(0),
			gid:  uint32Ptr(0),
			want: "0:0",
		},
		{
			// 只传入 uid=0（root），应生成 "0:"
			name: "root uid only",
			uid:  uint32Ptr(0),
			gid:  nil,
			want: "0:",
		},
		{
			// 只传入 gid=0（root 组），应生成 ":0"
			name: "root gid only",
			uid:  nil,
			gid:  uint32Ptr(0),
			want: ":0",
		},
		{
			// 较大的 uid/gid 值（nobody 用户，65534），验证整数格式化无截断
			name: "large uid and gid",
			uid:  uint32Ptr(65534),
			gid:  uint32Ptr(65534),
			want: "65534:65534",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := buildChownArg(tt.uid, tt.gid)
			if got != tt.want {
				t.Errorf("buildChownArg(uid=%v, gid=%v) = %q, want %q", tt.uid, tt.gid, got, tt.want)
			}
		})
	}
}

// ─── resolveOwnerIDs ──────────────────────────────────────────────────────────

// TestResolveOwnerIDs 验证 resolveOwnerIDs 将请求中的可选 uid/gid 转换为
// os.Lchown 所需的 int 类型，未传入时返回 -1（表示保持原值不变）。
func TestResolveOwnerIDs(t *testing.T) {
	tests := []struct {
		name    string
		uid     *uint32
		gid     *uint32
		wantUID int
		wantGID int
	}{
		{
			// 同时传入 uid 和 gid，两者均应转换为对应整数
			name:    "both uid and gid provided",
			uid:     uint32Ptr(1000),
			gid:     uint32Ptr(2000),
			wantUID: 1000,
			wantGID: 2000,
		},
		{
			// 只传入 uid，gid 未设置时应返回 -1（os.Lchown 语义：不修改 gid）
			name:    "only uid provided - gid should be -1",
			uid:     uint32Ptr(1000),
			gid:     nil,
			wantUID: 1000,
			wantGID: -1,
		},
		{
			// 只传入 gid，uid 未设置时应返回 -1（os.Lchown 语义：不修改 uid）
			name:    "only gid provided - uid should be -1",
			uid:     nil,
			gid:     uint32Ptr(2000),
			wantUID: -1,
			wantGID: 2000,
		},
		{
			// uid 和 gid 均未设置，两者均应返回 -1
			name:    "neither uid nor gid - both should be -1",
			uid:     nil,
			gid:     nil,
			wantUID: -1,
			wantGID: -1,
		},
		{
			// uid=0 是合法的 root 用户 ID，不应被误判为"未设置"而返回 -1
			name:    "uid=0 (root) is treated as valid, not -1",
			uid:     uint32Ptr(0),
			gid:     uint32Ptr(0),
			wantUID: 0,
			wantGID: 0,
		},
		{
			// 较大的 uid/gid 值（nobody，65534），验证 uint32 到 int 转换无溢出
			name:    "large uid and gid values",
			uid:     uint32Ptr(65534),
			gid:     uint32Ptr(65534),
			wantUID: 65534,
			wantGID: 65534,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			msg := &apiv1.ChangeOwnerRequest{}
			if tt.uid != nil {
				msg.Uid = tt.uid
			}
			if tt.gid != nil {
				msg.Gid = tt.gid
			}

			gotUID, gotGID := resolveOwnerIDs(msg)

			if gotUID != tt.wantUID {
				t.Errorf("resolveOwnerIDs uid: got %d, want %d", gotUID, tt.wantUID)
			}
			if gotGID != tt.wantGID {
				t.Errorf("resolveOwnerIDs gid: got %d, want %d", gotGID, tt.wantGID)
			}
		})
	}
}

// ─── buildChownArg + resolveOwnerIDs interaction ─────────────────────────────

// TestBuildChownArgGidOnlyNoPanic 验证当 uid 为 nil、只传 gid 时函数不会 panic，
// 且能正确返回 ":gid" 格式的字符串。
func TestBuildChownArgGidOnlyNoPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Errorf("buildChownArg panicked with gid-only input: %v", r)
		}
	}()
	result := buildChownArg(nil, uint32Ptr(1001))
	if result != ":1001" {
		t.Errorf("got %q, want \":1001\"", result)
	}
}

// TestResolveOwnerIDsLeaveUnchangedSemantics 验证当请求中 uid 和 gid 均未设置时，
// resolveOwnerIDs 返回 (-1, -1)，这是传递给 os.Lchown 时"保持原值不变"的语义。
func TestResolveOwnerIDsLeaveUnchangedSemantics(t *testing.T) {
	msg := &apiv1.ChangeOwnerRequest{}
	uid, gid := resolveOwnerIDs(msg)
	if uid != -1 || gid != -1 {
		t.Errorf("expected both -1 when neither uid nor gid set; got uid=%d gid=%d", uid, gid)
	}
}
