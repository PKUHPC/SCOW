package file

// 用于记录文件中哪些块已经被接收
func MergeChunks(m map[int64]int64, newStart int64, newSize int64) {
	for start, size := range m {
		if newStart+newSize == start { // 右邻接合并
			m[newStart] = newSize + size
			delete(m, start)
			return
		} else if start+int64(size) == newStart { // 左邻接合并
			m[start] = size + newSize
			return
		}
	}
	m[newStart] = newSize
}
