package cmd

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

const (
	configDirName       = "scowctl"
	configFileName      = "config.json"
	defaultProfileName  = "default"
	configDirPermission = 0o700
	configPermission    = 0o600
)

var userConfigDir = os.UserConfigDir

type config struct {
	CurrentProfile string             `json:"currentProfile"`
	Profiles       map[string]profile `json:"profiles"`
}

type profile struct {
	BaseURL      string `json:"baseUrl"`
	Token        string `json:"token"`
	IdentityID   string `json:"identityId"`
	AuthSecret   string `json:"authSecret,omitempty"`
	AuthUser     string `json:"authUser,omitempty"`
	OpenAPICache string `json:"openapiCache,omitempty"`
}

type namedProfile struct {
	Name string
	profile
}

func saveLoginProfile(baseURL string, token string, identityID string, authSecret string, authUser string) error {
	configPath, err := getConfigPath()
	if err != nil {
		return err
	}

	cfg, err := readConfig(configPath)
	if err != nil {
		return err
	}

	if cfg.Profiles == nil {
		cfg.Profiles = map[string]profile{}
	}

	cfg.CurrentProfile = defaultProfileName
	cfg.Profiles[defaultProfileName] = profile{
		BaseURL:    baseURL,
		Token:      token,
		IdentityID: identityID,
		AuthSecret: authSecret,
		AuthUser:   authUser,
	}

	return writeConfig(configPath, cfg)
}

func (current *namedProfile) apiAuthToken() string {
	if current.AuthSecret != "" {
		return current.AuthSecret
	}

	return current.Token
}

func (current *namedProfile) apiAuthUser() string {
	if current.AuthSecret == "" {
		return ""
	}

	return current.AuthUser
}

func getCurrentProfile() (*namedProfile, error) {
	configPath, err := getConfigPath()
	if err != nil {
		return nil, err
	}

	cfg, err := readConfig(configPath)
	if err != nil {
		return nil, err
	}

	profileName := cfg.CurrentProfile
	if profileName == "" {
		profileName = defaultProfileName
	}

	current, ok := cfg.Profiles[profileName]
	if !ok {
		return nil, fmt.Errorf("profile %q not found, please run scowctl login first", profileName)
	}

	return &namedProfile{Name: profileName, profile: current}, nil
}

func updateCurrentProfile(update func(*profile)) error {
	configPath, err := getConfigPath()
	if err != nil {
		return err
	}

	cfg, err := readConfig(configPath)
	if err != nil {
		return err
	}

	profileName := cfg.CurrentProfile
	if profileName == "" {
		profileName = defaultProfileName
	}

	current, ok := cfg.Profiles[profileName]
	if !ok {
		return fmt.Errorf("profile %q not found, please run scowctl login first", profileName)
	}

	update(&current)
	cfg.Profiles[profileName] = current

	return writeConfig(configPath, cfg)
}

func getConfigPath() (string, error) {
	dir, err := userConfigDir()
	if err != nil {
		return "", fmt.Errorf("get user config dir: %w", err)
	}

	return filepath.Join(dir, configDirName, configFileName), nil
}

func readConfig(configPath string) (*config, error) {
	content, err := os.ReadFile(configPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return &config{}, nil
		}

		return nil, fmt.Errorf("read config file: %w", err)
	}

	if len(content) == 0 {
		return &config{}, nil
	}

	var cfg config
	if err := json.Unmarshal(content, &cfg); err != nil {
		return nil, fmt.Errorf("parse config file: %w", err)
	}

	return &cfg, nil
}

func writeConfig(configPath string, cfg *config) error {
	if err := os.MkdirAll(filepath.Dir(configPath), configDirPermission); err != nil {
		return fmt.Errorf("create config dir: %w", err)
	}

	content, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}

	content = append(content, '\n')

	if err := os.WriteFile(configPath, content, configPermission); err != nil {
		return fmt.Errorf("write config file: %w", err)
	}

	if err := os.Chmod(configPath, configPermission); err != nil {
		return fmt.Errorf("set config file permission: %w", err)
	}

	return nil
}
