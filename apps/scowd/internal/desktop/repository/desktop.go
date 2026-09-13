package repository

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/auth"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/database"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/desktop"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/desktop/dao"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/desktop/model"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/sirupsen/logrus"
)

type DesktopRepository interface {
	Add(username string, d *model.DesktopInfo) error
	GetDesktopByID(username string, id int) (*model.DesktopInfo, error)
	GetDesktopsByDisplay(username string, displayID int) ([]*model.DesktopInfo, error)
	ListUserDesktops(desktopDir, vncServerBinPath, username string) ([]*model.DesktopInfo, error)
	UpdateLastConnectTime(username string, displayID int, t string) error
	UpdateLastConnectTimeByID(id int, t string) error
	Remove(id int) error
}

type desktopRepository struct{ dao dao.DesktopDAO }

func NewDesktopRepository(d dao.DesktopDAO) DesktopRepository { return &desktopRepository{dao: d} }

func (r *desktopRepository) Add(username string, d *model.DesktopInfo) error {
	conn, err := db.Get()
	if err != nil {
		logrus.Errorf("open global db error: %v", err)
		return fmt.Errorf("open global db error: %v", err)
	}
	if err := r.dao.InsertDesktop(conn, username, d.Host, d.DisplayID, d.DesktopName, d.Wm, d.CreateTime); err != nil {
		logrus.Errorf("insert desktop error: %v", err)
		return fmt.Errorf("insert desktop error: %v", err)
	}
	return nil
}

func (r *desktopRepository) GetDesktopByID(username string, id int) (*model.DesktopInfo, error) {
	conn, err := db.Get()
	if err != nil {
		return nil, fmt.Errorf("open global db error: %v", err)
	}
	row := r.dao.SelectDesktopByID(conn, id)
	var d model.DesktopInfo
	// SELECT id, username, host, display_id, desktop_name, wm, create_time, is_active
	var dbUsername string
	if err := row.Scan(&d.ID, &dbUsername, &d.Host, &d.DisplayID, &d.DesktopName, &d.Wm, &d.CreateTime, &d.IsActive); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	if dbUsername != username {
		return nil, nil
	}
	return &d, nil
}

func (r *desktopRepository) GetDesktopsByDisplay(username string, displayID int) ([]*model.DesktopInfo, error) {
	conn, err := db.Get()
	if err != nil {
		logrus.Errorf("open global db error: %v", err)
		return nil, fmt.Errorf("open global db error: %v", err)
	}

	rows, err := r.dao.SelectDesktopsByUser(conn, username)
	if err != nil {
		logrus.Errorf("query db error: %v", err)
		return nil, fmt.Errorf("query db error: %v", err)
	}
	defer func() {
		if err := rows.Close(); err != nil {
			logrus.Errorf("close rows error: %v", err)
		}
	}()

	var desktops []*model.DesktopInfo
	for rows.Next() {
		var d model.DesktopInfo
		if err := rows.Scan(&d.ID, &d.Host, &d.DisplayID, &d.DesktopName, &d.Wm, &d.CreateTime, &d.IsActive); err != nil {
			logrus.Errorf("scan row error: %v", err)
			continue
		}
		if d.DisplayID == displayID {
			desktops = append(desktops, &d)
		}
	}
	if err := rows.Err(); err != nil {
		logrus.Errorf("iterate rows error: %v", err)
		return nil, fmt.Errorf("iterate rows error: %v", err)
	}

	return desktops, nil
}

func (r *desktopRepository) ListUserDesktops(desktopDir, vncServerBinPath, username string) ([]*model.DesktopInfo, error) {
	logrus.Debugf("Listing user desktops for user: %s", username)
	conn, err := db.Get()
	if err != nil {
		logrus.Errorf("open global db error: %v", err)
		return nil, fmt.Errorf("open global db error: %v", err)
	}

	count, err := r.dao.CountDesktopsByUser(conn, username)
	if err != nil {
		logrus.Errorf("count desktops error: %v", err)
		return nil, fmt.Errorf("count desktops error: %v", err)
	}
	logrus.Debugf("Found %d desktops in DB for user %s", count, username)

	if count == 0 {
		desktopFilePath, err := getUserDesktopsFilePath(desktopDir, username)
		if err != nil {
			logrus.Errorf("can't get user desktops file path: %v", err)
			return nil, fmt.Errorf("can't get user desktops file path: %v", err)
		}

		desktops, err := readDesktopFile(desktopFilePath)
		if err != nil {
			logrus.Errorf("can't read user desktops file: %v", err)
			return nil, fmt.Errorf("can't read user desktops file: %v", err)
		}
		logrus.Debugf("Read %d desktops from file %s", len(desktops), desktopFilePath)

		if len(desktops) > 0 {
			// deduplicate desktops by displayID, keeping the newest one
			desktopMap := make(map[int]*model.DesktopInfo)
			for _, d := range desktops {
				if existing, ok := desktopMap[d.DisplayID]; ok {
					existingTime, err1 := time.Parse(time.RFC3339Nano, existing.CreateTime)
					newTime, err2 := time.Parse(time.RFC3339Nano, d.CreateTime)
					if err1 == nil && err2 == nil && !newTime.After(existingTime) {
						continue
					}
				}
				desktopMap[d.DisplayID] = d
			}

			for _, d := range desktopMap {
				if err := r.dao.InsertDesktop(conn, username, d.Host, d.DisplayID, d.DesktopName, d.Wm, d.CreateTime); err != nil {
					logrus.Errorf("migrate desktop error: %v", err)
					return nil, fmt.Errorf("migrate desktop error: %v", err)
				}
			}
			logrus.Debugf("Migrated %d desktops from file for user %s", len(desktopMap), username)
		}

		if err := os.Remove(desktopFilePath); err != nil && !os.IsNotExist(err) {
			logrus.Errorf("remove desktops.json error: %v", err)
			return nil, fmt.Errorf("remove desktops.json error: %v", err)
		}
	}

	rows, err := r.dao.SelectDesktopsByUser(conn, username)
	if err != nil {
		logrus.Errorf("query db error: %v", err)
		return nil, fmt.Errorf("query db error: %v", err)
	}
	defer func() {
		if err := rows.Close(); err != nil {
			logrus.Errorf("close rows error: %v", err)
		}
	}()

	var desktops []*model.DesktopInfo
	for rows.Next() {
		var d model.DesktopInfo
		if err := rows.Scan(&d.ID, &d.Host, &d.DisplayID, &d.DesktopName, &d.Wm, &d.CreateTime, &d.IsActive); err != nil {
			logrus.Errorf("scan row error: %v", err)
			return nil, fmt.Errorf("scan row error: %v", err)
		}
		desktops = append(desktops, &d)
	}
	if err := rows.Err(); err != nil {
		logrus.Errorf("iterate rows error: %v", err)
		return nil, fmt.Errorf("iterate rows error: %v", err)
	}
	if logrus.GetLevel() >= logrus.DebugLevel {
		var desktopDisplayIDs []int
		for _, d := range desktops {
			desktopDisplayIDs = append(desktopDisplayIDs, d.DisplayID)
		}
		logrus.Debugf("Retrieved %d desktops from DB for user %s, displayIDs: %v", len(desktops), username, desktopDisplayIDs)
	}

	activeIDs, err := r.listActiveDisplays(vncServerBinPath, username)
	if err != nil {
		logrus.Errorf("list active displays error: %v", err)
		return nil, err
	}
	logrus.Debugf("Active display IDs for user %s: %v", username, activeIDs)

	for _, d := range desktops {
		if _, ok := activeIDs[d.DisplayID]; ok {
			// Active in VNC, no action needed
			logrus.Debugf("Desktop %d is active", d.DisplayID)
		} else if d.IsActive == 1 {
			logrus.Debugf("Desktop %d is marked active in DB but not running, setting to inactive", d.DisplayID)
			if err := r.dao.UpdateDesktopActiveStatus(conn, d.ID, 0); err != nil {
				logrus.Errorf("update is_active error: %v", err)
				return nil, fmt.Errorf("update is_active error: %v", err)
			}
			d.IsActive = 0
		}
	}

	return desktops, nil
}

func (r *desktopRepository) UpdateLastConnectTime(username string, displayID int, t string) error {
	conn, err := db.Get()
	if err != nil {
		logrus.Errorf("open global db error: %v", err)
		return fmt.Errorf("open global db error: %v", err)
	}
	if err := r.dao.UpdateLastConnectTime(conn, username, displayID, t); err != nil {
		logrus.Errorf("update last connect time error: %v", err)
		return fmt.Errorf("update last connect time error: %v", err)
	}
	return nil
}

func (r *desktopRepository) UpdateLastConnectTimeByID(id int, t string) error {
	conn, err := db.Get()
	if err != nil {
		logrus.Errorf("open global db error: %v", err)
		return fmt.Errorf("open global db error: %v", err)
	}
	if err := r.dao.UpdateLastConnectTimeByID(conn, id, t); err != nil {
		logrus.Errorf("update last connect time by id error: %v", err)
		return fmt.Errorf("update last connect time by id error: %v", err)
	}
	return nil
}

func (r *desktopRepository) Remove(id int) error {
	conn, err := db.Get()
	if err != nil {
		logrus.Errorf("open global db error: %v", err)
		return fmt.Errorf("open global db error: %v", err)
	}
	if err := r.dao.DeleteDesktopByID(conn, id); err != nil {
		logrus.Errorf("delete desktop error: %v", err)
		return fmt.Errorf("delete desktop error: %v", err)
	}
	return nil
}

func (r *desktopRepository) listActiveDisplays(vncServerBinPath, username string) (map[int]*int, error) {
	// Switch to the user to execute the vncserver -list command
	// We use "su -l" to simulate a full login shell, ensuring environment variables are set correctly
	cmdStr := fmt.Sprintf("%s -list", vncServerBinPath)
	listCmd := exec.Command("su", "-l", username, "-c", cmdStr)
	var stdoutBuf bytes.Buffer
	listCmd.Stdout = &stdoutBuf

	if err := listCmd.Run(); err != nil {
		logrus.Errorf("list running session error: %s", err)
		return nil, fmt.Errorf("list running session error: %s", err)
	}

	logrus.Debugf("vncserver -list output: %s", stdoutBuf.String())

	m, err := desktop.ParseListOutputWithPid(stdoutBuf.String())
	if err != nil {
		logrus.Errorf("parse session output err: %s", err)
		return nil, fmt.Errorf("parse session output err: %s", err)
	}

	logrus.Debugf("parsed vnc sessions: %+v", m)
	return m, nil
}

func getUserDesktopsFilePath(desktopDir string, username string) (string, error) {
	if desktopDir == "" {
		return "", fmt.Errorf("desktopDir is empty")
	}

	user, err := auth.Lookup(username)
	if err != nil {
		return "", fmt.Errorf("lookup user %s error: %v", username, err)
	}

	return filepath.Join(user.HomeDir, desktopDir, "desktops.json"), nil
}

func readDesktopFile(path string) ([]*model.DesktopInfo, error) {
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return []*model.DesktopInfo{}, nil
		}
		return nil, err
	}
	defer func() {
		if err := f.Close(); err != nil {
			logrus.Errorf("failed to close file %s: %v", path, err)
		}
	}()
	var desktops []*model.DesktopInfo
	if err := json.NewDecoder(f).Decode(&desktops); err != nil {
		if err.Error() == "EOF" {
			return []*model.DesktopInfo{}, nil
		}
		return nil, err
	}
	return desktops, nil
}
