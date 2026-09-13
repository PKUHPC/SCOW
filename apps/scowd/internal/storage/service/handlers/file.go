// Package handlers provides HTTP handlers for storage-related operations including
// file management, directory operations, and file transfer services.
package handlers

import (
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
	"unicode/utf8"

	"github.com/PKUHPC/private-scow/apps/scowd/internal/auth"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/config"
	global_child "github.com/PKUHPC/private-scow/apps/scowd/internal/process/childstate"
	storageUtils "github.com/PKUHPC/private-scow/apps/scowd/internal/storage/disk"
	fileUtils "github.com/PKUHPC/private-scow/apps/scowd/internal/storage/file"
	apiv1 "github.com/PKUHPC/private-scow/apps/scowd/protos/gen/api/storage"

	"connectrpc.com/connect"
	"github.com/gabriel-vasile/mimetype"
	cp "github.com/otiai10/copy"
	"github.com/sirupsen/logrus"
)

type FileServer struct{}

// 上传相关常量：请求体限制、元数据区大小、哨兵窗口配置与空闲哈希延迟。
const maxBodySize = 10 * 1024 * 1024 // 10MB，限制单次上传请求体大小

// handleStorageError 处理存储空间不足和配额超限错误
// 如果是存储相关错误，返回 true 和对应的 connect.Error
// 如果不是存储相关错误，返回 false 和 nil
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

func (f *FileServer) ReadDirectory(
	ctx context.Context,
	req *connect.Request[apiv1.ReadDirectoryRequest],
) (*connect.Response[apiv1.ReadDirectoryResponse], error) {

	// 使用filepath.Walk遍历目录
	logrus.Infof("Read Directory %s", req.Msg.DirPath)

	fileInfo, err := os.Stat(req.Msg.DirPath)
	if err != nil {
		if os.IsNotExist(err) {
			logrus.Errorf("Path %s does not exist", req.Msg.DirPath)
			return nil, connect.NewError(connect.CodeInvalidArgument, err)
		} else if os.IsPermission(err) {
			logrus.Errorf("Permission denied accessing path: %s", req.Msg.DirPath)
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}
		// Handle other potential errors
		logrus.Errorf("Error accessing path %s: %v", req.Msg.DirPath, err)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	if !fileInfo.IsDir() {
		logrus.Errorf("The path %s is a file not a dir", req.Msg.DirPath)
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("NOT_A_DIR"))
	}

	var filesInfo = make([]*apiv1.FileInfo, 0, 100)
	entries, err := os.ReadDir(req.Msg.DirPath)
	if err != nil {
		if os.IsPermission(err) {
			logrus.Errorf("Permission denied reading directory: %s", req.Msg.DirPath)
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}
		// Handle other potential errors
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

		// 获取文件的类型（是文件还是目录）
		fileType := apiv1.FileType_FILE
		if entry.IsDir() {
			fileType = apiv1.FileType_DIR
		}

		// 获取文件的修改时间
		modTime := info.ModTime()
		// 获取文件的大小
		size := info.Size()
		// 获取文件的权限
		mode := info.Mode()

		// 构建完整路径用于软链接检测
		fullPath := filepath.Join(req.Msg.DirPath, entry.Name())

		// 检测是否为软链接
		linkInfo, err := os.Lstat(fullPath)
		var linkTargetPath *string
		var linkTargetType *apiv1.FileType

		if err == nil && linkInfo.Mode()&os.ModeSymlink != 0 {
			// 这是一个软链接
			fileType = apiv1.FileType_SYMLINK

			// 解析软链接目标
			targetPath, err := os.Readlink(fullPath)
			if err == nil {
				// 如果目标路径是相对路径，转换为绝对路径
				if !filepath.IsAbs(targetPath) {
					targetPath = filepath.Join(req.Msg.DirPath, targetPath)
				}
				targetPath = filepath.Clean(targetPath)
				if !utf8.ValidString(targetPath) {
					logrus.Warnf("Skipping symlink target with invalid UTF-8 path: %q", targetPath)
				} else {
					linkTargetPath = &targetPath
				}

				// 检测目标类型（若目标为软链接则返回 SYMLINK）
				tgtInfo, err := os.Lstat(targetPath)
				if err == nil {
					if tgtInfo.Mode()&os.ModeSymlink != 0 {
						targetType := apiv1.FileType_SYMLINK
						linkTargetType = &targetType
					} else {
						// 非软链接，进一步判断是目录还是文件
						targetInfo, err := os.Stat(targetPath)
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

	// 打印文件信息
	logrus.Infof("Read %d files", len(filesInfo))

	res := connect.NewResponse(&apiv1.ReadDirectoryResponse{
		FilesInfo: filesInfo,
	})

	return res, nil
}

func (f *FileServer) CreateFile(
	ctx context.Context,
	req *connect.Request[apiv1.CreateFileRequest],
) (*connect.Response[apiv1.CreateFileResponse], error) {

	_, err := os.Stat(req.Msg.FilePath)
	if err == nil {
		logrus.Infof("file already exists at %s", req.Msg.FilePath)
		return connect.NewResponse(&apiv1.CreateFileResponse{}), nil
	}

	logrus.Infof("Create file %s for user %s", req.Msg.FilePath, os.Args[2])

	file, err := os.Create(req.Msg.FilePath)
	if err != nil {
		if isStorageError, storageErr := handleStorageError(err, "file creation", req.Msg.FilePath); isStorageError {
			return nil, storageErr
		}
		// 判断错误类型
		if os.IsExist(err) {
			// 文件已存在，忽略错误
			logrus.Infof("file already exists at %s", req.Msg.FilePath)
			return connect.NewResponse(&apiv1.CreateFileResponse{}), nil
		} else if os.IsPermission(err) {
			// 无权限创建文件
			logrus.Errorf("no permission to create file at %s", req.Msg.FilePath)
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}

		if os.IsNotExist(err) {
			// 父目录不存在
			logrus.Errorf("parent directory does not exist for %s", req.Msg.FilePath)
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		// 其他错误
		logrus.Errorf("Create file error at %s", req.Msg.FilePath)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	defer func() {
		if err := file.Close(); err != nil {
			logrus.Errorf("Failed to close file: %v", err)
		}
	}() // 确保文件被正确关闭

	// 文件创建成功
	return connect.NewResponse(&apiv1.CreateFileResponse{}), nil
}

func (f *FileServer) MakeDirectory(
	ctx context.Context,
	req *connect.Request[apiv1.MakeDirectoryRequest],
) (*connect.Response[apiv1.MakeDirectoryResponse], error) {

	// 路径黑名单校验
	if err := fileUtils.ValidateMakeDirPath(req.Msg.DirPath); err != nil {
		logrus.WithError(err).Errorf("directory path validation failed: %s", req.Msg.DirPath)
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	_, err := os.Stat(req.Msg.DirPath)
	if err == nil {
		logrus.Infof("Directory already exists at %s", req.Msg.DirPath)
		return connect.NewResponse(&apiv1.MakeDirectoryResponse{}), nil
	}

	logrus.Infof("Create directory %s for user %s", req.Msg.DirPath, os.Args[2])

	// 尝试创建目录
	err = os.MkdirAll(req.Msg.DirPath, 0775)
	if err != nil {
		if isStorageError, storageErr := handleStorageError(err, "directory creation", req.Msg.DirPath); isStorageError {
			return nil, storageErr
		}
		// 判断错误类型
		// 目录已存在
		if os.IsExist(err) {
			// 忽略目录已存在的问题，直接认为成功
			logrus.Infof("Directory already exists at %s", req.Msg.DirPath)
			return connect.NewResponse(&apiv1.MakeDirectoryResponse{}), nil
		} else if os.IsPermission(err) {
			// 无权限创建目录
			logrus.Errorf("no permission to create directory at %s", req.Msg.DirPath)
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}
		// 其他错误
		logrus.Errorf("Make directory error at %s", req.Msg.DirPath)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// 目录创建成功
	return connect.NewResponse(&apiv1.MakeDirectoryResponse{}), nil
}

func (f *FileServer) DeleteDirectory(ctx context.Context,
	req *connect.Request[apiv1.DeleteDirectoryRequest],
) (*connect.Response[apiv1.DeleteDirectoryResponse], error) {

	logrus.Infof("Delete directory %s for user %s", req.Msg.DirPath, os.Args[2])

	// 尝试删除目录及其所有内容
	err := os.RemoveAll(req.Msg.DirPath)
	if err != nil {
		// 判断错误类型
		if os.IsNotExist(err) {
			// 目录不存在
			logrus.Errorf("directory does not exist at %s", req.Msg.DirPath)
			return nil, connect.NewError(connect.CodeNotFound, err)
		} else if os.IsPermission(err) {
			// 无权限删除目录
			logrus.Errorf("no permission to delete directory at %s", req.Msg.DirPath)
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}
		// 其他错误
		logrus.Errorf("Delete directory error at %s", req.Msg.DirPath)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// 目录删除成功
	res := connect.NewResponse(&apiv1.DeleteDirectoryResponse{})
	return res, nil
}

func (f *FileServer) DeleteFile(ctx context.Context,
	req *connect.Request[apiv1.DeleteFileRequest],
) (*connect.Response[apiv1.DeleteFileResponse], error) {

	logrus.Infof("Delete file %s for user %s", req.Msg.FilePath, os.Args[2])

	// 尝试删除文件及其所有内容
	err := os.Remove(req.Msg.FilePath)
	if err != nil {
		// 判断错误类型
		if os.IsNotExist(err) {
			// 文件不存在
			logrus.Errorf("directory does not exist at %s", req.Msg.FilePath)
			return nil, connect.NewError(connect.CodeNotFound, err)
		} else if os.IsPermission(err) {
			// 无权限删除文件
			logrus.Errorf("no permission to delete directory at %s", req.Msg.FilePath)
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}
		// 其他错误
		logrus.Errorf("Delete file error at %s", req.Msg.FilePath)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// 文件删除成功
	res := connect.NewResponse(&apiv1.DeleteFileResponse{})
	return res, nil
}

func (f *FileServer) WriteFile(ctx context.Context,
	req *connect.Request[apiv1.WriteFileRequest],
) (*connect.Response[apiv1.WriteFileResponse], error) {

	logrus.Infof("Write file %s for user %s", req.Msg.FilePath, os.Args[2])

	contentLength := len(req.Msg.Content)
	if contentLength > maxBodySize {
		return nil, connect.NewError(
			connect.CodeInvalidArgument,
			fmt.Errorf("request body exceeds the maximum allowed size of %d bytes", maxBodySize),
		)
	}

	var writeErr error
	if req.Msg.Append != nil && *req.Msg.Append {
		logrus.Infof("Add new content to file %s for user %s", req.Msg.FilePath, os.Args[2])
		// 如果是追加写入，验证文件是否已存在
		if _, err := os.Stat(req.Msg.FilePath); os.IsNotExist(err) {
			logrus.Infof("Directory already exists at %s", req.Msg.FilePath)
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		// 追加写入下，文件打开模式不使用创建，无权限需求
		file, err := os.OpenFile(req.Msg.FilePath, os.O_WRONLY|os.O_APPEND, 0)
		if err != nil {
			writeErr = err
		} else {
			defer func() { _ = file.Close() }()
			_, writeErr = file.WriteString(req.Msg.Content)
		}
	} else {
		// 创建或覆盖文件，并写入内容
		writeErr = os.WriteFile(req.Msg.FilePath, []byte(req.Msg.Content), 0664)
	}

	if writeErr != nil {
		return nil, connect.NewError(connect.CodeInternal, writeErr)
	}

	res := connect.NewResponse(&apiv1.WriteFileResponse{})
	return res, nil
}

func (f *FileServer) ChangeMode(ctx context.Context,
	req *connect.Request[apiv1.ChangeModeRequest],
) (*connect.Response[apiv1.ChangeModeResponse], error) {

	logrus.Infof("Change %s mode for user %s", req.Msg.Path, os.Args[2])

	// 将字符串形式的权限值转换为 os.FileMode（八进制解析）
	mode64, err := strconv.ParseInt(req.Msg.Mode, 8, 32)
	if err != nil {
		logrus.Errorf("Invalid mode: %s", req.Msg.Mode)
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("invalid mode format: %w", err))
	}
	mode := os.FileMode(mode64)

	if req.Msg.Recursive {
		err = filepath.WalkDir(req.Msg.Path, func(path string, d os.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if chErr := os.Chmod(path, mode); chErr != nil {
				logrus.Warnf("Failed to chmod %s: %v", path, chErr)
				return chErr
			}
			return nil
		})
		if err != nil {
			return nil, connect.NewError(connect.CodeInternal, err)
		}
	} else {
		err = os.Chmod(req.Msg.Path, mode)
		if err != nil {
			return nil, connect.NewError(connect.CodeInternal, err)
		}
	}

	return connect.NewResponse(&apiv1.ChangeModeResponse{}), nil
}

func (f *FileServer) ChangeOwner(
	ctx context.Context,
	req *connect.Request[apiv1.ChangeOwnerRequest],
) (*connect.Response[apiv1.ChangeOwnerResponse], error) {
	if req.Msg.Uid == nil && req.Msg.Gid == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("at least one of uid or gid must be specified"))
	}
	if req.Msg.TargetUid == nil {
		return nil, connect.NewError(connect.CodeUnimplemented, errors.New("ChangeOwner Mode A must be called on the parent process"))
	}

	uid := -1
	gid := -1
	if req.Msg.Uid != nil {
		uid = int(*req.Msg.Uid)
	}
	if req.Msg.Gid != nil {
		gid = int(*req.Msg.Gid)
	}
	targetUID := *req.Msg.TargetUid
	logrus.Debugf("ChangeOwner Mode B: targetUID=%d uid=%d gid=%d path=%s", targetUID, uid, gid, req.Msg.Path)

	walkFn := func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			if os.IsPermission(err) {
				logrus.Debugf("ChangeOwner Mode B: skipping %s (permission denied)", path)
				return nil
			}
			return err
		}
		info, err := d.Info()
		if err != nil {
			return err
		}
		stat, ok := info.Sys().(*syscall.Stat_t)
		if !ok || stat.Uid != targetUID {
			return nil
		}
		logrus.Debugf("ChangeOwner Mode B: chown %s (uid=%d gid=%d)", path, uid, gid)
		return os.Lchown(path, uid, gid)
	}

	if req.Msg.Recursive {
		startInfo, err := os.Lstat(req.Msg.Path)
		if err != nil {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		if startInfo.Mode()&os.ModeSymlink != 0 {
			return nil, connect.NewError(connect.CodeInvalidArgument,
				fmt.Errorf("recursive chown on symlink path %s is not allowed", req.Msg.Path))
		}
		if err := filepath.WalkDir(req.Msg.Path, walkFn); err != nil {
			logrus.Errorf("ChangeOwner walk failed for path %s: %v", req.Msg.Path, err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		logrus.Infof("ChangeOwner Mode B: walk completed for path %s", req.Msg.Path)
	} else {
		info, err := os.Lstat(req.Msg.Path)
		if err != nil {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		stat, ok := info.Sys().(*syscall.Stat_t)
		if ok && stat.Uid == targetUID {
			logrus.Debugf("ChangeOwner Mode B: chown %s (uid=%d gid=%d)", req.Msg.Path, uid, gid)
			if err := os.Lchown(req.Msg.Path, uid, gid); err != nil {
				return nil, connect.NewError(connect.CodeInternal, err)
			}
			logrus.Infof("ChangeOwner Mode B: changed owner for path %s", req.Msg.Path)
		} else {
			logrus.Debugf("ChangeOwner Mode B: skipped %s (uid mismatch or no stat)", req.Msg.Path)
		}
	}

	return connect.NewResponse(&apiv1.ChangeOwnerResponse{}), nil
}

func (f *FileServer) ReadFile(ctx context.Context,
	req *connect.Request[apiv1.ReadFileRequest],
) (*connect.Response[apiv1.ReadFileResponse], error) {
	// 获取文件路径
	filePath := req.Msg.FilePath

	// 获取文件信息以检查文件大小
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		// 如果无法获取文件信息，返回错误
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to stat file: %w", err))
	}

	// 检查文件大小
	if fileInfo.Size() > maxBodySize {
		// 如果文件超过 10MB，返回错误
		return nil, connect.NewError(
			connect.CodeResourceExhausted,
			fmt.Errorf("file size exceeds the maximum allowed size of %d bytes", maxBodySize),
		)
	}

	// 读取文件内容
	content, err := os.ReadFile(filePath)
	if err != nil {
		// 如果读取文件时出错，返回错误
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	// 返回文件内容
	return connect.NewResponse(&apiv1.ReadFileResponse{
		Content: content,
	}), nil
}

func (f *FileServer) GetHomeDirectory(ctx context.Context,
	req *connect.Request[apiv1.GetHomeDirectoryRequest],
) (*connect.Response[apiv1.GetHomeDirectoryResponse], error) {

	logrus.Infof("Get home directory")

	// 此处不能使用 os.UserHomeDir(), UserHomeDir 获取环境变量中的 HOME, 而子进程的这个环境变量继承自父进程
	currentUser, err := auth.Lookup(req.Msg.UserId)
	if err != nil {
		logrus.Errorf("Get home directory error")
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&apiv1.GetHomeDirectoryResponse{
		Path: currentUser.HomeDir,
	}), nil
}

func (f *FileServer) GetFileMetadata(ctx context.Context,
	req *connect.Request[apiv1.GetFileMetadataRequest],
) (*connect.Response[apiv1.GetFileMetadataResponse], error) {

	logrus.Infof("Get file %s metadata", req.Msg.FilePath)

	// os.Stat() 获取真实目标信息（大小、类型）
	fileInfo, err := os.Stat(req.Msg.FilePath)
	if err != nil {
		if os.IsNotExist(err) {
			logrus.Errorf("Path %s does not exist", req.Msg.FilePath)
			return nil, connect.NewError(connect.CodeNotFound, err)
		} else if os.IsPermission(err) {
			logrus.Errorf("Insufficient permission to read path %s", req.Msg.FilePath)
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}
		logrus.Errorf("Get file metadata error at %s", req.Msg.FilePath)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	fileType := apiv1.FileType_FILE
	if fileInfo.IsDir() {
		fileType = apiv1.FileType_DIR
	}

	fileMode := fileInfo.Mode().Perm()
	perm := uint32(fileMode)

	// 判断是否为符号链接
	// os.Lstat()判断是否是软链接
	linkInfo, err := os.Lstat(req.Msg.FilePath)
	if err != nil {
		logrus.Errorf("Get file metadata Lstat error at %s", req.Msg.FilePath)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	isSymlink := linkInfo.Mode()&os.ModeSymlink != 0

	var linkTargetPath string
	var linkTargetType apiv1.FileType
	if isSymlink {
		// 解析软链接目标路径
		target, err := os.Readlink(req.Msg.FilePath)
		if err == nil {
			if filepath.IsAbs(target) {
				linkTargetPath = filepath.Clean(target)
			} else {
				linkTargetPath = filepath.Clean(filepath.Join(filepath.Dir(req.Msg.FilePath), target))
			}
			// 检测目标类型：若目标也是软链接，则返回 SYMLINK；否则根据是否目录/文件返回
			if tInfo, err := os.Lstat(linkTargetPath); err == nil && tInfo.Mode()&os.ModeSymlink != 0 {
				linkTargetType = apiv1.FileType_SYMLINK
			} else if tStat, err := os.Stat(linkTargetPath); err == nil {
				if tStat.IsDir() {
					linkTargetType = apiv1.FileType_DIR
				} else {
					linkTargetType = apiv1.FileType_FILE
				}
			}
		}
	}

	// 检测文件类型
	var mimeType string
	if fileType == apiv1.FileType_FILE {
		mime, err := mimetype.DetectFile(req.Msg.FilePath)
		if err != nil {
			logrus.Errorf("get file mime error: %v", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		mimeType = mime.String()
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

	logrus.Info(res.Msg.SizeByte)
	return res, nil
}

func (f *FileServer) Exists(ctx context.Context,
	req *connect.Request[apiv1.ExistsRequest],
) (*connect.Response[apiv1.ExistsResponse], error) {

	logrus.Infof("Check if the path %s exists", req.Msg.Path)

	_, err := os.Stat(req.Msg.Path)
	if err == nil {
		res := connect.NewResponse(&apiv1.ExistsResponse{
			Exists: true,
		})
		return res, nil
	}
	if os.IsNotExist(err) || errors.Is(err, syscall.ENOTDIR) {
		logrus.Infof("Path %s does not exist", req.Msg.Path)

		res := connect.NewResponse(&apiv1.ExistsResponse{
			Exists: false,
		})
		return res, nil
	}

	if os.IsPermission(err) {
		logrus.Errorf("Insufficient permission to read path %s", req.Msg.Path)
		return nil, connect.NewError(connect.CodePermissionDenied, err)
	}

	logrus.Errorf("Check if the path %s exists error", req.Msg.Path)
	return nil, connect.NewError(connect.CodeInternal, err)

}

func (f *FileServer) Copy(ctx context.Context,
	req *connect.Request[apiv1.CopyRequest],
) (*connect.Response[apiv1.CopyResponse], error) {

	logrus.Infof("Copy %s to %s", req.Msg.FromPath, req.Msg.ToPath)

	// 检查源文件路径
	_, err := os.Stat(req.Msg.FromPath)
	if err != nil {
		if os.IsNotExist(err) {
			logrus.Errorf("Path %s does not exist", req.Msg.FromPath)
			return nil, connect.NewError(connect.CodeNotFound, err)
		} else if os.IsPermission(err) {
			logrus.Errorf("Insufficient permission to read path %s", req.Msg.FromPath)
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}
		logrus.Errorf("Check path error at %s", req.Msg.FromPath)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	normalizedFromPath := filepath.Clean(req.Msg.FromPath)
	normalizedToPath := filepath.Clean(req.Msg.ToPath)
	// 检查是否是copy到自身或其子路径
	// 同名文件与文件夹不可能存在所以此处不用区分是否为文件对象
	if req.Msg.FromPath == req.Msg.ToPath ||
		strings.HasPrefix(normalizedToPath, normalizedFromPath+string(filepath.Separator)) {
		err := fmt.Errorf("can not copy a directory %s to itself or its sub direcotry %s", req.Msg.FromPath, req.Msg.ToPath)
		logrus.WithError(err).Errorf("copy error")
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// 复制文件或目录
	err = cp.Copy(req.Msg.FromPath, req.Msg.ToPath)
	if err != nil {
		if isStorageError, storageErr := handleStorageError(err, "copy operation", fmt.Sprintf("%s to %s", req.Msg.FromPath, req.Msg.ToPath)); isStorageError {
			return nil, storageErr
		}
		logrus.Errorf("Copy failed: %s", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	res := connect.NewResponse(&apiv1.CopyResponse{})

	return res, nil
}

func (f *FileServer) ShareFileOrDir(ctx context.Context,
	req *connect.Request[apiv1.ShareFileOrDirRequest],
) (*connect.Response[apiv1.ShareFileOrDirResponse], error) {
	logrus.Infof("ShareFileOrDir is only implemented by K8sFileServer")
	return nil, connect.NewError(connect.CodeUnimplemented, fmt.Errorf("shareFileOrDir is only implemented by K8sFileServer"))
}

func (f *FileServer) CompressFiles(ctx context.Context,
	req *connect.Request[apiv1.CompressFilesRequest],
) (*connect.Response[apiv1.CompressFilesResponse], error) {

	request := req.Msg

	// 压缩前检查目标路径可用空间
	var requiredSpace int64
	for _, path := range request.Paths {
		info, err := os.Stat(path)
		if err == nil {
			requiredSpace += info.Size()
		}
	}

	if err := storageUtils.CheckDiskSpace(filepath.Dir(request.ArchivePath), uint64(requiredSpace)); err != nil {
		return nil, connect.NewError(connect.CodeResourceExhausted, err)
	}

	// 构建压缩包的完整路径
	archivePath := filepath.Join(request.ArchivePath)

	// 创建文件以存储压缩包
	tempZipFile, err := os.Create(archivePath)
	if err != nil {
		if isStorageError, storageErr := handleStorageError(err, "archive creation", archivePath); isStorageError {
			return nil, storageErr
		}
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to create temporary archive: %v", err))
	}

	// 调用 ZipPathsOnTheFly 函数进行压缩
	err = fileUtils.ZipPathsOnTheFly(ctx, request.Paths, tempZipFile, 9)
	if err != nil {
		tempZipFile.Close()
		if removeErr := os.Remove(archivePath); removeErr != nil && !os.IsNotExist(removeErr) {
			logrus.Warnf("Failed to remove temporary archive %s: %v", archivePath, removeErr)
		}

		// 检查错误是否由于上下文取消引起
		if errors.Is(err, context.Canceled) {
			logrus.Info("zip operation canceled by client")
			return nil, connect.NewError(connect.CodeCanceled, err)
		}

		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("zip failed: %v", err))
	}

	// 关闭压缩包
	err = tempZipFile.Close()
	if err != nil {
		if removeErr := os.Remove(archivePath); removeErr != nil && !os.IsNotExist(removeErr) {
			logrus.Warnf("Failed to remove temporary archive %s: %v", archivePath, removeErr)
		}
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("close zip file error: %v", err))
	}

	return connect.NewResponse(&apiv1.CompressFilesResponse{}), nil
}

func (f *FileServer) DecompressFile(ctx context.Context,
	req *connect.Request[apiv1.DecompressFileRequest],
) (*connect.Response[apiv1.DecompressFileResponse], error) {

	logrus.Infof("Decompress file from  %s to %s for user %s", req.Msg.FilePath, req.Msg.DecompressionPath, os.Args[2])

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
	defer func() {
		if err := file.Close(); err != nil {
			logrus.Errorf("Failed to close file: %v", err)
		}
	}()

	// 检测文件类型
	mime, err := mimetype.DetectFile(req.Msg.FilePath)
	if err != nil {
		logrus.Errorf("failed to detect decompression file type: %s", req.Msg.FilePath)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// 根据文件类型解压
	decompressErr := func() error {
		switch mime.Extension() {
		case string(fileUtils.ExtensionZip):
			return fileUtils.Unzip(ctx, file, req.Msg.DecompressionPath)
		case string(fileUtils.ExtensionTar):
			return fileUtils.Untar(ctx, file, req.Msg.DecompressionPath)
		case string(fileUtils.ExtensionTgz), string(fileUtils.ExtensionTarGz):
			return fileUtils.Untargz(ctx, file, req.Msg.DecompressionPath)
		case string(fileUtils.ExtensionGz):
			// 检查是否可能是 tar.gz 但被错误识别为 .gz
			if strings.HasSuffix(file.Name(), string(fileUtils.ExtensionTarGz)) {
				return fileUtils.Untargz(ctx, file, req.Msg.DecompressionPath)
			}
			return fileUtils.Ungzip(ctx, file, req.Msg.DecompressionPath)
		default:
			logrus.Errorf("unsupported file MIME type: %s, extension: %s for file %s", mime.String(), mime.Extension(), req.Msg.FilePath)
			return connect.NewError(connect.CodePermissionDenied, fmt.Errorf("unsupported file type"))
		}
	}()

	if decompressErr != nil {
		logrus.Errorf("failed to decompress the file from %s to %s", req.Msg.FilePath, req.Msg.DecompressionPath)
		return nil, connect.NewError(connect.CodeInternal, decompressErr)
	}

	return connect.NewResponse(&apiv1.DecompressFileResponse{}), nil
}

func (f *FileServer) Move(ctx context.Context,
	req *connect.Request[apiv1.MoveRequest],
) (*connect.Response[apiv1.MoveResponse], error) {

	logrus.Infof("Move %s to %s for user %s", req.Msg.FromPath, req.Msg.ToPath, os.Args[2])

	// 检查源文件路径
	_, err := os.Stat(req.Msg.FromPath)
	if err != nil {
		if os.IsNotExist(err) {
			logrus.Errorf("Path %s does not exist", req.Msg.FromPath)
			return nil, connect.NewError(connect.CodeNotFound, err)
		} else if os.IsPermission(err) {
			logrus.Errorf("Insufficient permission to read path %s", req.Msg.FromPath)
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}
		logrus.Errorf("Check path error at %s", req.Msg.FromPath)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// 检查目标文件路径的父路径是否存在
	_, err = os.Stat(filepath.Dir(req.Msg.ToPath))
	if err != nil {
		if os.IsNotExist(err) {
			logrus.Errorf("Path %s does not exist", filepath.Dir(req.Msg.ToPath))
			return nil, connect.NewError(connect.CodeNotFound, err)
		} else if os.IsPermission(err) {
			logrus.Errorf("Insufficient permission to read path %s", filepath.Dir(req.Msg.ToPath))
			return nil, connect.NewError(connect.CodePermissionDenied, err)
		}
		logrus.Errorf("Check path error at %s", filepath.Dir(req.Msg.ToPath))
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// 判断是否跨设备（跨文件系统）
	crossDevice, err := fileUtils.IsCrossDevice(req.Msg.FromPath, filepath.Dir(req.Msg.ToPath))
	if err != nil {
		logrus.Errorf("Failed to check device for paths: %s", err)
		// 如果发生错误大概率是系统异常，直接抛出这个错误不再向下执行
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	if !crossDevice {
		// 同一文件系统：直接 rename
		logrus.Debugf("Move file with same device, using rename: %s -> %s", req.Msg.FromPath, req.Msg.ToPath)
		// 移动文件或目录
		err = os.Rename(req.Msg.FromPath, req.Msg.ToPath)
		if err != nil {
			if isStorageError, storageErr := handleStorageError(err, "move operation", fmt.Sprintf("%s to %s", req.Msg.FromPath, req.Msg.ToPath)); isStorageError {
				return nil, storageErr
			}
			logrus.Errorf("Move failed: %s", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
	} else {
		// 跨设备：copy + delete，支持文件和目录
		logrus.Infof("Move file across devices, using copy+delete: %s -> %s", req.Msg.FromPath, req.Msg.ToPath)
		copyDone := false
		defer func() {
			if !copyDone {
				logrus.Warnf("Copy incomplete, rolling back: removing %s", req.Msg.ToPath)
				if removeErr := os.RemoveAll(req.Msg.ToPath); removeErr != nil && !os.IsNotExist(removeErr) {
					logrus.Errorf("Rollback failed, remove %s error: %v", req.Msg.ToPath, removeErr)
				}
			}
		}()
		if err = cp.Copy(req.Msg.FromPath, req.Msg.ToPath); err != nil {
			if isStorageError, storageErr := handleStorageError(err, "move operation",
				fmt.Sprintf("%s to %s", req.Msg.FromPath, req.Msg.ToPath)); isStorageError {
				return nil, storageErr
			}
			logrus.Errorf("Cross-device copy failed: %v", err)
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		copyDone = true

		if err = os.RemoveAll(req.Msg.FromPath); err != nil {
			logrus.Warnf("Copy succeeded but failed to remove src %s: %v", req.Msg.FromPath, err)
			return nil, connect.NewError(connect.CodeInternal,
				fmt.Errorf("remove src failed after copy: %w", err))
		}
	}

	res := connect.NewResponse(&apiv1.MoveResponse{})

	return res, nil
}

// Upload 处理客户端流式上传
func (f *FileServer) Upload(ctx context.Context,
	stream *connect.ClientStream[apiv1.UploadRequest],
) (*connect.Response[apiv1.UploadResponse], error) {
	var file *os.File
	var totalWritten uint64 = 0
	var expectedWritten uint64 = 0
	var uploadFilePath string
	var currentChunkIdx *uint64
	var currentChunkOffset uint64
	var chunkedUpload bool
	var receivedMessages uint64
	var receivedChunks uint64

	closeUploadFile := func() error {
		if file == nil {
			return nil
		}
		fileToClose := file
		file = nil
		return fileToClose.Close()
	}
	defer func() {
		if err := closeUploadFile(); err != nil {
			logrus.Errorf("Failed to close file: %v", err)
		}
	}()

	// 步骤 1：循环接收客户端流中的消息，先接收 Info，再接收 Chunk
	for stream.Receive() {
		req := stream.Msg()
		receivedMessages++

		switch x := req.Message.(type) {
		case *apiv1.UploadRequest_Info_:
			// 步骤 1.1：处理上传元信息，区分普通上传与分片上传
			logrus.Debugf("Receive upload info message #%d, path=%s, chunked=%t", receivedMessages, x.Info.Path, x.Info.ChunkIdx != nil)
			// 步骤 1.1.1：检查目标路径父目录是否存在且可写
			_, err := os.Stat(filepath.Dir(x.Info.Path))
			if err != nil {
				if os.IsNotExist(err) {
					logrus.Errorf("The path %s to the file to be uploaded does not exist", filepath.Dir(x.Info.Path))
					return nil, connect.NewError(connect.CodeNotFound, err)
				} else if os.IsPermission(err) {
					logrus.Errorf("Insufficient permission to upload file to path %s", filepath.Dir(x.Info.Path))
					return nil, connect.NewError(connect.CodePermissionDenied, err)
				}

				logrus.Errorf("upload file to path %s error: %v", filepath.Dir(x.Info.Path), err)
				return nil, connect.NewError(connect.CodeInternal, err)
			}

			if x.Info.ChunkIdx != nil {
				// 步骤 1.1.2：分片上传场景，打开已存在的 .uploading 临时文件
				uploadFilePath = x.Info.Path
				if !strings.HasSuffix(uploadFilePath, ".uploading") {
					uploadFilePath = uploadFilePath + ".uploading"
				}
				file, err = os.OpenFile(uploadFilePath, os.O_RDWR, 0644)
				if err != nil {
					if os.IsNotExist(err) {
						logrus.Errorf("uploading file does not exist: %s", uploadFilePath)
						return nil, connect.NewError(connect.CodeNotFound, err)
					}
					logrus.Errorf("open file to path %s error: %v", uploadFilePath, err)
					return nil, connect.NewError(connect.CodeInternal, err)
				}
				currentChunkIdx = x.Info.ChunkIdx
				currentChunkOffset = 0
				chunkedUpload = true
				logrus.Debugf("Open chunked upload file success: path=%s, chunkIdx=%d", uploadFilePath, *currentChunkIdx)
			} else {
				// 步骤 1.1.3：普通上传场景，创建或截断目标文件
				uploadFilePath = x.Info.Path
				file, err = os.OpenFile(uploadFilePath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
				if err != nil {
					if os.IsNotExist(err) {
						logrus.Errorf("upload file path does not exist: %s", filepath.Dir(uploadFilePath))
						return nil, connect.NewError(connect.CodeNotFound, err)
					}
					logrus.Errorf("open file to path %s error: %v", uploadFilePath, err)
					return nil, connect.NewError(connect.CodeInternal, err)
				}
				chunkedUpload = false
				logrus.Debugf("Open normal upload file success: path=%s", uploadFilePath)
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
			receivedChunks++
			if receivedChunks == 1 || receivedChunks%128 == 0 {
				logrus.Debugf("Receive upload chunk progress: chunks=%d, totalWritten=%d, expectedWritten=%d, chunkedUpload=%t", receivedChunks, totalWritten, expectedWritten, chunkedUpload)
			}
			if chunkedUpload {
				// 步骤 1.2.1：分片上传，写入指定分片偏移并累积统计信息
				if currentChunkIdx == nil {
					return nil, connect.NewError(connect.CodeFailedPrecondition, errors.New("chunk idx not provided"))
				}
				chunkSize := uint64(len(x.Chunk))
				chunkIdx := *currentChunkIdx
				offsetWithin := int64(currentChunkOffset)
				n, err := fileUtils.WriteChunkData(file, uploadFilePath, chunkIdx, x.Chunk, offsetWithin, fileUtils.UploadingMetaSize)
				if err != nil {
					logrus.Errorf("write chunk data failed for %s at chunk %d offset %d: %v", uploadFilePath, chunkIdx, offsetWithin, err)
					if isStorageError, storageErr := handleStorageError(err, "file upload", uploadFilePath); isStorageError {
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
			} else {
				// 步骤 1.2.2：普通上传，顺序写入文件内容并累积统计信息
				chunkSize := uint64(len(x.Chunk))
				n, err := file.Write(x.Chunk)
				if err != nil {
					logrus.Errorf("write file chunk failed for %s: %v", uploadFilePath, err)
					if isStorageError, storageErr := handleStorageError(err, "file upload", uploadFilePath); isStorageError {
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
		logrus.Errorf("Unknown error sent while uploading file: %v, path=%s, chunked=%t, receivedMessages=%d, receivedChunks=%d, expectedWritten=%d, totalWritten=%d", err, uploadFilePath, chunkedUpload, receivedMessages, receivedChunks, expectedWritten, totalWritten)
		if uploadFilePath != "" && !chunkedUpload {
			if removeErr := os.Remove(uploadFilePath); removeErr != nil && !os.IsNotExist(removeErr) {
				logrus.Warnf("Failed to remove partial upload file %s: %v", uploadFilePath, removeErr)
			}
		}
		if uploadFilePath != "" && chunkedUpload {
			fileUtils.ScheduleFullHash(uploadFilePath, 0)
		}
		return nil, connect.NewError(connect.CodeUnknown, err)
	}

	if file == nil {
		logrus.Errorf("no file info provided before upload stream ended")
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("no file info provided"))
	}

	// 步骤 3：在分片模式下，为最后一个分片刷新位图与哨兵元数据
	if uploadFilePath != "" && chunkedUpload && currentChunkIdx != nil {
		if err := fileUtils.UpdateChunkMeta(file, uploadFilePath, *currentChunkIdx, int64(currentChunkOffset), fileUtils.UploadingMetaSize); err != nil {
			logrus.Errorf("update chunk metadata failed for %s at chunk %d, bytes %d: %v", uploadFilePath, *currentChunkIdx, currentChunkOffset, err)
			if isStorageError, storageErr := handleStorageError(err, "file upload", uploadFilePath); isStorageError {
				return nil, storageErr
			}
			return nil, connect.NewError(connect.CodeInternal, err)
		}
	}

	// 步骤 4：读取实际文件大小并与写入统计值进行对比
	var actualFileSize uint64
	if uploadFilePath != "" {
		fileInfo, err := os.Stat(uploadFilePath)
		if err != nil {
			logrus.Errorf("Failed to get file info after upload: %v", err)
			if !chunkedUpload {
				if removeErr := os.Remove(uploadFilePath); removeErr != nil && !os.IsNotExist(removeErr) {
					logrus.Warnf("Failed to remove partial upload file %s: %v", uploadFilePath, removeErr)
				}
			}
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		actualFileSize = uint64(fileInfo.Size())
	}

	// 步骤 5：关闭文件句柄，并在分片模式下调度后台计算全量哈希
	uploadedFileName := file.Name()
	if err := closeUploadFile(); err != nil {
		if isStorageError, storageErr := handleStorageError(err, "file upload", uploadFilePath); isStorageError {
			return nil, storageErr
		}

		logrus.Errorf("file close failed: %v", err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if uploadFilePath != "" && chunkedUpload {
		fileUtils.ScheduleFullHash(uploadFilePath, fileUtils.FullHashIdleDelay)
	}

	logrus.Debugf("Upload stream finished: path=%s, chunked=%t, receivedMessages=%d, receivedChunks=%d, expectedWritten=%d, totalWritten=%d, actualFileSize=%d", uploadFilePath, chunkedUpload, receivedMessages, receivedChunks, expectedWritten, totalWritten, actualFileSize)
	logrus.Infof("upload file %s successfull, expected bytes %d, written bytes %d, file size %d", uploadedFileName, expectedWritten, totalWritten, actualFileSize)
	// 步骤 6：返回写入字节统计信息给客户端
	res := connect.NewResponse(&apiv1.UploadResponse{
		WrittenBytes: totalWritten,
	})

	return res, nil
}

func (f *FileServer) Download(ctx context.Context,
	req *connect.Request[apiv1.DownloadRequest],
	stream *connect.ServerStream[apiv1.DownloadResponse],
) error {

	// 验证limit参数, 不传LimitBytes时，LimitBytes为nil
	if req.Msg.LimitBytes != nil && *req.Msg.LimitBytes <= 0 {
		logrus.Errorf("Invalid limit %d, must be > 0", *req.Msg.LimitBytes)
		return connect.NewError(connect.CodeInvalidArgument, errors.New("INVALID_LIMIT"))
	}

	// 验证offset和limit参数
	offsetBytes := req.Msg.GetOffsetBytes()
	limitBytes := req.Msg.GetLimitBytes()

	// 检查并打开请求的文件
	fileInfo, err := os.Stat(req.Msg.Path)
	if err != nil {
		if os.IsNotExist(err) {
			logrus.Errorf("The path %s to be downloaded does not exist", req.Msg.Path)
			return connect.NewError(connect.CodeNotFound, err)
		} else if os.IsPermission(err) {
			logrus.Errorf("Insufficient permission to download file %s", req.Msg.Path)
			return connect.NewError(connect.CodePermissionDenied, err)
		}
		logrus.Errorf("download file %s error", req.Msg.Path)
		return connect.NewError(connect.CodeInternal, err)
	}
	if fileInfo.IsDir() {
		logrus.Errorf("The path %s is a dir not a file", req.Msg.Path)
		return connect.NewError(connect.CodeInvalidArgument, errors.New("NOT_A_FILE"))
	}

	// 检查offset是否超过文件大小
	fileSize := fileInfo.Size()
	if offsetBytes > uint64(fileSize) {
		logrus.Errorf("Offset %d exceeds file size %d for file %s", offsetBytes, fileSize, req.Msg.Path)
		return connect.NewError(connect.CodeInvalidArgument, errors.New("OFFSET_EXCEEDS_FILE_SIZE"))
	}

	file, err := os.Open(req.Msg.Path)
	if err != nil {
		logrus.Errorf("Open path %s failed", req.Msg.Path)
		return connect.NewError(connect.CodeNotFound, err)
	}
	defer func() {
		if err := file.Close(); err != nil {
			logrus.Errorf("Failed to close file: %v", err)
		}
	}()

	// 处理offset参数，定位到指定位置
	if offsetBytes > 0 {
		if _, err := file.Seek(int64(offsetBytes), 0); err != nil {
			logrus.Errorf("Failed to seek to offset %d in file %s: %v", offsetBytes, req.Msg.Path, err)
			return connect.NewError(connect.CodeInternal, err)
		}
	}

	// 计算需要读取的字节数
	var reader io.Reader = file
	if limitBytes > 0 {
		reader = io.LimitReader(file, int64(limitBytes))
	}

	r, w := io.Pipe()

	// 启动 Goroutine 读取文件并写入到管道中
	go func() {
		defer w.Close()
		if _, err := io.Copy(w, reader); err != nil {
			logrus.Errorf("Error copying file to pipe: %v", err)
		}
	}()

	buf := make([]byte, req.Msg.ChunkSizeByte)
	for {
		global_child.SetLastRequestTime(time.Now())
		n, err := r.Read(buf)
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
			logrus.Errorf("Error sending chunk of data: %v", err)
			return connect.NewError(connect.CodeInternal, err)
		}
	}

	if offsetBytes > 0 || limitBytes > 0 {
		logrus.Infof("Download of file %s completed successfully (offset: %d, limit: %d)", req.Msg.Path, offsetBytes, limitBytes)
	} else {
		logrus.Infof("Download of file %s completed successfully", req.Msg.Path)
	}
	return nil
}

func (f *FileServer) CompressAndDownload(ctx context.Context,
	req *connect.Request[apiv1.CompressAndDownloadRequest],
	stream *connect.ServerStream[apiv1.CompressAndDownloadResponse],
) error {
	// 检查请求的文件
	for _, resourcePath := range req.Msg.Paths {
		resourceInfo, err := os.Stat(resourcePath)
		if err != nil {
			if os.IsNotExist(err) {
				logrus.Errorf("The path %s to be downloaded does not exist", resourceInfo)
				return connect.NewError(connect.CodeNotFound, err)
			} else if os.IsPermission(err) {
				logrus.Errorf("Insufficient permission to download file %s", resourceInfo)
				return connect.NewError(connect.CodePermissionDenied, err)
			}
			logrus.Errorf("download file %s error", resourceInfo)
			return connect.NewError(connect.CodeInternal, err)
		}
	}

	// 创建 pipe，用于边压缩边读写
	pr, pw := io.Pipe()

	// 创建一个子上下文，用于管理压缩过程的取消
	zipCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	// 启动一个 goroutine 进行压缩
	go func() {
		// 执行压缩；如果发生错误，通过 CloseWithError 关闭管道并传递错误
		err := fileUtils.ZipPathsOnTheFly(zipCtx, req.Msg.Paths, pw, 9)
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

func (f *FileServer) InitMultipartUpload(
	ctx context.Context,
	req *connect.Request[apiv1.InitMultipartUploadRequest],
) (*connect.Response[apiv1.InitMultipartUploadResponse], error) {
	// 步骤 1：校验用户信息与上传目标路径（目录存在性与最终文件不存在性）
	currentUser, err := auth.Lookup(req.Msg.UserId)
	if err != nil {
		logrus.Errorf("Get home directory error")
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	userHomeDir := currentUser.HomeDir
	_ = userHomeDir

	uploadingFilePath := filepath.Join(req.Msg.Path, req.Msg.Name+".uploading")
	dirInfo, err := os.Stat(req.Msg.Path)
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

	outputFilePath := filepath.Join(req.Msg.Path, req.Msg.Name)
	if _, err := os.Stat(outputFilePath); err == nil {
		return nil, connect.NewError(connect.CodeAlreadyExists, fmt.Errorf("file %s already exists", outputFilePath))
	} else if os.IsPermission(err) {
		return nil, connect.NewError(connect.CodePermissionDenied, err)
	} else if !os.IsNotExist(err) {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	chunkSizeByte := config.GetChunkSizeByte()
	fileSizeByte := req.Msg.FileSizeByte
	// 位图大小由分片数量决定，位图放在内容区后、元数据区前
	bitsetSize := fileUtils.GetBitsetSize(fileSizeByte, uint64(chunkSizeByte))
	fileSizeWithMeta := int64(fileSizeByte) + bitsetSize + fileUtils.UploadingMetaSize

	modificationTimeResp := req.Msg.ModificationTime
	var uploadedIndices []uint64

	// 步骤 2：获取 uploading 文件锁，保证同一上传文件的操作串行
	lock := fileUtils.GetUploadingLock(uploadingFilePath)
	lock.Lock()
	defer lock.Unlock()

	// needRecreate 为 true 时表示需要创建全新的 .uploading 文件
	needRecreate := false

	// 步骤 3：如已存在 .uploading 文件则进行校验与续传判断
	if stat, err := os.Stat(uploadingFilePath); err == nil {
		file, err := os.OpenFile(uploadingFilePath, os.O_RDWR, 0644)
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
			if removeErr := os.Remove(uploadingFilePath); removeErr != nil && !os.IsNotExist(removeErr) {
				logrus.Warnf("Failed to remove corrupted uploading file %s: %v", uploadingFilePath, removeErr)
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
						if removeErr := os.Remove(uploadingFilePath); removeErr != nil && !os.IsNotExist(removeErr) {
							logrus.Warnf("Failed to remove corrupted uploading file %s: %v", uploadingFilePath, removeErr)
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
							if removeErr := os.Remove(uploadingFilePath); removeErr != nil && !os.IsNotExist(removeErr) {
								logrus.Warnf("Failed to remove corrupted uploading file %s: %v", uploadingFilePath, removeErr)
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
						if removeErr := os.Remove(uploadingFilePath); removeErr != nil && !os.IsNotExist(removeErr) {
							logrus.Warnf("Failed to remove corrupted uploading file %s: %v", uploadingFilePath, removeErr)
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
		file, err := os.OpenFile(uploadingFilePath, os.O_CREATE|os.O_RDWR, 0644)
		if err != nil {
			if isStorageError, storageErr := handleStorageError(err, "create uploading file", uploadingFilePath); isStorageError {
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
			if isStorageError, storageErr := handleStorageError(err, "preallocate uploading file", uploadingFilePath); isStorageError {
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
			if isStorageError, storageErr := handleStorageError(err, "write uploading metadata", uploadingFilePath); isStorageError {
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

func (f *FileServer) CompleteMultipartUpload(
	ctx context.Context,
	req *connect.Request[apiv1.CompleteMultipartUploadRequest],
) (*connect.Response[apiv1.CompleteMultipartUploadResponse], error) {
	// 步骤 1：校验用户信息与上传目标路径（目录存在性与合法性）
	currentUser, err := auth.Lookup(req.Msg.UserId)
	if err != nil {
		logrus.Errorf("Get home directory error")
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	homeDir := currentUser.HomeDir
	_ = homeDir

	uploadingFilePath := filepath.Join(req.Msg.Path, req.Msg.Name+".uploading")
	outputFilePath := filepath.Join(req.Msg.Path, req.Msg.Name)

	dirInfo, err := os.Stat(req.Msg.Path)
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

	// 步骤 2：获取 uploading 文件锁，防止并发修改上传状态
	lock := fileUtils.GetUploadingLock(uploadingFilePath)
	lock.Lock()
	defer lock.Unlock()

	file, err := os.OpenFile(uploadingFilePath, os.O_RDWR, 0644)
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
		// 步骤 3：元数据区缺失，删除异常的 .uploading 文件并返回错误
		_ = file.Close()
		if removeErr := os.Remove(uploadingFilePath); removeErr != nil && !os.IsNotExist(removeErr) {
			logrus.Warnf("Failed to remove invalid uploading file %s: %v", uploadingFilePath, removeErr)
		}
		return nil, connect.NewError(connect.CodeFailedPrecondition, errors.New("uploading metadata missing"))
	}

	meta, err := fileUtils.ReadUploadingMeta(file, stat.Size(), fileUtils.UploadingMetaSize)
	if err != nil || meta == nil {
		_ = file.Close()
		if removeErr := os.Remove(uploadingFilePath); removeErr != nil && !os.IsNotExist(removeErr) {
			logrus.Warnf("Failed to remove invalid uploading file %s: %v", uploadingFilePath, removeErr)
		}
		return nil, connect.NewError(connect.CodeFailedPrecondition, errors.New("uploading metadata invalid"))
	}
	if meta.ChunkSizeByte == 0 {
		// 步骤 3.1：元数据不完整（缺少分片大小），删除异常文件
		_ = file.Close()
		if removeErr := os.Remove(uploadingFilePath); removeErr != nil && !os.IsNotExist(removeErr) {
			logrus.Warnf("Failed to remove invalid uploading file %s: %v", uploadingFilePath, removeErr)
		}
		return nil, connect.NewError(connect.CodeFailedPrecondition, errors.New("chunk size missing in metadata"))
	}

	totalChunks := fileUtils.CalculateChunks(meta.FileSize, meta.ChunkSizeByte)
	bitset, err := fileUtils.ReadChunkBitsetAt(file, int64(meta.FileSize), totalChunks)
	if err != nil {
		// 步骤 3.2：读取位图失败，删除异常文件
		_ = file.Close()
		if removeErr := os.Remove(uploadingFilePath); removeErr != nil && !os.IsNotExist(removeErr) {
			logrus.Warnf("Failed to remove invalid uploading file %s: %v", uploadingFilePath, removeErr)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	complete := true
	if totalChunks > 0 {
		// 步骤 4：遍历位图，确认所有分片均已上传
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
		return nil, connect.NewError(connect.CodeFailedPrecondition, errors.New("upload not complete"))
	}

	if err := file.Truncate(int64(meta.FileSize)); err != nil {
		_ = file.Close()
		if isStorageError, storageErr := handleStorageError(err, "truncate uploading file", uploadingFilePath); isStorageError {
			return nil, storageErr
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	if err := file.Close(); err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	if err := os.Rename(uploadingFilePath, outputFilePath); err != nil {
		if isStorageError, storageErr := handleStorageError(err, "rename uploading file", outputFilePath); isStorageError {
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
