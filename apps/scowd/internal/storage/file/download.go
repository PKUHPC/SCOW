package file

import "fmt"

// MaxDownloadChunkSizeByte 与 portal-server 的 DOWNLOAD_CHUNK_SIZE 默认值一致，
// 并为 portal-web gRPC 客户端默认的 4 MiB 消息限制预留序列化空间。
const MaxDownloadChunkSizeByte uint32 = 3 * 1024 * 1024

// ValidateDownloadChunkSize 在分配缓冲区前校验下载和压缩下载的分块大小。
func ValidateDownloadChunkSize(size uint32) error {
	if size == 0 || size > MaxDownloadChunkSizeByte {
		return fmt.Errorf("chunk_size_byte must be between 1 and %d bytes", MaxDownloadChunkSizeByte)
	}
	return nil
}
