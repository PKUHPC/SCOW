package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseAIConfigEnableStdout(t *testing.T) {
	tests := []struct {
		name         string
		config       string
		enableStdout bool
	}{
		{
			name:         "defaults to true when omitted",
			config:       "log:\n  level: info\n",
			enableStdout: true,
		},
		{
			name:         "allows explicitly disabling stdout",
			config:       "log:\n  level: info\n  enableStdout: false\n",
			enableStdout: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			configPath := filepath.Join(t.TempDir(), "config.yaml")
			if err := os.WriteFile(configPath, []byte(tt.config), 0o600); err != nil {
				t.Fatalf("write config: %v", err)
			}

			config := ParseAIConfig(configPath)
			if config.LogConfig.EnableStdout != tt.enableStdout {
				t.Fatalf("EnableStdout = %t, want %t", config.LogConfig.EnableStdout, tt.enableStdout)
			}
		})
	}
}
