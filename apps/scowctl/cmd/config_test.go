package cmd

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestSaveLoginProfile(t *testing.T) {
	configDir := t.TempDir()
	oldUserConfigDir := userConfigDir
	userConfigDir = func() (string, error) {
		return configDir, nil
	}
	t.Cleanup(func() {
		userConfigDir = oldUserConfigDir
	})

	err := saveLoginProfile("https://scow.example.com", "token-value", "user1", "", "")
	if err != nil {
		t.Fatal(err)
	}

	configPath := filepath.Join(configDir, configDirName, configFileName)
	info, err := os.Stat(configPath)
	if err != nil {
		t.Fatal(err)
	}

	if got := info.Mode().Perm(); got != configPermission {
		t.Fatalf("config file permission = %o, want %o", got, configPermission)
	}

	content, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatal(err)
	}

	var cfg config
	if err := json.Unmarshal(content, &cfg); err != nil {
		t.Fatal(err)
	}

	if cfg.CurrentProfile != defaultProfileName {
		t.Fatalf("current profile = %q, want %q", cfg.CurrentProfile, defaultProfileName)
	}

	got := cfg.Profiles[defaultProfileName]
	want := profile{
		BaseURL:    "https://scow.example.com",
		Token:      "token-value",
		IdentityID: "user1",
	}
	if got != want {
		t.Fatalf("profile = %+v, want %+v", got, want)
	}
}

func TestSaveLoginProfilePreservesOtherProfiles(t *testing.T) {
	configPath := filepath.Join(t.TempDir(), configDirName, configFileName)
	err := writeConfig(configPath, &config{
		CurrentProfile: "dev",
		Profiles: map[string]profile{
			"dev": {
				BaseURL:    "http://dev.example.com",
				Token:      "dev-token",
				IdentityID: "dev-user",
			},
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	oldUserConfigDir := userConfigDir
	userConfigDir = func() (string, error) {
		return filepath.Dir(filepath.Dir(configPath)), nil
	}
	t.Cleanup(func() {
		userConfigDir = oldUserConfigDir
	})

	if err := saveLoginProfile("https://scow.example.com", "token-value", "user1", "", ""); err != nil {
		t.Fatal(err)
	}

	cfg, err := readConfig(configPath)
	if err != nil {
		t.Fatal(err)
	}

	if _, ok := cfg.Profiles["dev"]; !ok {
		t.Fatal("existing profile was not preserved")
	}

	if got := cfg.Profiles[defaultProfileName].IdentityID; got != "user1" {
		t.Fatalf("default profile identityId = %q, want %q", got, "user1")
	}
}

func TestSaveLoginProfileStoresStaticAPIAuth(t *testing.T) {
	configDir := t.TempDir()
	oldUserConfigDir := userConfigDir
	userConfigDir = func() (string, error) {
		return configDir, nil
	}
	t.Cleanup(func() {
		userConfigDir = oldUserConfigDir
	})

	if err := saveLoginProfile("https://scow.example.com", "token-value", "user1", "secret-value", "api-user"); err != nil {
		t.Fatal(err)
	}

	current, err := getCurrentProfile()
	if err != nil {
		t.Fatal(err)
	}

	if current.AuthSecret != "secret-value" {
		t.Fatalf("authSecret = %q, want secret-value", current.AuthSecret)
	}
	if current.AuthUser != "api-user" {
		t.Fatalf("authUser = %q, want api-user", current.AuthUser)
	}
	if current.apiAuthToken() != "secret-value" {
		t.Fatalf("apiAuthToken() = %q, want secret-value", current.apiAuthToken())
	}
	if current.apiAuthUser() != "api-user" {
		t.Fatalf("apiAuthUser() = %q, want api-user", current.apiAuthUser())
	}
}

func TestWriteConfigTightensExistingFilePermission(t *testing.T) {
	configPath := filepath.Join(t.TempDir(), configDirName, configFileName)
	if err := os.MkdirAll(filepath.Dir(configPath), configDirPermission); err != nil {
		t.Fatal(err)
	}

	if err := os.WriteFile(configPath, []byte("{}"), 0o644); err != nil {
		t.Fatal(err)
	}

	if err := writeConfig(configPath, &config{}); err != nil {
		t.Fatal(err)
	}

	info, err := os.Stat(configPath)
	if err != nil {
		t.Fatal(err)
	}

	if got := info.Mode().Perm(); got != configPermission {
		t.Fatalf("config file permission = %o, want %o", got, configPermission)
	}
}
