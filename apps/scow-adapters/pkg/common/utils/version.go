package utils

import "fmt"

var (
	Version = "dev"
)

var (
	GitCommit = "UnKnown"
	BuildTime = "Unknown"
)

func GetVersion() string {
	return fmt.Sprintf("Adapter Version: %s-%s\nBuild Time: %s", Version, GitCommit, BuildTime)
}

func VersionTemplate() string {
	return `{{.Version}}` + "\n"
}
