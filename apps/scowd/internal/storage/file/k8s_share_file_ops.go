package file

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"connectrpc.com/connect"
	"github.com/sirupsen/logrus"
)

// ValidateShareFileOrDirPaths 校验分享接口中由前端拼接传入的各路径是否保持在当前用户共享目录内。
// 同时保证目标路径层级关系正确，最终分享文件名与源文件名一致。
func ValidateShareFileOrDirPaths(
	userID string,
	sharedFolderPath string,
	sourceFilePath string,
	targetDirectory string,
	targetTopDir string,
	targetFullDir string,
	sharedFilePath string,
) error {
	if sharedFolderPath == "" {
		logrus.Errorf("Validate path failed: shared folder path is empty")
		return connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("shared folder path is empty"))
	}

	if err := validateCleanBase(filepath.Base(sourceFilePath), "source_file_path"); err != nil {
		return err
	}
	if err := validateCleanBase(filepath.Base(sharedFilePath), "shared_file_path"); err != nil {
		return err
	}

	userSharedRoot := filepath.Join(filepath.Clean(sharedFolderPath), userID)
	if !isPathInsideOrSame(userSharedRoot, targetDirectory) {
		logrus.Errorf(
			"Validate path failed: target_directory %s must be under user shared root %s",
			targetDirectory,
			userSharedRoot,
		)
		return connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("target_directory must be under user shared root"))
	}
	if !isPathInside(targetDirectory, targetTopDir) {
		logrus.Errorf("Validate path failed: target_top_dir %s must be under target_directory %s", targetTopDir, targetDirectory)
		return connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("target_top_dir must be under target_directory"))
	}
	if !isPathInside(targetTopDir, targetFullDir) {
		logrus.Errorf("Validate path failed: target_full_dir %s must be under target_top_dir %s", targetFullDir, targetTopDir)
		return connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("target_full_dir must be under target_top_dir"))
	}
	if !isPathInside(targetFullDir, sharedFilePath) {
		logrus.Errorf("Validate path failed: shared_file_path %s must be under target_full_dir %s", sharedFilePath, targetFullDir)
		return connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("shared_file_path must be under target_full_dir"))
	}
	if filepath.Base(sharedFilePath) != filepath.Base(sourceFilePath) {
		logrus.Errorf("Validate path failed: shared_file_path %s basename must match source_file_path %s basename", sharedFilePath, sourceFilePath)
		return connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("shared_file_path basename must match source_file_path basename"))
	}
	return nil
}

// validateCleanBase 校验路径 basename 是否有效，避免空值、当前目录或上级目录作为文件名。
func validateCleanBase(base string, field string) error {
	if base == "" || base == "." || base == ".." {
		logrus.Errorf("Validate path failed: %s has invalid basename %s", field, base)
		return connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("%s has invalid basename", field))
	}
	return nil
}

// isPathInside 判断 child 是否严格位于 parent 目录下，不允许 parent 和 child 是同一路径。
func isPathInside(parent string, child string) bool {
	if filepath.Clean(parent) == filepath.Clean(child) {
		return false
	}
	return isPathInsideOrSame(parent, child)
}

// isPathInsideOrSame 判断 child 是否位于 parent 目录下，允许二者是同一路径。
func isPathInsideOrSame(parent string, child string) bool {
	parent = filepath.Clean(parent)
	child = filepath.Clean(child)

	rel, err := filepath.Rel(parent, child)
	if err != nil {
		return false
	}
	return rel == "." || (rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)))
}

// ParseFileMode 将八进制字符串形式的权限转换为 os.FileMode。
func ParseFileMode(modeString string) (os.FileMode, error) {
	mode64, err := strconv.ParseInt(modeString, 8, 32)
	if err != nil {
		logrus.Errorf("Invalid file mode format mode=%s: %v", modeString, err)
		return 0, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("invalid mode format: %w", err))
	}
	return os.FileMode(mode64), nil
}

// ChangeModeInRoot 在指定 os.Root 范围内修改文件或目录权限，可选择递归处理目录。
func ChangeModeInRoot(root *os.Root, relativePath string, displayPath string, modeString string, recursive bool) error {
	mode, err := ParseFileMode(modeString)
	if err != nil {
		return err
	}

	if recursive {
		info, err := root.Stat(relativePath)
		if err != nil {
			if os.IsNotExist(err) {
				logrus.Errorf(
					"ChangeModeInRoot failed: path does not exist display_path=%s relative_path=%s mode=%s recursive=%v",
					displayPath,
					relativePath,
					modeString,
					recursive,
				)
				return connect.NewError(connect.CodeNotFound, err)
			}
			logrus.Errorf(
				"ChangeModeInRoot failed to stat path display_path=%s relative_path=%s mode=%s recursive=%v: %v",
				displayPath,
				relativePath,
				modeString,
				recursive,
				err,
			)
			return connect.NewError(connect.CodeInternal, err)
		}

		if !info.IsDir() {
			logrus.Errorf(
				"ChangeModeInRoot failed: recursive chmod target is not a directory display_path=%s relative_path=%s mode=%s",
				displayPath,
				relativePath,
				modeString,
			)
			return connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("path is not a directory"))
		}

		if err := recursiveChangeModeInRoot(root, relativePath, mode); err != nil {
			logrus.Errorf(
				"ChangeModeInRoot failed recursive chmod display_path=%s relative_path=%s mode=%s: %v",
				displayPath,
				relativePath,
				modeString,
				err,
			)
			return connect.NewError(connect.CodeInternal, err)
		}
		return nil
	}

	file, err := root.OpenFile(relativePath, os.O_RDONLY, 0)
	if err != nil {
		logrus.Errorf(
			"ChangeModeInRoot failed to open target display_path=%s relative_path=%s mode=%s recursive=%v: %v",
			displayPath,
			relativePath,
			modeString,
			recursive,
			err,
		)
		return connect.NewError(connect.CodeInternal, err)
	}
	defer func() { _ = file.Close() }()

	if err := file.Chmod(mode); err != nil {
		logrus.Errorf(
			"ChangeModeInRoot failed to chmod target display_path=%s relative_path=%s mode=%s recursive=%v: %v",
			displayPath,
			relativePath,
			modeString,
			recursive,
			err,
		)
		return connect.NewError(connect.CodeInternal, err)
	}
	return nil
}

// recursiveChangeModeInRoot 在指定 os.Root 范围内递归修改目录及其子项权限。
func recursiveChangeModeInRoot(root *os.Root, dirPath string, mode os.FileMode) error {
	file, err := root.OpenFile(dirPath, os.O_RDONLY, 0)
	if err != nil {
		logrus.Errorf("recursiveChangeModeInRoot failed to open directory path=%s mode=%#o: %v", dirPath, mode, err)
		return err
	}
	if err := file.Chmod(mode); err != nil {
		_ = file.Close()
		logrus.Errorf("recursiveChangeModeInRoot failed to chmod directory path=%s mode=%#o: %v", dirPath, mode, err)
		return err
	}
	_ = file.Close()

	dir, err := root.Open(dirPath)
	if err != nil {
		logrus.Errorf("recursiveChangeModeInRoot failed to open directory for read path=%s mode=%#o: %v", dirPath, mode, err)
		return err
	}
	defer func() { _ = dir.Close() }()

	entries, err := dir.Readdir(-1)
	if err != nil {
		logrus.Errorf("recursiveChangeModeInRoot failed to read directory entries path=%s mode=%#o: %v", dirPath, mode, err)
		return err
	}

	for _, entry := range entries {
		childPath := filepath.Join(dirPath, entry.Name())

		if _, err := root.Stat(childPath); err != nil {
			logrus.Errorf("recursiveChangeModeInRoot failed to stat child path=%s parent=%s mode=%#o: %v", childPath, dirPath, mode, err)
			return err
		}

		if entry.IsDir() {
			if err := recursiveChangeModeInRoot(root, childPath, mode); err != nil {
				return err
			}
		} else {
			cfile, err := root.OpenFile(childPath, os.O_RDONLY, 0)
			if err != nil {
				logrus.Errorf("recursiveChangeModeInRoot failed to open file path=%s mode=%#o: %v", childPath, mode, err)
				return err
			}
			if err := cfile.Chmod(mode); err != nil {
				_ = cfile.Close()
				logrus.Errorf("recursiveChangeModeInRoot failed to chmod file path=%s mode=%#o: %v", childPath, mode, err)
				return err
			}
			_ = cfile.Close()
		}
	}
	return nil
}
