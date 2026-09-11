package file

import (
	"archive/zip"
	"compress/flate"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// ZipPathsOnTheFly packages multiple paths into ZIP data and writes it to w.
// compressionLevel is an integer between 0 and 9 where 0 is no compression and 9 is best compression.
func ZipPathsOnTheFly(ctx context.Context, paths []string, w io.Writer, compressionLevel int) error {
	// Ensure valid compression level
	if compressionLevel < 0 || compressionLevel > 9 {
		return fmt.Errorf("invalid compression level: %d, must be between 0 and 9", compressionLevel)
	}

	zipWriter := zip.NewWriter(w)
	defer func() {
		if err := zipWriter.Close(); err != nil {
			fmt.Printf("Error closing zip writer: %v\n", err)
		}
	}()

	// 多个文件和文件夹下载时必然属于同一目录，所以将任意一个路径的 Dir 做为 baseDir 即可
	baseDir := filepath.Dir(paths[0])

	// Register Deflate compressor with the desired compression level
	zipWriter.RegisterCompressor(zip.Deflate, func(out io.Writer) (io.WriteCloser, error) {
		return flate.NewWriter(out, compressionLevel)
	})

	for _, p := range paths {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			// 继续执行
		}

		absPath, err := filepath.Abs(p)
		if err != nil {
			return fmt.Errorf("invalid path: %s, error: %w", p, err)
		}

		_, err = os.Stat(absPath)
		if err != nil {
			return fmt.Errorf("cannot access path: %s, error: %w", absPath, err)
		}

		err = filepath.Walk(absPath, func(path string, info os.FileInfo, err error) error {
			// 检查是否有错误
			if err != nil {
				return err
			}

			// 在每次迭代时检查上下文是否已取消
			select {
			case <-ctx.Done():
				return ctx.Err()
			default:
				// 继续处理
			}

			// Compute the relative path to maintain directory structure in ZIP
			relPath, err := filepath.Rel(baseDir, path)
			if err != nil {
				return err
			}

			// Replace backslashes with forward slashes for ZIP compatibility
			relPath = filepath.ToSlash(relPath)

			// Skip the root directory if it's being zipped
			if relPath == "." {
				return nil
			}

			if info.IsDir() {
				// 创建带权限的目录条目
				zipDirHeader := &zip.FileHeader{
					Name:     relPath + "/",
					Method:   zip.Deflate, // 目录通常不压缩，但保留设置
					Modified: info.ModTime(),
				}
				zipDirHeader.SetMode(info.Mode())
				_, err := zipWriter.CreateHeader(zipDirHeader)
				return err
			}

			// Open the file for reading
			f, err := os.Open(path)
			if err != nil {
				return err
			}
			defer func() { _ = f.Close() }()

			// Create a zip entry header with compression method
			zipEntryHeader := &zip.FileHeader{
				Name:     relPath,
				Method:   zip.Deflate, // Use Deflate compression method
				Modified: info.ModTime(),
			}
			// Preserve file permissions
			zipEntryHeader.SetMode(info.Mode())

			// Create the zip entry
			zipEntry, err := zipWriter.CreateHeader(zipEntryHeader)
			if err != nil {
				return err
			}

			// Copy the file contents into the zip entry
			_, err = io.Copy(zipEntry, f)
			if err != nil {
				return err
			}

			return nil
		})

		if err != nil {
			return fmt.Errorf("error walking path %s: %w", absPath, err)
		}
	}

	return nil
}

// ZipPathsOnTheFlyWithRoot packages multiple paths into ZIP data and writes it to w with root permission checks.
// compressionLevel is an integer between 0 and 9 where 0 is no compression and 9 is best compression.
// root parameter is used to ensure all paths are within the allowed root directory.
func ZipPathsOnTheFlyWithRoot(ctx context.Context, paths []string, w io.Writer, compressionLevel int, root *os.Root) error {
	// Ensure valid compression level
	if compressionLevel < 0 || compressionLevel > 9 {
		return fmt.Errorf("invalid compression level: %d, must be between 0 and 9", compressionLevel)
	}

	// Validate all paths are within root before proceeding
	for _, p := range paths {
		// Check if path is within root directory using inline validation
		_, err := root.Stat(p)
		if err != nil {
			// If path doesn't exist, check if parent directory is accessible
			if os.IsNotExist(err) {
				parentDir := filepath.Dir(p)
				if parentDir != p { // Avoid infinite recursion
					_, parentErr := root.Stat(parentDir)
					if parentErr != nil {
						return fmt.Errorf("path %s is not within allowed root directory: %w", p, err)
					}
				}
			} else {
				return fmt.Errorf("path %s is not within allowed root directory: %w", p, err)
			}
		}
	}

	zipWriter := zip.NewWriter(w)
	defer func() {
		if err := zipWriter.Close(); err != nil {
			fmt.Printf("Error closing zip writer: %v\n", err)
		}
	}()

	// 多个文件和文件夹下载时必然属于同一目录，所以将任意一个路径的 Dir 做为 baseDir 即可
	baseDir := filepath.Dir(paths[0])

	// Register Deflate compressor with the desired compression level
	zipWriter.RegisterCompressor(zip.Deflate, func(out io.Writer) (io.WriteCloser, error) {
		return flate.NewWriter(out, compressionLevel)
	})

	for _, p := range paths {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			// 继续执行
		}

		// Use root.Stat instead of os.Stat for permission checking
		_, err := root.Stat(p)
		if err != nil {
			return fmt.Errorf("cannot access path: %s, error: %w", p, err)
		}

		err = walkWithRoot(root, p, baseDir, zipWriter, ctx)
		if err != nil {
			return fmt.Errorf("error walking path %s: %w", p, err)
		}
	}

	return nil
}

// walkWithRoot walks through a directory tree using root operations
func walkWithRoot(root *os.Root, startPath, baseDir string, zipWriter *zip.Writer, ctx context.Context) error {
	// Get file info using root
	info, err := root.Stat(startPath)
	if err != nil {
		return err
	}

	// Process the current path
	if err := processPathForZip(root, startPath, baseDir, info, zipWriter); err != nil {
		return err
	}

	// If it's a directory, recursively process its contents
	if info.IsDir() {
		dir, err := root.Open(startPath)
		if err != nil {
			return err
		}
		defer func() { _ = dir.Close() }()

		entries, err := dir.Readdir(-1)
		if err != nil {
			return err
		}

		for _, entry := range entries {
			select {
			case <-ctx.Done():
				return ctx.Err()
			default:
				// 继续处理
			}

			childPath := filepath.Join(startPath, entry.Name())
			if err := walkWithRoot(root, childPath, baseDir, zipWriter, ctx); err != nil {
				return err
			}
		}
	}

	return nil
}

// processPathForZip processes a single path for ZIP creation
func processPathForZip(root *os.Root, path, baseDir string, info os.FileInfo, zipWriter *zip.Writer) error {
	// Compute the relative path to maintain directory structure in ZIP
	relPath, err := filepath.Rel(baseDir, path)
	if err != nil {
		return err
	}

	// Replace backslashes with forward slashes for ZIP compatibility
	relPath = filepath.ToSlash(relPath)

	// Skip the root directory if it's being zipped
	if relPath == "." {
		return nil
	}

	if info.IsDir() {
		// 创建带权限的目录条目
		zipDirHeader := &zip.FileHeader{
			Name:     relPath + "/",
			Method:   zip.Deflate, // 目录通常不压缩，但保留设置
			Modified: info.ModTime(),
		}
		zipDirHeader.SetMode(info.Mode())
		_, err := zipWriter.CreateHeader(zipDirHeader)
		return err
	}

	// Open the file for reading using root
	f, err := root.Open(path)
	if err != nil {
		return err
	}
	defer func() { _ = f.Close() }()

	// Create a zip entry header with compression method
	zipEntryHeader := &zip.FileHeader{
		Name:     relPath,
		Method:   zip.Deflate, // Use Deflate compression method
		Modified: info.ModTime(),
	}
	// Preserve file permissions
	zipEntryHeader.SetMode(info.Mode())

	// Create the zip entry
	zipEntry, err := zipWriter.CreateHeader(zipEntryHeader)
	if err != nil {
		return err
	}

	// Copy the file contents into the zip entry
	_, err = io.Copy(zipEntry, f)
	if err != nil {
		return err
	}

	return nil
}
