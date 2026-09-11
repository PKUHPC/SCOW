package file

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"math"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/sirupsen/logrus"
	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/transform"
)

type FileExtension string

const (
	ExtensionZip   FileExtension = ".zip"
	ExtensionTar   FileExtension = ".tar"
	ExtensionTarGz FileExtension = ".tar.gz"
	ExtensionGz    FileExtension = ".gz"
	ExtensionTgz   FileExtension = ".tgz"
)

const (
	defaultBufferSize      = 64 * 1024        // 64KB
	largeFileSizeThreshold = 1024 * 1024 * 10 // 10MB
)

const (
	// 默认的首选权限失败时的文件降级回退权限，0644
	defaultFallbackFileMode = 0644
	// 默认的首选权限失败时的文件夹回退权限，0755
	defaultFallbackDirMode = 0755
)

// isSafePath 验证 targetPath 是否严格在 destDir 范围内
func isSafePath(destDir, targetPath string) bool {
	cleanDest := filepath.Clean(destDir)
	cleanTarget := filepath.Clean(targetPath)
	return strings.HasPrefix(cleanTarget, cleanDest+string(os.PathSeparator)) ||
		cleanTarget == cleanDest
}

func Unzip(ctx context.Context, file *os.File, destDir string) error {

	logrus.Infof("Unzip: %s to %s", file.Name(), destDir)
	// 打开 zip 文件
	stat, err := file.Stat()
	if err != nil {
		return fmt.Errorf("failed to stat zip file: %w", err)
	}
	reader, err := zip.NewReader(file, stat.Size())
	if err != nil {
		return fmt.Errorf("failed to create zip reader: %w", err)
	}

	// 参考 linux 解压缩 zip 的方法
	// 分离"目录"和"文件"条目，预先创建出所有目录
	var files []*zip.File

	// 遍历解压的所有条目，预先创建"目录"
	for _, f := range reader.File {
		// 检查上下文是否已取消
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			// 继续执行
		}

		if f.FileInfo().IsDir() {
			err := extractZipFile(ctx, f, destDir, true)
			if err != nil {
				return fmt.Errorf("failed to extract directory in zip file: %w", err)
			}
		} else {
			files = append(files, f)
		}
	}

	// 遍历所有文件条目，创建"文件"
	for _, f := range files {
		// 检查上下文是否已取消
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			// 继续执行
		}

		if !f.FileInfo().IsDir() {
			err := extractZipFile(ctx, f, destDir, false)
			if err != nil {
				return fmt.Errorf("failed to extract directory in zip file: %w", err)
			}
		}
	}

	return nil
}

func extractZipFile(ctx context.Context, f *zip.File, destDir string, isDir bool) error {

	// 转换文件名编码
	fileName, err := ConvertFileNameEncoding(f.Name)
	if err != nil {
		return fmt.Errorf("failed to convert fileName %s encoding from ivalid utf-8: %w", fileName, err)
	}
	filePath := filepath.Join(destDir, fileName)

	// 检查路径安全性
	if !isSafePath(destDir, filePath) {
		return fmt.Errorf("illegal file path %s", filePath)
	}

	if isDir {
		// 创建目录
		if err := makeDirWithPermissionFallback(filePath, f.Mode()); err != nil {
			return fmt.Errorf("failed to create directory %s : %w", fileName, err)
		}

		// 设置修改时间
		if err := setFileModificationTime(filePath, f.Modified); err != nil {
			logrus.Warnf("Failed to set mtime for file %s: %v", filePath, err)
		}
		return nil

	} else {

		// 对于文件，再次确保其父目录存在，确保特殊的 zip 文件无法解析目录层时也可以正常解压
		fileDirPath := filepath.Dir(filePath)
		_, err := os.Stat(fileDirPath)
		if os.IsNotExist(err) {
			if err := makeDirWithPermissionFallback(fileDirPath, defaultFallbackDirMode); err != nil {
				return fmt.Errorf("failed to create parent folder of file: %w", err)
			}
		}

		// 创建文件
		destFile, err := openFileWithPermissionFallback(filePath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			return fmt.Errorf("failed to create file %s : %w", filePath, err)
		}
		defer func() {
			if err := destFile.Close(); err != nil {
				logrus.Errorf("Failed to close destination file: %v", err)
			}
		}()

		// 解压文件内容
		srcFile, err := f.Open()
		if err != nil {
			return fmt.Errorf("failed to open zip file content: %w", err)
		}
		defer func() {
			if err := srcFile.Close(); err != nil {
				logrus.Errorf("Failed to close source file: %v", err)
			}
		}()

		size := safeUint64ToInt64(f.UncompressedSize64)
		if err := adaptiveCopyWithContext(ctx, destFile, srcFile, size); err != nil {
			return fmt.Errorf("failed to copy zip file content: %w", err)
		}
		// 设置修改时间
		if err := setFileModificationTime(filePath, f.Modified); err != nil {
			logrus.Warnf("Failed to set mtime for file %s: %v", filePath, err)
		}
		return nil

	}

}

// Untar 解压 .tar 文件
func Untar(ctx context.Context, file *os.File, destDir string) error {
	logrus.Infof("Untar: %s to %s", file.Name(), destDir)
	reader := tar.NewReader(file)
	return extractTar(ctx, reader, destDir)
}

// Ungzip 解压 .gz 文件
func Ungzip(ctx context.Context, file *os.File, destDir string) error {
	logrus.Infof("Ungzip: %s to %s", file.Name(), destDir)
	gzipReader, err := gzip.NewReader(file)
	if err != nil {
		return fmt.Errorf("failed to create gzip reader: %w", err)
	}
	defer func() { _ = gzipReader.Close() }()

	fileInfo, err := file.Stat()
	if err != nil {
		return fmt.Errorf("failed to stat gzip file: %w", err)
	}

	// 解压 gzip 文件，通常 gzip 文件只包含一个文件
	outFilePath := filepath.Join(destDir, strings.TrimSuffix(filepath.Base(file.Name()), ".gz"))
	outFile, err := openFileWithPermissionFallback(outFilePath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, fileInfo.Mode())
	if err != nil {
		return err
	}
	defer func() { _ = outFile.Close() }()

	if err := adaptiveCopyWithContext(ctx, outFile, gzipReader, -1); err != nil {
		return fmt.Errorf("failed to copy gzip file content: %w", err)
	}

	// 获取原始修改时间
	var modTime time.Time
	if !gzipReader.Header.ModTime.IsZero() {
		// 优先使用gzip头部中的修改时间
		modTime = gzipReader.Header.ModTime
	} else {
		// 如果gzip头部没有修改时间，则使用压缩文件的修改时间
		modTime = fileInfo.ModTime()
	}

	// 设置解压后文件的修改时间
	if err := setFileModificationTime(outFilePath, modTime); err != nil {
		logrus.Warnf("Failed to set mtime for file %s: %v", outFilePath, err)
	}
	return nil
}

// Untargz 解压 .tar.gz 或 .tgz 文件
func Untargz(ctx context.Context, file *os.File, destDir string) error {
	logrus.Infof("Untargz: %s to %s", file.Name(), destDir)
	gzipReader, err := gzip.NewReader(file)
	if err != nil {
		return fmt.Errorf("failed to create gzip reader: %w", err)
	}
	defer func() { _ = gzipReader.Close() }()

	tarReader := tar.NewReader(gzipReader)
	return extractTar(ctx, tarReader, destDir)
}

// 解压 tar 文件内容
func extractTar(ctx context.Context, reader *tar.Reader, destDir string) error {

	for {
		// 检查上下文是否已取消
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			// 继续执行
		}

		header, err := reader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("failed to read tar header: %w", err)
		}

		// 转换文件名编码
		fileName, err := ConvertFileNameEncoding(header.Name)
		if err != nil {
			return fmt.Errorf("failed to convert fileName %s encoding from ivalid utf-8: %w", fileName, err)
		}
		// 构造目标路径
		targetPath := filepath.Join(destDir, fileName)

		// 检查路径安全性
		if !isSafePath(destDir, targetPath) {
			return fmt.Errorf("illegal file path: %s", targetPath)
		}

		switch header.Typeflag {
		case tar.TypeDir:
			// 创建目录
			if err := makeDirWithPermissionFallback(targetPath, os.FileMode(header.Mode)); err != nil {
				return fmt.Errorf("failed to create file %s : %w", targetPath, err)
			}
			if err := setFileModificationTime(targetPath, header.ModTime); err != nil {
				logrus.Warnf("Failed to set mtime for dir %s: %v", targetPath, err)
			}
		case tar.TypeReg:
			// 创建文件

			// 再次确保其父目录存在，确保如果出现特殊的 tar 文件无法解析目录层时也可以正常解压
			fileDirPath := filepath.Dir(targetPath)
			_, err := os.Stat(fileDirPath)
			if os.IsNotExist(err) {
				if err := makeDirWithPermissionFallback(fileDirPath, defaultFallbackDirMode); err != nil {
					return fmt.Errorf("failed to create parent folder of file: %w", err)
				}
			}

			outFile, err := openFileWithPermissionFallback(targetPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, os.FileMode(header.Mode))
			if err != nil {
				return err
			}

			// 写入文件内容
			err = adaptiveCopyWithContext(ctx, outFile, reader, header.Size)
			// 立即关闭，不使用defer
			_ = outFile.Close()
			if err != nil {
				return fmt.Errorf("failed to write file content: %w", err)
			}
			if err := setFileModificationTime(targetPath, header.ModTime); err != nil {
				logrus.Warnf("Failed to set mtime for file %s: %v", targetPath, err)
			}
		case tar.TypeSymlink:
			if err := os.Symlink(header.Linkname, targetPath); err != nil && !os.IsExist(err) {
				return fmt.Errorf("failed to create symlink %s: %w", targetPath, err)
			}
			// 对于符号链接不设置 mtime
			logrus.Debugf("Skipping mtime for symlink %s", targetPath)
		default:
			// 跳过其他类型（硬链接、设备文件等），记录日志
			logrus.Warnf("Skipping unsupported tar entry type %d: %s", header.Typeflag, header.Name)
		}
	}
	return nil
}

// 根据文件大小自适应选择复制策略
func adaptiveCopyWithContext(ctx context.Context, dst io.Writer, src io.Reader, size int64) error {

	if size >= 0 && size < largeFileSizeThreshold {
		// 小文件直接使用io.Copy
		_, err := io.Copy(dst, src)
		if err != nil {
			return fmt.Errorf("failed to copy file : %w", err)
		}
		return nil
	}

	// 大文件或未知大小的文件使用缓冲区
	buf := make([]byte, defaultBufferSize)

	// 使用自定义的读取器包装源读取器，以便检查上下文
	ctxReader := &contextReader{
		ctx:    ctx,
		reader: src,
		// 每 1MB 数据检查一次上下文
		checkThreshold: 1024 * 1024,
	}

	_, err := io.CopyBuffer(dst, ctxReader, buf)
	if err != nil {
		return fmt.Errorf("failed to copy big size file with context: %w", err)
	}
	return nil

}

// 安全地将 uint64 转换为 int64
func safeUint64ToInt64(size uint64) int64 {
	if size > math.MaxInt64 {
		// 使用 -1 表示超大文件或未知大小
		return -1
	}
	return int64(size)
}

type contextReader struct {
	ctx            context.Context
	reader         io.Reader
	bytesRead      int64
	checkThreshold int64
}

func (r *contextReader) Read(p []byte) (n int, err error) {
	if r.bytesRead >= r.checkThreshold {
		select {
		case <-r.ctx.Done():
			return 0, r.ctx.Err()
		default:
			// 继续执行
		}
		r.bytesRead = 0
	}

	n, err = r.reader.Read(p)
	r.bytesRead += int64(n)
	return
}

// ConvertFileNameEncoding 转换非UTF-8编码的文件名为UTF-8编码
// 如果文件名已经是有效的UTF-8，则直接返回原文件名
// 否则尝试从GBK转换为UTF-8
func ConvertFileNameEncoding(fileName string) (string, error) {

	if utf8.ValidString(fileName) {
		return fileName, nil
	}

	// 尝试从GBK转换到UTF-8
	utf8Name, err := GBKToUTF8([]byte(fileName))
	if err != nil {
		return fileName, err
	}

	return string(utf8Name), nil
}

// GBKToUTF8 将GBK编码的字节转换为UTF-8
func GBKToUTF8(s []byte) ([]byte, error) {
	reader := transform.NewReader(bytes.NewReader(s), simplifiedchinese.GBK.NewDecoder())
	d, err := io.ReadAll(reader)
	if err != nil {
		return nil, err
	}
	return d, nil
}

func setFileModificationTime(filePath string, modTime time.Time) error {
	if err := os.Chtimes(filePath, modTime, modTime); err != nil {
		return fmt.Errorf("failed to set modification time for %s: %w", filePath, err)
	}
	return nil
}

func openFileWithPermissionFallback(path string, flag int, originalMode os.FileMode) (*os.File, error) {

	// 确保文件模式至少有基本的读写权限 (644 = rw-r--r--)
	minFileMode := os.FileMode(defaultFallbackFileMode)

	// 合并权限，确保至少有基本的读写权限
	effectiveMode := originalMode | minFileMode

	if effectiveMode != originalMode {
		logrus.Warnf("Adjusting file mode from %s to %#o to ensure minimum permissions",
			originalMode, effectiveMode)
	}

	file, err := os.OpenFile(path, flag, effectiveMode)
	if err == nil {
		return file, nil
	}

	// 其他错误
	return nil, fmt.Errorf("failed to create output file: %w", err)
}

func makeDirWithPermissionFallback(path string, originalMode os.FileMode) error {

	//  确保目录权限至少有基本执行权限与读取权限
	minDirMode := os.FileMode(defaultFallbackDirMode)
	// 合并原始权限与最小权限，获得有效权限
	effectiveMode := originalMode | minDirMode

	if effectiveMode != originalMode {
		logrus.Warnf("Adjusting directory mode from %s to %#o to ensure minimum permissions",
			originalMode, effectiveMode)
	}

	// 尝试使用原始权限创建目录
	err := os.MkdirAll(path, effectiveMode)
	if err == nil {
		return nil
	}

	// 其他错误
	return fmt.Errorf("failed to create directory: %w", err)
}

// validatePathWithinRoot 验证路径是否在root限制内
func validatePathWithinRoot(root *os.Root, path string) error {
	// 使用 root.Stat 来验证路径是否在 root 限制范围内
	// 如果路径超出 root 限制，os.Root 会返回错误
	_, err := root.Stat(path)
	if err != nil {
		// 如果是因为文件不存在，我们需要检查父目录
		if os.IsNotExist(err) {
			// 检查父目录是否在 root 范围内
			parentDir := filepath.Dir(path)
			if parentDir != "." && parentDir != path {
				return validatePathWithinRoot(root, parentDir)
			}
			// 如果到达根目录，说明路径是有效的
			return nil
		}
		// 其他错误可能表示路径超出限制或权限问题
		return err
	}
	return nil
}

// convertToRelativePath 将绝对路径转换为相对于root的相对路径
func convertToRelativePath(root *os.Root, absolutePath string) (string, error) {
	// 获取root的根路径
	rootPath := root.Name()

	// 将绝对路径转换为相对于root路径的相对路径
	relativePath, err := filepath.Rel(rootPath, absolutePath)
	if err != nil {
		return "", fmt.Errorf("failed to get relative path for %s relative to %s: %w", absolutePath, rootPath, err)
	}

	// 检查路径是否试图访问root之外的内容
	if strings.HasPrefix(relativePath, "..") {
		return "", fmt.Errorf("path %s is outside root directory %s", absolutePath, rootPath)
	}

	return relativePath, nil
}

// UnzipWithRoot 解压ZIP文件，确保所有解压的文件路径都在root限制内
func UnzipWithRoot(ctx context.Context, file *os.File, destDir string, root *os.Root) error {
	logrus.Infof("Unzip with root: %s to %s", file.Name(), destDir)
	// 打开 zip 文件
	stat, err := file.Stat()
	if err != nil {
		return fmt.Errorf("failed to stat zip file: %w", err)
	}
	reader, err := zip.NewReader(file, stat.Size())
	if err != nil {
		return fmt.Errorf("failed to create zip reader: %w", err)
	}

	// 分离"目录"和"文件"条目，预先创建出所有目录
	var files []*zip.File

	// 遍历解压的所有条目，预先创建"目录"
	for _, f := range reader.File {
		// 检查上下文是否已取消
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			// 继续执行
		}

		if f.FileInfo().IsDir() {
			err := extractZipFileWithRoot(ctx, f, destDir, true, root)
			if err != nil {
				return fmt.Errorf("failed to extract directory in zip file: %w", err)
			}
		} else {
			files = append(files, f)
		}
	}

	// 遍历所有文件条目，创建"文件"
	for _, f := range files {
		// 检查上下文是否已取消
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			// 继续执行
		}

		if !f.FileInfo().IsDir() {
			err := extractZipFileWithRoot(ctx, f, destDir, false, root)
			if err != nil {
				return fmt.Errorf("failed to extract file in zip file: %w", err)
			}
		}
	}

	return nil
}

// extractZipFileWithRoot 解压单个ZIP文件条目，确保路径在root限制内
func extractZipFileWithRoot(ctx context.Context, f *zip.File, destDir string, isDir bool, root *os.Root) error {
	// 转换文件名编码
	fileName, err := ConvertFileNameEncoding(f.Name)
	if err != nil {
		return fmt.Errorf("failed to convert fileName %s encoding from invalid utf-8: %w", fileName, err)
	}
	filePath := filepath.Join(destDir, fileName)

	// 检查路径安全性
	if !isSafePath(destDir, filePath) {
		return fmt.Errorf("illegal file path %s", filePath)
	}

	// 将绝对路径转换为相对路径
	relativePath, err := convertToRelativePath(root, filePath)
	if err != nil {
		return fmt.Errorf("failed to convert path to relative: %w", err)
	}

	// 检查相对路径是否在root限制内
	if err := validatePathWithinRoot(root, relativePath); err != nil {
		logrus.Errorf("Extract path %s is outside root or permission denied", relativePath)
		return fmt.Errorf("extract path %s is outside allowed root directory or permission denied", relativePath)
	}

	if isDir {
		// 创建目录
		if err := makeDirWithPermissionFallback(filePath, f.Mode()); err != nil {
			return fmt.Errorf("failed to create directory %s : %w", fileName, err)
		}
		// 设置修改时间
		if err := setFileModificationTime(filePath, f.Modified); err != nil {
			logrus.Warnf("Failed to set mtime for file %s: %v", filePath, err)
		}
		return nil
	} else {
		// 对于文件，再次确保其父目录存在
		fileDirPath := filepath.Dir(filePath)
		_, err := os.Stat(fileDirPath)
		if os.IsNotExist(err) {
			if err := makeDirWithPermissionFallback(fileDirPath, defaultFallbackDirMode); err != nil {
				return fmt.Errorf("failed to create parent folder of file: %w", err)
			}
		}

		// 创建文件
		destFile, err := openFileWithPermissionFallback(filePath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			return fmt.Errorf("failed to create file %s : %w", filePath, err)
		}
		defer func() { _ = destFile.Close() }()

		// 解压文件内容
		srcFile, err := f.Open()
		if err != nil {
			return fmt.Errorf("failed to open zip file content: %w", err)
		}
		defer func() { _ = srcFile.Close() }()

		size := safeUint64ToInt64(f.UncompressedSize64)
		if err := adaptiveCopyWithContext(ctx, destFile, srcFile, size); err != nil {
			return fmt.Errorf("failed to copy zip file content: %w", err)
		}
		// 设置修改时间
		if err := setFileModificationTime(filePath, f.Modified); err != nil {
			logrus.Warnf("Failed to set mtime for file %s: %v", filePath, err)
		}
		return nil
	}
}

// UntarWithRoot 解压TAR文件，确保所有解压的文件路径都在root限制内
func UntarWithRoot(ctx context.Context, file *os.File, destDir string, root *os.Root) error {
	logrus.Infof("Untar with root: %s to %s", file.Name(), destDir)
	reader := tar.NewReader(file)
	return extractTarWithRoot(ctx, reader, destDir, root)
}

// UntargzWithRoot 解压TAR.GZ文件，确保所有解压的文件路径都在root限制内
func UntargzWithRoot(ctx context.Context, file *os.File, destDir string, root *os.Root) error {
	logrus.Infof("Untargz with root: %s to %s", file.Name(), destDir)
	gzipReader, err := gzip.NewReader(file)
	if err != nil {
		return fmt.Errorf("failed to create gzip reader: %w", err)
	}
	defer func() { _ = gzipReader.Close() }()

	tarReader := tar.NewReader(gzipReader)
	return extractTarWithRoot(ctx, tarReader, destDir, root)
}

// extractTarWithRoot 解压TAR文件内容，确保路径在root限制内
func extractTarWithRoot(ctx context.Context, reader *tar.Reader, destDir string, root *os.Root) error {
	for {
		// 检查上下文是否已取消
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			// 继续执行
		}

		header, err := reader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("failed to read tar header: %w", err)
		}

		// 转换文件名编码
		fileName, err := ConvertFileNameEncoding(header.Name)
		if err != nil {
			return fmt.Errorf("failed to convert fileName %s encoding from invalid utf-8: %w", fileName, err)
		}
		// 构造目标路径
		targetPath := filepath.Join(destDir, fileName)

		// 检查路径安全性
		if !isSafePath(destDir, targetPath) {
			return fmt.Errorf("illegal file path: %s", targetPath)
		}

		// 将绝对路径转换为相对路径
		relativePath, err := convertToRelativePath(root, targetPath)
		if err != nil {
			return fmt.Errorf("failed to convert to relative path: %w", err)
		}

		// 检查相对路径是否在root限制内
		if err := validatePathWithinRoot(root, relativePath); err != nil {
			logrus.Errorf("Extract path %s is outside root or permission denied", relativePath)
			return fmt.Errorf("extract path %s is outside allowed root directory or permission denied", relativePath)
		}

		switch header.Typeflag {
		case tar.TypeDir:
			// 创建目录
			if err := makeDirWithPermissionFallback(targetPath, os.FileMode(header.Mode)); err != nil {
				return fmt.Errorf("failed to create directory %s : %w", targetPath, err)
			}
			if err := setFileModificationTime(targetPath, header.ModTime); err != nil {
				logrus.Warnf("Failed to set modification time for directory %s: %v", targetPath, err)
			}
		case tar.TypeReg:
			// 创建文件
			// 再次确保其父目录存在
			fileDirPath := filepath.Dir(targetPath)
			_, err := os.Stat(fileDirPath)
			if os.IsNotExist(err) {
				if err := makeDirWithPermissionFallback(fileDirPath, defaultFallbackDirMode); err != nil {
					return fmt.Errorf("failed to create parent folder of file: %w", err)
				}
			}

			outFile, err := openFileWithPermissionFallback(targetPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, os.FileMode(header.Mode))
			if err != nil {
				return err
			}

			// 写入文件内容
			err = adaptiveCopyWithContext(ctx, outFile, reader, header.Size)
			// 立即关闭，不使用defer
			_ = outFile.Close()
			if err != nil {
				return fmt.Errorf("failed to write file content: %w", err)
			}
			if err := setFileModificationTime(targetPath, header.ModTime); err != nil {
				logrus.Warnf("Failed to set modification time for file %s: %v", targetPath, err)
			}
		case tar.TypeSymlink:
			if err := os.Symlink(header.Linkname, targetPath); err != nil && !os.IsExist(err) {
				return fmt.Errorf("failed to create symlink %s: %w", targetPath, err)
			}
			// 对于符号链接不设置 mtime
			logrus.Debugf("Skipping mtime for symlink %s", targetPath)
		default:
			// 跳过其他类型（硬链接、设备文件等），记录日志
			logrus.Warnf("Skipping unsupported tar entry type %d: %s", header.Typeflag, header.Name)
		}

	}
	return nil
}

// UngzipWithRoot 解压GZ文件，确保解压的文件路径在root限制内
func UngzipWithRoot(ctx context.Context, file *os.File, destDir string, root *os.Root) error {
	logrus.Infof("Ungzip with root: %s to %s", file.Name(), destDir)
	gzipReader, err := gzip.NewReader(file)
	if err != nil {
		return fmt.Errorf("failed to create gzip reader: %w", err)
	}
	defer func() { _ = gzipReader.Close() }()

	fileInfo, err := file.Stat()
	if err != nil {
		return fmt.Errorf("failed to stat gzip file: %w", err)
	}

	// 解压 gzip 文件，通常 gzip 文件只包含一个文件
	outFilePath := filepath.Join(destDir, strings.TrimSuffix(filepath.Base(file.Name()), ".gz"))

	// 将绝对路径转换为相对路径
	relativePath, err := convertToRelativePath(root, outFilePath)
	if err != nil {
		return fmt.Errorf("failed to convert to relative path: %w", err)
	}

	// 检查相对路径是否在root限制内
	if err := validatePathWithinRoot(root, relativePath); err != nil {
		logrus.Errorf("Output file path %s is outside root or permission denied", relativePath)
		return fmt.Errorf("output file path %s is outside allowed root directory or permission denied", relativePath)
	}

	outFile, err := openFileWithPermissionFallback(outFilePath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, fileInfo.Mode())
	if err != nil {
		return err
	}
	defer func() { _ = outFile.Close() }()

	if err := adaptiveCopyWithContext(ctx, outFile, gzipReader, -1); err != nil {
		return fmt.Errorf("failed to copy gzip file content: %w", err)
	}

	// 获取原始修改时间
	var modTime time.Time
	if !gzipReader.ModTime.IsZero() {
		// 优先使用gzip头部中的修改时间
		modTime = gzipReader.ModTime
	} else {
		// 如果gzip头部没有修改时间，则使用压缩文件的修改时间
		modTime = fileInfo.ModTime()
	}

	// 设置解压后文件的修改时间
	if err := setFileModificationTime(outFilePath, modTime); err != nil {
		logrus.Warnf("Failed to set mtime for file %s: %v", outFilePath, err)
	}
	return nil
}
