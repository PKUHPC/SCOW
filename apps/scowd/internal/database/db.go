package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	_ "modernc.org/sqlite"
)

var globalDB *sql.DB
var once sync.Once
var dbErr error

func getGlobalDBPath() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("get executable path error: %v", err)
	}
	dir := filepath.Dir(exe)
	return filepath.Join(dir, "scowd.db"), nil
}

func Get() (*sql.DB, error) {
	once.Do(func() {
		p, e := getGlobalDBPath()
		if e != nil {
			dbErr = e
			return
		}

		// Ensure file exists with 0600 permissions (Read/Write for owner only)
		f, err := os.OpenFile(p, os.O_RDWR|os.O_CREATE, 0600)
		if err != nil {
			dbErr = fmt.Errorf("create/open db file error: %v", err)
			return
		}
		_ = f.Close()

		if err := os.Chmod(p, 0600); err != nil {
			dbErr = fmt.Errorf("chmod db file error: %v", err)
			return
		}

		globalDB, dbErr = sql.Open("sqlite", p)
	})
	if dbErr != nil {
		return nil, dbErr
	}
	return globalDB, nil
}
