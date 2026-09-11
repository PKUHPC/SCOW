package filesystem

import (
	"strings"
	"testing"

	"github.com/sirupsen/logrus"
)

// newTestLogger returns a logrus entry suitable for tests (discards output).
func newTestLogger() *logrus.Entry {
	log := logrus.New()
	log.SetLevel(logrus.PanicLevel)
	return logrus.NewEntry(log)
}

// parseGpfsGroupQuotaOutput calls GetDiskSpace(path) internally.
// We use a real path ("/tmp") so disk.Usage does not fail, then
// check that 0-limit entries are replaced by the real total size.

// ─── parseGpfsGroupQuotaOutput ────────────────────────────────────────────────

func TestParseGpfsGroupQuotaOutput_ValidLine(t *testing.T) {
	// mmlsquota -g <group> -Y -e <fs>
	// Format: mmlsquota:group:0:1:::share:GRP:12345:devteam:1024:512:2048:0:none:...
	// field indices (0-based): 0=mmlsquota 1=group 2=seqno 3=ver 4=res 5=res
	//   6=filesystem 7=quotaType(GRP) 8=id 9=name 10=blockUsage 11=blockQuota(soft)
	//   12=blockLimit(hard) 13=blockInDoubt 14=blockGrace 15=...
	// blockUsage=1024 KB, softLimit=512 KB, hardLimit=2048 KB, grace=none
	line := "mmlsquota:group:0:1:::share:GRP:12345:devteam:1024:512:2048:0:none:300:0:0:0:none::0:root:"

	logger := newTestLogger()
	info, err := parseGpfsGroupQuotaOutput(line, "/tmp", logger)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.Filesystem == "" {
		t.Fatal("expected Filesystem to be set, got empty string")
	}
	if info.BlockUsedStorageBytes != 1024*1024 {
		t.Errorf("BlockUsedStorageBytes: got %d, want %d", info.BlockUsedStorageBytes, uint64(1024*1024))
	}
	if info.BlockSoftLimitBytes != 512*1024 {
		t.Errorf("BlockSoftLimitBytes: got %d, want %d", info.BlockSoftLimitBytes, uint64(512*1024))
	}
	if info.BlockHardLimitBytes != 2048*1024 {
		t.Errorf("BlockHardLimitBytes: got %d, want %d", info.BlockHardLimitBytes, uint64(2048*1024))
	}
	if info.BlockGraceDays != 0 {
		t.Errorf("BlockGraceDays: got %d, want 0", info.BlockGraceDays)
	}
}

func TestParseGpfsGroupQuotaOutput_WithAsterisk(t *testing.T) {
	// blockUsage has an asterisk suffix (over soft limit)
	line := "mmlsquota:group:0:1:::share:GRP:12345:devteam:2048*:512:4096:0:none:300:0:0:0:none::0:root:"

	logger := newTestLogger()
	info, err := parseGpfsGroupQuotaOutput(line, "/tmp", logger)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.BlockUsedStorageBytes != 2048*1024 {
		t.Errorf("BlockUsedStorageBytes with asterisk: got %d, want %d", info.BlockUsedStorageBytes, uint64(2048*1024))
	}
}

func TestParseGpfsGroupQuotaOutput_ZeroHardLimit_UsesTotalSpace(t *testing.T) {
	// hardLimit=0 means unlimited — should be replaced by total disk space
	line := "mmlsquota:group:0:1:::share:GRP:12345:devteam:1024:0:0:0:none:300:0:0:0:none::0:root:"

	logger := newTestLogger()
	info, err := parseGpfsGroupQuotaOutput(line, "/tmp", logger)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.BlockHardLimitBytes == 0 {
		t.Error("BlockHardLimitBytes should not be 0 when limit field is 0 (should use total disk space)")
	}
}

func TestParseGpfsGroupQuotaOutput_HeaderLineSkipped(t *testing.T) {
	// HEADER lines must be ignored
	output := "mmlsquota:group:HEADER:version:reserved:reserved:filesystemName:quotaType:id:name:blockUsage:blockQuota:blockLimit:blockInDoubt:blockGrace:filesUsage:filesQuota:filesLimit:filesInDoubt:filesGrace:remarks:fid:filesetname:"
	logger := newTestLogger()
	info, err := parseGpfsGroupQuotaOutput(output, "/tmp", logger)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.Filesystem != "" {
		t.Errorf("expected empty result for HEADER-only input, got Filesystem=%q", info.Filesystem)
	}
}

func TestParseGpfsGroupQuotaOutput_EmptyOutput(t *testing.T) {
	logger := newTestLogger()
	info, err := parseGpfsGroupQuotaOutput("", "/tmp", logger)
	if err != nil {
		t.Fatalf("unexpected error on empty input: %v", err)
	}
	if info.Filesystem != "" {
		t.Errorf("expected empty GroupQuotaInfo for empty output, got %+v", info)
	}
}

func TestParseGpfsGroupQuotaOutput_InsufficientFields(t *testing.T) {
	// Only 10 fields — should be skipped (< 23)
	line := "mmlsquota:group:0:1:::share:GRP:12345:devteam:"
	logger := newTestLogger()
	info, err := parseGpfsGroupQuotaOutput(line, "/tmp", logger)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.Filesystem != "" {
		t.Errorf("expected empty result for short line, got %+v", info)
	}
}

func TestParseGpfsGroupQuotaOutput_NonGRPLineIgnored(t *testing.T) {
	// USR type line should not match group parser
	line := "mmlsquota:group:0:1:::share:USR:12345:someuser:1024:512:2048:0:none:300:0:0:0:none::0:root:"
	logger := newTestLogger()
	info, err := parseGpfsGroupQuotaOutput(line, "/tmp", logger)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.Filesystem != "" {
		t.Errorf("expected empty result for USR-type line in group parser, got %+v", info)
	}
}

func TestParseGpfsGroupQuotaOutput_MultipleLines_FirstGRPReturned(t *testing.T) {
	header := "mmlsquota:group:HEADER:version:reserved:reserved:filesystemName:quotaType:id:name:blockUsage:blockQuota:blockLimit:blockInDoubt:blockGrace:filesUsage:filesQuota:filesLimit:filesInDoubt:filesGrace:remarks:fid:filesetname:"
	data := "mmlsquota:group:0:1:::share:GRP:12345:devteam:2048:1024:4096:0:none:300:0:0:0:none::0:root:"
	output := strings.Join([]string{header, data}, "\n")

	logger := newTestLogger()
	info, err := parseGpfsGroupQuotaOutput(output, "/tmp", logger)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.Filesystem == "" {
		t.Fatal("expected Filesystem to be populated from data line")
	}
	if info.BlockUsedStorageBytes != 2048*1024 {
		t.Errorf("BlockUsedStorageBytes: got %d, want %d", info.BlockUsedStorageBytes, uint64(2048*1024))
	}
}

// ─── parseGpfsQuotaOutput (user quota) ───────────────────────────────────────

func TestParseGpfsQuotaOutput_ValidLine(t *testing.T) {
	// USR type line
	line := "mmlsquota:user:0:1:::share:USR:69031:testuser:603136:0:1048576:0:none:2304:0:0:0:none::0:root:"

	logger := newTestLogger()
	info, err := parseGpfsQuotaOutput(line, "/tmp", logger)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.Filesystem == "" {
		t.Fatal("expected Filesystem to be set")
	}
	if info.BlockUsedStorageBytes != 603136*1024 {
		t.Errorf("BlockUsedStorageBytes: got %d, want %d", info.BlockUsedStorageBytes, uint64(603136*1024))
	}
	if info.BlockHardLimitBytes != 1048576*1024 {
		t.Errorf("BlockHardLimitBytes: got %d, want %d", info.BlockHardLimitBytes, uint64(1048576*1024))
	}
}

func TestParseGpfsQuotaOutput_EmptyOutput(t *testing.T) {
	logger := newTestLogger()
	info, err := parseGpfsQuotaOutput("", "/tmp", logger)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.Filesystem != "" {
		t.Errorf("expected empty QuotaInfo for empty output")
	}
}

func TestParseGpfsQuotaOutput_WithAsteriskOnUsage(t *testing.T) {
	line := "mmlsquota:user:0:1:::share:USR:69031:testuser:603136*:0:1048576:0:none:2304:0:0:0:none::0:root:"
	logger := newTestLogger()
	info, err := parseGpfsQuotaOutput(line, "/tmp", logger)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.BlockUsedStorageBytes != 603136*1024 {
		t.Errorf("BlockUsedStorageBytes with asterisk: got %d, want %d", info.BlockUsedStorageBytes, uint64(603136*1024))
	}
}

// ─── parseIntWithCheck ────────────────────────────────────────────────────────

func TestParseIntWithCheck(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    uint64
		wantErr bool
	}{
		{"empty string", "", 0, false},
		{"zero", "0", 0, false},
		{"positive", "12345", 12345, false},
		{"large", "18446744073709551615", 18446744073709551615, false},
		{"negative sign", "-1", 0, true},
		{"non-numeric", "abc", 0, true},
		{"float string", "1.5", 0, true},
		{"space inside", "1 2", 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseIntWithCheck(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("parseIntWithCheck(%q) error=%v, wantErr=%v", tt.input, err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("parseIntWithCheck(%q) = %d, want %d", tt.input, got, tt.want)
			}
		})
	}
}

// ─── parseGracePeriod ────────────────────────────────────────────────────────

func TestParseGracePeriod(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  int
	}{
		{"empty string", "", 0},
		{"dash", "-", 0},
		{"none", "none", 0},
		{"7days", "7days", 7},
		{"14days", "14days", 14},
		{"plain number", "3", 3},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseGracePeriod(tt.input)
			if got != tt.want {
				t.Errorf("parseGracePeriod(%q) = %d, want %d", tt.input, got, tt.want)
			}
		})
	}
}
