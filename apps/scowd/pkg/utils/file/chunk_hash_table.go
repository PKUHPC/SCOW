package file

import (
	"github.com/sirupsen/logrus"
)

// ChunkHash 表示块位置与对应强 hash
type ChunkHash struct {
	Start      int64
	StrongHash []byte
}

// ChunkHashTable 是一个基于xHash的分块哈希表
type ChunkHashTable struct {
	// 使用uint32作为弱哈希键，值为可能有冲突的块位置列表
	Table map[uint32][]ChunkHash
}

// AddChunk 向哈希表中添加新的块数据
func (ht *ChunkHashTable) AddChunk(weakHash uint32, strongHash []byte, start int64) {
	pos := ChunkHash{
		Start:      start,
		StrongHash: strongHash,
	}
	ht.Table[weakHash] = append(ht.Table[weakHash], pos)
}

// NewChunkHashTable 创建分块哈希表
// 参数:
// - fileSize: 文件大小（字节）
// - chunkSize: 块大小（字节）
// - filePath: 文件路径，用于日志记录
// 返回:
// - 分块哈希表
func NewChunkHashTable(fileSize int64, chunkSize uint32, filePath string) *ChunkHashTable {
	// 创建哈希表
	hashTable := &ChunkHashTable{
		Table: make(map[uint32][]ChunkHash),
	}

	// 记录哈希表创建信息
	logrus.WithFields(logrus.Fields{
		"file_path":        filePath,
		"file_size_bytes":  fileSize,
		"chunk_size_bytes": chunkSize,
	}).Debug("Created chunk hash table")

	return hashTable
}
