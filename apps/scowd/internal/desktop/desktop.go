package desktop

import (
	"bytes"
	"fmt"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/auth"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/sirupsen/logrus"
)

type DesktopInfo struct {
	Host        string `json:"host"`
	DisplayID   int    `json:"displayId"`
	DesktopName string `json:"desktopName"`
	Wm          string `json:"wm"`
	CreateTime  string `json:"createTime"`
}

func ParseListOutputWithPid(output string) (map[int]*int, error) {
	res := make(map[int]*int)
	lines := strings.Split(output, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, ":") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 1 {
			continue
		}
		displayNumber := strings.TrimPrefix(fields[0], ":")
		id, err := strconv.Atoi(displayNumber)
		if err != nil {
			return nil, fmt.Errorf("invalid display id: %s", displayNumber)
		}
		var pidPtr *int
		if len(fields) >= 2 {
			if p, err := strconv.Atoi(fields[1]); err == nil {
				pidPtr = &p
			}
		}
		res[id] = pidPtr
	}
	return res, nil
}

func CleanupStaleDesktop(username string, displayID int) error {
	user, err := auth.Lookup(username)
	if err != nil {
		return fmt.Errorf("get user %s error: %v", username, err)
	}
	vncDir := filepath.Join(user.HomeDir, ".vnc")
	dirEntries, err := os.ReadDir(vncDir)
	if err == nil {
		// Get current hostname
		hostname, err := os.Hostname()
		if err != nil {
			return fmt.Errorf("get hostname error: %v", err)
		}

		// The format of the file is usually hostname:displayID.log or hostname:displayID.pid
		targetLog := fmt.Sprintf("%s:%d.log", hostname, displayID)
		targetPid := fmt.Sprintf("%s:%d.pid", hostname, displayID)

		for _, de := range dirEntries {
			name := de.Name()
			if name == targetLog || name == targetPid {
				filePath := filepath.Join(vncDir, name)
				if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
					logrus.Warnf("Failed to remove stale desktop file %s: %v", filePath, err)
				}
			}
		}
	}
	lockFilePath := filepath.Join("/tmp", fmt.Sprintf(".X%d-lock", displayID))
	if err := os.Remove(lockFilePath); err != nil && !os.IsNotExist(err) {
		logrus.Warnf("Failed to remove X lock file %s: %v", lockFilePath, err)
	}
	socketPath := filepath.Join("/tmp/.X11-unix", fmt.Sprintf("X%d", displayID))
	if err := os.Remove(socketPath); err != nil && !os.IsNotExist(err) {
		logrus.Warnf("Failed to remove X socket %s: %v", socketPath, err)
	}
	return nil
}

func RefreshPassword(displayID string, vncPasswdPath string) (string, error) {

	params := []string{"-o", "-display", displayID}

	cmd := exec.Command(vncPasswdPath, params...)

	var stderrBuf bytes.Buffer
	cmd.Stderr = &stderrBuf

	err := cmd.Run()
	if err != nil {
		logrus.Errorf("failed to exec refresh password command: %v", err)
		return "", fmt.Errorf("failed to exec refresh password command: %v", err)
	}

	stderr := stderrBuf.String()

	return ParseOTP(stderr)
}
