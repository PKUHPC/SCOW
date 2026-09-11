package dao

import (
	"database/sql"
)

type DesktopDAO interface {
	CreateDesktopsTable(db *sql.DB) error
	InsertDesktop(db *sql.DB, username string, host string, displayID int, desktopName string, wm string, createTime string) error
	SelectDesktopByID(db *sql.DB, id int) *sql.Row
	SelectDesktopsByUser(db *sql.DB, username string) (*sql.Rows, error)
	CountDesktopsByUser(db *sql.DB, username string) (int, error)
	UpdateDesktopActiveStatus(db *sql.DB, id int, active int) error
	UpdateLastConnectTime(db *sql.DB, username string, displayID int, t string) error
	UpdateLastConnectTimeByID(db *sql.DB, id int, t string) error
	DeleteDesktopByID(db *sql.DB, id int) error
}

type desktopDAO struct{}

func NewDesktopDAO() DesktopDAO { return &desktopDAO{} }

func (d *desktopDAO) CreateDesktopsTable(db *sql.DB) error {
	_, err := db.Exec("CREATE TABLE IF NOT EXISTS desktops (id INTEGER PRIMARY KEY, username TEXT NOT NULL, host TEXT NOT NULL, display_id INTEGER, desktop_name TEXT, wm TEXT, create_time TEXT, last_connect_time TEXT DEFAULT '', is_active INTEGER NOT NULL DEFAULT 1)")
	return err
}

func (d *desktopDAO) InsertDesktop(db *sql.DB, username string, host string, displayID int, desktopName string, wm string, createTime string) error {
	_, err := db.Exec("INSERT OR REPLACE INTO desktops(username, host, display_id, desktop_name, wm, create_time, last_connect_time) VALUES (?,?,?,?,?,?,?)",
		username, host, displayID, desktopName, wm, createTime, createTime,
	)
	return err
}

func (d *desktopDAO) SelectDesktopByID(db *sql.DB, id int) *sql.Row {
	return db.QueryRow("SELECT id, username, host, display_id, desktop_name, wm, create_time, is_active FROM desktops WHERE id=?", id)
}

func (d *desktopDAO) SelectDesktopsByUser(db *sql.DB, username string) (*sql.Rows, error) {
	return db.Query("SELECT id, host, display_id, desktop_name, wm, create_time, is_active FROM desktops WHERE username= ?", username)
}

func (d *desktopDAO) CountDesktopsByUser(db *sql.DB, username string) (int, error) {
	var count int
	row := db.QueryRow("SELECT COUNT(*) FROM desktops WHERE username= ?", username)
	err := row.Scan(&count)
	return count, err
}

func (d *desktopDAO) UpdateDesktopActiveStatus(db *sql.DB, id int, active int) error {
	_, err := db.Exec("UPDATE desktops SET is_active= ? WHERE id= ?", active, id)
	return err
}

func (d *desktopDAO) UpdateLastConnectTime(db *sql.DB, username string, displayID int, t string) error {
	res, err := db.Exec("UPDATE desktops SET last_connect_time= ? WHERE username= ? AND display_id= ?", t, username, displayID)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (d *desktopDAO) UpdateLastConnectTimeByID(db *sql.DB, id int, t string) error {
	res, err := db.Exec("UPDATE desktops SET last_connect_time= ? WHERE id= ?", t, id)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (d *desktopDAO) DeleteDesktopByID(db *sql.DB, id int) error {
	_, err := db.Exec("DELETE FROM desktops WHERE id= ?", id)
	return err
}
