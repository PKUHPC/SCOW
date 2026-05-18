package utils

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/distribution/reference"
)

type ImageRef struct {
	Image         string // fully normalized for CRI
	ServerAddress string // registry host[:port]
}

type AuthConfig struct {
	Auth string `json:"auth"`
}

type RegistryConfig struct {
	Auths map[string]AuthConfig `json:"auths"`
}

func decodeAuth(encodedAuth string) (username, password string, err error) {
	decoded, err := base64.StdEncoding.DecodeString(encodedAuth)
	if err != nil {
		return "", "", err
	}

	auth := string(decoded)
	parts := strings.SplitN(auth, ":", 2)
	if len(parts) != 2 {
		return "", "", errors.New("invalid auth format")
	}

	return parts[0], parts[1], nil
}

func getRegistryConfigPath() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(homeDir, DefaultUserConfigPrefix, "registry.json"), nil
}

func loadRegistryConfig() (*RegistryConfig, error) {
	configPath, err := getRegistryConfigPath()
	if err != nil {
		return nil, fmt.Errorf("failed to get registry config path: %v", err)
	}

	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return &RegistryConfig{Auths: make(map[string]AuthConfig)}, nil
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %v", err)
	}

	var config RegistryConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %v", err)
	}

	if config.Auths == nil {
		config.Auths = make(map[string]AuthConfig)
	}

	return &config, nil
}

func NormalizeImageRef(input string) (ImageRef, error) {
	in := strings.TrimSpace(input)
	if in == "" {
		return ImageRef{}, fmt.Errorf("image reference is empty")
	}

	// Parse + normalize "familiar" Docker image names.
	named, err := reference.ParseDockerRef(in)
	if err != nil {
		return ImageRef{}, err
	}

	return ImageRef{
		Image:         named.String(),
		ServerAddress: reference.Domain(named),
	}, nil
}

// getAuthForRegistry retrieves saved authentication info for a registry
func getAuthForRegistry(registry string) (username, password string, err error) {
	if registry == "" {
		return "", "", fmt.Errorf("registry cannot be empty")
	}

	config, err := loadRegistryConfig()
	if err != nil {
		return "", "", err
	}

	authConfig, exists := config.Auths[registry]
	if !exists {
		return "", "", nil // No auth info available
	}

	return decodeAuth(authConfig.Auth)
}
