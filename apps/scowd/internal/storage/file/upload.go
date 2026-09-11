package file

import (
	"bufio"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/zeebo/xxh3"
)

const UploadingMetaSize = int64(1024)
const SentinelCountDefault = uint32(8)
const SentinelSizeDefault = uint32(4096)

type fallocateFunc func(fd int, mode uint32, off int64, length int64) error

// PreallocateFile reserves space for an uploading file. Filesystems such as
// NFS or FUSE may not support fallocate, so fall back to a sparse file there.
func PreallocateFile(file *os.File, size int64) error {
	return preallocateFile(file, size, syscall.Fallocate)
}

func preallocateFile(file *os.File, size int64, fallocate fallocateFunc) error {
	err := fallocate(int(file.Fd()), 0, 0, size)
	if err == nil {
		return nil
	}
	if !errors.Is(err, syscall.EOPNOTSUPP) && !errors.Is(err, syscall.ENOSYS) {
		return err
	}

	logrus.Warnf("Filesystem does not support fallocate for %s; falling back to sparse allocation", file.Name())
	return file.Truncate(size)
}

// FileInfoSlice is a custom type for sorting files by the numeric suffix.
type FileInfoSlice []fs.DirEntry

var fileChunkReg = `([a-fA-F0-9]{64})_(\d+)\.scowuploadtemp`

// UploadingMeta 表示分片上传临时文件的元数据。
type UploadingMeta struct {
	FileSize         uint64   `json:"file_size"`
	ModificationTime uint64   `json:"modification_time"`
	ChunkSizeByte    uint64   `json:"chunk_size_byte"`
	TempHash         string   `json:"temp_hash"`
	FullHash         string   `json:"full_hash"`
	FullHashReady    bool     `json:"full_hash_ready"`
	LastActivityAt   int64    `json:"last_activity_at"`
	SentinelCount    uint32   `json:"sentinel_count"`
	SentinelSize     uint32   `json:"sentinel_size"`
	SentinelHashes   []uint64 `json:"sentinel_hashes"`
}

var uploadingFileLocks sync.Map

// GetUploadingLock 返回指定上传路径的互斥锁，用于保护临时文件元数据写入。
func GetUploadingLock(path string) *sync.Mutex {
	if v, ok := uploadingFileLocks.Load(path); ok {
		return v.(*sync.Mutex)
	}
	mu := &sync.Mutex{}
	actual, _ := uploadingFileLocks.LoadOrStore(path, mu)
	return actual.(*sync.Mutex)
}

// GetBitsetSize 根据文件大小和分片大小计算位图所需字节数。
func GetBitsetSize(fileSize uint64, chunkSize uint64) int64 {
	totalChunks := CalculateChunks(fileSize, chunkSize)
	return BitsetSize(totalChunks)
}

// EnsureBitsetRegion 确保临时文件布局为：内容区 + 位图区 + 固定元数据区。
func EnsureBitsetRegion(file *os.File, fileSize uint64, chunkSize uint64, metaSize int64) (int64, error) {
	bitsetSize := GetBitsetSize(fileSize, chunkSize)
	if bitsetSize == 0 {
		return 0, nil
	}
	stat, err := file.Stat()
	if err != nil {
		return 0, err
	}
	expectedSize := int64(fileSize) + bitsetSize + metaSize
	if stat.Size() == expectedSize {
		return bitsetSize, nil
	}
	oldSize := int64(fileSize) + metaSize
	if stat.Size() == oldSize {
		metaBuf := make([]byte, metaSize)
		_, err := file.ReadAt(metaBuf, stat.Size()-metaSize)
		if err != nil && err != io.EOF {
			return 0, err
		}
		if err := file.Truncate(expectedSize); err != nil {
			return 0, err
		}
		zeros := make([]byte, bitsetSize)
		if _, err := file.WriteAt(zeros, int64(fileSize)); err != nil {
			return 0, err
		}
		if _, err := file.WriteAt(metaBuf, int64(fileSize)+bitsetSize); err != nil {
			return 0, err
		}
		return bitsetSize, nil
	}
	if stat.Size() < expectedSize {
		if err := file.Truncate(expectedSize); err != nil {
			return 0, err
		}
	}
	return bitsetSize, nil
}

// ReadUploadingMeta 从文件末尾读取固定长度元数据并反序列化。
func ReadUploadingMeta(file *os.File, totalSize int64, metaSize int64) (*UploadingMeta, error) {
	buf := make([]byte, metaSize)
	_, err := file.ReadAt(buf, totalSize-metaSize)
	if err != nil && err != io.EOF {
		return nil, err
	}
	payload := strings.TrimRight(string(buf), "\x00")
	var meta UploadingMeta
	if err := json.Unmarshal([]byte(payload), &meta); err != nil {
		return nil, err
	}
	return &meta, nil
}

// WriteUploadingMeta 将元数据写入临时文件末尾固定区域。
func WriteUploadingMeta(file *os.File, metaOffset int64, meta *UploadingMeta, metaSize int64) error {
	b, err := json.Marshal(meta)
	if err != nil {
		return err
	}
	if int64(len(b)) > metaSize {
		b = b[:metaSize]
	} else if int64(len(b)) < metaSize {
		padded := make([]byte, metaSize)
		copy(padded, b)
		b = padded
	}
	_, err = file.WriteAt(b, metaOffset)
	return err
}

// WriteChunkData 在内容区写入指定分片数据，并校验偏移范围。
func WriteChunkData(file *os.File, uploadFilePath string, chunkIdx uint64, chunk []byte, offsetWithin int64, metaSize int64) (int, error) {
	lock := GetUploadingLock(uploadFilePath)
	lock.Lock()
	defer lock.Unlock()
	return func() (int, error) {
		stat, err := file.Stat()
		if err != nil {
			return 0, err
		}
		sz := stat.Size()
		if sz < metaSize {
			return 0, errors.New("uploading file missing metadata region")
		}
		meta, err := ReadUploadingMeta(file, sz, metaSize)
		if err != nil {
			return 0, err
		}
		if meta.ChunkSizeByte == 0 {
			return 0, errors.New("chunk size missing in metadata")
		}
		chunkSize := meta.ChunkSizeByte
		contentSize := int64(meta.FileSize)
		offset := int64(chunkIdx)*int64(chunkSize) + offsetWithin
		if offset < 0 || offset >= contentSize {
			return 0, errors.New("chunk offset out of range")
		}
		if offset+int64(len(chunk)) > contentSize {
			return 0, errors.New("chunk size out of range")
		}
		n, err := file.WriteAt(chunk, offset)
		if err != nil {
			return n, err
		}
		return n, nil
	}()
}

// UpdateChunkMeta 更新位图、哨兵窗口哈希与临时 hash。
func UpdateChunkMeta(file *os.File, uploadFilePath string, chunkIdx uint64, chunkBytes int64, metaSize int64) error {
	if chunkBytes <= 0 {
		return nil
	}
	lock := GetUploadingLock(uploadFilePath)
	lock.Lock()
	defer lock.Unlock()
	stat, err := file.Stat()
	if err != nil {
		return err
	}
	sz := stat.Size()
	if sz < metaSize {
		return errors.New("uploading file missing metadata region")
	}
	meta, err := ReadUploadingMeta(file, sz, metaSize)
	if err != nil {
		return err
	}
	if meta.ChunkSizeByte == 0 {
		return errors.New("chunk size missing in metadata")
	}
	chunkSize := meta.ChunkSizeByte
	contentSize := int64(meta.FileSize)
	offsetStart := int64(chunkIdx) * int64(chunkSize)
	if offsetStart < 0 || offsetStart >= contentSize {
		return errors.New("chunk offset out of range")
	}
	offsetEnd := offsetStart + chunkBytes
	if offsetEnd > contentSize {
		offsetEnd = contentSize
	}
	if meta.SentinelCount > 0 && meta.SentinelSize > 0 && len(meta.SentinelHashes) > 0 {
		positions := GenerateSentinelPositions(meta.FileSize, chunkSize, meta.SentinelCount, meta.SentinelSize)
		for i := 0; i < int(meta.SentinelCount) && i < len(positions) && i < len(meta.SentinelHashes); i++ {
			if meta.SentinelHashes[i] != 0 {
				continue
			}
			start := int64(positions[i])
			end := start + int64(meta.SentinelSize)
			// 仅在哨兵窗口被本次写入完整覆盖时更新 hash
			if start >= offsetStart && end <= offsetEnd {
				h, err := ComputeWindowHash(file, positions[i], meta.SentinelSize)
				if err != nil {
					return err
				}
				meta.SentinelHashes[i] = h
			}
		}
	}
	meta.TempHash = CalcTempHash(meta.SentinelHashes)
	meta.LastActivityAt = time.Now().UnixNano()
	if meta.FullHashReady {
		meta.FullHashReady = false
		meta.FullHash = ""
	}
	totalChunks := CalculateChunks(meta.FileSize, chunkSize)
	bitsetSize, err := EnsureBitsetRegion(file, meta.FileSize, chunkSize, metaSize)
	if err != nil {
		return err
	}
	if err := MarkChunkUploadedAt(file, int64(meta.FileSize), totalChunks, chunkIdx); err != nil {
		return err
	}
	metaOffset := int64(meta.FileSize) + bitsetSize
	return WriteUploadingMeta(file, metaOffset, meta, metaSize)
}

func (fis FileInfoSlice) Len() int {
	return len(fis)
}

func (fis FileInfoSlice) Swap(i, j int) {
	fis[i], fis[j] = fis[j], fis[i]
}

func (fis FileInfoSlice) Less(i, j int) bool {
	re := regexp.MustCompile(`[a-fA-F0-9]{64}_(\d+)\.scowuploadtemp`)
	matchI := re.FindStringSubmatch(fis[i].Name())
	matchJ := re.FindStringSubmatch(fis[j].Name())
	if len(matchI) < 2 || len(matchJ) < 2 {
		return fis[i].Name() < fis[j].Name()
	}
	numI, _ := strconv.Atoi(matchI[1])
	numJ, _ := strconv.Atoi(matchJ[1])
	return numI < numJ
}

func MergeFileChunks(writer *bufio.Writer, filePath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer func() { _ = file.Close() }()

	reader := bufio.NewReader(file)
	_, err = io.Copy(writer, reader)
	if err != nil {
		return err
	}

	return nil
}

func CalculateChunks(filesize, chunksize uint64) uint64 {
	if chunksize == 0 {
		return 0 // 避免除以零
	}
	// 计算完整分片数量
	fullChunks := filesize / chunksize
	// 如果有余数，则需要增加一个分片
	if filesize%chunksize != 0 {
		fullChunks++
	}
	return fullChunks
}

func CalculateFileSHA256(filePath string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer func() { _ = file.Close() }()

	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}

	return hex.EncodeToString(hash.Sum(nil)), nil
}

// GenerateSentinelPositions 生成哨兵窗口起始位置，均匀分布并对齐到分片区间
func GenerateSentinelPositions(fileSize uint64, chunkSize uint64, count uint32, windowSize uint32) []uint64 {
	if count == 0 || fileSize == 0 {
		return nil
	}
	size := uint64(windowSize)
	if size == 0 {
		size = 1
	}
	if size > fileSize {
		size = fileSize
	}
	if chunkSize == 0 {
		chunkSize = size
	}
	segment := fileSize / uint64(count+1)
	if segment == 0 {
		segment = chunkSize
	}
	positions := make([]uint64, count)
	for i := uint32(0); i < count; i++ {
		pos := uint64(i+1) * segment
		if pos >= fileSize {
			pos = fileSize - 1
		}
		chunkIdx := pos / chunkSize
		base := chunkIdx * chunkSize
		offsetWithin := uint64(0)
		if chunkSize > size {
			offsetWithin = (chunkSize - size) / 2
		}
		pos = base + offsetWithin
		if pos+size > fileSize {
			if fileSize > size {
				pos = fileSize - size
			} else {
				pos = 0
			}
		}
		positions[i] = pos
	}
	return positions
}

// ComputeWindowHash 计算指定窗口范围的内容 hash
func ComputeWindowHash(file *os.File, pos uint64, size uint32) (uint64, error) {
	if size == 0 {
		return 0, nil
	}
	buf := make([]byte, size)
	n, err := file.ReadAt(buf, int64(pos))
	if err != nil && err != io.EOF {
		return 0, err
	}
	if n < len(buf) {
		buf = buf[:n]
	}
	h := xxh3.New()
	if _, err := h.Write(buf); err != nil {
		return 0, err
	}
	return h.Sum64(), nil
}

func CalcTempHash(hashes []uint64) string {
	h := xxh3.New()
	hasData := false
	var b [8]byte
	for _, v := range hashes {
		if v == 0 {
			continue
		}
		hasData = true
		binary.LittleEndian.PutUint64(b[:], v)
		_, _ = h.Write(b[:])
	}
	if !hasData {
		return ""
	}
	return fmt.Sprintf("%x", h.Sum64())
}

// VerifySentinels 重新计算哨兵窗口 hash 并与元数据比对，提供轻量续传校验
func VerifySentinels(file *os.File, fileSize uint64, contentSize int64, chunkSize uint64, count uint32, size uint32, hashes []uint64, tempHash string) error {
	if count == 0 || size == 0 || len(hashes) == 0 {
		return nil
	}
	positions := GenerateSentinelPositions(fileSize, chunkSize, count, size)
	for i := 0; i < int(count) && i < len(positions) && i < len(hashes); i++ {
		if hashes[i] == 0 {
			continue
		}
		pos := positions[i]
		if int64(pos)+int64(size) > contentSize {
			continue
		}
		h, err := ComputeWindowHash(file, pos, size)
		if err != nil {
			return err
		}
		if h != hashes[i] {
			return errors.New("temp hash mismatch")
		}
	}
	if tempHash != "" {
		if CalcTempHash(hashes) != tempHash {
			return errors.New("temp hash mismatch")
		}
	}
	return nil
}

func ComputeFullHash(file *os.File, contentSize int64) (string, error) {
	if contentSize <= 0 {
		return "", nil
	}
	h := xxh3.New()
	section := io.NewSectionReader(file, 0, contentSize)
	if _, err := io.Copy(h, section); err != nil {
		return "", err
	}
	return fmt.Sprintf("%x", h.Sum64()), nil
}

// BuildChunkBitset 根据分片数创建位图，1 bit 对应一个分片
func BuildChunkBitset(totalChunks uint64) []byte {
	if totalChunks == 0 {
		return nil
	}
	byteLen := (totalChunks + 7) / 8
	return make([]byte, byteLen)
}

// BitsetSize 返回位图字节长度，向上取整保证 8 个分片占 1 字节
func BitsetSize(totalChunks uint64) int64 {
	return int64((totalChunks + 7) / 8)
}

// SetChunkBit 标记位图中某个分片为已上传
func SetChunkBit(bitset []byte, chunkIdx uint64) {
	if len(bitset) == 0 {
		return
	}
	byteIdx := chunkIdx / 8
	if byteIdx >= uint64(len(bitset)) {
		return
	}
	bit := uint8(1 << (chunkIdx % 8))
	bitset[byteIdx] |= bit
}

func ConvertBitsetToIndexes(bitset []byte, totalChunks uint64) []uint64 {
	if len(bitset) == 0 || totalChunks == 0 {
		return nil
	}
	indexes := make([]uint64, 0, totalChunks)
	for idx := uint64(0); idx < totalChunks; idx++ {
		byteIdx := idx / 8
		bit := uint8(1 << (idx % 8))
		if byteIdx < uint64(len(bitset)) && (bitset[byteIdx]&bit) != 0 {
			indexes = append(indexes, idx)
		}
	}
	return indexes
}

// BitsetHasAny 判断位图是否包含任何已上传分片
func BitsetHasAny(bitset []byte) bool {
	for _, b := range bitset {
		if b != 0 {
			return true
		}
	}
	return false
}

// LastUploadedChunk 返回位图中最后一个已上传分片索引
func LastUploadedChunk(bitset []byte, totalChunks uint64) (uint64, bool) {
	if len(bitset) == 0 || totalChunks == 0 {
		return 0, false
	}
	for i := len(bitset) - 1; i >= 0; i-- {
		b := bitset[i]
		if b == 0 {
			continue
		}
		for bit := 7; bit >= 0; bit-- {
			if b&(1<<uint8(bit)) == 0 {
				continue
			}
			idx := uint64(i*8 + bit)
			if idx >= totalChunks {
				continue
			}
			return idx, true
		}
	}
	return 0, false
}

func EnsureChunkBitsetSize(path string, totalChunks uint64) error {
	byteLen := int64((totalChunks + 7) / 8)
	if byteLen == 0 {
		return nil
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0644)
	if err != nil {
		return err
	}
	defer func() { _ = f.Close() }()
	stat, err := f.Stat()
	if err != nil {
		return err
	}
	if stat.Size() < byteLen {
		if err := f.Truncate(byteLen); err != nil {
			return err
		}
	}
	return nil
}

func ReadChunkBitset(path string) ([]byte, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return data, nil
}

func WriteChunkBitset(path string, bitset []byte) error {
	return os.WriteFile(path, bitset, 0644)
}

// ReadChunkBitsetAt 从指定偏移读取位图
func ReadChunkBitsetAt(file *os.File, offset int64, totalChunks uint64) ([]byte, error) {
	size := BitsetSize(totalChunks)
	if size == 0 {
		return nil, nil
	}
	buf := make([]byte, size)
	_, err := file.ReadAt(buf, offset)
	if err != nil && err != io.EOF {
		return nil, err
	}
	return buf, nil
}

// WriteChunkBitsetAt 将位图写入指定偏移
func WriteChunkBitsetAt(file *os.File, offset int64, bitset []byte) error {
	if len(bitset) == 0 {
		return nil
	}
	_, err := file.WriteAt(bitset, offset)
	return err
}

// MarkChunkUploadedAt 在位图中标记分片，位图位于指定偏移
func MarkChunkUploadedAt(file *os.File, offset int64, totalChunks uint64, chunkIdx uint64) error {
	size := BitsetSize(totalChunks)
	if size == 0 {
		return nil
	}
	byteIdx := chunkIdx / 8
	if byteIdx >= uint64(size) {
		return nil
	}
	var b [1]byte
	if _, err := file.ReadAt(b[:], offset+int64(byteIdx)); err != nil && err != io.EOF {
		return err
	}
	bit := uint8(1 << (chunkIdx % 8))
	if b[0]&bit != 0 {
		return nil
	}
	b[0] |= bit
	_, err := file.WriteAt(b[:], offset+int64(byteIdx))
	return err
}

func MarkChunkUploaded(path string, totalChunks uint64, chunkIdx uint64) error {
	byteLen := int64((totalChunks + 7) / 8)
	if byteLen == 0 {
		return nil
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0644)
	if err != nil {
		return err
	}
	defer func() { _ = f.Close() }()
	stat, err := f.Stat()
	if err != nil {
		return err
	}
	if stat.Size() < byteLen {
		if err := f.Truncate(byteLen); err != nil {
			return err
		}
	}
	byteIdx := chunkIdx / 8
	if byteIdx >= uint64(byteLen) {
		return nil
	}
	var b [1]byte
	if _, err := f.ReadAt(b[:], int64(byteIdx)); err != nil && err != io.EOF {
		return err
	}
	bit := uint8(1 << (chunkIdx % 8))
	if b[0]&bit != 0 {
		return nil
	}
	b[0] |= bit
	_, err = f.WriteAt(b[:], int64(byteIdx))
	return err
}

// CheckSequentialFiles checks for missing numbers in the sequence of files
func CheckSequentialFiles(entries []fs.DirEntry, dirPath string, chunksNum uint64) error {
	// Regular expression to match file names like "xxx_1.scowuploadtemp", "xxx_2.scowuploadtemp", ..., "xxx_n.scowuploadtemp"
	re := regexp.MustCompile(fileChunkReg)

	// Map to store the presence of numbers
	numMap := make(map[int]bool)
	var mu sync.Mutex

	maxNum := 0
	var wg sync.WaitGroup
	errChan := make(chan error, len(entries))

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		wg.Add(1)
		go func(entry fs.DirEntry) {
			defer wg.Done()

			fileName := entry.Name()
			matches := re.FindStringSubmatch(fileName)
			if len(matches) < 3 {
				return
			}

			num, err := strconv.Atoi(matches[2])
			if err != nil {
				errChan <- fmt.Errorf("invalid file name format: %s", fileName)
				return
			}

			contentHashString, err := CalculateFileSHA256(filepath.Join(dirPath, fileName))
			if err != nil {
				errChan <- fmt.Errorf("failed to calculate hash for file %s: %v", entry.Name(), err)
				return
			}

			nameHashString := matches[1]
			if nameHashString != contentHashString {
				if err := os.Remove(filepath.Join(dirPath, fileName)); err != nil && !os.IsNotExist(err) {
					logrus.Warnf("Failed to remove invalid file %s: %v", filepath.Join(dirPath, fileName), err)
				}
				errChan <- fmt.Errorf("file %s hash verification failed", entry.Name())
				return
			}

			mu.Lock()
			numMap[num] = true
			if num > maxNum {
				maxNum = num
			}
			mu.Unlock()
		}(entry)
	}

	wg.Wait()
	close(errChan)

	for err := range errChan {
		if err != nil {
			return err
		}
	}

	// 检查 chunks 的数量是否正确
	if chunksNum != uint64(maxNum) {
		return fmt.Errorf("incomplete chunks %s, need: %d, received: %d", dirPath, chunksNum, maxNum)
	}

	// Check for missing numbers
	for i := 1; i <= maxNum; i++ {
		if !numMap[i] {
			return fmt.Errorf("missing file: xxx_%d", i)
		}
	}

	return nil
}

// 因为 os.root 暂不支持 ReadDir 的方法，
// 对于使用root权限 entries []fs.DirEntry 参数变更为 fileInfos []os.FileInfo
// 转换为使用 FileInfo 和 root 权限的版本
func CheckSequentialFilesWithRoot(fileInfos []os.FileInfo, dirPath string, chunksNum uint64, root *os.Root) error {
	// Regular expression to match file names
	re := regexp.MustCompile(fileChunkReg)

	// Map to store the presence of numbers
	numMap := make(map[int]bool)
	var mu sync.Mutex

	maxNum := 0
	var wg sync.WaitGroup
	errChan := make(chan error, len(fileInfos))

	for _, info := range fileInfos {
		if info.IsDir() {
			continue
		}

		wg.Add(1)
		go func(info os.FileInfo) {
			defer wg.Done()

			fileName := info.Name()
			matches := re.FindStringSubmatch(fileName)
			if len(matches) < 3 {
				return
			}

			num, err := strconv.Atoi(matches[2])
			if err != nil {
				errChan <- fmt.Errorf("invalid file name format: %s", fileName)
				return
			}

			// 使用 root 权限计算文件哈希
			filePath := filepath.Join(dirPath, fileName)
			contentHashString, err := CalculateFileSHA256WithRoot(filePath, root)
			if err != nil {
				errChan <- fmt.Errorf("failed to calculate hash for file %s: %v", fileName, err)
				return
			}

			nameHashString := matches[1]
			if nameHashString != contentHashString {
				// 使用 root 权限删除文件
				if removeErr := root.Remove(filePath); removeErr != nil {
					logrus.Warnf("Failed to remove invalid file %s: %v", filePath, removeErr)
				}
				errChan <- fmt.Errorf("file %s hash verification failed", fileName)
				return
			}

			mu.Lock()
			numMap[num] = true
			if num > maxNum {
				maxNum = num
			}
			mu.Unlock()
		}(info)
	}

	wg.Wait()
	close(errChan)

	for err := range errChan {
		if err != nil {
			return err
		}
	}

	// 检查 chunks 的数量是否正确
	if chunksNum != uint64(maxNum) {
		return fmt.Errorf("incomplete chunks %s, need: %d, received: %d", dirPath, chunksNum, maxNum)
	}

	// Check for missing numbers
	for i := 1; i <= maxNum; i++ {
		if !numMap[i] {
			return fmt.Errorf("missing file: xxx_%d", i)
		}
	}

	return nil
}

// 使用root权限计算文件哈希
func CalculateFileSHA256WithRoot(filePath string, root *os.Root) (string, error) {
	file, err := root.Open(filePath)
	if err != nil {
		return "", err
	}
	defer func() { _ = file.Close() }()

	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}

	return hex.EncodeToString(hash.Sum(nil)), nil
}

// 使用root权限mergeFileChunks
func MergeFileChunksWithRoot(writer *bufio.Writer, filePath string, root *os.Root) error {
	file, err := root.Open(filePath)
	if err != nil {
		return err
	}
	defer func() { _ = file.Close() }()

	reader := bufio.NewReader(file)
	_, err = io.Copy(writer, reader)
	if err != nil {
		return err
	}

	return nil
}

// 使用 root 权限获取目录下的 FileInfo[]
func GetFileInfosWithRoot(root *os.Root, dirPath string) ([]os.FileInfo, error) {
	dir, err := root.Open(dirPath)
	if err != nil {
		return nil, err
	}
	defer func() { _ = dir.Close() }()

	return dir.Readdir(-1)
}
