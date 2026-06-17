package cmd

import (
	"bytes"
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"
)

func withUserConfigDir(t *testing.T, configDir string) {
	t.Helper()

	oldUserConfigDir := userConfigDir
	userConfigDir = func() (string, error) {
		return configDir, nil
	}
	t.Cleanup(func() {
		userConfigDir = oldUserConfigDir
	})
}

func TestRunProfileShowPrintsCurrentProfile(t *testing.T) {
	configDir := t.TempDir()
	withUserConfigDir(t, configDir)

	if err := saveLoginProfile("https://scow.example.com", "token-value", "user1", "", ""); err != nil {
		t.Fatal(err)
	}
	if err := updateCurrentProfile(func(current *profile) {
		current.OpenAPICache = filepath.Join(configDir, configDirName, openAPICacheDirName, defaultProfileName)
	}); err != nil {
		t.Fatal(err)
	}

	var output bytes.Buffer
	if err := runProfileShow(&output); err != nil {
		t.Fatal(err)
	}

	var got profileShowOutput
	if err := json.Unmarshal(output.Bytes(), &got); err != nil {
		t.Fatal(err)
	}

	if got.Name != defaultProfileName {
		t.Fatalf("name = %q, want %q", got.Name, defaultProfileName)
	}
	if got.BaseURL != "https://scow.example.com" {
		t.Fatalf("baseUrl = %q, want https://scow.example.com", got.BaseURL)
	}
	if got.IdentityID != "user1" {
		t.Fatalf("identityId = %q, want user1", got.IdentityID)
	}
	if got.AuthType != "token" {
		t.Fatalf("authType = %q, want token", got.AuthType)
	}
	if got.AuthSecretSet {
		t.Fatal("authSecretSet = true, want false")
	}
	if got.OpenAPICache == "" {
		t.Fatal("openapiCache is empty")
	}
}

func TestRunProfileShowHidesStaticAuthSecret(t *testing.T) {
	configDir := t.TempDir()
	withUserConfigDir(t, configDir)

	if err := saveLoginProfile("http://localhost:5080", "", "api-user", "secret-value", "api-user"); err != nil {
		t.Fatal(err)
	}

	var output bytes.Buffer
	if err := runProfileShow(&output); err != nil {
		t.Fatal(err)
	}

	if strings.Contains(output.String(), "secret-value") {
		t.Fatal("profile show output contains auth secret")
	}

	var got profileShowOutput
	if err := json.Unmarshal(output.Bytes(), &got); err != nil {
		t.Fatal(err)
	}

	if got.AuthType != "static" {
		t.Fatalf("authType = %q, want static", got.AuthType)
	}
	if got.AuthUser != "api-user" {
		t.Fatalf("authUser = %q, want api-user", got.AuthUser)
	}
	if !got.AuthSecretSet {
		t.Fatal("authSecretSet = false, want true")
	}
}
