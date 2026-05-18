package main

import (
	"github.com/spf13/cobra"

	"scow-adapters/cmd/scow-crane-ai-adapter/app"
)

func main() {
	rootCmd := app.NewAdapterCommand()
	if err := rootCmd.Execute(); err != nil {
		cobra.CheckErr(err)
	}
}
