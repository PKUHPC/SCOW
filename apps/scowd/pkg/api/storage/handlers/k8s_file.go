package handlers

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
	"unicode/utf8"

	global_child "scowd/global/child"
	"scowd/pkg/config"
	"scowd/pkg/libs/auth"
	fileUtils "scowd/pkg/utils/file"
	storageUtils "scowd/pkg/utils/storage"
	"scowd/pkg/utils/system"
	apiv1 "scowd/protos/gen/api/storage"

	"connectrpc.com/connect"
	"github.com/gabriel-vasile/mimetype"
	cp "github.com/otiai10/copy"
	"github.com/sirupsen/logrus"
)

// K8sFileServer 专门处理 Kubernetes 环境下的文件管理，使用 os.Root 限制用户权限
type K8sFileServer struct {
	// 配置信息，包含共享文件夹路径等
	config *config.ScowdConfig
}

// NewK8sFileServer 创建带配置的 K8sFileServer 实例
func NewK8sFileServer() *K8sFileServer {
	conf, _ := config.GetScowdConfig()
	return &K8sFileServer{config: conf}
}

// getRootForPaths 根据路径决定使用共享文件夹 root 还是用户家目录 root
func (k *K8sFileServer) getRootForPaths(userID string, paths ...string) (*os.Root, error) {
	if k.config != nil && k.config.AI.SharedFolderPath != "" {
		shared := filepath.Clean(k.config.AI.SharedFolderPath)
		for _, p := range paths {
			if strings.HasPrefix(filepath.Clean(p), shared) {
				// 检查共享文件夹路径是否为软链接
				fileInfo, err := os.Lstat(shared)
				if err != nil {
					if os.IsNotExist(err) {
						logrus.Errorf("shared folder %s is not exist", shared)
						return nil, err
					}
					return nil, fmt.Errorf("failed to check shared folder path %s: %w", shared, err)
				}
				if fileInfo.Mode()&os.ModeSymlink != 0 {
					return nil, fmt.Errorf("shared folder path %s is a symbolic link, symbolic links are not allowed", shared)
				}
				return os.OpenRoot(shared)
			}
		}
	}
	return getUserHomeRoot(userID)
}

const maxBodySize = 10 * 1024 * 1024 // 10MB

// getUserHomeRoot 获取用户家目录并创建 os.Root 实例
func getUserHomeRoot(userID string) (*os.Root, error) {
	currentUser, err := auth.Lookup(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to lookup user %s: %w", userID, err)
	}
	logrus.Debugf("user %s's home dir is %s", userID, currentUser.HomeDir)

	if err := system.CreateUserHomeDir(userID, currentUser.HomeDir); err != nil {
		logrus.Errorf("Failed to create user home directory for user %s: %v", userID, err)
		return nil, fmt.Errorf("failed to create user home directory for user %s: %w", userID, err)
	}

	// 在用户家目录下创建一个 scow 目录
	uid, err := strconv.Atoi(currentUser.UID)
	if err != nil {
		logrus.Errorf("Failed to parse UID for user %s: %v", userID, err)
		return nil, fmt.Errorf("failed to parse UID for user %s: %w", userID, err)
	}

	gid, err := strconv.Atoi(currentUser.GID)
	if err != nil {
		logrus.Errorf("Failed to parse GID for user %s: %v", userID, err)
		return nil, fmt.Errorf("failed to parse GID for user %s: %w", userID, err)
	}

	if err := system.CreateScowDir(currentUser.HomeDir, uid, gid); err != nil {
		logrus.Errorf("Failed to create scow directory for user %s: %v", userID, err)
		return nil, fmt.Errorf("failed to create scow directory for user %s: %w", userID, err)
	}

	// 检查目录是否存在和可访问
	fileInfo, err := os.Stat(currentUser.HomeDir)
	if err != nil {
		if os.IsNotExist(err) {
			logrus.Errorf("Home directory %s does not exist for user %s", currentUser.HomeDir, userID)
			return nil, fmt.Errorf("home directory %s does not exist for user %s", currentUser.HomeDir, userID)
		} else if os.IsPermission(err) {
			logrus.Errorf("Permission denied accessing home directory %s for user %s", currentUser.HomeDir, userID)
			return nil, fmt.Errorf("permission denied accessing home directory %s for user %s: %w", currentUser.HomeDir, userID, err)
		}
		logrus.Errorf("Cannot access home directory %s for user %s: %v", currentUser.HomeDir, userID, err)
		return nil, fmt.Errorf("cannot access home directory %s for user %s: %w", currentUser.HomeDir, userID, err)
	}

	// 验证是否为目录
	if !fileInfo.IsDir() {
		logrus.Errorf("Path %s is not a directory for user %s", currentUser.HomeDir, userID)
		return nil, fmt.Errorf("path %s is not a directory for user %s", currentUser.HomeDir, userID)
	}

	// 检查路径是否为软链接
	if fileInfo.Mode()&os.ModeSymlink != 0 {
		logrus.Errorf("Path %s is a symbolic link for user %s, not allowed", currentUser.HomeDir, userID)
		return nil, fmt.Errorf("path %s is a symbolic link for user %s, symbolic links are not allowed", currentUser.HomeDir, userID)
	}

	// 记录目录权限信息用于调试
	logrus.Debugf("Home directory %s permissions: %v", currentUser.HomeDir, fileInfo.Mode())

	// 尝试创建 os.Root
	root, err := os.OpenRoot(currentUser.HomeDir)
	if err != nil {
		if os.IsPermission(err) {
			logrus.Errorf("Permission denied creating root for %s: %v", currentUser.HomeDir, err)
			return nil, fmt.Errorf("permission denied creating root for %s: %w", currentUser.HomeDir, err)
		}
		// 记录详细的错误信息用于调试
		logrus.Errorf("Failed to create os.Root for %s, error type: %T, error: %v", currentUser.HomeDir, err, err)
		return nil, fmt.Errorf("failed to create root for %s: %w", currentUser.HomeDir, err)
	}

	logrus.Debugf("Successfully created os.Root for user %s at %s", userID, currentUser.HomeDir)
	return root, nil
}

// handleStorageError 处理存储空间不足和配额超限错误
func handleStorageError(err error, operation string, path string) (bool, *connect.Error) {
	if errors.Is(err, syscall.ENOSPC) {
		logrus.Errorf("No space left on device during %s: %s", operation, path)
		return true, connect.NewError(connect.CodeResourceExhausted, err)
	}
	if errors.Is(err, syscall.EDQUOT) {
		logrus.Errorf("Disk quota exceeded during %s: %s", operation, path)
		return true, connect.NewError(connect.CodeResourceExhausted, err)
	}
	return false, nil
}

// getRelativePathForUser 将绝对路径转换为相对于用户主目录的相对路径
func getRelativePathForUser(userID, absolutePath string) (string, error) {
	currentUser, err := auth.Lookup(userID)
	if err != nil {
		return "", fmt.Errorf("failed to lookup user %s: %w", userID, err)
	}

	// 将绝对路径转换为相对于用户主目录的相对路径
	relativePath, err := filepath.Rel(currentUser.HomeDir, absolutePath)
	if err != nil {
		return "", fmt.Errorf("failed to get relative path for %s relative to %s: %w", absolutePath, currentUser.HomeDir, err)
	}

	// 检查路径是否试图访问主目录之外的内容
	if strings.HasPrefix(relativePath, "..") {
		return "", fmt.Errorf("path %s is outside user home directory %s", absolutePath, currentUser.HomeDir)
	}

	return relativePath, nil
}

func openRoot(userID string, noCheckPermission bool) (*os.Root, error) {
	if noCheckPermission {
		root, err := os.OpenRoot("/")
		if err != nil {
			return nil, fmt.Errorf("failed to create root: %w", err)
		}
		return root, nil
	}

	root, err := getUserHomeRoot(userID)
	if err != nil {
		return nil, err
	}

	return root, nil
}

func buildRelativePath(userID, absolutePath string, noCheckPermission bool) (string, error) {
	if noCheckPermission {
		return normalizeNoCheckRelativePath(absolutePath), nil
	}

	relativePath, err := getRelativePathForUser(userID, absolutePath)
	if err != nil {
		return "", connect.NewError(connect.CodePermissionDenied, err)
	}

	return relativePath, nil
}

func normalizeNoCheckRelativePath(absolutePath string) string {
	relativePath := strings.TrimPrefix(absolutePath, "/")
	if relativePath == "" {
		relativePath = "."
	}
	return relativePath
}

// getRelativePathForRoot 根据路径是否在共享文件夹中，转换为相对路径
func (k *K8sFileServer) getRelativePathForRoot(userID, absolutePath string, inShared bool) (string, error) {
	if inShared && k.config != nil && k.config.AI.SharedFolderPath != "" {
		// 对于共享文件夹，使用共享文件夹路径作为根目录
		sharedPrefix := filepath.Clean(k.config.AI.SharedFolderPath)
		relativePath, err := filepath.Rel(sharedPrefix, absolutePath)
		if err != nil {
			return "", fmt.Errorf("failed to get relative path for %s relative to shared folder %s: %w", absolutePath, sharedPrefix, err)
		}
		// 检查路径是否试图访问共享文件夹之外的内容
		if strings.HasPrefix(relativePath, "..") {
			return "", fmt.Errorf("path %s is outside shared folder %s", absolutePath, sharedPrefix)
		}
		return relativePath, nil
	} else {
		// 对于用户主目录，使用现有函数
		return getRelativePathForUser(userID, absolutePath)
	}
}

// validatePathWithinRoot 验证路径是否在 root 限制范围内
func validatePathWithinRoot(root *os.Root, path string) error {
	logrus.Debugf("Validating path %s within root", path)
	// 使用 root.Stat 来验证路径是否在 root 限制范围内
	// 如果路径超出 root 限制，os.Root 会返回错误
	_, err := root.Stat(path)
	if err != nil {
		// 如果是因为文件不存在，我们需要检查父目录
		if os.IsNotExist(err) {
			logrus.Debugf("Path %s does not exist, checking parent directory", path)
			// 检查父目录是否在 root 范围内
			parentDir := filepath.Dir(path)
			logrus.Debugf("Parent directory of %s is %s", path, parentDir)
			// 防止无限递归：如果父目录等于当前路径或者是"."/"/"，停止递归
			if parentDir != "." && parentDir != "/" && parentDir != path && len(parentDir) < len(path) {
				return validatePathWithinRoot(root, parentDir)
			}
			// 如果到达根目录或无法继续向上，说明路径是有效的
			logrus.Debugf("Reached root level for path %s, considering valid", path)
			return nil
		}
		// 其他错误可能表示路径超出限制或权限问题
		logrus.Debugf("Path validation failed for %s: %v", path, err)
		return err
	}
	logrus.Debugf("Path %s validated successfully", path)
	return nil
}

func (k *K8sFileServer) ReadDirectory(
	ctx context.Context,
	req *connect.Request[apiv1.ReadDirectoryRequest],
) (*connect.Response[apiv1.ReadDirectoryResponse], error) {
	noCheckPermission := req.Msg.GetNoCheckPermission()

	logrus.Infof("K8s Read Directory %s for user %s (no_check_permission: %v)",
		req.Msg.DirPath, req.Msg.UserId, noCheckPermission)

	var root *os.Root
	var relativePath string
	var err error

	root, err = openRoot(req.Msg.UserId, noCheckPermission)
	if err != nil {
		logrus.Errorf("Failed to create root for path %s: %v", req.Msg.DirPath, err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	defer func() {
		if closeErr := root.Close(); closeErr != nil {
			logrus.Errorf("Failed to close root: %v", closeErr)
		}
	}()

	relativePath, err = buildRelativePath(req.Msg.UserId, req.Msg.DirPath, noCheckPermission)
	if err != nil {
		logrus.Errorf("Path conversion error: %v", err)
		return nil, err
	}

	if noCheckPermission {
		logrus.Debugf("Using system root with relative path: %s", relativePath)
	} else {
		logrus.Debugf("Using relative path: %s for directory access", relativePath)
	}

	// 以下逻辑对两种模式完全相同，无需任何 if-else 分支

	// 使用 os.Root 验证路径是否在限制范围内
	if err := validatePathWithinRoot(root, relativePath); err != nil {
		if os.IsNotExist(err) {
			logrus.Errorf("Directory %s does not exist", req.Msg.DirPath)
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("directory %s does not exist", req.Msg.DirPath))
		}
		logrus.Errorf("Directory path %s is outside root or permission denied", req.Msg.DirPath)
		return nil, connect.NewError(connect.CodePermissionDenied, fmt.Errorf("directory path %s is outside allowed root directory or permission denied", req.Msg.DirPath))
	}

	file, err := root.Open(relativePath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			logrus.Errorf("Path %s does not exist", req.Msg.DirPath)
			return nil, connect.NewError(connect.CodeNotFound, err)
		} else if errors.Is(err, os.ErrPermission) {
			logrus.Errorf("Permission denied accessing path: %s", req.Msg.DirPath)
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}
		logrus.Errorf("Error accessing path %s: %v", req.Msg.DirPath, err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	defer func() {
		if err := file.Close(); err != nil {
			logrus.Errorf("Failed to close file: %v", err)
		}
	}()

	// 获取文件信息
	fileInfo, err := file.Stat()
	if err != nil {
		logrus.WithError(err).Error("Can't get file info")
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	if !fileInfo.IsDir() {
		logrus.Errorf("The path %s is a file not a dir", req.Msg.DirPath)
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("NOT_A_DIR"))
	}

	// 使用 root.ReadDir 读取目录
	var filesInfo = make([]*apiv1.FileInfo, 0, 100)
	entries, err := file.ReadDir(-1)
	if err != nil {
		if errors.Is(err, os.ErrPermission) {
			logrus.Errorf("Permission denied reading directory: %s", req.Msg.DirPath)
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}
		logrus.Errorf("Error reading directory %s: %v", req.Msg.DirPath, err)
		return nil, connect.NewError(connect.CodeUnknown, err)
	}

	for _, entry := range entries {
		if !utf8.ValidString(entry.Name()) {
			logrus.Warnf("Skipping file with invalid UTF-8 name: %q", entry.Name())
			continue
		}

		info, err := entry.Info()
		if err != nil {
			logrus.Errorf("Get FileInfo Error: %v", err)
			continue
		}

		fileType := apiv1.FileType_FILE
		if entry.IsDir() {
			fileType = apiv1.FileType_DIR
		}

		modTime := info.ModTime()
		size := info.Size()
		mode := info.Mode()

		// 构建相对路径用于软链接检测
		entryRelativePath := filepath.Join(relativePath, entry.Name())
		var linkTargetPath *string
		var linkTargetType *apiv1.FileType

		// 检测是否为软链接
		// 注意：在 os.Root 环境中，我们需要使用 root.Lstat 来检测软链接
		linkInfo, err := root.Lstat(entryRelativePath)
		if err == nil && linkInfo.Mode()&os.ModeSymlink != 0 {
			// 这是一个软链接
			fileType = apiv1.FileType_SYMLINK

			// 解析软链接目标
			targetPath, err := root.Readlink(entryRelativePath)
			if err == nil {
				var absoluteTargetPath string
				if filepath.IsAbs(targetPath) {
					absoluteTargetPath = filepath.Clean(targetPath)
				} else {
					resolved := filepath.Clean(filepath.Join(relativePath, targetPath))
					absoluteTargetPath = filepath.Join(root.Name(), resolved)
					targetPath = resolved
				}
				if !utf8.ValidString(absoluteTargetPath) {
					logrus.Warnf("Skipping symlink target with invalid UTF-8 path: %q", absoluteTargetPath)
				} else {
					linkTargetPath = &absoluteTargetPath
				}

				// 检测目标类型（若目标为软链接则返回 SYMLINK）
				tgtInfo, err := root.Lstat(targetPath)
				if err == nil {
					if tgtInfo.Mode()&os.ModeSymlink != 0 {
						targetType := apiv1.FileType_SYMLINK
						linkTargetType = &targetType
					} else {
						// 非软链接，进一步判断是目录还是文件
						targetInfo, err := root.Stat(targetPath)
						if err == nil {
							if targetInfo.IsDir() {
								targetType := apiv1.FileType_DIR
								linkTargetType = &targetType
							} else {
								targetType := apiv1.FileType_FILE
								linkTargetType = &targetType
							}
						}
					}
				}
				// 如果无法解析目标或目标不存在，linkTargetType 保持为 nil
			}
		}

		filesInfo = append(filesInfo, &apiv1.FileInfo{
			FileType:       fileType,
			Name:           entry.Name(),
			ModTime:        modTime.Format(time.RFC3339),
			SizeByte:       uint64(size),
			Mode:           uint32(mode),
			LinkTargetPath: linkTargetPath,
			LinkTargetType: linkTargetType,
		})
	}

	logrus.Infof("Read %d files", len(filesInfo))

	res := connect.NewResponse(&apiv1.ReadDirectoryResponse{
		FilesInfo: filesInfo,
	})

	return res, nil
}

func (k *K8sFileServer) CreateFile(
	ctx context.Context,
	req *connect.Request[apiv1.CreateFileRequest],
) (*connect.Response[apiv1.CreateFileResponse], error) {

	noCheckPermission := req.Msg.GetNoCheckPermission()

	logrus.Infof(
		"K8s Create file %s for user %s (no_check_permission: %v)",
		req.Msg.FilePath,
		req.Msg.UserId,
		noCheckPermission,
	)

	var (
		root         *os.Root
		relativePath string
		err          error
	)

	// 1. 打开 root + 计算相对路径
	root, err = openRoot(req.Msg.UserId, noCheckPermission)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	defer func() {
		if closeErr := root.Close(); closeErr != nil {
			logrus.Errorf("Failed to close root: %v", closeErr)
		}
	}()

	relativePath, err = buildRelativePath(req.Msg.UserId, req.Msg.FilePath, noCheckPermission)
	if err != nil {
		return nil, err
	}

	// 2. 禁止创建 root 或空路径
	if relativePath == "" || relativePath == "." {
		return nil, connect.NewError(
			connect.CodeInvalidArgument,
			errors.New("invalid file path"),
		)
	}

	// 3. 如果文件已存在，直接返回
	if _, err := root.Stat(relativePath); err == nil {
		logrus.Infof("File already exists at %s", req.Msg.FilePath)
		return connect.NewResponse(&apiv1.CreateFileResponse{}), nil
	}

	// 4. 校验父目录存在且在 root 内
	parentDir := filepath.Dir(relativePath)
	if parentDir != "." {
		if err := validatePathWithinRoot(root, parentDir); err != nil {
			if os.IsNotExist(err) {
				return nil, connect.NewError(connect.CodeNotFound, err)
			}
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}
	}

	// 5. 创建文件
	file, err := root.Create(relativePath)
	if err != nil {
		if errors.Is(err, os.ErrPermission) {
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}
		if errors.Is(err, os.ErrNotExist) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	defer func() {
		if closeErr := file.Close(); closeErr != nil {
			logrus.Errorf("Failed to close file: %v", closeErr)
		}
	}()

	logrus.Infof("Successfully created file at %s", req.Msg.FilePath)
	return connect.NewResponse(&apiv1.CreateFileResponse{}), nil
}

func (k *K8sFileServer) MakeDirectory(
	ctx context.Context,
	req *connect.Request[apiv1.MakeDirectoryRequest],
) (*connect.Response[apiv1.MakeDirectoryResponse], error) {

	// 路径合法校验
	if err := fileUtils.ValidateMakeDirPath(req.Msg.DirPath); err != nil {
		logrus.WithError(err).Errorf("k8s directory path validation failed: %s", req.Msg.DirPath)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	if req.Msg.Mode != nil {
		logrus.Infof("k8s creating directory %s with mode %s for user %s", req.Msg.DirPath, *req.Msg.Mode, req.Msg.UserId)
		dirMode, err := fileUtils.ParseMakeDirMode(req.Msg.Mode, 0775)
		if err != nil {
			modeStr := "<nil>"
			if req.Msg.Mode != nil {
				modeStr = *req.Msg.Mode
			}
			logrus.WithError(err).Errorf("invalid mode %s for directory %s", modeStr, req.Msg.DirPath)
			return nil, connect.NewError(connect.CodeInvalidArgument, err)
		}
		logrus.Infof("K8s creating directory %s with mode %s for user %s as root",
			req.Msg.DirPath, *req.Msg.Mode, req.Msg.UserId)
		if err := fileUtils.MakeDirectoryAsRoot(req.Msg.DirPath, req.Msg.UserId, dirMode); err != nil {
			return nil, err
		}
		return connect.NewResponse(&apiv1.MakeDirectoryResponse{}), nil
	}

	noCheckPermission := req.Msg.GetNoCheckPermission()

	logrus.Infof("K8s Create directory %s for user %s (no_check_permission: %v)",
		req.Msg.DirPath, req.Msg.UserId, noCheckPermission)

	var root *os.Root
	var relativePath string
	var err error

	if noCheckPermission {
		// 不检查权限模式：创建系统根目录的 os.Root
		root, err = openRoot("", true)
		if err != nil {
			logrus.Errorf("Failed to create root for system path: %v", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		defer func() {
			if closeErr := root.Close(); closeErr != nil {
				logrus.Errorf("Failed to close root: %v", closeErr)
			}
		}()

		relativePath, err = buildRelativePath("", req.Msg.DirPath, true)
		if err != nil {
			logrus.Errorf("Path conversion error: %v", err)
			return nil, err
		}
		logrus.Debugf("Using system root with relative path: %s", relativePath)
	} else {
		// 正常模式：根据路径决定使用共享文件夹还是用户家目录

		// 如果是希望创建分享目录下的内容，但是分享目录不存在时应该创建
		if strings.HasPrefix(req.Msg.DirPath, k.config.AI.SharedFolderPath) {
			err := os.MkdirAll(k.config.AI.SharedFolderPath, 0775)
			if err != nil {
				if isStorageError, storageErr := handleStorageError(err, "directory creation", k.config.AI.SharedFolderPath); isStorageError {
					return nil, storageErr
				} else if os.IsExist(err) {
					logrus.Infof("Directory already exists at %s", k.config.AI.SharedFolderPath)
				} else {
					logrus.Errorf("Make directory error at %s: %v", k.config.AI.SharedFolderPath, err)
					return nil, connect.NewError(connect.CodeInternal, err)
				}
			} else {
				logrus.Infof("Successfully created directory at %s", k.config.AI.SharedFolderPath)
			}
		}

		root, err = k.getRootForPaths(req.Msg.UserId, req.Msg.DirPath)
		if err != nil {
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		defer func() {
			if closeErr := root.Close(); closeErr != nil {
				logrus.Errorf("Failed to close root: %v", closeErr)
			}
		}()

		// 检查是否在共享文件夹中
		inShared := strings.HasPrefix(req.Msg.DirPath, k.config.AI.SharedFolderPath)

		// 将绝对路径转换为相对路径
		relativePath, err = k.getRelativePathForRoot(req.Msg.UserId, req.Msg.DirPath, inShared)
		if err != nil {
			logrus.Errorf("Path conversion error: %v", err)
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}

		logrus.Debugf("Using relative path: %s for directory creation", relativePath)
	}

	// 以下逻辑对两种模式完全相同

	// 验证路径是否在root限制内
	if err := validatePathWithinRoot(root, relativePath); err != nil {
		logrus.Errorf("Directory path %s is outside root or permission denied", req.Msg.DirPath)
		return nil, connect.NewError(connect.CodePermissionDenied, fmt.Errorf("directory path %s is outside allowed root directory or permission denied", req.Msg.DirPath))
	}

	// 创建目录（无 mode 参数时使用默认 0775）
	err = os.MkdirAll(req.Msg.DirPath, 0775)
	if err != nil {
		if isStorageError, storageErr := handleStorageError(err, "directory creation", req.Msg.DirPath); isStorageError {
			return nil, storageErr
		}
		if os.IsExist(err) {
			logrus.Infof("Directory already exists at %s", req.Msg.DirPath)
			return connect.NewResponse(&apiv1.MakeDirectoryResponse{}), nil
		} else if os.IsPermission(err) {
			logrus.Errorf("No permission to create directory at %s", req.Msg.DirPath)
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}
		logrus.Errorf("Make directory error at %s: %v", req.Msg.DirPath, err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	logrus.Infof("Successfully created directory at %s", req.Msg.DirPath)
	return connect.NewResponse(&apiv1.MakeDirectoryResponse{}), nil
}

func (k *K8sFileServer) DeleteDirectory(ctx context.Context,
	req *connect.Request[apiv1.DeleteDirectoryRequest],
) (*connect.Response[apiv1.DeleteDirectoryResponse], error) {
	noCheckPermission := req.Msg.GetNoCheckPermission()

	logrus.Infof("K8s Delete directory %s for user %s (no_check_permission: %v)",
		req.Msg.DirPath, req.Msg.UserId, noCheckPermission)

	var (
		root         *os.Root
		relativePath string
		err          error
	)

	if noCheckPermission {
		root, err = openRoot("", true)
		if err != nil {
			logrus.Errorf("Failed to create system root: %v", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		defer func() {
			if closeErr := root.Close(); closeErr != nil {
				logrus.Errorf("Failed to close root: %v", closeErr)
			}
		}()

		relativePath, err = buildRelativePath("", req.Msg.DirPath, true)
		if err != nil {
			logrus.Errorf("Path conversion error: %v", err)
			return nil, err
		}
		logrus.Debugf("Using system root, relative path: %s", relativePath)

	} else {
		root, err = k.getRootForPaths(req.Msg.UserId, req.Msg.DirPath)
		if err != nil {
			logrus.Errorf("Failed to get root for path %s: %v", req.Msg.DirPath, err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		defer func() {
			if closeErr := root.Close(); closeErr != nil {
				logrus.Errorf("Failed to close root: %v", closeErr)
			}
		}()

		inShared := k.config != nil &&
			k.config.AI.SharedFolderPath != "" &&
			strings.HasPrefix(req.Msg.DirPath, k.config.AI.SharedFolderPath)

		logrus.Debugf("Directory %s is in shared folder: %v", req.Msg.DirPath, inShared)

		relativePath, err = k.getRelativePathForRoot(
			req.Msg.UserId,
			req.Msg.DirPath,
			inShared,
		)
		if err != nil {
			logrus.Errorf("Path conversion error: %v", err)
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}

		logrus.Debugf("Converted to relative path: %s", relativePath)
	}

	if relativePath == "." {
		logrus.Errorf("Refusing to delete root directory: %s", req.Msg.DirPath)
		return nil, connect.NewError(
			connect.CodeInvalidArgument,
			errors.New("refusing to delete root directory"),
		)
	}

	dirInfo, err := root.Stat(relativePath)
	if err != nil {
		if os.IsNotExist(err) {
			logrus.Errorf("Directory %s does not exist", req.Msg.DirPath)
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		logrus.Errorf("Failed to stat directory %s: %v", req.Msg.DirPath, err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	logrus.Debug("Directory exists and stat successful")

	// 确保是目录而不是文件
	if !dirInfo.IsDir() {
		logrus.Errorf("Path %s is not a directory", req.Msg.DirPath)
		return nil, connect.NewError(
			connect.CodeInvalidArgument,
			fmt.Errorf("path is not a directory"),
		)
	}

	// 删除目录（必须通过 root）
	logrus.Debugf(
		"Removing directory (relative=%s, original=%s)",
		relativePath,
		req.Msg.DirPath,
	)

	if err := root.RemoveAll(relativePath); err != nil {
		if os.IsNotExist(err) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		if os.IsPermission(err) {
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}
		logrus.Errorf("Delete directory error: %v", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	logrus.Infof("Successfully deleted directory: %s", req.Msg.DirPath)

	return connect.NewResponse(&apiv1.DeleteDirectoryResponse{}), nil
}

func (k *K8sFileServer) DeleteFile(ctx context.Context,
	req *connect.Request[apiv1.DeleteFileRequest],
) (*connect.Response[apiv1.DeleteFileResponse], error) {
	noCheckPermission := req.Msg.GetNoCheckPermission()

	logrus.Infof("K8s Delete file %s for user %s (no_check_permission: %v)",
		req.Msg.FilePath, req.Msg.UserId, noCheckPermission)

	var root *os.Root
	var relativePath string
	var err error

	root, err = openRoot(req.Msg.UserId, noCheckPermission)
	if err != nil {
		logrus.Errorf("Failed to create root for path %s: %v", req.Msg.FilePath, err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	defer func() {
		if closeErr := root.Close(); closeErr != nil {
			logrus.Errorf("Failed to close root: %v", closeErr)
		}
	}()

	relativePath, err = buildRelativePath(req.Msg.UserId, req.Msg.FilePath, noCheckPermission)
	if err != nil {
		logrus.Errorf("Path conversion error: %v", err)
		return nil, err
	}

	// 检查文件是否存在并确保是文件而不是目录
	fileInfo, err := root.Lstat(relativePath)
	if err != nil {
		if os.IsNotExist(err) {
			logrus.Errorf("File %s does not exist", req.Msg.FilePath)
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		logrus.Errorf("Failed to stat file %s: %v", req.Msg.FilePath, err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	if fileInfo.IsDir() {
		logrus.Errorf("Path %s is a directory, not a file", req.Msg.FilePath)
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("path is a directory"))
	}

	err = root.Remove(relativePath)
	if err != nil {
		if os.IsNotExist(err) {
			logrus.Errorf("File does not exist at %s", req.Msg.FilePath)
			return nil, connect.NewError(connect.CodeNotFound, err)
		} else if os.IsPermission(err) {
			logrus.Errorf("No permission to delete file at %s", req.Msg.FilePath)
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}
		logrus.Errorf("Delete file error at %s: %v", req.Msg.FilePath, err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	logrus.Infof("Successfully deleted file at %s", req.Msg.FilePath)
	res := connect.NewResponse(&apiv1.DeleteFileResponse{})
	return res, nil
}

func (k *K8sFileServer) WriteFile(ctx context.Context,
	req *connect.Request[apiv1.WriteFileRequest],
) (*connect.Response[apiv1.WriteFileResponse], error) {
	logrus.Infof("K8s Write file %s for user %s", req.Msg.FilePath, req.Msg.UserId)

	contentLength := len(req.Msg.Content)
	if contentLength > maxBodySize {
		return nil, connect.NewError(
			connect.CodeInvalidArgument,
			fmt.Errorf("request body exceeds the maximum allowed size of %d bytes", maxBodySize),
		)
	}

	root, err := getUserHomeRoot(req.Msg.UserId)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	defer func() { _ = root.Close() }()

	// 将绝对路径转换为相对路径
	relativePath, err := getRelativePathForUser(req.Msg.UserId, req.Msg.FilePath)
	if err != nil {
		logrus.Errorf("Path conversion error: %v", err)
		return nil, connect.NewError(connect.CodePermissionDenied, err)
	}

	// 使用 os.Root 验证路径是否在限制范围内
	if err := validatePathWithinRoot(root, relativePath); err != nil {
		// 对于写入操作，如果路径不存在但父目录存在且在范围内，则允许
		if !os.IsNotExist(err) {
			logrus.Errorf("File path %s is outside root or permission denied", req.Msg.FilePath)
			return nil, connect.NewError(connect.CodePermissionDenied, fmt.Errorf("file path %s is outside allowed root directory or permission denied", req.Msg.FilePath))
		}
		// 验证父目录是否在范围内
		relativeParentDir := filepath.Dir(relativePath)
		if relativeParentDir != "." && relativeParentDir != relativePath {
			if err := validatePathWithinRoot(root, relativeParentDir); err != nil {
				logrus.Errorf("Parent directory %s is outside root or permission denied", req.Msg.FilePath)
				return nil, connect.NewError(connect.CodePermissionDenied, fmt.Errorf("parent directory of %s is outside allowed root directory or permission denied", req.Msg.FilePath))
			}
		}
	}

	var writeErr error
	if req.Msg.Append != nil && *req.Msg.Append {
		logrus.Infof("Add new content to file %s for user %s", req.Msg.FilePath, req.Msg.UserId)
		if _, err := root.Stat(relativePath); os.IsNotExist(err) {
			logrus.Errorf("File does not exist at %s", req.Msg.FilePath)
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		file, err := root.OpenFile(relativePath, os.O_WRONLY|os.O_APPEND, 0)
		if err != nil {
			writeErr = err
		} else {
			defer func() { _ = file.Close() }()
			_, writeErr = file.WriteString(req.Msg.Content)
		}
	} else {
		file, err := root.OpenFile(relativePath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0664)
		if err != nil {
			writeErr = err
		} else {
			defer func() { _ = file.Close() }()
			_, writeErr = file.Write([]byte(req.Msg.Content))
		}
	}

	if writeErr != nil {
		logrus.Errorf("Write file error at %s: %v", req.Msg.FilePath, writeErr)
		return nil, connect.NewError(connect.CodeInternal, writeErr)
	}

	logrus.Infof("Successfully wrote file at %s", req.Msg.FilePath)
	res := connect.NewResponse(&apiv1.WriteFileResponse{})
	return res, nil
}

func (k *K8sFileServer) ReadFile(ctx context.Context,
	req *connect.Request[apiv1.ReadFileRequest],
) (*connect.Response[apiv1.ReadFileResponse], error) {
	logrus.Infof("K8s Read file %s for user %s", req.Msg.FilePath, req.Msg.UserId)

	root, err := getUserHomeRoot(req.Msg.UserId)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	defer func() { _ = root.Close() }()

	// 将绝对路径转换为相对路径
	relativePath, err := getRelativePathForUser(req.Msg.UserId, req.Msg.FilePath)
	if err != nil {
		logrus.Errorf("Path conversion error: %v", err)
		return nil, connect.NewError(connect.CodePermissionDenied, err)
	}

	fileInfo, err := root.Lstat(relativePath)
	if err != nil {
		if os.IsNotExist(err) {
			logrus.Errorf("File %s does not exist", req.Msg.FilePath)
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		logrus.Errorf("Failed to stat file %s: %v", req.Msg.FilePath, err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// 确保是文件而不是目录
	if fileInfo.IsDir() {
		logrus.Errorf("Path %s is a directory, not a file", req.Msg.FilePath)
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("path is a directory"))
	}

	if fileInfo.Size() > maxBodySize {
		logrus.Errorf("File size %d exceeds maximum allowed size %d bytes", fileInfo.Size(), maxBodySize)
		return nil, connect.NewError(
			connect.CodeResourceExhausted,
			fmt.Errorf("file size exceeds the maximum allowed size of %d bytes", maxBodySize),
		)
	}

	file, err := root.Open(relativePath)
	if err != nil {
		logrus.Errorf("Failed to open file %s: %v", req.Msg.FilePath, err)
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to open file: %w", err))
	}
	defer func() { _ = file.Close() }()

	content, err := io.ReadAll(file)
	if err != nil {
		logrus.Errorf("Failed to read file %s: %v", req.Msg.FilePath, err)
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to read file: %w", err))
	}

	logrus.Infof("Successfully read file %s (%d bytes)", req.Msg.FilePath, len(content))
	return connect.NewResponse(&apiv1.ReadFileResponse{
		Content: content,
	}), nil
}

func (k *K8sFileServer) ChangeMode(ctx context.Context,
	req *connect.Request[apiv1.ChangeModeRequest],
) (*connect.Response[apiv1.ChangeModeResponse], error) {
	noCheckPermission := req.Msg.GetNoCheckPermission()
	logrus.Infof(
		"K8s ChangeMode request user=%s path=%s mode=%s recursive=%v no_check_permission=%v",
		req.Msg.UserId,
		req.Msg.Path,
		req.Msg.Mode,
		req.Msg.Recursive,
		noCheckPermission,
	)

	if err := k.changeModePath(req.Msg.UserId, req.Msg.Path, req.Msg.Mode, req.Msg.Recursive, noCheckPermission); err != nil {
		return nil, err
	}

	return connect.NewResponse(&apiv1.ChangeModeResponse{}), nil
}

func (k *K8sFileServer) changeModePath(
	userID string,
	path string,
	modeString string,
	recursive bool,
	noCheckPermission bool,
) error {
	var root *os.Root
	var relativePath string
	var err error

	logrus.Debugf(
		"Preparing chmod user=%s path=%s mode=%s recursive=%v no_check_permission=%v",
		userID,
		path,
		modeString,
		recursive,
		noCheckPermission,
	)

	if noCheckPermission {
		root, err = openRoot("", true)
		if err != nil {
			logrus.Errorf(
				"Failed to create root for chmod user=%s path=%s mode=%s recursive=%v no_check_permission=%v: %v",
				userID,
				path,
				modeString,
				recursive,
				noCheckPermission,
				err,
			)
			return connect.NewError(connect.CodeInternal, err)
		}
		defer func() { _ = root.Close() }()

		relativePath, err = buildRelativePath("", path, true)
		if err != nil {
			logrus.Errorf(
				"Failed to build chmod relative path user=%s path=%s mode=%s recursive=%v no_check_permission=%v: %v",
				userID,
				path,
				modeString,
				recursive,
				noCheckPermission,
				err,
			)
			return err
		}
		logrus.Debugf(
			"Chmod uses system root path=%s relative_path=%s",
			path,
			relativePath,
		)
	} else {
		root, err = k.getRootForPaths(userID, path)
		if err != nil {
			logrus.Errorf(
				"Failed to resolve chmod root user=%s path=%s mode=%s recursive=%v no_check_permission=%v: %v",
				userID,
				path,
				modeString,
				recursive,
				noCheckPermission,
				err,
			)
			return connect.NewError(connect.CodeInternal, err)
		}
		defer func() { _ = root.Close() }()

		inShared := k.config != nil && k.config.AI.SharedFolderPath != "" &&
			strings.HasPrefix(path, k.config.AI.SharedFolderPath)
		relativePath, err = k.getRelativePathForRoot(userID, path, inShared)
		if err != nil {
			logrus.Errorf(
				"Failed to convert chmod path user=%s path=%s mode=%s recursive=%v in_shared=%v no_check_permission=%v: %v",
				userID,
				path,
				modeString,
				recursive,
				inShared,
				noCheckPermission,
				err,
			)
			return connect.NewError(connect.CodePermissionDenied, err)
		}
		logrus.Debugf(
			"Chmod resolved root=%s path=%s relative_path=%s in_shared=%v",
			root.Name(),
			path,
			relativePath,
			inShared,
		)
	}

	if err := fileUtils.ChangeModeInRoot(root, relativePath, path, modeString, recursive); err != nil {
		logrus.Debugf(
			"Chmod failed path=%s relative_path=%s mode=%s recursive=%v: %v",
			path,
			relativePath,
			modeString,
			recursive,
			err,
		)
		return err
	}
	logrus.Debugf(
		"Chmod finished path=%s relative_path=%s mode=%s recursive=%v",
		path,
		relativePath,
		modeString,
		recursive,
	)
	return nil
}

func (k *K8sFileServer) GetHomeDirectory(ctx context.Context,
	req *connect.Request[apiv1.GetHomeDirectoryRequest],
) (*connect.Response[apiv1.GetHomeDirectoryResponse], error) {
	logrus.Infof("K8s Get home directory")

	currentUser, err := auth.Lookup(req.Msg.UserId)
	if err != nil {
		logrus.Errorf("Get home directory error")
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&apiv1.GetHomeDirectoryResponse{
		Path: currentUser.HomeDir,
	}), nil
}

func (k *K8sFileServer) GetFileMetadata(
	ctx context.Context,
	req *connect.Request[apiv1.GetFileMetadataRequest],
) (*connect.Response[apiv1.GetFileMetadataResponse], error) {
	noCheckPermission := req.Msg.GetNoCheckPermission()

	logrus.Infof("K8s Get file %s metadata (no_check_permission: %v)", req.Msg.FilePath, noCheckPermission)

	var root *os.Root
	var relativePath string
	var err error

	root, err = openRoot(req.Msg.UserId, noCheckPermission)
	if err != nil {
		logrus.Errorf("Failed to create root for path %s: %v", req.Msg.FilePath, err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	defer func() {
		if closeErr := root.Close(); closeErr != nil {
			logrus.Errorf("Failed to close root: %v", closeErr)
		}
	}()

	relativePath, err = buildRelativePath(req.Msg.UserId, req.Msg.FilePath, noCheckPermission)
	if err != nil {
		logrus.Errorf("Path conversion error: %v", err)
		return nil, err
	}

	if noCheckPermission {
		logrus.Debugf("Using system root with relative path: %s", relativePath)
	} else {
		logrus.Debugf("Using relative path: %s", relativePath)
	}

	// 获取文件信息
	fileInfo, err := root.Lstat(relativePath)
	if err != nil {
		if os.IsNotExist(err) {
			logrus.Errorf("Path %s does not exist", req.Msg.FilePath)
			return nil, connect.NewError(connect.CodeNotFound, err)
		} else if os.IsPermission(err) {
			logrus.Errorf("Insufficient permission to read path %s", req.Msg.FilePath)
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}
		logrus.WithError(err).Errorf(
			"Get file metadata error at %s (userId=%s, relative=%s)",
			req.Msg.FilePath, req.Msg.UserId, relativePath,
		)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	fileType := apiv1.FileType_FILE
	if fileInfo.IsDir() {
		fileType = apiv1.FileType_DIR
	}

	fileMode := fileInfo.Mode().Perm()
	perm := uint32(fileMode)

	isSymlink := fileInfo.Mode()&os.ModeSymlink != 0

	var linkTargetPath string
	var linkTargetType apiv1.FileType
	if isSymlink {
		// 解析软链接目标路径
		target, err := root.Readlink(relativePath)
		if err == nil {
			isAbs := filepath.IsAbs(target)
			var linkTargetRelative string

			if noCheckPermission {
				// 不检查权限模式：直接使用绝对路径
				if isAbs {
					linkTargetPath = filepath.Clean(target)
					linkTargetRelative = strings.TrimPrefix(linkTargetPath, "/")
				} else {
					linkTargetRelative = filepath.Clean(filepath.Join(filepath.Dir(relativePath), target))
					linkTargetPath = "/" + linkTargetRelative
				}
			} else {
				// 正常模式：相对于用户家目录
				if isAbs {
					if rel, err := getRelativePathForUser(req.Msg.UserId, target); err == nil {
						linkTargetRelative = rel
					}
					linkTargetPath = filepath.Clean(target)
				} else {
					linkTargetRelative = filepath.Clean(filepath.Join(filepath.Dir(relativePath), target))
					if currentUser, err := auth.Lookup(req.Msg.UserId); err == nil {
						linkTargetPath = filepath.Clean(filepath.Join(currentUser.HomeDir, linkTargetRelative))
					}
				}
			}

			if linkTargetRelative != "" {
				// 判断目标类型
				if tInfo, err := root.Lstat(linkTargetRelative); err == nil && tInfo.Mode()&os.ModeSymlink != 0 {
					linkTargetType = apiv1.FileType_SYMLINK
				} else if tStat, err := root.Stat(linkTargetRelative); err == nil {
					if tStat.IsDir() {
						linkTargetType = apiv1.FileType_DIR
					} else {
						linkTargetType = apiv1.FileType_FILE
					}
				}
			}
		}
	}

	var mimeType string
	if fileType == apiv1.FileType_FILE {
		// 对于 root 限制的文件系统，我们需要使用 root.Open 来读取文件进行 MIME 检测
		file, err := root.Open(relativePath)
		if err == nil {
			defer func() { _ = file.Close() }()
			mime, err := mimetype.DetectReader(file)
			if err == nil {
				mimeType = mime.String()
			}
		}
		if mimeType == "" {
			mimeType = "application/octet-stream"
		}
	}

	res := connect.NewResponse(&apiv1.GetFileMetadataResponse{
		SizeByte:       uint64(fileInfo.Size()),
		Type:           fileType,
		Permission:     perm,
		IsSymlink:      isSymlink,
		Mime:           mimeType,
		LinkTargetPath: &linkTargetPath,
		LinkTargetType: &linkTargetType,
	})

	return res, nil
}

func (k *K8sFileServer) Exists(
	ctx context.Context,
	req *connect.Request[apiv1.ExistsRequest],
) (*connect.Response[apiv1.ExistsResponse], error) {
	noCheckPermission := req.Msg.GetNoCheckPermission()

	logrus.Infof("K8s Check if the path %s exists (no_check_permission: %v)", req.Msg.Path, noCheckPermission)

	var root *os.Root
	var relativePath string
	var err error

	if noCheckPermission {
		// 不检查权限模式：创建系统根目录的 os.Root
		root, err = openRoot("", true)
		if err != nil {
			logrus.Errorf("Failed to create root for system path: %v", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		defer func() {
			if closeErr := root.Close(); closeErr != nil {
				logrus.Errorf("Failed to close root: %v", closeErr)
			}
		}()

		relativePath, err = buildRelativePath("", req.Msg.Path, true)
		if err != nil {
			logrus.Errorf("Path conversion error: %v", err)
			return nil, err
		}
		logrus.Debugf("Using system root with relative path: %s", relativePath)
	} else {
		// 正常模式：根据路径决定使用共享文件夹还是用户家目录
		root, err = k.getRootForPaths(req.Msg.UserId, req.Msg.Path)
		if err != nil {
			if os.IsNotExist(err) {
				return connect.NewResponse(&apiv1.ExistsResponse{
					Exists: false,
				}), nil
			}
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		defer func() {
			if closeErr := root.Close(); closeErr != nil {
				logrus.Errorf("Failed to close root: %v", closeErr)
			}
		}()

		inShared := k.config != nil && k.config.AI.SharedFolderPath != "" &&
			strings.HasPrefix(req.Msg.Path, k.config.AI.SharedFolderPath)

		relativePath, err = k.getRelativePathForRoot(req.Msg.UserId, req.Msg.Path, inShared)
		if err != nil {
			logrus.Errorf("Path conversion error: %v", err)
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}
		logrus.Debugf("Using relative path: %s", relativePath)
	}

	// 检查路径是否存在
	_, err = root.Lstat(relativePath)
	if err == nil {
		return connect.NewResponse(&apiv1.ExistsResponse{
			Exists: true,
		}), nil
	}
	if os.IsNotExist(err) || errors.Is(err, syscall.ENOTDIR) {
		logrus.Infof("Path %s does not exist", req.Msg.Path)
		return connect.NewResponse(&apiv1.ExistsResponse{
			Exists: false,
		}), nil
	}

	if os.IsPermission(err) {
		logrus.Errorf("Insufficient permission to read path %s", req.Msg.Path)
		return nil, connect.NewError(connect.CodePermissionDenied, err)
	}

	logrus.Errorf("Check if the path %s exists error", req.Msg.Path)
	return nil, connect.NewError(connect.CodeInternal, err)
}

func (k *K8sFileServer) Copy(ctx context.Context,
	req *connect.Request[apiv1.CopyRequest],
) (*connect.Response[apiv1.CopyResponse], error) {
	noCheckPermission := req.Msg.GetNoCheckPermission()
	isShareFileCopy := req.Msg.Mode != nil && req.Msg.ChmodRecursive != nil
	copyType := "normal_file_copy"
	if isShareFileCopy {
		copyType = "shared_file_copy"
	}

	logrus.Infof(
		"K8s Copy request type=%s user=%s from=%s to=%s no_check_permission=%v mode=%s chmod_recursive=%v",
		copyType,
		req.Msg.UserId,
		req.Msg.FromPath,
		req.Msg.ToPath,
		noCheckPermission,
		req.Msg.GetMode(),
		req.Msg.GetChmodRecursive(),
	)

	var srcRoot, dstRoot *os.Root
	var srcRelativePath, dstRelativePath string
	var err error

	if noCheckPermission {
		// 不检查权限模式：源和目标都使用系统根目录
		srcRoot, err = os.OpenRoot("/")
		if err != nil {
			logrus.Errorf("Failed to create source root: %v", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		defer func() {
			if closeErr := srcRoot.Close(); closeErr != nil {
				logrus.Errorf("Failed to close srcRoot: %v", closeErr)
			}
		}()

		dstRoot, err = os.OpenRoot("/")
		if err != nil {
			logrus.Errorf("Failed to create destination root: %v", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		defer func() {
			if closeErr := dstRoot.Close(); closeErr != nil {
				logrus.Errorf("Failed to close dstRoot: %v", closeErr)
			}
		}()

		srcRelativePath = strings.TrimPrefix(req.Msg.FromPath, "/")
		dstRelativePath = strings.TrimPrefix(req.Msg.ToPath, "/")

		// 防止操作文件系统根目录
		if srcRelativePath == "" || dstRelativePath == "" {
			return nil, connect.NewError(connect.CodeInvalidArgument,
				errors.New("refusing to operate on filesystem root"))
		}
	} else {
		// 正常模式：根据共享目录判断
		var sharedPrefix string
		if k.config != nil && k.config.AI.SharedFolderPath != "" {
			sharedPrefix = filepath.Clean(k.config.AI.SharedFolderPath)
			logrus.Debugf("Shared folder prefix: %s", sharedPrefix)
		}

		inShared := func(p string) bool {
			return sharedPrefix != "" && strings.HasPrefix(filepath.Clean(p), sharedPrefix)
		}

		srcInShared := inShared(req.Msg.FromPath)
		dstInShared := inShared(req.Msg.ToPath)
		logrus.Debugf("Source in shared: %v, Destination in shared: %v", srcInShared, dstInShared)

		if srcInShared {
			srcRoot, err = os.OpenRoot(sharedPrefix)
		} else {
			srcRoot, err = getUserHomeRoot(req.Msg.UserId)
		}
		if err != nil {
			logrus.Errorf("Failed to open source root: %v", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		defer func() {
			if closeErr := srcRoot.Close(); closeErr != nil {
				logrus.Errorf("Failed to close srcRoot: %v", closeErr)
			}
		}()

		if dstInShared {
			dstRoot, err = os.OpenRoot(sharedPrefix)
		} else {
			dstRoot, err = getUserHomeRoot(req.Msg.UserId)
		}
		if err != nil {
			logrus.Errorf("Failed to open destination root: %v", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		defer func() {
			if closeErr := dstRoot.Close(); closeErr != nil {
				logrus.Errorf("Failed to close dstRoot: %v", closeErr)
			}
		}()

		srcRelativePath, err = k.getRelativePathForRoot(req.Msg.UserId, req.Msg.FromPath, srcInShared)
		if err != nil {
			logrus.Errorf("Source path conversion error: %v", err)
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}

		dstRelativePath, err = k.getRelativePathForRoot(req.Msg.UserId, req.Msg.ToPath, dstInShared)
		if err != nil {
			logrus.Errorf("Destination path conversion error: %v", err)
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}
	}

	// 判断是否在同一个 root（通过路径比较，而非指针比较）
	sameRoot := srcRoot.Name() == dstRoot.Name()
	logrus.Debugf("Same root: %v (src: %s, dst: %s)", sameRoot, srcRoot.Name(), dstRoot.Name())

	// 验证源路径存在且在 root 范围内
	if err := validatePathWithinRoot(srcRoot, srcRelativePath); err != nil {
		if os.IsNotExist(err) {
			logrus.Errorf("Source path %s does not exist", req.Msg.FromPath)
			return nil, connect.NewError(connect.CodeNotFound,
				fmt.Errorf("source path %s does not exist", req.Msg.FromPath))
		}
		logrus.Errorf("Source path %s is outside root or permission denied", req.Msg.FromPath)
		return nil, connect.NewError(connect.CodePermissionDenied,
			fmt.Errorf("source path %s is outside allowed root directory", req.Msg.FromPath))
	}

	// 验证目标路径的父目录在 root 范围内
	dstParentDir := filepath.Dir(dstRelativePath)
	if err := validatePathWithinRoot(dstRoot, dstParentDir); err != nil {
		if !os.IsNotExist(err) {
			logrus.Errorf("Target parent directory is outside root or permission denied")
			return nil, connect.NewError(connect.CodePermissionDenied,
				fmt.Errorf("target path parent directory is outside allowed root directory"))
		}
	}

	// 防止复制到自身或子目录（仅当在同一个 root 时）
	if sameRoot {
		if srcRelativePath == dstRelativePath {
			return nil, connect.NewError(connect.CodeInvalidArgument,
				errors.New("cannot copy to itself"))
		}
		if strings.HasPrefix(dstRelativePath, srcRelativePath+string(filepath.Separator)) {
			return nil, connect.NewError(connect.CodeInvalidArgument,
				errors.New("cannot copy to subdirectory of itself"))
		}
	}

	if req.Msg.Mode != nil {
		if _, err := fileUtils.ParseFileMode(req.Msg.GetMode()); err != nil {
			logrus.Errorf("Failed to parse mode: %v", err)
			return nil, err
		}
		if _, err := dstRoot.Lstat(dstRelativePath); err == nil {
			return nil, connect.NewError(connect.CodeAlreadyExists, fmt.Errorf("target path %s already exists", req.Msg.ToPath))
		} else if !os.IsNotExist(err) {
			logrus.Errorf("Failed to check target path before atomic copy path=%s: %v", req.Msg.ToPath, err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		if err := k.copyWithModeAtomic(
			req.Msg.UserId,
			req.Msg.FromPath,
			req.Msg.ToPath,
			req.Msg.GetMode(),
			req.Msg.GetChmodRecursive(),
			req.Msg.GetNoCheckPermission(),
		); err != nil {
			return nil, err
		}
	} else {
		// 使用绝对路径进行复制
		// 注意：cp.Copy 不是 root-safe，但前面的 validatePathWithinRoot 已提供保护
		logrus.Debugf("Starting copy from %s to %s", req.Msg.FromPath, req.Msg.ToPath)
		err = cp.Copy(req.Msg.FromPath, req.Msg.ToPath)
		if err != nil {
			if isStorageError, storageErr := handleStorageError(err, "copy operation",
				fmt.Sprintf("%s to %s", req.Msg.FromPath, req.Msg.ToPath)); isStorageError {
				return nil, storageErr
			}
			logrus.Errorf("Copy failed: %v", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
	}

	logrus.Infof("Successfully copied %s to %s", req.Msg.FromPath, req.Msg.ToPath)
	return connect.NewResponse(&apiv1.CopyResponse{}), nil
}

// 复制同时递归修改文件夹权限
func (k *K8sFileServer) copyWithModeAtomic(
	userID string,
	fromPath string,
	toPath string,
	mode string,
	chmodRecursive bool,
	noCheckPermission bool,
) error {
	tmpPath := fileUtils.TempSiblingPath(toPath, ".scowd-copy-tmp-")
	logrus.Debugf(
		"Starting atomic copy with chmod user=%s from=%s to=%s tmp=%s mode=%s recursive=%v no_check_permission=%v",
		userID,
		fromPath,
		toPath,
		tmpPath,
		mode,
		chmodRecursive,
		noCheckPermission,
	)

	if err := cp.Copy(fromPath, tmpPath); err != nil {
		if isStorageError, storageErr := handleStorageError(err, "copy operation",
			fmt.Sprintf("%s to %s", fromPath, toPath)); isStorageError {
			return storageErr
		}
		logrus.Errorf("Atomic copy failed before chmod from=%s tmp=%s: %v", fromPath, tmpPath, err)
		return connect.NewError(connect.CodeInternal, err)
	}

	cleanupTmp := true
	defer func() {
		if cleanupTmp {
			fileUtils.RemovePathForRollback(tmpPath, "atomic copy temp")
		}
	}()

	if err := k.changeModePath(userID, tmpPath, mode, chmodRecursive, noCheckPermission); err != nil {
		logrus.Errorf(
			"Atomic copy chmod failed, rolling back temp path user=%s tmp=%s target=%s mode=%s recursive=%v: %v",
			userID,
			tmpPath,
			toPath,
			mode,
			chmodRecursive,
			err,
		)
		return err
	}

	if err := os.Rename(tmpPath, toPath); err != nil {
		// 在rename时再次进行文件系统元数据层面的限制失败
		// TODO: 对接多存储后需要进行逻辑分歧处理
		if isStorageError, storageErr := handleStorageError(err, "atomic copy rename",
			fmt.Sprintf("%s to %s", tmpPath, toPath)); isStorageError {
			return storageErr
		}
		logrus.Errorf("Atomic copy rename failed tmp=%s target=%s: %v", tmpPath, toPath, err)
		return connect.NewError(connect.CodeInternal, err)
	}

	cleanupTmp = false
	logrus.Infof(
		"Successfully copied with mode user=%s from=%s to=%s mode=%s recursive=%v no_check_permission=%v",
		userID,
		fromPath,
		toPath,
		mode,
		chmodRecursive,
		noCheckPermission,
	)
	return nil
}

func (k *K8sFileServer) ShareFileOrDir(ctx context.Context,
	req *connect.Request[apiv1.ShareFileOrDirRequest],
) (*connect.Response[apiv1.ShareFileOrDirResponse], error) {
	targetDirectory := req.Msg.TargetDirectory
	targetTopDir := req.Msg.TargetTopDir
	targetFullDir := req.Msg.TargetFullDir
	sharedFilePath := req.Msg.SharedFilePath

	logrus.Infof(
		"K8s ShareFileOrDir request user=%s source=%s shared=%s target_directory=%s target_top_dir=%s target_full_dir=%s mode=%s",
		req.Msg.UserId,
		req.Msg.SourceFilePath,
		sharedFilePath,
		targetDirectory,
		targetTopDir,
		targetFullDir,
		req.Msg.Mode,
	)

	sharedFolderPath := ""
	if k.config != nil {
		sharedFolderPath = k.config.AI.SharedFolderPath
	}
	if err := fileUtils.ValidateShareFileOrDirPaths(
		req.Msg.UserId,
		sharedFolderPath,
		req.Msg.SourceFilePath,
		targetDirectory,
		targetTopDir,
		targetFullDir,
		sharedFilePath,
	); err != nil {
		return nil, err
	}
	if _, err := fileUtils.ParseFileMode(req.Msg.Mode); err != nil {
		return nil, err
	}
	if err := k.validateShareSourcePath(req.Msg.UserId, req.Msg.SourceFilePath); err != nil {
		logShareFileOrDirStepError("validate source path", err)
		return nil, err
	}

	// 记录本次操作时产生的副作用，失败时按相反顺序处理
	var rollback []func()
	shareCompleted := false
	defer func() {
		if shareCompleted {
			return
		}
		for i := len(rollback) - 1; i >= 0; i-- {
			rollback[i]()
		}
	}()

	targetDirectoryExists, err := k.Exists(ctx, connect.NewRequest(&apiv1.ExistsRequest{
		UserId: req.Msg.UserId,
		Path:   targetDirectory,
	}))
	if err != nil {
		logShareFileOrDirStepError("check target directory", err)
		return nil, err
	}
	logrus.Debugf(
		"K8s ShareFileOrDir: target directory exists=%v path=%s",
		targetDirectoryExists.Msg.Exists,
		targetDirectory,
	)
	if !targetDirectoryExists.Msg.Exists {
		logrus.Debugf(
			"K8s ShareFileOrDir: Creating target directory path=%s and applying recursive mode=%s",
			targetDirectory,
			req.Msg.Mode,
		)
		if _, err := k.MakeDirectory(ctx, connect.NewRequest(&apiv1.MakeDirectoryRequest{
			UserId:  req.Msg.UserId,
			DirPath: targetDirectory,
		})); err != nil {
			logShareFileOrDirStepError("create target directory", err)
			return nil, err
		}
		rollback = append(rollback, func() {
			fileUtils.RemoveEmptyDirForRollback(targetDirectory, "share target directory")
		})
		if _, err := k.ChangeMode(ctx, connect.NewRequest(&apiv1.ChangeModeRequest{
			UserId:    req.Msg.UserId,
			Path:      targetDirectory,
			Mode:      req.Msg.Mode,
			Recursive: true,
		})); err != nil {
			logShareFileOrDirStepError("chmod target directory", err)
			return nil, err
		}
	}

	targetTopDirExists, err := k.Exists(ctx, connect.NewRequest(&apiv1.ExistsRequest{
		UserId: req.Msg.UserId,
		Path:   targetTopDir,
	}))
	if err != nil {
		logShareFileOrDirStepError("check target top directory", err)
		return nil, err
	}

	targetFullDirExists, err := k.Exists(ctx, connect.NewRequest(&apiv1.ExistsRequest{
		UserId: req.Msg.UserId,
		Path:   targetFullDir,
	}))
	if err != nil {
		logShareFileOrDirStepError("check target full directory", err)
		return nil, err
	}
	logrus.Debugf(
		"K8s ShareFileOrDir: Target full directory exists=%v path=%s",
		targetFullDirExists.Msg.Exists,
		targetFullDir,
	)
	if !targetFullDirExists.Msg.Exists {
		logrus.Debugf(
			"K8s ShareFileOrDir: Creating target full directory path=%s",
			targetFullDir,
		)
		if _, err := k.MakeDirectory(ctx, connect.NewRequest(&apiv1.MakeDirectoryRequest{
			UserId:  req.Msg.UserId,
			DirPath: targetFullDir,
		})); err != nil {
			logShareFileOrDirStepError("create target full directory", err)
			return nil, err
		}
		if !targetTopDirExists.Msg.Exists {
			rollback = append(rollback, func() {
				fileUtils.RemoveEmptyDirForRollback(targetTopDir, "share target top directory")
			})
		}
		rollback = append(rollback, func() {
			fileUtils.RemovePathForRollback(targetFullDir, "share target full directory")
		})
	}

	tmpSharedFilePath := fileUtils.TempSiblingPath(sharedFilePath, ".scowd-share-tmp-")
	logrus.Debugf(
		"K8s ShareFileOrDir: Copying shared source=%s to temp_path=%s final_path=%s",
		req.Msg.SourceFilePath,
		tmpSharedFilePath,
		sharedFilePath,
	)
	rollback = append(rollback, func() {
		fileUtils.RemovePathForRollback(tmpSharedFilePath, "share temp copy")
	})
	if _, err := k.Copy(ctx, connect.NewRequest(&apiv1.CopyRequest{
		UserId:   req.Msg.UserId,
		FromPath: req.Msg.SourceFilePath,
		ToPath:   tmpSharedFilePath,
	})); err != nil {
		logShareFileOrDirStepError("copy source to temp path", err)
		return nil, err
	}

	// 确认tempInfo是dir还是file, 判断能否进行权限递归修改
	tmpInfo, err := os.Stat(tmpSharedFilePath)
	if err != nil {
		logShareFileOrDirStepError("stat temp copy", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if err := k.changeModePath(req.Msg.UserId, tmpSharedFilePath, req.Msg.Mode, tmpInfo.IsDir(), false); err != nil {
		logrus.Errorf(
			"K8s ShareFileOrDir: chmod temp copy failed, rolling back temp_path=%s final_path=%s: %v",
			tmpSharedFilePath,
			sharedFilePath,
			err,
		)
		logShareFileOrDirStepError("chmod temp copy", err)
		return nil, err
	}

	sharedFileExists, err := k.Exists(ctx, connect.NewRequest(&apiv1.ExistsRequest{
		UserId: req.Msg.UserId,
		Path:   sharedFilePath,
	}))
	if err != nil {
		logShareFileOrDirStepError("check final shared path", err)
		return nil, err
	}
	if sharedFileExists.Msg.Exists {
		return nil, connect.NewError(connect.CodeAlreadyExists, fmt.Errorf("shared file path %s already exists", sharedFilePath))
	}

	if err := os.Rename(tmpSharedFilePath, sharedFilePath); err != nil {
		if isStorageError, storageErr := handleStorageError(err, "share file rename",
			fmt.Sprintf("%s to %s", tmpSharedFilePath, sharedFilePath)); isStorageError {
			logShareFileOrDirStepError("commit temp copy", storageErr)
			return nil, storageErr
		}
		logrus.Errorf("K8s ShareFileOrDir: rename temp copy failed tmp=%s final=%s: %v", tmpSharedFilePath, sharedFilePath, err)
		logShareFileOrDirStepError("commit temp copy", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	rollback = append(rollback, func() {
		fileUtils.RemovePathForRollback(sharedFilePath, "share final copy")
	})

	logrus.Debugf(
		"K8s ShareFileOrDir: Applying final recursive mode=%s to target_top_dir=%s",
		req.Msg.Mode,
		targetTopDir,
	)
	if _, err := k.ChangeMode(ctx, connect.NewRequest(&apiv1.ChangeModeRequest{
		UserId:    req.Msg.UserId,
		Path:      targetTopDir,
		Mode:      req.Msg.Mode,
		Recursive: true,
	})); err != nil {
		logShareFileOrDirStepError("chmod target top directory", err)
		return nil, err
	}

	logrus.Infof(
		"Successfully shared file or directory user=%s source=%s shared=%s target_directory=%s target_top_dir=%s target_full_dir=%s mode=%s",
		req.Msg.UserId,
		req.Msg.SourceFilePath,
		sharedFilePath,
		targetDirectory,
		targetTopDir,
		targetFullDir,
		req.Msg.Mode,
	)
	shareCompleted = true
	return connect.NewResponse(&apiv1.ShareFileOrDirResponse{}), nil
}

func (k *K8sFileServer) validateShareSourcePath(userID string, sourceFilePath string) error {
	currentUser, err := auth.Lookup(userID)
	if err != nil {
		logrus.Errorf("K8s ShareFileOrDir: failed to lookup source user user=%s source=%s: %v", userID, sourceFilePath, err)
		return connect.NewError(connect.CodeInternal, err)
	}

	relativePath, err := filepath.Rel(currentUser.HomeDir, sourceFilePath)
	if err != nil {
		logrus.Errorf("K8s ShareFileOrDir: source path conversion failed user=%s source=%s home=%s: %v", userID, sourceFilePath, currentUser.HomeDir, err)
		return connect.NewError(connect.CodePermissionDenied, err)
	}
	if relativePath == ".." || strings.HasPrefix(relativePath, ".."+string(filepath.Separator)) {
		logrus.Errorf("K8s ShareFileOrDir: source path is outside user home user=%s source=%s home=%s", userID, sourceFilePath, currentUser.HomeDir)
		return connect.NewError(connect.CodePermissionDenied, fmt.Errorf("source path %s is outside user home directory", sourceFilePath))
	}

	root, err := os.OpenRoot(currentUser.HomeDir)
	if err != nil {
		logrus.Errorf("K8s ShareFileOrDir: failed to open source home root user=%s home=%s source=%s: %v", userID, currentUser.HomeDir, sourceFilePath, err)
		return connect.NewError(connect.CodeInternal, err)
	}
	defer func() { _ = root.Close() }()

	if err := validatePathWithinRoot(root, relativePath); err != nil {
		if os.IsNotExist(err) {
			logrus.Errorf("K8s ShareFileOrDir: source path does not exist user=%s source=%s", userID, sourceFilePath)
			return connect.NewError(connect.CodeNotFound, fmt.Errorf("source path %s does not exist", sourceFilePath))
		}
		logrus.Errorf("K8s ShareFileOrDir: source path is outside root or permission denied user=%s source=%s: %v", userID, sourceFilePath, err)
		return connect.NewError(connect.CodePermissionDenied, fmt.Errorf("source path %s is outside allowed root directory", sourceFilePath))
	}
	return nil
}

func logShareFileOrDirStepError(step string, err error) {
	logrus.WithError(err).Errorf("K8s ShareFileOrDir failed at step=%s", step)
}

func (k *K8sFileServer) CompressFiles(
	ctx context.Context,
	req *connect.Request[apiv1.CompressFilesRequest],
) (*connect.Response[apiv1.CompressFilesResponse], error) {

	noCheckPermission := req.Msg.GetNoCheckPermission()

	logrus.Infof(
		"K8s Compress files for user %s (no_check_permission: %v)",
		req.Msg.UserId,
		noCheckPermission,
	)

	var (
		root *os.Root
		err  error
	)

	// 1. 打开 root
	if noCheckPermission {
		root, err = os.OpenRoot("/")
	} else {
		root, err = getUserHomeRoot(req.Msg.UserId)
	}
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to open root: %w", err))
	}
	defer func() {
		if closeErr := root.Close(); closeErr != nil {
			logrus.Errorf("failed to close root: %v", closeErr)
		}
	}()

	// 2. 处理待压缩路径
	var relativePaths []string
	for _, path := range req.Msg.Paths {
		var relativePath string

		if noCheckPermission {
			relativePath = normalizeNoCheckRelativePath(path)
		} else {
			relativePath, err = getRelativePathForUser(req.Msg.UserId, path)
			if err != nil {
				return nil, connect.NewError(connect.CodePermissionDenied, err)
			}
		}

		if relativePath == "" || relativePath == "." {
			return nil, connect.NewError(
				connect.CodeInvalidArgument,
				errors.New("refusing to compress root directory"),
			)
		}

		// 校验路径在 root 内且存在
		if err := validatePathWithinRoot(root, relativePath); err != nil {
			if os.IsNotExist(err) {
				return nil, connect.NewError(connect.CodeNotFound, err)
			}
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}

		relativePaths = append(relativePaths, relativePath)
	}

	// 3. 处理压缩包路径
	var archiveRelativePath string
	if noCheckPermission {
		archiveRelativePath = normalizeNoCheckRelativePath(req.Msg.ArchivePath)
	} else {
		archiveRelativePath, err = getRelativePathForUser(req.Msg.UserId, req.Msg.ArchivePath)
		if err != nil {
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}
	}

	if archiveRelativePath == "" || archiveRelativePath == "." {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("invalid archive path"))
	}

	// 校验目标目录
	parentDir := filepath.Dir(archiveRelativePath)
	if parentDir != "." {
		if err := validatePathWithinRoot(root, parentDir); err != nil {
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}
	}

	// 4. 磁盘空间检查
	var requiredSpace int64
	for _, relativePath := range relativePaths {
		if info, err := root.Stat(relativePath); err == nil {
			requiredSpace += info.Size()
		}
	}

	checkAbsPath := filepath.Dir(req.Msg.ArchivePath)
	if err := storageUtils.CheckDiskSpace(checkAbsPath, uint64(requiredSpace)); err != nil {
		return nil, connect.NewError(connect.CodeResourceExhausted, err)
	}

	// 5. 创建压缩包文件
	tempZipFile, err := root.Create(archiveRelativePath)
	if err != nil {
		if isStorageError, storageErr := handleStorageError(err, "archive creation", req.Msg.ArchivePath); isStorageError {
			return nil, storageErr
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// 6. 执行压缩
	err = fileUtils.ZipPathsOnTheFlyWithRoot(ctx, relativePaths, tempZipFile, 9, root)
	if err != nil {
		_ = tempZipFile.Close()
		_ = root.Remove(archiveRelativePath)

		if errors.Is(err, context.Canceled) {
			return nil, connect.NewError(connect.CodeCanceled, err)
		}

		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("zip failed: %v", err))
	}

	// 7. 关闭文件
	if err := tempZipFile.Close(); err != nil {
		_ = root.Remove(archiveRelativePath)
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to finalize zip file: %w", err))
	}

	return connect.NewResponse(&apiv1.CompressFilesResponse{}), nil
}

func (k *K8sFileServer) DecompressFile(
	ctx context.Context,
	req *connect.Request[apiv1.DecompressFileRequest],
) (*connect.Response[apiv1.DecompressFileResponse], error) {
	noCheckPermission := req.Msg.GetNoCheckPermission()

	logrus.Infof("K8S Decompress file from %s to %s for user %s (no_check_permission: %v)",
		req.Msg.FilePath, req.Msg.DecompressionPath, req.Msg.UserId, noCheckPermission)

	var root *os.Root
	var relativeFilePath string
	var relativeDecompPath string
	var err error

	if noCheckPermission {
		// 不检查权限模式：创建系统根目录的 os.Root
		root, err = openRoot("", true)
		if err != nil {
			logrus.Errorf("Failed to create root for system path: %v", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		defer func() {
			if closeErr := root.Close(); closeErr != nil {
				logrus.Errorf("Failed to close root: %v", closeErr)
			}
		}()

		relativeFilePath, err = buildRelativePath("", req.Msg.FilePath, true)
		if err != nil {
			logrus.Errorf("Source file path conversion error: %v", err)
			return nil, err
		}
		relativeDecompPath, err = buildRelativePath("", req.Msg.DecompressionPath, true)
		if err != nil {
			logrus.Errorf("Decompression path conversion error: %v", err)
			return nil, err
		}

		logrus.Debugf("Using system root with relative paths: source=%s, dest=%s",
			relativeFilePath, relativeDecompPath)
	} else {
		// 正常模式：根据路径决定使用共享文件夹还是用户家目录
		root, err = k.getRootForPaths(req.Msg.UserId, req.Msg.FilePath, req.Msg.DecompressionPath)
		if err != nil {
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		defer func() {
			if closeErr := root.Close(); closeErr != nil {
				logrus.Errorf("Failed to close root: %v", closeErr)
			}
		}()

		// 转换源文件路径
		relativeFilePath, err = k.getRelativePathForRoot(req.Msg.UserId, req.Msg.FilePath, false)
		if err != nil {
			logrus.Errorf("Source file path conversion error: %v", err)
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}

		// 转换解压目标路径
		relativeDecompPath, err = k.getRelativePathForRoot(req.Msg.UserId, req.Msg.DecompressionPath, false)
		if err != nil {
			logrus.Errorf("Decompression path conversion error: %v", err)
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}

		logrus.Debugf("Using relative paths: source=%s, dest=%s", relativeFilePath, relativeDecompPath)
	}

	// 以下逻辑对两种模式完全相同

	// 验证源文件路径是否在root限制内
	if err := validatePathWithinRoot(root, relativeFilePath); err != nil {
		logrus.Errorf("Source file path %s is outside root or permission denied", req.Msg.FilePath)
		return nil, connect.NewError(connect.CodePermissionDenied,
			fmt.Errorf("source file path %s is outside allowed root directory or permission denied", req.Msg.FilePath))
	}

	// 检查源文件路径
	fileInfo, err := os.Stat(req.Msg.FilePath)
	if err != nil {
		if os.IsNotExist(err) {
			logrus.Errorf("Path %s does not exist", req.Msg.FilePath)
			return nil, connect.NewError(connect.CodeNotFound, err)
		} else if os.IsPermission(err) {
			logrus.Errorf("Insufficient permission to read path %s", req.Msg.FilePath)
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}
		logrus.Errorf("Check path error at %s", req.Msg.FilePath)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// 检查源文件是否为常规文件，排除路径，符号链接，设备等特殊文件
	if !fileInfo.Mode().IsRegular() {
		if fileInfo.IsDir() {
			logrus.Errorf("The path %s is a dir not a file", req.Msg.FilePath)
			return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("NOT_A_FILE"))
		}
		logrus.Errorf("The path %s is not a regular file", req.Msg.FilePath)
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("NOT_A_REGULAR_FILE"))
	}

	// 验证解压目标路径是否在root限制内
	if err := validatePathWithinRoot(root, relativeDecompPath); err != nil {
		logrus.Errorf("Decompression path %s is outside root or permission denied", req.Msg.DecompressionPath)
		return nil, connect.NewError(connect.CodePermissionDenied,
			fmt.Errorf("decompression path %s is outside allowed root directory or permission denied", req.Msg.DecompressionPath))
	}

	// 目标解压缩路径已存在，判断目标解压缩路径是否为绝对路径
	// 允许在有权限的目录中进行解压缩
	_, err = os.Stat(req.Msg.DecompressionPath)
	if err == nil {
		if !filepath.IsAbs(req.Msg.DecompressionPath) {
			logrus.Errorf("Decompression path %s is not a absolute path", req.Msg.DecompressionPath)
			return nil, connect.NewError(connect.CodePermissionDenied, errors.New("DECOMPRESSION_PATH_NOT_ABSOLUTE"))
		}
	}

	// 如果目录不存在，则尝试创建
	err = os.MkdirAll(req.Msg.DecompressionPath, 0755)
	if err != nil {
		if isStorageError, storageErr := handleStorageError(err, "decompression directory creation", req.Msg.DecompressionPath); isStorageError {
			return nil, storageErr
		}
		if os.IsExist(err) {
			logrus.Errorf("Decompression directory already created at %s", req.Msg.DecompressionPath)
			return nil, connect.NewError(connect.CodeAlreadyExists, errors.New("DECOMPRESSION_PATH_ALREADY_CREATED"))
		} else if os.IsPermission(err) {
			logrus.Errorf("no permission to create directory at %s", req.Msg.DecompressionPath)
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}
		logrus.Errorf("Make directory error at %s, error: %v", req.Msg.DecompressionPath, err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// 使用 gabriel-vasile/mimetype 判断解压文件类型
	// 打开源文件
	file, err := os.Open(req.Msg.FilePath)
	if err != nil {
		logrus.Errorf("failed to open decompression source file: %s", req.Msg.FilePath)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	defer func() { _ = file.Close() }()

	// 检测文件类型
	mime, err := mimetype.DetectFile(req.Msg.FilePath)
	if err != nil {
		logrus.Errorf("failed to detect decompression file type: %s", req.Msg.FilePath)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// 根据文件类型解压，使用root权限检查
	decompressErr := func() error {
		switch mime.Extension() {
		case string(fileUtils.ExtensionZip):
			return fileUtils.UnzipWithRoot(ctx, file, req.Msg.DecompressionPath, root)
		case string(fileUtils.ExtensionTar):
			return fileUtils.UntarWithRoot(ctx, file, req.Msg.DecompressionPath, root)
		case string(fileUtils.ExtensionTgz), string(fileUtils.ExtensionTarGz):
			return fileUtils.UntargzWithRoot(ctx, file, req.Msg.DecompressionPath, root)
		case string(fileUtils.ExtensionGz):
			// 检查是否可能是 tar.gz 但被错误识别为 .gz
			if strings.HasSuffix(file.Name(), string(fileUtils.ExtensionTarGz)) {
				return fileUtils.UntargzWithRoot(ctx, file, req.Msg.DecompressionPath, root)
			}
			return fileUtils.UngzipWithRoot(ctx, file, req.Msg.DecompressionPath, root)
		default:
			logrus.Errorf("unsupported file MIME type: %s, extension: %s for file %s",
				mime.String(), mime.Extension(), req.Msg.FilePath)
			return connect.NewError(connect.CodePermissionDenied, fmt.Errorf("unsupported file type"))
		}
	}()

	if decompressErr != nil {
		logrus.Errorf("failed to decompress the file from %s to %s", req.Msg.FilePath, req.Msg.DecompressionPath)
		return nil, connect.NewError(connect.CodeInternal, decompressErr)
	}

	return connect.NewResponse(&apiv1.DecompressFileResponse{}), nil
}

func (k *K8sFileServer) Move(ctx context.Context,
	req *connect.Request[apiv1.MoveRequest],
) (*connect.Response[apiv1.MoveResponse], error) {
	noCheckPermission := req.Msg.GetNoCheckPermission()

	logrus.Infof("K8s Move %s to %s (no_check_permission: %v)",
		req.Msg.FromPath, req.Msg.ToPath, noCheckPermission)

	var srcRoot, dstRoot *os.Root
	var srcRelativePath, dstRelativePath string
	var err error

	if noCheckPermission {
		// 不检查权限模式
		srcRoot, err = os.OpenRoot("/")
		if err != nil {
			logrus.Errorf("Failed to create source root: %v", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		defer func() {
			if closeErr := srcRoot.Close(); closeErr != nil {
				logrus.Errorf("Failed to close srcRoot: %v", closeErr)
			}
		}()

		dstRoot, err = os.OpenRoot("/")
		if err != nil {
			logrus.Errorf("Failed to create destination root: %v", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		defer func() {
			if closeErr := dstRoot.Close(); closeErr != nil {
				logrus.Errorf("Failed to close dstRoot: %v", closeErr)
			}
		}()

		srcRelativePath = strings.TrimPrefix(req.Msg.FromPath, "/")
		dstRelativePath = strings.TrimPrefix(req.Msg.ToPath, "/")

		// 防止操作文件系统根目录
		if srcRelativePath == "" || dstRelativePath == "" {
			return nil, connect.NewError(connect.CodeInvalidArgument,
				errors.New("refusing to operate on filesystem root"))
		}
	} else {
		// 正常模式
		var sharedPrefix string
		if k.config != nil && k.config.AI.SharedFolderPath != "" {
			sharedPrefix = filepath.Clean(k.config.AI.SharedFolderPath)
		}

		inShared := func(p string) bool {
			return sharedPrefix != "" && strings.HasPrefix(filepath.Clean(p), sharedPrefix)
		}

		srcInShared := inShared(req.Msg.FromPath)
		dstInShared := inShared(req.Msg.ToPath)

		if srcInShared {
			srcRoot, err = os.OpenRoot(sharedPrefix)
		} else {
			srcRoot, err = getUserHomeRoot(req.Msg.UserId)
		}
		if err != nil {
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		defer func() {
			if closeErr := srcRoot.Close(); closeErr != nil {
				logrus.Errorf("Failed to close srcRoot: %v", closeErr)
			}
		}()

		if dstInShared {
			dstRoot, err = os.OpenRoot(sharedPrefix)
		} else {
			dstRoot, err = getUserHomeRoot(req.Msg.UserId)
		}
		if err != nil {
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		defer func() {
			if closeErr := dstRoot.Close(); closeErr != nil {
				logrus.Errorf("Failed to close dstRoot: %v", closeErr)
			}
		}()

		srcRelativePath, err = k.getRelativePathForRoot(req.Msg.UserId, req.Msg.FromPath, srcInShared)
		if err != nil {
			logrus.Errorf("Source path conversion error: %v", err)
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}

		dstRelativePath, err = k.getRelativePathForRoot(req.Msg.UserId, req.Msg.ToPath, dstInShared)
		if err != nil {
			logrus.Errorf("Destination path conversion error: %v", err)
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}
	}

	// 判断是否在同一个 root（通过路径比较，而非指针比较）
	sameRoot := srcRoot.Name() == dstRoot.Name()
	logrus.Debugf("Same root: %v (src: %s, dst: %s)", sameRoot, srcRoot.Name(), dstRoot.Name())

	// 验证源路径存在且在 root 范围内
	if _, err := srcRoot.Lstat(srcRelativePath); err != nil {
		if os.IsNotExist(err) {
			logrus.Errorf("Source path %s does not exist", req.Msg.FromPath)
			return nil, connect.NewError(connect.CodeNotFound,
				fmt.Errorf("source path %s does not exist", req.Msg.FromPath))
		}
		if os.IsPermission(err) {
			logrus.Errorf("Source path %s permission denied", req.Msg.FromPath)
			return nil, connect.NewError(connect.CodePermissionDenied,
				fmt.Errorf("permission denied for source path %s", req.Msg.FromPath))
		}
		logrus.Errorf("Source path %s error: %v", req.Msg.FromPath, err)
		return nil, connect.NewError(connect.CodePermissionDenied,
			fmt.Errorf("source path %s is outside allowed root directory", req.Msg.FromPath))
	}

	// 验证目标路径的父目录在 root 范围内
	dstParentDir := filepath.Dir(dstRelativePath)
	if err := validatePathWithinRoot(dstRoot, dstParentDir); err != nil {
		if !os.IsNotExist(err) {
			logrus.Errorf("Target parent directory is outside root or permission denied")
			return nil, connect.NewError(connect.CodePermissionDenied,
				fmt.Errorf("target path parent directory is outside allowed root directory"))
		}
	}

	// 防止移动到自身或子目录（仅当在同一个 root 时）
	if sameRoot {
		if srcRelativePath == dstRelativePath {
			return nil, connect.NewError(connect.CodeInvalidArgument,
				errors.New("cannot move to itself"))
		}
		if strings.HasPrefix(dstRelativePath, srcRelativePath+string(filepath.Separator)) {
			return nil, connect.NewError(connect.CodeInvalidArgument,
				errors.New("cannot move to subdirectory of itself"))
		}
	}

	// 判断是否跨设备（跨文件系统）
	crossDevice, err := fileUtils.IsCrossDevice(req.Msg.FromPath, filepath.Dir(req.Msg.ToPath))
	if err != nil {
		logrus.Errorf("Failed to check device for paths: %s", err)
		// 如果发生错误大概率是系统异常，抛出这个错误
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// 根据是否在同一个 root 选择不同的移动策略
	if sameRoot && !crossDevice {
		// 同 root 内移动：使用 Rename（root-safe）
		logrus.Debugf("Same root move, using Rename")
		err = srcRoot.Rename(srcRelativePath, dstRelativePath)
		if err != nil {
			if isStorageError, storageErr := handleStorageError(err, "move operation",
				fmt.Sprintf("%s to %s", req.Msg.FromPath, req.Msg.ToPath)); isStorageError {
				return nil, storageErr
			}
			logrus.Errorf("Move (Rename) failed: %v", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
	} else {
		// 跨 root 移动：先复制再删除
		logrus.Debugf("Cross-root move, copying then deleting")

		copyDone := false
		defer func() {
			if !copyDone {
				logrus.Warnf("Copy incomplete, rolling back: removing %s", req.Msg.ToPath)
				// 回滚用 dstRoot，保持 root-safe
				if removeErr := dstRoot.RemoveAll(dstRelativePath); removeErr != nil && !os.IsNotExist(removeErr) {
					logrus.Errorf("Rollback failed, remove %s error: %v", req.Msg.ToPath, removeErr)
				}
			}
		}()
		// 复制（不是 root-safe，但前面已验证路径）
		err = cp.Copy(req.Msg.FromPath, req.Msg.ToPath)
		if err != nil {
			if isStorageError, storageErr := handleStorageError(err, "copy in move operation",
				fmt.Sprintf("%s to %s", req.Msg.FromPath, req.Msg.ToPath)); isStorageError {
				return nil, storageErr
			}
			logrus.Errorf("Copy in move failed: %v", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		copyDone = true

		// 删除源文件/目录（root-safe）
		err = srcRoot.RemoveAll(srcRelativePath)
		if err != nil {
			logrus.Errorf("Failed to remove source after copy: %v", err)
			return nil, connect.NewError(connect.CodeInternal,
				fmt.Errorf("moved but failed to remove source: %w", err))
		}
	}

	logrus.Infof("Successfully moved %s to %s", req.Msg.FromPath, req.Msg.ToPath)
	return connect.NewResponse(&apiv1.MoveResponse{}), nil
}

func (k *K8sFileServer) ChangeOwner(
	ctx context.Context,
	req *connect.Request[apiv1.ChangeOwnerRequest],
) (*connect.Response[apiv1.ChangeOwnerResponse], error) {
	noCheckPermission := req.Msg.GetNoCheckPermission()
	logrus.Infof("K8s ChangeOwner path=%s user=%s recursive=%v (no_check_permission: %v)",
		req.Msg.Path, req.Msg.UserId, req.Msg.Recursive, noCheckPermission)

	if req.Msg.Uid == nil && req.Msg.Gid == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("at least one of uid or gid must be specified"))
	}

	var (
		root         *os.Root
		relativePath string
		rootDir      string
		err          error
	)

	if noCheckPermission {
		root, err = openRoot("", true)
		if err != nil {
			logrus.Errorf("Failed to create system root: %v", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		defer func() {
			if closeErr := root.Close(); closeErr != nil {
				logrus.Errorf("Failed to close root: %v", closeErr)
			}
		}()

		relativePath, err = buildRelativePath("", req.Msg.Path, true)
		if err != nil {
			logrus.Errorf("Path conversion error: %v", err)
			return nil, err
		}
		rootDir = "/"
		logrus.Debugf("Using system root, relative path: %s", relativePath)
	} else {
		return nil, connect.NewError(connect.CodePermissionDenied, errors.New("K8s ChangeOwner requires no_check_permission=true"))
	}

	// Validate path is within sandbox
	if _, err := root.Stat(relativePath); err != nil {
		if os.IsNotExist(err) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	absPath := filepath.Join(rootDir, relativePath)
	logrus.Debugf("K8s ChangeOwner: rootDir=%s relativePath=%s absPath=%s",
		rootDir, relativePath, absPath)

	if req.Msg.TargetUid == nil {
		// Mode A: chown -R on the entire path
		arg := buildChownArg(req.Msg.Uid, req.Msg.Gid)
		args := make([]string, 0, 3)
		if req.Msg.Recursive {
			args = append(args, "-R")
		}
		args = append(args, arg, absPath)
		logrus.Debugf("K8s ChangeOwner Mode A: chown %v", args)
		cmd := exec.CommandContext(ctx, "chown", args...)
		if out, err := cmd.CombinedOutput(); err != nil {
			logrus.Errorf("chown failed for path %s: %v, output: %s", req.Msg.Path, err, string(out))
			return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("chown failed: %v", err))
		}
		logrus.Infof("K8s ChangeOwner Mode A: successfully changed owner for path %s", req.Msg.Path)
	} else {
		// Mode B: only change files owned by target_uid
		uid, gid := resolveOwnerIDs(req.Msg)
		logrus.Debugf("K8s ChangeOwner Mode B: targetUID=%d uid=%d gid=%d path=%s",
			*req.Msg.TargetUid, uid, gid, req.Msg.Path)
		if req.Msg.Recursive {
			if err := recursiveChangeOwner(root, rootDir, relativePath, uid, gid, *req.Msg.TargetUid); err != nil {
				logrus.Errorf("recursiveChangeOwner failed for %s: %v", req.Msg.Path, err)
				return nil, connect.NewError(connect.CodeInternal, err)
			}
			logrus.Infof("K8s ChangeOwner Mode B: recursive walk completed for path %s", req.Msg.Path)
		} else {
			info, err := root.Stat(relativePath)
			if err != nil {
				return nil, connect.NewError(connect.CodeInternal, err)
			}
			stat, ok := info.Sys().(*syscall.Stat_t)
			if ok && stat.Uid == *req.Msg.TargetUid {
				logrus.Debugf("K8s ChangeOwner Mode B: chown %s (uid=%d gid=%d)", absPath, uid, gid)
				if err := os.Lchown(absPath, uid, gid); err != nil {
					return nil, connect.NewError(connect.CodeInternal, err)
				}
				logrus.Infof("K8s ChangeOwner Mode B: changed owner for path %s", req.Msg.Path)
			} else {
				logrus.Debugf("K8s ChangeOwner Mode B: skipped %s (uid mismatch or no stat)", absPath)
			}
		}
	}

	return connect.NewResponse(&apiv1.ChangeOwnerResponse{}), nil
}

// Upload 上传文件流式操作方法
func (k *K8sFileServer) Upload(
	ctx context.Context,
	stream *connect.ClientStream[apiv1.UploadRequest],
) (*connect.Response[apiv1.UploadResponse], error) {
	var file *os.File
	var totalWritten uint64 = 0
	var expectedWritten uint64 = 0
	var uploadFilePath string
	var uploadFileAbsPath string
	var currentChunkIdx *uint64
	var currentChunkOffset uint64
	var chunkedUpload bool
	var root *os.Root
	var receivedChunks uint64
	var noCheckPermission bool

	closeUploadFile := func() error {
		if file == nil {
			return nil
		}
		fileToClose := file
		file = nil
		return fileToClose.Close()
	}
	defer func() {
		if closeErr := closeUploadFile(); closeErr != nil {
			logrus.Errorf("Failed to close file: %v", closeErr)
		}
	}()

	closeRoot := func() error {
		if root == nil {
			return nil
		}
		rootToClose := root
		root = nil
		return rootToClose.Close()
	}
	defer func() {
		if closeErr := closeRoot(); closeErr != nil {
			logrus.Errorf("Failed to close root: %v", closeErr)
		}
	}()

	// 步骤 1：循环接收客户端流中的消息，先接收 Info，再接收 Chunk
	for stream.Receive() {
		req := stream.Msg()

		switch x := req.Message.(type) {
		case *apiv1.UploadRequest_Info_:
			noCheckPermission = x.Info.NoCheckPermission != nil && *x.Info.NoCheckPermission

			logrus.Infof("K8s Upload file to %s for user %s (no_check_permission: %v)",
				x.Info.Path, x.Info.UserId, noCheckPermission)

			// 步骤 1.1：处理上传元信息，建立用户 root 并区分普通/分片上传
			var relativePath string
			var err error

			root, err = openRoot(x.Info.UserId, noCheckPermission)
			if err != nil {
				logrus.Errorf("Failed to create root for path %s: %v", x.Info.Path, err)
				return nil, connect.NewError(connect.CodeInternal, err)
			}

			relativePath, err = buildRelativePath(x.Info.UserId, x.Info.Path, noCheckPermission)
			if err != nil {
				logrus.Errorf("Source path conversion error: %v", err)
				return nil, err
			}

			if noCheckPermission {
				logrus.Debugf("Using system root with relative path: %s", relativePath)
			} else {
				logrus.Debugf("Upload file path %s", x.Info.Path)
				logrus.Debugf("Using relative path: %s", relativePath)
			}

			if x.Info.ChunkIdx != nil {
				// 步骤 1.1.1：分片上传场景，打开已存在的 .uploading 临时文件
				uploadFilePath = relativePath
				if !strings.HasSuffix(uploadFilePath, ".uploading") {
					uploadFilePath = uploadFilePath + ".uploading"
				}
				uploadFileAbsPath = filepath.Join(root.Name(), uploadFilePath)
				file, err = root.OpenFile(uploadFilePath, os.O_RDWR, 0644)
				if err != nil {
					if os.IsNotExist(err) {
						logrus.Errorf("uploading file does not exist: %s", uploadFileAbsPath)
						return nil, connect.NewError(connect.CodeNotFound, err)
					}
					logrus.Errorf("open file to path %s error: %v", x.Info.Path, err)
					return nil, connect.NewError(connect.CodeInternal, err)
				}
				currentChunkIdx = x.Info.ChunkIdx
				currentChunkOffset = 0
				chunkedUpload = true
				logrus.Debugf("K8s upload info: user=%s, path=%s, absPath=%s, chunked=true, chunkIdx=%d", x.Info.UserId, x.Info.Path, uploadFileAbsPath, *x.Info.ChunkIdx)
			} else {
				// 步骤 1.1.2：普通上传场景，创建或截断目标文件
				file, err = root.OpenFile(relativePath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
				if err != nil {
					logrus.Errorf("open/create file to path %s error: %v", x.Info.Path, err)
					return nil, connect.NewError(connect.CodeInternal, err)
				}
				uploadFilePath = relativePath
				uploadFileAbsPath = filepath.Join(root.Name(), uploadFilePath)
				chunkedUpload = false
				logrus.Debugf("K8s upload info: user=%s, path=%s, absPath=%s, chunked=false", x.Info.UserId, x.Info.Path, uploadFileAbsPath)
			}
		case *apiv1.UploadRequest_Chunk:
			// 步骤 1.2：处理数据分片，根据是否分片上传选择不同写入路径
			if file == nil {
				logrus.Errorf("no file path provided before chunk")
				return nil, connect.NewError(
					connect.CodeFailedPrecondition,
					errors.New("no file path provided before chunk"),
				)
			}
			if chunkedUpload {
				// 步骤 1.2.1：分片上传，写入指定分片偏移并累积统计信息
				if currentChunkIdx == nil {
					return nil, connect.NewError(connect.CodeFailedPrecondition, errors.New("chunk idx not provided"))
				}
				chunkSize := uint64(len(x.Chunk))
				chunkIdx := *currentChunkIdx
				offsetWithin := int64(currentChunkOffset)
				n, err := fileUtils.WriteChunkData(file, uploadFileAbsPath, chunkIdx, x.Chunk, offsetWithin, fileUtils.UploadingMetaSize)
				if err != nil {
					if isStorageError, storageErr := handleStorageError(err, "file upload", uploadFileAbsPath); isStorageError {
						return nil, storageErr
					}
					return nil, connect.NewError(connect.CodeInternal, err)
				}

				if n != len(x.Chunk) {
					logrus.Errorf("Partial write detected: expected %d bytes, wrote %d bytes. This may indicate storage quota exceeded or disk full", len(x.Chunk), n)
					return nil, connect.NewError(connect.CodeResourceExhausted,
						errors.New("storage quota exceeded or insufficient space: partial write detected"))
				}

				currentChunkOffset += uint64(n)
				totalWritten += uint64(n)
				expectedWritten += chunkSize
				receivedChunks++
				if receivedChunks == 1 || receivedChunks%128 == 0 {
					logrus.Debugf("K8s upload chunk progress: absPath=%s, chunkIdx=%d, receivedChunks=%d, chunkOffset=%d, written=%d, expected=%d", uploadFileAbsPath, *currentChunkIdx, receivedChunks, currentChunkOffset, totalWritten, expectedWritten)
				}
			} else {
				// 步骤 1.2.2：普通上传，顺序写入文件内容并累积统计信息
				chunkSize := uint64(len(x.Chunk))
				n, err := file.Write(x.Chunk)
				if err != nil {
					if isStorageError, storageErr := handleStorageError(err, "file upload", uploadFileAbsPath); isStorageError {
						return nil, storageErr
					}
					return nil, connect.NewError(connect.CodeInternal, err)
				}

				if n != len(x.Chunk) {
					logrus.Errorf("Partial write detected: expected %d bytes, wrote %d bytes. This may indicate storage quota exceeded or disk full", len(x.Chunk), n)
					return nil, connect.NewError(connect.CodeResourceExhausted,
						errors.New("storage quota exceeded or insufficient space: partial write detected"))
				}

				totalWritten += uint64(n)
				expectedWritten += chunkSize
			}
		default:
			// 步骤 1.3：拒绝未知类型的消息
			logrus.Errorf("unknown message type")
			return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("unknown message type"))
		}
	}

	// 步骤 2：流式接收结束后检查错误，必要时清理部分写入的数据或调度全量哈希
	if err := stream.Err(); err != nil {
		logrus.Errorf("Unknown error sent while uploading file")
		if uploadFilePath != "" && !chunkedUpload {
			_ = root.Remove(uploadFilePath) // 删除部分写入的文件
		}
		if closeErr := closeUploadFile(); closeErr != nil {
			if isStorageError, storageErr := handleStorageError(closeErr, "file upload", uploadFileAbsPath); isStorageError {
				return nil, storageErr
			}
			logrus.Errorf("file close failed: %v", closeErr)
			return nil, connect.NewError(connect.CodeInternal, closeErr)
		}
		if uploadFileAbsPath != "" && chunkedUpload {
			fileUtils.ScheduleFullHash(uploadFileAbsPath, 0)
		}
		return nil, connect.NewError(connect.CodeUnknown, err)
	}

	if file == nil {
		logrus.Errorf("no file info provided before upload stream ended")
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("no file info provided"))
	}

	// 步骤 3：在分片模式下，为最后一个分片刷新位图与哨兵元数据
	if uploadFilePath != "" && chunkedUpload && currentChunkIdx != nil {
		logrus.Debugf("K8s upload finalize chunk meta: absPath=%s, chunkIdx=%d, chunkOffset=%d, totalWritten=%d, expectedWritten=%d, receivedChunks=%d", uploadFileAbsPath, *currentChunkIdx, currentChunkOffset, totalWritten, expectedWritten, receivedChunks)
		if err := fileUtils.UpdateChunkMeta(file, uploadFileAbsPath, *currentChunkIdx, int64(currentChunkOffset), fileUtils.UploadingMetaSize); err != nil {
			if isStorageError, storageErr := handleStorageError(err, "file upload", uploadFileAbsPath); isStorageError {
				return nil, storageErr
			}
			return nil, connect.NewError(connect.CodeInternal, err)
		}
	}

	// 步骤 4：读取实际文件大小并与写入统计值进行对比（普通上传需严格一致）
	fileInfo, err := root.Stat(uploadFilePath)
	if err != nil {
		logrus.Errorf("Failed to get file info after upload: %v", err)
		if uploadFilePath != "" && !chunkedUpload {
			_ = root.Remove(uploadFilePath)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	actualFileSize := uint64(fileInfo.Size())
	if !chunkedUpload && actualFileSize != expectedWritten {
		logrus.Errorf("File size mismatch: expected %d bytes, actual file size %d bytes", expectedWritten, actualFileSize)
		return nil, connect.NewError(connect.CodeDataLoss,
			errors.New("file upload failed: file size does not match expected bytes"))
	}
	uploadedFileName := file.Name()
	if closeErr := closeUploadFile(); closeErr != nil {
		if isStorageError, storageErr := handleStorageError(closeErr, "file upload", uploadFileAbsPath); isStorageError {
			return nil, storageErr
		}
		logrus.Errorf("file close failed: %v", closeErr)
		return nil, connect.NewError(connect.CodeInternal, closeErr)
	}
	// 步骤 5：在分片模式下调度后台计算全量哈希
	if uploadFileAbsPath != "" && chunkedUpload {
		fileUtils.ScheduleFullHash(uploadFileAbsPath, fileUtils.FullHashIdleDelay)
	}

	logrus.Infof("upload file %s successfully, expected bytes %d, written bytes %d, file size %d",
		uploadedFileName, expectedWritten, totalWritten, actualFileSize)
	// 步骤 6：返回写入字节统计信息给客户端
	res := connect.NewResponse(&apiv1.UploadResponse{
		WrittenBytes: totalWritten,
	})

	return res, nil
}

func (k *K8sFileServer) Download(
	ctx context.Context,
	req *connect.Request[apiv1.DownloadRequest],
	stream *connect.ServerStream[apiv1.DownloadResponse],
) error {
	noCheckPermission := req.Msg.GetNoCheckPermission()

	userID := req.Msg.UserId
	if userID == "" {
		logrus.Errorf("User ID is required for download operation")
		return connect.NewError(connect.CodeInvalidArgument, errors.New("USER_ID_REQUIRED"))
	}

	logrus.Infof(
		"K8s Download file %s for user %s (no_check_permission: %v)",
		req.Msg.Path,
		userID,
		noCheckPermission,
	)

	var (
		root         *os.Root
		relativePath string
		err          error
	)

	// 创建 root 并计算相对路径
	root, err = openRoot(userID, noCheckPermission)
	if err != nil {
		logrus.Errorf("Failed to create root for path %s: %v", req.Msg.Path, err)
		return connect.NewError(connect.CodeInternal, err)
	}
	defer func() {
		if closeErr := root.Close(); closeErr != nil {
			logrus.Errorf("Failed to close root: %v", closeErr)
		}
	}()

	relativePath, err = buildRelativePath(userID, req.Msg.Path, noCheckPermission)
	if err != nil {
		logrus.Errorf("Download path conversion error: %v", err)
		return err
	}

	if noCheckPermission && (relativePath == "" || relativePath == ".") {
		return connect.NewError(
			connect.CodeInvalidArgument,
			errors.New("empty path or root path is not allowed"),
		)
	}

	// 校验路径在 root 内
	if !noCheckPermission {
		if err := validatePathWithinRoot(root, relativePath); err != nil {
			logrus.Errorf(
				"Download path %s is outside allowed root for user %s",
				req.Msg.Path,
				userID,
			)
			return connect.NewError(
				connect.CodePermissionDenied,
				fmt.Errorf("download path %s is outside allowed root", req.Msg.Path),
			)
		}
	}

	// 参数校验
	if req.Msg.LimitBytes != nil && *req.Msg.LimitBytes <= 0 {
		logrus.Errorf("Invalid limit %d, must be > 0", *req.Msg.LimitBytes)
		return connect.NewError(connect.CodeInvalidArgument, errors.New("INVALID_LIMIT"))
	}

	// 验证offset和limit参数
	offsetBytes := req.Msg.GetOffsetBytes()
	limitBytes := req.Msg.GetLimitBytes()

	// 文件检查
	fileInfo, err := root.Stat(relativePath)
	if err != nil {
		if os.IsNotExist(err) {
			logrus.Errorf("File %s does not exist", req.Msg.Path)
			return connect.NewError(connect.CodeNotFound, err)
		}
		if os.IsPermission(err) {
			logrus.Errorf("Permission denied for file %s", req.Msg.Path)
			return connect.NewError(connect.CodePermissionDenied, err)
		}
		logrus.Errorf("Stat file %s failed: %v", req.Msg.Path, err)
		return connect.NewError(connect.CodeInternal, err)
	}

	if fileInfo.IsDir() {
		logrus.Errorf("Path %s is a directory, not a file", req.Msg.Path)
		return connect.NewError(connect.CodeInvalidArgument, errors.New("NOT_A_FILE"))
	}

	// 检查offset是否超过文件大小
	fileSize := fileInfo.Size()
	if offsetBytes > uint64(fileSize) {
		logrus.Errorf(
			"Offset %d exceeds file size %d for file %s",
			offsetBytes,
			fileSize,
			req.Msg.Path,
		)
		return connect.NewError(
			connect.CodeInvalidArgument,
			errors.New("OFFSET_EXCEEDS_FILE_SIZE"),
		)
	}

	// 打开文件
	file, err := root.Open(relativePath)
	if err != nil {
		logrus.Errorf("Open file %s failed: %v", req.Msg.Path, err)
		return connect.NewError(connect.CodeNotFound, err)
	}
	defer func() {
		if closeErr := file.Close(); closeErr != nil {
			logrus.Errorf("Failed to close file: %v", closeErr)
		}
	}()

	// 处理offset参数，定位到指定位置
	if offsetBytes > 0 {
		if _, err := file.Seek(int64(offsetBytes), io.SeekStart); err != nil {
			logrus.Errorf(
				"Seek to offset %d failed for file %s: %v",
				offsetBytes,
				req.Msg.Path,
				err,
			)
			return connect.NewError(connect.CodeInternal, err)
		}
	}

	// 计算需要读取的字节数
	var reader io.Reader = file
	if limitBytes > 0 {
		reader = io.LimitReader(file, int64(limitBytes))
	}

	// 流式传输
	pr, pw := io.Pipe()

	// 启动 Goroutine 读取文件并写入到管道中
	go func() {
		defer func() {
			_ = pw.Close()
		}()

		done := make(chan error, 1)
		go func() {
			_, err := io.Copy(pw, reader)
			done <- err
		}()

		select {
		case <-ctx.Done():
			_ = pw.CloseWithError(ctx.Err())
		case err := <-done:
			if err != nil {
				logrus.Errorf("Error copying file to pipe: %v", err)
			}
		}
	}()

	buf := make([]byte, req.Msg.ChunkSizeByte)
	for {
		global_child.SetLastRequestTime(time.Now())

		n, err := pr.Read(buf)
		if err == io.EOF {
			break
		}
		if err != nil {
			logrus.Errorf("Error reading from pipe: %v", err)
			return connect.NewError(connect.CodeInternal, err)
		}

		// 发送数据块，当客户端速度较慢时阻塞，避免内存占用
		if err := stream.Send(&apiv1.DownloadResponse{
			Chunk: buf[:n],
		}); err != nil {
			logrus.Errorf("Error sending chunk: %v", err)
			return connect.NewError(connect.CodeInternal, err)
		}
	}

	logrus.Infof(
		"Download of file %s completed successfully (offset=%d, limit=%d)",
		req.Msg.Path,
		offsetBytes,
		limitBytes,
	)

	return nil
}

func (k *K8sFileServer) CompressAndDownload(ctx context.Context,
	req *connect.Request[apiv1.CompressAndDownloadRequest],
	stream *connect.ServerStream[apiv1.CompressAndDownloadResponse],
) error {
	// 获取用户家目录实例
	root, err := getUserHomeRoot(req.Msg.UserId)
	if err != nil {
		return connect.NewError(connect.CodeInternal, err)
	}
	defer func() { _ = root.Close() }()

	var validPaths []string
	// 检查请求的文件
	for _, resourcePath := range req.Msg.Paths {
		// 将绝对路径转换为相对路径
		relativePath, err := getRelativePathForUser(req.Msg.UserId, resourcePath)
		if err != nil {
			logrus.Errorf("Source path conversion error: %v", err)
			return connect.NewError(connect.CodePermissionDenied, err)
		}

		// 使用 os.Root 验证路径是否在限制范围内
		if err := validatePathWithinRoot(root, relativePath); err != nil {
			if os.IsNotExist(err) {
				logrus.Errorf("The path %s to be downloaded does not exist", resourcePath)
				return connect.NewError(connect.CodeNotFound, err)
			}
			logrus.Errorf("Path %s is outside root or permission denied", resourcePath)
			return connect.NewError(connect.CodePermissionDenied, err)
		}

		validPaths = append(validPaths, relativePath)
		logrus.Debugf("Added path to zip: %s", relativePath)
	}

	// 创建 pipe，用于边压缩边读写
	pr, pw := io.Pipe()

	// 创建一个子上下文，用于管理压缩过程的取消
	zipCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	// 启动一个 goroutine 进行压缩
	go func() {
		// 执行压缩；如果发生错误，通过 CloseWithError 关闭管道并传递错误
		// 注意：这里传入的是相对路径，ZipPathsOnTheFlyWithRoot 会使用 root 进行安全访问
		err := fileUtils.ZipPathsOnTheFlyWithRoot(zipCtx, validPaths, pw, 9, root)
		if err != nil {
			logrus.Errorf("Compression error: %v", err)
		}
		pw.CloseWithError(err)
	}()

	go func() {
		<-ctx.Done()
		// 客户端取消了请求，取消压缩上下文以中断压缩过程
		logrus.Info("Request canceled by client, terminating compression and transmission")
		cancel()
	}()

	// 缓冲区用于读取压缩数据
	buf := make([]byte, req.Msg.ChunkSizeByte)

	// 从 pr 读数据，写入 stream
	for {
		// 更新最后请求时间
		global_child.SetLastRequestTime(time.Now())

		// 从管道读取一块数据
		n, err := pr.Read(buf)
		if err == io.EOF {
			// 压缩和传输成功完成
			break
		}
		if err != nil {
			// 处理读取错误
			if errors.Is(err, context.Canceled) {
				logrus.Info("Transmission canceled by client")
				return connect.NewError(connect.CodeCanceled, err)
			}
			logrus.Errorf("Error reading from pipe: %v", err)
			return connect.NewError(connect.CodeInternal, fmt.Errorf("error reading compressed data: %v", err))
		}

		// 将数据块发送给客户端
		if sendErr := stream.Send(&apiv1.CompressAndDownloadResponse{
			Chunk: buf[:n],
		}); sendErr != nil {
			// 检查错误是否由于上下文取消引起
			if errors.Is(sendErr, context.Canceled) {
				logrus.Info("Send operation canceled by client")
				return connect.NewError(connect.CodeCanceled, sendErr)
			}
			logrus.Errorf("Error sending chunk of data: %v", sendErr)
			return connect.NewError(connect.CodeInternal, fmt.Errorf("error sending data to client: %v", sendErr))
		}

		// 检查上下文是否已取消
		select {
		case <-ctx.Done():
			// 客户端取消了请求，终止传输
			logrus.Info("Request context canceled, stopping compression and transmission")
			return connect.NewError(connect.CodeCanceled, ctx.Err())
		default:
			// 继续处理
		}
	}

	logrus.Infof("Download of files %v completed successfully", req.Msg.Paths)
	return nil
}

func (k *K8sFileServer) InitMultipartUpload(
	ctx context.Context,
	req *connect.Request[apiv1.InitMultipartUploadRequest],
) (*connect.Response[apiv1.InitMultipartUploadResponse], error) {
	noCheckPermission := req.Msg.GetNoCheckPermission()

	// 步骤 1：解析用户家目录 root 并校验上传目标目录合法性
	logrus.Infof("K8s init multi upload file %s for user %s (no_check_permission: %v)",
		req.Msg.Name, req.Msg.UserId, noCheckPermission)

	var root *os.Root
	var relativePath string
	var err error

	root, err = openRoot(req.Msg.UserId, noCheckPermission)
	if err != nil {
		logrus.Errorf("Failed to create root for path %s: %v", req.Msg.Path, err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	defer func() {
		if closeErr := root.Close(); closeErr != nil {
			logrus.Errorf("Failed to close root: %v", closeErr)
		}
	}()

	relativePath, err = buildRelativePath(req.Msg.UserId, req.Msg.Path, noCheckPermission)
	if err != nil {
		logrus.Errorf("Source path conversion error: %v", err)
		return nil, err
	}

	if noCheckPermission {
		logrus.Debugf("Using system root with relative path: %s", relativePath)
	} else {
		logrus.Debugf("Upload file path %s", req.Msg.Path)
		logrus.Debugf("Using relative path: %s for directory access", relativePath)
	}

	// 以下逻辑对两种模式完全相同

	// 验证路径是否在root限制内
	if err := validatePathWithinRoot(root, relativePath); err != nil {
		if os.IsNotExist(err) {
			logrus.Errorf("Directory %s does not exist", req.Msg.Path)
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("directory %s does not exist", req.Msg.Path))
		}
		logrus.Errorf("Directory path %s is outside root or permission denied", req.Msg.Path)
		return nil, connect.NewError(connect.CodePermissionDenied,
			fmt.Errorf("directory path %s is outside allowed root directory or permission denied", req.Msg.Path))
	}

	dirInfo, err := root.Stat(relativePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("directory %s does not exist", req.Msg.Path))
		}
		if os.IsPermission(err) {
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if !dirInfo.IsDir() {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("path %s is not a directory", req.Msg.Path))
	}

	uploadingRelativePath := filepath.Join(relativePath, req.Msg.Name+".uploading")
	outputRelativePath := filepath.Join(relativePath, req.Msg.Name)
	absUploadingPath := filepath.Join(root.Name(), uploadingRelativePath)
	absOutputPath := filepath.Join(root.Name(), outputRelativePath)

	if _, err := root.Stat(outputRelativePath); err == nil {
		return nil, connect.NewError(connect.CodeAlreadyExists, fmt.Errorf("file %s already exists", absOutputPath))
	} else if os.IsPermission(err) {
		return nil, connect.NewError(connect.CodePermissionDenied, err)
	} else if !os.IsNotExist(err) {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	chunkSizeByte := config.GetChunkSizeByte()
	fileSizeByte := req.Msg.FileSizeByte
	bitsetSize := fileUtils.GetBitsetSize(fileSizeByte, uint64(chunkSizeByte))
	fileSizeWithMeta := int64(fileSizeByte) + bitsetSize + fileUtils.UploadingMetaSize

	modificationTimeResp := req.Msg.ModificationTime
	var uploadedIndices []uint64

	// 步骤 2：获取 uploading 文件锁，保证同一上传文件的操作串行
	lock := fileUtils.GetUploadingLock(absUploadingPath)
	lock.Lock()
	defer lock.Unlock()

	// needRecreate 为 true 时表示需要创建全新的 .uploading 文件
	needRecreate := false

	// 步骤 3：如已存在 .uploading 文件则进行校验与续传判断
	if stat, err := root.Stat(uploadingRelativePath); err == nil {
		file, err := root.OpenFile(uploadingRelativePath, os.O_RDWR, 0644)
		if err != nil {
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		closed := false
		defer func() {
			if !closed {
				if err := file.Close(); err != nil {
					logrus.Errorf("Failed to close file: %v", err)
				}
			}
		}()

		sz := stat.Size()
		if sz < fileUtils.UploadingMetaSize {
			// 文件过小，无法包含完整元数据区，可能是上次初始化时因配额不足导致 Truncate 失败遗留的残缺文件。
			// 关闭文件句柄并标记需要重建，避免后续分片写入因 "uploading file missing metadata region" 一直失败。
			if err := file.Close(); err != nil {
				logrus.Errorf("Failed to close corrupted uploading file before recreate: %v", err)
			}
			closed = true
			if removeErr := root.Remove(uploadingRelativePath); removeErr != nil && !os.IsNotExist(removeErr) {
				logrus.Warnf("Failed to remove corrupted uploading file %s: %v", absUploadingPath, removeErr)
			}
			needRecreate = true
		} else if sz >= fileUtils.UploadingMetaSize {
			if meta, err := fileUtils.ReadUploadingMeta(file, sz, fileUtils.UploadingMetaSize); err == nil {
				if meta.ChunkSizeByte == 0 {
					return nil, connect.NewError(connect.CodeFailedPrecondition, errors.New("chunk size missing in metadata"))
				}
				chunkSizeByte = int(meta.ChunkSizeByte)
				contentSize := int64(meta.FileSize)
				totalChunks := fileUtils.CalculateChunks(meta.FileSize, uint64(chunkSizeByte))
				_, err := fileUtils.EnsureBitsetRegion(file, meta.FileSize, uint64(chunkSizeByte), fileUtils.UploadingMetaSize)
				if err != nil {
					return nil, connect.NewError(connect.CodeInternal, err)
				}
				bitset, err := fileUtils.ReadChunkBitsetAt(file, contentSize, totalChunks)
				if err != nil {
					return nil, connect.NewError(connect.CodeInternal, err)
				}
				if meta.FullHashReady && meta.FullHash != "" {
					lastChunkIdx, ok := fileUtils.LastUploadedChunk(bitset, totalChunks)
					if !ok {
						if err := file.Close(); err != nil {
							logrus.Errorf("Failed to close uploading file before remove: %v", err)
						}
						closed = true
						if removeErr := root.Remove(uploadingRelativePath); removeErr != nil && !os.IsNotExist(removeErr) {
							logrus.Warnf("Failed to remove corrupted uploading file %s: %v", absUploadingPath, removeErr)
						}
						needRecreate = true
					} else {
						hashSize := int64((lastChunkIdx + 1) * uint64(chunkSizeByte))
						if hashSize > contentSize {
							hashSize = contentSize
						}
						hash, err := fileUtils.ComputeFullHash(file, hashSize)
						if err != nil {
							return nil, connect.NewError(connect.CodeInternal, err)
						}
						if hash != meta.FullHash {
							if err := file.Close(); err != nil {
								logrus.Errorf("Failed to close uploading file before remove: %v", err)
							}
							closed = true
							if removeErr := root.Remove(uploadingRelativePath); removeErr != nil && !os.IsNotExist(removeErr) {
								logrus.Warnf("Failed to remove corrupted uploading file %s: %v", absUploadingPath, removeErr)
							}
							needRecreate = true
						}
					}
				} else {
					if err := fileUtils.VerifySentinels(file, meta.FileSize, contentSize, uint64(chunkSizeByte), meta.SentinelCount, meta.SentinelSize, meta.SentinelHashes, meta.TempHash); err != nil {
						if errClose := file.Close(); errClose != nil {
							logrus.Errorf("Failed to close uploading file before remove: %v", errClose)
						}
						closed = true
						if removeErr := root.Remove(uploadingRelativePath); removeErr != nil && !os.IsNotExist(removeErr) {
							logrus.Warnf("Failed to remove corrupted uploading file %s: %v", absUploadingPath, removeErr)
						}
						needRecreate = true
					}
				}
				if !needRecreate {
					modificationTimeResp = meta.ModificationTime
					uploadedIndices = fileUtils.ConvertBitsetToIndexes(bitset, totalChunks)
				}
			}
		}
	} else if !os.IsNotExist(err) {
		// 步骤 3.3：其他错误（非“文件不存在”）直接返回
		if os.IsPermission(err) {
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	} else {
		// 步骤 3.4：.uploading 文件不存在，后续需要新建
		needRecreate = true
	}

	// 步骤 4：根据 needRecreate 标志创建或重建 .uploading 文件并写入初始元数据
	if needRecreate {
		file, err := root.OpenFile(uploadingRelativePath, os.O_CREATE|os.O_RDWR, 0644)
		if err != nil {
			if isStorageError, storageErr := handleStorageError(err, "create uploading file", absUploadingPath); isStorageError {
				return nil, storageErr
			}
			if os.IsPermission(err) {
				return nil, connect.NewError(connect.CodePermissionDenied, err)
			}
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		defer func() {
			if err := file.Close(); err != nil {
				logrus.Errorf("Failed to close file: %v", err)
			}
		}()

		// 优先预分配磁盘块；底层文件系统不支持 fallocate 时降级为稀疏文件。
		if err := fileUtils.PreallocateFile(file, fileSizeWithMeta); err != nil {
			if isStorageError, storageErr := handleStorageError(err, "preallocate uploading file", absUploadingPath); isStorageError {
				return nil, storageErr
			}
			return nil, connect.NewError(connect.CodeInternal, err)
		}

		meta := fileUtils.UploadingMeta{
			FileSize:         fileSizeByte,
			ModificationTime: req.Msg.ModificationTime,
			ChunkSizeByte:    uint64(chunkSizeByte),
			TempHash:         "",
			FullHash:         "",
			FullHashReady:    false,
			LastActivityAt:   0,
			SentinelCount:    fileUtils.SentinelCountDefault,
			SentinelSize:     fileUtils.SentinelSizeDefault,
			SentinelHashes:   make([]uint64, fileUtils.SentinelCountDefault),
		}
		metaOffset := int64(fileSizeByte) + bitsetSize
		if err := fileUtils.WriteUploadingMeta(file, metaOffset, &meta, fileUtils.UploadingMetaSize); err != nil {
			if isStorageError, storageErr := handleStorageError(err, "write uploading metadata", absUploadingPath); isStorageError {
				return nil, storageErr
			}
			return nil, connect.NewError(connect.CodeInternal, err)
		}
	}

	// 步骤 5：返回分片参数及已上传分片索引给客户端，用于断点续传
	res := connect.NewResponse(&apiv1.InitMultipartUploadResponse{
		FileSizeByte:     fileSizeByte,
		ChunkSizeByte:    uint64(chunkSizeByte),
		ModificationTime: modificationTimeResp,
		UploadedIndices:  uploadedIndices,
	})
	return res, nil
}

func (k *K8sFileServer) CompleteMultipartUpload(ctx context.Context,
	req *connect.Request[apiv1.CompleteMultipartUploadRequest],
) (*connect.Response[apiv1.CompleteMultipartUploadResponse], error) {
	noCheckPermission := req.Msg.GetNoCheckPermission()

	// 步骤 1：解析用户家目录 root 并校验上传目标目录合法性
	logrus.Infof("K8s complete multipart upload for file %s, user %s (no_check_permission: %v)",
		req.Msg.Name, req.Msg.UserId, noCheckPermission)

	var root *os.Root
	var relativePath string
	var err error

	root, err = openRoot(req.Msg.UserId, noCheckPermission)
	if err != nil {
		logrus.Errorf("Failed to create root for path %s: %v", req.Msg.Path, err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	defer func() {
		if closeErr := root.Close(); closeErr != nil {
			logrus.Errorf("Failed to close root: %v", closeErr)
		}
	}()

	relativePath, err = buildRelativePath(req.Msg.UserId, req.Msg.Path, noCheckPermission)
	if err != nil {
		logrus.Errorf("Source path conversion error: %v", err)
		return nil, err
	}

	if noCheckPermission {
		logrus.Debugf("Using system root with relative path: %s", relativePath)
	} else {
		logrus.Debugf("Using relative path: %s for directory access", relativePath)
	}

	// 以下逻辑对两种模式完全相同

	// 验证路径是否在root限制内
	if err := validatePathWithinRoot(root, relativePath); err != nil {
		if os.IsNotExist(err) {
			logrus.Errorf("Directory %s does not exist", req.Msg.Path)
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("directory %s does not exist", req.Msg.Path))
		}
		logrus.Errorf("Directory path %s is outside root or permission denied", req.Msg.Path)
		return nil, connect.NewError(connect.CodePermissionDenied,
			fmt.Errorf("directory path %s is outside allowed root directory or permission denied", req.Msg.Path))
	}

	dirInfo, err := root.Stat(relativePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("directory %s does not exist", req.Msg.Path))
		}
		if os.IsPermission(err) {
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if !dirInfo.IsDir() {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("path %s is not a directory", req.Msg.Path))
	}

	uploadingRelativePath := filepath.Join(relativePath, req.Msg.Name+".uploading")
	outputRelativePath := filepath.Join(relativePath, req.Msg.Name)
	absUploadingPath := filepath.Join(root.Name(), uploadingRelativePath)
	absOutputPath := filepath.Join(root.Name(), outputRelativePath)

	lock := fileUtils.GetUploadingLock(absUploadingPath)
	lock.Lock()
	defer lock.Unlock()

	file, err := root.OpenFile(uploadingRelativePath, os.O_RDWR, 0644)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		if os.IsPermission(err) {
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	stat, err := file.Stat()
	if err != nil {
		_ = file.Close()
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if stat.Size() < fileUtils.UploadingMetaSize {
		// 步骤 2：元数据区缺失，删除异常的 .uploading 文件并返回错误
		_ = file.Close()
		_ = root.Remove(uploadingRelativePath)
		return nil, connect.NewError(connect.CodeFailedPrecondition, errors.New("uploading metadata missing"))
	}

	meta, err := fileUtils.ReadUploadingMeta(file, stat.Size(), fileUtils.UploadingMetaSize)
	if err != nil || meta == nil {
		_ = file.Close()
		_ = root.Remove(uploadingRelativePath)
		return nil, connect.NewError(connect.CodeFailedPrecondition, errors.New("uploading metadata invalid"))
	}
	if meta.ChunkSizeByte == 0 {
		// 步骤 2.1：元数据不完整（缺少分片大小），删除异常文件
		_ = file.Close()
		_ = root.Remove(uploadingRelativePath)
		return nil, connect.NewError(connect.CodeFailedPrecondition, errors.New("chunk size missing in metadata"))
	}

	totalChunks := fileUtils.CalculateChunks(meta.FileSize, meta.ChunkSizeByte)
	bitset, err := fileUtils.ReadChunkBitsetAt(file, int64(meta.FileSize), totalChunks)
	if err != nil {
		// 步骤 2.2：读取位图失败，删除异常文件
		_ = file.Close()
		_ = root.Remove(uploadingRelativePath)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	logrus.Debugf("K8s complete upload inspect: uploading=%s, output=%s, fileSize=%d, chunkSize=%d, totalChunks=%d, bitsetBytes=%d, uploadingFileSize=%d", absUploadingPath, absOutputPath, meta.FileSize, meta.ChunkSizeByte, totalChunks, len(bitset), stat.Size())

	complete := true
	if totalChunks > 0 {
		// 步骤 3：遍历位图，确认所有分片均已上传，记录缺失分片
		for idx := uint64(0); idx < totalChunks; idx++ {
			byteIdx := idx / 8
			if byteIdx >= uint64(len(bitset)) {
				complete = false
				break
			}
			bit := uint8(1 << (idx % 8))
			if bitset[byteIdx]&bit == 0 {
				complete = false
				break
			}
		}
	}

	if !complete {
		_ = file.Close()
		missing := make([]uint64, 0, 16)
		for idx := uint64(0); idx < totalChunks; idx++ {
			byteIdx := idx / 8
			if byteIdx >= uint64(len(bitset)) {
				missing = append(missing, idx)
			} else {
				bit := uint8(1 << (idx % 8))
				if bitset[byteIdx]&bit == 0 {
					missing = append(missing, idx)
				}
			}
			if len(missing) >= 16 {
				break
			}
		}
		logrus.Errorf("K8s complete upload failed: upload not complete, uploading=%s, totalChunks=%d, bitsetBytes=%d, firstMissingChunks=%v", absUploadingPath, totalChunks, len(bitset), missing)
		return nil, connect.NewError(connect.CodeFailedPrecondition, errors.New("upload not complete"))
	}

	if err := file.Truncate(int64(meta.FileSize)); err != nil {
		_ = file.Close()
		if isStorageError, storageErr := handleStorageError(err, "truncate uploading file", absUploadingPath); isStorageError {
			return nil, storageErr
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	if err := file.Close(); err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	if err := os.Rename(absUploadingPath, absOutputPath); err != nil {
		if isStorageError, storageErr := handleStorageError(err, "rename uploading file", absOutputPath); isStorageError {
			return nil, storageErr
		}
		if os.IsPermission(err) {
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	res := connect.NewResponse(&apiv1.CompleteMultipartUploadResponse{})
	return res, nil
}
