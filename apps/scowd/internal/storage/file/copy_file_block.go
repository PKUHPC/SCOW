package file

import (
	"fmt"
	"io"
	"os"
	"runtime"
	"sync"
	"syscall"
)

// 自定义 Writer 实现带偏移量的写入
type offsetWriter struct {
	writer io.WriterAt
	offset int64
}

func (w *offsetWriter) Write(p []byte) (n int, err error) {
	n, err = w.writer.WriteAt(p, w.offset)
	w.offset += int64(n)
	return
}

// 缓冲区池，根据文件大小动态调整缓冲区大小
var bufferPool = sync.Pool{
	New: func() interface{} {
		// 默认使用1MB缓冲区
		buf := make([]byte, 1024*1024)
		return &buf
	},
}

// 获取适合文件大小的缓冲区
func GetBuffer(fileSize int64) []byte {
	bufPtr := bufferPool.Get().(*[]byte)
	buf := *bufPtr

	// 根据文件大小动态调整缓冲区大小
	if fileSize > 1024*1024*1024 { // 大于1GB的文件
		if cap(buf) < 8*1024*1024 { // 如果缓冲区小于8MB，则扩大
			*bufPtr = make([]byte, 8*1024*1024)
			buf = *bufPtr
		}
	} else if fileSize > 100*1024*1024 { // 大于100MB的文件
		if cap(buf) < 4*1024*1024 { // 如果缓冲区小于4MB，则扩大
			*bufPtr = make([]byte, 4*1024*1024)
			buf = *bufPtr
		}
	}

	return buf
}

// 释放缓冲区回池
func PutBuffer(buf *[]byte) {
	bufferPool.Put(buf)
}

// CopyFileBlock 使用优化的内存管理复制文件块
// 根据文件大小和系统支持情况选择最佳的复制方法
func CopyFileBlock(srcFile *os.File, start int64, size uint32, dstFile *os.File, dstStart int64) error {
	// 获取文件信息以确定最佳策略
	srcInfo, err := srcFile.Stat()
	if err != nil {
		return err
	}

	// 对于大文件块(>10MB)，尝试使用内存映射
	if size > 10*1024*1024 && runtime.GOOS != "windows" {
		// 尝试使用内存映射
		err := mmapCopyFileBlock(srcFile, start, size, dstFile, dstStart)
		if err == nil {
			return nil // 内存映射成功
		}
		// 内存映射失败，回退到优化的缓冲区复制
	}

	// 使用优化的缓冲区复制
	reader := io.NewSectionReader(srcFile, start, int64(size))

	// 获取优化的缓冲区
	bufPtr := bufferPool.Get().(*[]byte)
	defer bufferPool.Put(bufPtr)
	buf := GetBuffer(srcInfo.Size())

	// 使用带偏移量的写入器
	writer := &offsetWriter{
		writer: dstFile,
		offset: dstStart,
	}

	// 执行拷贝，使用优化的缓冲区
	_, err = io.CopyBuffer(writer, io.LimitReader(reader, int64(size)), buf)
	return err
}

// mmapCopyFileBlock 使用内存映射技术复制文件块
// 注意：此函数在Windows上不可用，会返回错误
func mmapCopyFileBlock(srcFile *os.File, start int64, size uint32, dstFile *os.File, dstStart int64) error {
	// Windows平台不支持此实现方式
	if runtime.GOOS == "windows" {
		return fmt.Errorf("memory mapping not implemented on Windows")
	}

	// 在类Unix系统上实现内存映射
	srcFd := int(srcFile.Fd())

	// 映射源文件
	srcData, err := syscall.Mmap(srcFd, start, int(size), syscall.PROT_READ, syscall.MAP_SHARED)
	if err != nil {
		return fmt.Errorf("failed to mmap source file: %v", err)
	}

	// 使用闭包捕获Munmap错误
	var munmapErr error
	defer func() {
		if err := syscall.Munmap(srcData); err != nil {
			munmapErr = fmt.Errorf("failed to unmap source file: %w", err)
		}
	}()

	// 写入目标文件
	_, err = dstFile.WriteAt(srcData, dstStart)
	if err != nil {
		// 优先返回WriteAt错误，但会确保Munmap执行
		if munmapErr != nil {
			return fmt.Errorf("write error: %v (additional unmap error: %v)", err, munmapErr)
		}
		return fmt.Errorf("failed to write to destination file: %w", err)
	}

	// 检查延迟执行的Munmap是否出错
	if munmapErr != nil {
		return munmapErr
	}
	return nil
}

// ZeroCopyFileBlock 尝试使用零拷贝技术复制文件块
// 注意：此函数在Windows上使用优化的缓冲区复制作为回退
func ZeroCopyFileBlock(srcFile *os.File, start int64, size uint32, dstFile *os.File, dstStart int64) error {
	// Windows平台不支持sendfile系统调用，使用优化的缓冲区复制
	if runtime.GOOS == "windows" {
		return CopyFileBlock(srcFile, start, size, dstFile, dstStart)
	}

	// 在Linux系统上尝试使用sendfile系统调用
	srcFd := int(srcFile.Fd())
	dstFd := int(dstFile.Fd())

	// 确保文件指针位置正确
	if _, err := srcFile.Seek(start, 0); err != nil {
		return err
	}
	if _, err := dstFile.Seek(dstStart, 0); err != nil {
		return err
	}

	// 使用sendfile系统调用
	n, err := syscall.Sendfile(dstFd, srcFd, nil, int(size))
	if err != nil || n != int(size) {
		// 如果sendfile失败或未完全复制，回退到优化的缓冲区复制
		return CopyFileBlock(srcFile, start, size, dstFile, dstStart)
	}

	return nil
}
