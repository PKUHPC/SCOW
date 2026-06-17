//go:build !windows

package cmd

import (
	"os"
	"os/signal"
	"syscall"
)

func setupTerminalResizeSignal(sigCh chan<- os.Signal) {
	signal.Notify(sigCh, syscall.SIGWINCH)
}
