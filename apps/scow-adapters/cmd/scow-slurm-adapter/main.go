package main

import (
	"github.com/spf13/cobra"

	"scow-adapters/cmd/scow-slurm-adapter/app"
)

func main() {
	rootCmd := app.RootCmd
	if err := rootCmd.Execute(); err != nil {
		cobra.CheckErr(err)
	}
}
