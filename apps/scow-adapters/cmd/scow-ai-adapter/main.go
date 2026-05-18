package main

import (
	"fmt"
	"os"

	"scow-adapters/cmd/scow-ai-adapter/app"
)

func main() {
	rootCmd := app.RootCmd
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
