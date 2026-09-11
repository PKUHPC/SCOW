package desktop

import (
	"testing"
)

func TestParseOTP(t *testing.T) {
	tests := []struct {
		name    string
		stderr  string
		want    string
		wantErr bool
	}{
		{
			name:   "正常输出包含 OTP",
			stderr: "Full control one-time password: abc123\n",
			want:   "abc123",
		},
		{
			name: "OTP 在多行输出中",
			stderr: `Desktop 'TurboVNC: myhost:1 (user)' started on display myhost:1

Full control one-time password: xyz789
Log file is /home/user/.vnc/myhost:1.log
`,
			want: "xyz789",
		},
		{
			name:   "OTP 值含前后空格，应 trim",
			stderr: "Full control one-time password:   padded  \n",
			want:   "padded",
		},
		{
			name:    "无 OTP 行",
			stderr:  "some other output\n",
			wantErr: true,
		},
		{
			name:    "空输出",
			stderr:  "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseOTP(tt.stderr)
			if (err != nil) != tt.wantErr {
				t.Fatalf("ParseOTP() error = %v, wantErr %v", err, tt.wantErr)
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("ParseOTP() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestParseDisplayID(t *testing.T) {
	tests := []struct {
		name    string
		stdout  string
		want    int
		wantErr bool
	}{
		{
			name:   "标准启动输出",
			stdout: "Desktop 'TurboVNC: myhost:1 (user)' started on display myhost:1\n",
			want:   1,
		},
		{
			name: "display 编号大于 1",
			stdout: `some preamble
Desktop 'TurboVNC: myhost:10 (user)' started on display myhost:10
`,
			want: 10,
		},
		{
			name:    "无匹配行",
			stdout:  "some other output\n",
			wantErr: true,
		},
		{
			name:    "空输出",
			stdout:  "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseDisplayID(tt.stdout)
			if (err != nil) != tt.wantErr {
				t.Fatalf("ParseDisplayID() error = %v, wantErr %v", err, tt.wantErr)
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("ParseDisplayID() = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestDisplayIDToPort(t *testing.T) {
	tests := []struct {
		displayID int
		want      int
	}{
		{1, 5901},
		{2, 5902},
		{10, 5910},
		{0, 5900},
	}

	for _, tt := range tests {
		got := DisplayIDToPort(tt.displayID)
		if got != tt.want {
			t.Errorf("DisplayIDToPort(%d) = %d, want %d", tt.displayID, got, tt.want)
		}
	}
}
