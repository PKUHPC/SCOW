package handlers

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"scowd/internal/config"
	"scowd/internal/auth"
	apiv1 "scowd/protos/gen/api/application"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"connectrpc.com/connect"
	"github.com/creack/pty"
	"github.com/sirupsen/logrus"
)

type ShellServer struct{}

func (d *ShellServer) Shell(
	ctx context.Context,
	stream *connect.BidiStream[apiv1.ShellRequest, apiv1.ShellResponse],
) error {
	var cmd *exec.Cmd
	var ptyMaster *os.File
	var ptySlave *os.File
	var cmdDone chan struct{}

	idleTimeout := config.GetShellIdleTimeout()
	var lastActiveUnixNano atomic.Int64
	lastActiveUnixNano.Store(time.Now().UnixNano())
	markActive := func() {
		lastActiveUnixNano.Store(time.Now().UnixNano())
	}
	var terminateOnce sync.Once
	terminate := func() {
		terminateOnce.Do(func() {
			if cmd == nil || cmd.Process == nil {
				return
			}
			if err := cmd.Process.Signal(syscall.SIGTERM); err != nil {
				logrus.Error("Failed to terminate process: ", err)
				return
			}
			if cmdDone == nil {
				return
			}
			select {
			case <-cmdDone:
				return
			case <-time.After(5 * time.Second):
			}
			_ = cmd.Process.Kill()
		})
	}

	var cols, rows uint32

	// Handle the initial connection message (Connect)
	for {
		req, err := stream.Receive()
		if err == io.EOF {
			// The client has closed the sending stream
			terminate()
			break
		}
		if err != nil {
			logrus.Printf("Error reading client data: %v", err)
			terminate()
			break
		}
		markActive()

		// Handle different request types based on message type
		switch msg := req.Message.(type) {
		case *apiv1.ShellRequest_Connect_:
			if cmd != nil {
				logrus.Warn("Received duplicate Connect request")
				continue
			}
			logrus.Info("Received Connect request")
			// Initialize shell
			// Parse parameters
			if msg.Connect.Cols != nil {
				cols = *msg.Connect.Cols
			}
			if msg.Connect.Rows != nil {
				rows = *msg.Connect.Rows
			}

			var err error
			currentUser, err := auth.Lookup(msg.Connect.UserId)
			if err != nil {
				logrus.WithError(err).Errorf("Get home directory error")
				return connect.NewError(connect.CodeInternal, err)
			}

			shellPath := currentUser.HomeDir
			if msg.Connect.Path != nil {
				shellPath = *msg.Connect.Path
			}

			// Create PTY
			ptyMaster, ptySlave, err = pty.Open()
			if err != nil {
				logrus.Error("Failed to create PTY: ", err)
				return connect.NewError(connect.CodeInternal, err)
			}
			defer func() {
				if ptyMaster != nil {
					ptyMaster.Close()
				}
				if ptySlave != nil {
					ptySlave.Close()
				}
			}()

			// Set window size
			// 640 and 480 are default values
			if err := pty.Setsize(ptyMaster, &pty.Winsize{
				Rows: uint16(rows),
				Cols: uint16(cols),
			}); err != nil {
				logrus.Error("Failed to set terminal size: ", err)
				return connect.NewError(connect.CodeInternal, err)
			}
			logrus.Infof("Set window size, rows: %d, cols: %d", rows, cols)

			// Create command
			// Try to display MOTD (Message of the Day) if available
			// We check both /etc/motd (static) and /run/motd.dynamic (dynamic, used by Ubuntu/Debian)
			// Use if/then/fi blocks inside a group to ensure the command chain continues even if files are missing or cat fails
			motdCmd := "{ if [ -f /etc/motd ]; then cat /etc/motd || true; fi; if [ -f /run/motd.dynamic ]; then cat /run/motd.dynamic || true; fi; }"

			// Use the shell path if provided, otherwise default to user's home directory
			targetPath := shellPath
			if shellPath != "" {
				targetPath = fmt.Sprintf("%q", shellPath)
			}

			// Construct the final command: cd -> print motd -> exec login shell
			cmd = exec.CommandContext(ctx, "bash", "-l", "-c", "cd "+targetPath+" && "+motdCmd+" && exec bash -l")
			// Modify command properties
			cmd.SysProcAttr = &syscall.SysProcAttr{
				Setsid: true,
				Ctty:   int(ptySlave.Fd()), // Explicitly set controlling terminal
			}

			cmd.Stdin = ptySlave
			cmd.Stdout = ptySlave
			cmd.Stderr = ptySlave

			// Start the process
			logrus.Info("Starting Shell process")
			if err := cmd.Start(); err != nil {
				logrus.Error("Failed to start process: ", err)
				return connect.NewError(connect.CodeInternal, err)
			}

			cmdDone = make(chan struct{})
			go func() {
				err := cmd.Wait()
				exitCode := uint32(0)
				signal := ""
				if exitErr, ok := err.(*exec.ExitError); ok {
					if status, ok := exitErr.Sys().(syscall.WaitStatus); ok {
						exitCode = uint32(status.ExitStatus())
						if status.Signaled() {
							signal = status.Signal().String()
						}
					}
				}
				logrus.Infof("Shell process exited with code=%d signal=%s", exitCode, signal)
				markActive()
				_ = stream.Send(&apiv1.ShellResponse{
					Message: &apiv1.ShellResponse_Exit_{
						Exit: &apiv1.ShellResponse_Exit{
							Code:   &exitCode,
							Signal: &signal,
						},
					},
				})
				close(cmdDone)
			}()

			if idleTimeout > 0 {
				go func() {
					ticker := time.NewTicker(15 * time.Second)
					defer ticker.Stop()
					for {
						select {
						case <-ctx.Done():
							return
						case <-ticker.C:
							lastActive := time.Unix(0, lastActiveUnixNano.Load())
							if time.Since(lastActive) > idleTimeout {
								terminate()
								return
							}
						}
					}
				}()
			}

			// Start another goroutine to read shell output and send it to the client through the stream
			go func() {
				buf := make([]byte, 4096)
				for {
					n, err := ptyMaster.Read(buf)
					if err != nil {
						if err != io.EOF {
							logrus.Errorf("Failed to read PTY output: %v", err)
						}
						break
					}

					logrus.Debugf("Read PTY output: %q (HEX: %x)", buf[:n], buf[:n])
					markActive()
					if err := stream.Send(&apiv1.ShellResponse{
						Message: &apiv1.ShellResponse_Data_{
							Data: &apiv1.ShellResponse_Data{Data: buf[:n]},
						},
					}); err != nil {
						logrus.Errorf("Failed to send output: %v", err)
						break
					}
				}
			}()
		case *apiv1.ShellRequest_Resize_:
			markActive()
			// Resize the window
			cols = msg.Resize.Cols
			rows = msg.Resize.Rows
			logrus.Debugf("Resize terminal cols=%d rows=%d", cols, rows)
			// Use pty to adjust shell's window size
			if ptyMaster != nil {
				if err := pty.Setsize(ptyMaster, &pty.Winsize{
					Cols: uint16(cols),
					Rows: uint16(rows),
				}); err != nil {
					logrus.Error("Failed to resize: ", err)
				}
			}

		case *apiv1.ShellRequest_Data_:
			markActive()
			// Write the incoming data directly to the shell's standard input
			if ptyMaster == nil {
				return connect.NewError(connect.CodeFailedPrecondition, fmt.Errorf("pty not initialized"))
			}
			if _, err := ptyMaster.Write(msg.Data.Data); err != nil {
				logrus.Error("Failed to write input data: ", err)
				return connect.NewError(connect.CodeInternal, err)
			}

		case *apiv1.ShellRequest_Disconnect_:
			// Client sent disconnect request, exit the shell
			logrus.Infof("Received disconnect request")
			markActive()
			terminate()
			if cmdDone != nil {
				<-cmdDone
			}
			return nil
		}
	}

	return nil
}
