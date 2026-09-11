package file

import (
	"os"
	"path/filepath"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
)

// TempSiblingPath returns a unique temporary path in the same parent directory as finalPath.
// Keeping temp and final as siblings allows a later rename to commit without crossing mounts.
func TempSiblingPath(finalPath string, prefix string) string {
	return filepath.Join(filepath.Dir(finalPath), prefix+uuid.NewString()+"-"+filepath.Base(finalPath))
}

// RemovePathForRollback best-effort removes a rollback target.
// It logs rollback failures but does not mask the original operation error.
func RemovePathForRollback(path string, label string) {
	if err := os.RemoveAll(path); err != nil && !os.IsNotExist(err) {
		logrus.Warnf("Rollback failed to remove %s path=%s: %v", label, path, err)
		return
	}
	logrus.Debugf("Rollback removed %s path=%s", label, path)
}

// RemoveEmptyDirForRollback best-effort removes a directory only if it is empty.
// This avoids deleting pre-existing or concurrently populated parent directories.
func RemoveEmptyDirForRollback(path string, label string) {
	if err := os.Remove(path); err != nil {
		if os.IsNotExist(err) {
			return
		}
		logrus.Warnf("Rollback skipped removing %s path=%s: %v", label, path, err)
		return
	}
	logrus.Debugf("Rollback removed empty %s path=%s", label, path)
}
