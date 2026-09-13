package repository

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/PKUHPC/private-scow/apps/scowd/internal/desktop/dao"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/desktop/model"
)

func migrationFixture(t *testing.T) (*desktopRepository, *sql.DB, string, []byte) {
	t.Helper()
	dir := t.TempDir()
	conn, err := sql.Open("sqlite", filepath.Join(dir, "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	conn.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = conn.Close() })
	r := &desktopRepository{dao: dao.NewDesktopDAO()}
	if err := r.dao.CreateDesktopsTable(conn); err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal([]*model.DesktopInfo{
		{Host: "login01", DisplayID: 1, DesktopName: "new", Wm: "xfce", CreateTime: "2026-09-12T00:00:00Z"},
		{Host: "login01", DisplayID: 1, DesktopName: "old", Wm: "xfce", CreateTime: "2026-09-11T00:00:00Z"},
		{Host: "login02", DisplayID: 2, DesktopName: "second", Wm: "gnome", CreateTime: "2026-09-11T00:00:00Z"},
	})
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "desktops.json")
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatal(err)
	}
	return r, conn, path, data
}

func assertMigrationComplete(t *testing.T, r *desktopRepository, conn *sql.DB, path string) {
	t.Helper()
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatalf("expected legacy file removed, got %v", err)
	}
	count, err := r.dao.CountDesktopsByUser(conn, "alice")
	if err != nil || count != 2 {
		t.Fatalf("expected both deduplicated desktops, count=%d err=%v", count, err)
	}
	var host, name, wm, created, lastConnected string
	var active int
	err = conn.QueryRow("SELECT host, desktop_name, wm, create_time, last_connect_time, is_active FROM desktops WHERE username='alice' AND display_id=1").Scan(&host, &name, &wm, &created, &lastConnected, &active)
	if err != nil {
		t.Fatal(err)
	}
	if host != "login01" || name != "new" || wm != "xfce" || created != "2026-09-12T00:00:00Z" || lastConnected != created || active != 1 {
		t.Fatalf("unexpected migrated desktop: %s %s %s %s %s %d", host, name, wm, created, lastConnected, active)
	}
}

func TestMigrateDesktopFileSuccess(t *testing.T) {
	r, conn, path, _ := migrationFixture(t)
	if err := r.migrateDesktopFile(conn, path, "alice"); err != nil {
		t.Fatal(err)
	}
	assertMigrationComplete(t, r, conn, path)
	// 已提交的迁移再次执行时不依赖旧文件，也不会重复插入。
	if err := r.migrateDesktopFile(conn, path, "alice"); err != nil {
		t.Fatal(err)
	}
	assertMigrationComplete(t, r, conn, path)
}

func TestMigrateDesktopFileRollbackAndRetry(t *testing.T) {
	for _, test := range []struct {
		name      string
		setup     []string
		cleanup   string
		errorText string
	}{
		{
			name: "second insert fails",
			setup: []string{`CREATE TRIGGER fail_migration BEFORE INSERT ON desktops
WHEN (SELECT COUNT(*) FROM desktops WHERE username=NEW.username) >= 1
BEGIN SELECT RAISE(ABORT, 'second insert failed'); END`},
			cleanup:   "DROP TRIGGER fail_migration",
			errorText: "second insert failed",
		},
		{
			name: "commit fails",
			// 延迟外键约束允许 INSERT 成功，在 COMMIT 时才报错。
			setup: []string{
				"PRAGMA foreign_keys=ON",
				"CREATE TABLE migration_parent (id INTEGER PRIMARY KEY)",
				"CREATE TABLE migration_child (id INTEGER REFERENCES migration_parent(id) DEFERRABLE INITIALLY DEFERRED)",
				"CREATE TRIGGER fail_migration AFTER INSERT ON desktops BEGIN INSERT INTO migration_child VALUES (1); END",
			},
			cleanup:   "DROP TRIGGER fail_migration",
			errorText: "commit desktop migration",
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			r, conn, path, original := migrationFixture(t)
			for _, statement := range test.setup {
				if _, err := conn.Exec(statement); err != nil {
					t.Fatal(err)
				}
			}
			err := r.migrateDesktopFile(conn, path, "alice")
			if err == nil || !strings.Contains(err.Error(), test.errorText) {
				t.Fatalf("expected %q, got %v", test.errorText, err)
			}
			count, err := r.dao.CountDesktopsByUser(conn, "alice")
			if err != nil || count != 0 {
				t.Fatalf("migration must roll back all inserts: count=%d err=%v", count, err)
			}
			data, err := os.ReadFile(path)
			if err != nil || !bytes.Equal(data, original) {
				t.Fatalf("legacy file must remain unchanged: %v", err)
			}
			if _, err := conn.Exec(test.cleanup); err != nil {
				t.Fatal(err)
			}
			if err := r.migrateDesktopFile(conn, path, "alice"); err != nil {
				t.Fatalf("migration retry failed: %v", err)
			}
			assertMigrationComplete(t, r, conn, path)
		})
	}
}
