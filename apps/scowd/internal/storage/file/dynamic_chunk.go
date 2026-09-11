package file

// DynamicChunk 根据文件大小和类型动态计算合适的分块大小
// 对于大文件使用更大的块以提高传输效率，对于小文件使用较小的块以减少内存占用
func DynamicChunk(fileSize int64, filePath string) (chunkSize uint32) {
	// 首先根据文件大小获取基础块大小
	return getBaseSizeChunk(fileSize)

	// 其他逻辑优化chunk大小
}

// getBaseSizeChunk 根据文件大小获取基础块大小
func getBaseSizeChunk(fileSize int64) uint32 {
	switch {
	case fileSize > 1<<40: // >1TB 文件
		return 16 << 20 // 16MB
	case fileSize > 100<<30: // 100GB~1TB
		return 8 << 20 // 8MB
	case fileSize > 10<<30: // 10GB~100GB
		return 4 << 20 // 4MB
	default: // <10GB 文件
		return 3 << 20 // 2MB
	}
}
