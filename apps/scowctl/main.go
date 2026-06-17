package main

import (
	"errors"
	"fmt"
	"os"

	"github.com/PKUHPC/private-scow/apps/scowctl/cmd"
)

var version = "dev"

func main() {
	cmd.SetVersion(version)

	if err := cmd.Execute(); err != nil {
		var exitErr *cmd.CommandExitError
		if errors.As(err, &exitErr) {
			os.Exit(exitErr.Code())
		}
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
