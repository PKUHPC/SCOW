package main

import (
	"fmt"
	"os"

	"github.com/PKUHPC/private-scow/apps/scowctl/cmd"
)

var version = "dev"

func main() {
	cmd.SetVersion(version)

	if err := cmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
