package handlers

import (
	"fmt"
	"os"
	"path/filepath"
	"syscall"

	"scowd/internal/auth"
	apiv1 "scowd/protos/gen/api/storage"

	"github.com/sirupsen/logrus"
)

// buildChownArg constructs the chown argument string ("uid:gid", ":gid", or "uid:") from optional uid/gid.
func buildChownArg(uid, gid *uint32) string {
	var arg string
	switch {
	case uid != nil && gid != nil:
		arg = fmt.Sprintf("%d:%d", *uid, *gid)
	case uid != nil:
		arg = fmt.Sprintf("%d:", *uid)
	default:
		arg = fmt.Sprintf(":%d", *gid)
	}
	logrus.Debugf("buildChownArg: uid=%v gid=%v -> %q", uid, gid, arg)
	return arg
}

// resolveOwnerIDs returns uid and gid as int for os.Lchown (-1 means leave unchanged).
func resolveOwnerIDs(msg *apiv1.ChangeOwnerRequest) (uid, gid int) {
	uid = -1
	gid = -1
	if msg.Uid != nil {
		uid = int(*msg.Uid)
	}
	if msg.Gid != nil {
		gid = int(*msg.Gid)
	}
	logrus.Debugf("resolveOwnerIDs: uid=%d gid=%d", uid, gid)
	return
}

// getRootDir returns the absolute root directory (home dir or shared dir) used to construct
// absolute paths after os.Root boundary validation.
func (k *K8sFileServer) getRootDir(userID string, inShared bool) (string, error) {
	if inShared && k.config != nil && k.config.AI.SharedFolderPath != "" {
		dir := filepath.Clean(k.config.AI.SharedFolderPath)
		logrus.Debugf("getRootDir: using shared folder %s for user %s", dir, userID)
		return dir, nil
	}
	currentUser, err := auth.Lookup(userID)
	if err != nil {
		return "", fmt.Errorf("lookup user %s: %w", userID, err)
	}
	logrus.Debugf("getRootDir: using home dir %s for user %s", currentUser.HomeDir, userID)
	return currentUser.HomeDir, nil
}

// recursiveChangeOwner walks dirPath within root and calls os.Lchown on entries whose uid matches targetUID.
// root.Stat is used on every child path to ensure no traversal outside the sandbox.
func recursiveChangeOwner(root *os.Root, rootDir, dirPath string, uid, gid int, targetUID uint32) error {
	logrus.Debugf("recursiveChangeOwner: entering dir %s (rootDir=%s uid=%d gid=%d targetUID=%d)",
		dirPath, rootDir, uid, gid, targetUID)

	dir, err := root.Open(dirPath)
	if err != nil {
		return fmt.Errorf("open dir %s: %w", dirPath, err)
	}
	defer func() { _ = dir.Close() }()

	entries, err := dir.Readdir(-1)
	if err != nil {
		return fmt.Errorf("readdir %s: %w", dirPath, err)
	}

	for _, entry := range entries {
		childPath := filepath.Join(dirPath, entry.Name())

		// Validate path stays within root sandbox before any operation.
		// Use Lstat (not Stat) to avoid following symlinks, consistent with os.Lchown semantics.
		info, err := root.Lstat(childPath)
		if err != nil {
			return fmt.Errorf("stat %s: %w", childPath, err)
		}

		stat, ok := info.Sys().(*syscall.Stat_t)
		if ok && stat.Uid == targetUID {
			absPath := filepath.Join(rootDir, childPath)
			logrus.Debugf("recursiveChangeOwner: chown %s (uid=%d gid=%d)", absPath, uid, gid)
			if err := os.Lchown(absPath, uid, gid); err != nil {
				return fmt.Errorf("lchown %s: %w", absPath, err)
			}
		}

		if entry.IsDir() {
			if err := recursiveChangeOwner(root, rootDir, childPath, uid, gid, targetUID); err != nil {
				return err
			}
		}
	}
	return nil
}
