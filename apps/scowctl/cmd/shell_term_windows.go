//go:build windows

package cmd

import "os"

func setupTerminalResizeSignal(sigCh chan<- os.Signal) {
	// Windows does not support SIGWINCH. No dynamic resize.
}
