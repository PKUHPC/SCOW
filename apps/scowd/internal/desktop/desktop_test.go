package desktop

import (
	"testing"
)

func intPtr(v int) *int { return &v }

func TestParseListOutputWithPid(t *testing.T) {
	tests := []struct {
		name    string
		output  string
		want    map[int]*int
		wantErr bool
	}{
		{
			name: "正常会话，有 PID",
			output: `TurboVNC sessions:

X DISPLAY #	PROCESS ID
:1		12345
`,
			want: map[int]*int{1: intPtr(12345)},
		},
		{
			name: "stale 会话，display 存在但无 PID",
			output: `TurboVNC sessions:

X DISPLAY #	PROCESS ID
:2
`,
			want: map[int]*int{2: nil},
		},
		{
			name: "混合：正常会话 + stale 会话",
			output: `TurboVNC sessions:

X DISPLAY #	PROCESS ID
:1		12345
:2
:3		67890
`,
			want: map[int]*int{
				1: intPtr(12345),
				2: nil,
				3: intPtr(67890),
			},
		},
		{
			name:   "空输出",
			output: "",
			want:   map[int]*int{},
		},
		{
			name: "只有表头，无会话",
			output: `TurboVNC sessions:

X DISPLAY #	PROCESS ID
`,
			want: map[int]*int{},
		},
		{
			name: "PID 字段为非数字，视为无 PID",
			output: `TurboVNC sessions:

:1		stale
`,
			want: map[int]*int{1: nil},
		},
		{
			name:    "display 编号无效",
			output:  `:abc		12345`,
			wantErr: true,
		},
		{
			name: "行首有空格，应正确 trim",
			output: `TurboVNC sessions:

   :1		12345
`,
			want: map[int]*int{1: intPtr(12345)},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseListOutputWithPid(tt.output)
			if (err != nil) != tt.wantErr {
				t.Fatalf("ParseListOutputWithPid() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr {
				return
			}
			if len(got) != len(tt.want) {
				t.Fatalf("ParseListOutputWithPid() len = %d, want %d", len(got), len(tt.want))
			}
			for displayID, wantPid := range tt.want {
				gotPid, ok := got[displayID]
				if !ok {
					t.Errorf("display %d missing from result", displayID)
					continue
				}
				if wantPid == nil && gotPid != nil {
					t.Errorf("display %d: want nil PID, got %d", displayID, *gotPid)
				} else if wantPid != nil && gotPid == nil {
					t.Errorf("display %d: want PID %d, got nil", displayID, *wantPid)
				} else if wantPid != nil && gotPid != nil && *wantPid != *gotPid {
					t.Errorf("display %d: want PID %d, got %d", displayID, *wantPid, *gotPid)
				}
			}
		})
	}
}
