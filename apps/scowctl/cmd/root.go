package cmd

import (
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "scowctl",
	Short: "SCOW command line tool",
}

func SetVersion(version string) {
	rootCmd.Version = version
}

// Execute runs scowctl with process arguments.
func Execute() error {
	return rootCmd.Execute()
}

func init() {
	rootCmd.AddCommand(loginCmd)
	rootCmd.AddCommand(apiCmd)
	rootCmd.AddCommand(profileCmd)
}
