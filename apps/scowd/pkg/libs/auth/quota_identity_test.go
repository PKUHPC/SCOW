package auth

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func installFakeIdentityCommands(t *testing.T, script string) {
	t.Helper()
	if runtime.GOOS == "windows" {
		t.Skip("该测试依赖 Unix 命令执行语义")
	}
	dir := t.TempDir()
	for _, name := range []string{"getent", "id"} {
		path := filepath.Join(dir, name)
		content := "#!/bin/sh\nFAKE_COMMAND=" + name + "\n" + script
		if err := os.WriteFile(path, []byte(content), 0o755); err != nil {
			t.Fatalf("写入模拟命令 %s 失败: %v", name, err)
		}
	}
	t.Setenv("PATH", dir)
}

func TestParseGroupLine(t *testing.T) {
	group, err := parseGroupLine("12345:x:67890:user")
	if err != nil {
		t.Fatalf("parseGroupLine returned error: %v", err)
	}
	if group.name != "12345" || group.gid != "67890" {
		t.Fatalf("unexpected group identity: %#v", group)
	}
}

func TestIsNumeric(t *testing.T) {
	tests := map[string]bool{"12345": true, "": false, "12a": false, "+12": false}
	for input, want := range tests {
		if got := isNumeric(input); got != want {
			t.Errorf("isNumeric(%q) = %v, want %v", input, got, want)
		}
	}
}

func TestResolveUserID_NonNumericUsername(t *testing.T) {
	installFakeIdentityCommands(t, `
if [ "$FAKE_COMMAND" = "getent" ] && [ "$1" = "passwd" ] && [ "$2" = "alice" ]; then
  echo 'alice:x:1001:1001::/home/alice:/bin/sh'
  exit 0
fi
exit 1
`)

	uid, err := ResolveUserID("alice")
	if err != nil || uid != "1001" {
		t.Fatalf("ResolveUserID(alice) = %q, %v; want 1001, nil", uid, err)
	}
}

func TestResolveUserID_NumericUsername(t *testing.T) {
	installFakeIdentityCommands(t, `
if [ "$FAKE_COMMAND" = "id" ] && [ "$1" = "-un" ] && [ "$2" = "12345" ]; then echo '12345'; exit 0; fi
if [ "$FAKE_COMMAND" = "id" ] && [ "$1" = "-u" ] && [ "$2" = "12345" ]; then echo '67890'; exit 0; fi
if [ "$FAKE_COMMAND" = "getent" ] && [ "$1" = "passwd" ] && [ "$2" = "67890" ]; then
  echo '12345:x:67890:100::/home/12345:/bin/sh'
  exit 0
fi
exit 1
`)

	uid, err := ResolveUserID("12345")
	if err != nil || uid != "67890" {
		t.Fatalf("ResolveUserID(12345) = %q, %v; want 67890, nil", uid, err)
	}
}

func TestResolveUserID_NumericUsernameRejectsUIDMatch(t *testing.T) {
	installFakeIdentityCommands(t, `
if [ "$FAKE_COMMAND" = "id" ] && [ "$1" = "-un" ] && [ "$2" = "12345" ]; then echo 'other-user'; exit 0; fi
exit 1
`)

	_, err := ResolveUserID("12345")
	if err == nil || !strings.Contains(err.Error(), "exact username") {
		t.Fatalf("ResolveUserID 应拒绝被按 UID 解析的数字用户名，实际错误: %v", err)
	}
}

func TestResolveGroupID_NonNumericGroupName(t *testing.T) {
	installFakeIdentityCommands(t, `
if [ "$FAKE_COMMAND" = "getent" ] && [ "$1" = "group" ] && [ "$2" = "research" ]; then
  echo 'research:x:2001:'
  exit 0
fi
exit 1
`)

	gid, err := ResolveGroupID("research")
	if err != nil || gid != "2001" {
		t.Fatalf("ResolveGroupID(research) = %q, %v; want 2001, nil", gid, err)
	}
}

func TestResolveGroupID_NumericValueIsGID(t *testing.T) {
	logPath := filepath.Join(t.TempDir(), "getent.log")
	t.Setenv("FAKE_GETENT_LOG", logPath)
	installFakeIdentityCommands(t, `
if [ "$FAKE_COMMAND" = "getent" ]; then echo "$*" >> "$FAKE_GETENT_LOG"; fi
exit 1
`)

	gid, err := ResolveGroupID("12345")
	if err != nil || gid != "12345" {
		t.Fatalf("ResolveGroupID(12345) = %q, %v; want 12345, nil", gid, err)
	}
	if _, err := os.Stat(logPath); !os.IsNotExist(err) {
		t.Fatalf("纯数字 GID 不应执行 getent，日志文件状态错误: %v", err)
	}
}

func TestResolveGroupID_NonNumericGroupNameMismatch(t *testing.T) {
	installFakeIdentityCommands(t, `
if [ "$FAKE_COMMAND" = "getent" ] && [ "$1" = "group" ] && [ "$2" = "research" ]; then
  echo 'other-group:x:2001:'
  exit 0
fi
exit 1
`)

	_, err := ResolveGroupID("research")
	if err == nil || !strings.Contains(err.Error(), "exact group name") {
		t.Fatalf("ResolveGroupID 应拒绝不匹配的组名，实际错误: %v", err)
	}
}
