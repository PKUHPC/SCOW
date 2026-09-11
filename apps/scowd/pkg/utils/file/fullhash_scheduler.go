package file

import (
	"os"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
)

const FullHashIdleDelay = 10 * time.Second

var fullHashTimers sync.Map

func ScheduleFullHash(uploadFilePath string, delay time.Duration) {
	if uploadFilePath == "" {
		logrus.Trace("Skip scheduling full hash: empty upload path")
		return
	}
	logrus.Tracef("Schedule full hash: path=%s, delay=%s", uploadFilePath, delay)
	if v, ok := fullHashTimers.Load(uploadFilePath); ok {
		t := v.(*time.Timer)
		if !t.Stop() {
			select {
			case <-t.C:
			default:
			}
		}
		t.Reset(delay)
		logrus.Tracef("Reset full hash timer: path=%s, delay=%s", uploadFilePath, delay)
		return
	}
	t := time.AfterFunc(delay, func() {
		logrus.Tracef("Full hash timer triggered: path=%s", uploadFilePath)
		runFullHash(uploadFilePath)
	})
	fullHashTimers.Store(uploadFilePath, t)
	logrus.Tracef("Create full hash timer: path=%s, delay=%s", uploadFilePath, delay)
}

func runFullHash(uploadFilePath string) {
	fullHashTimers.Delete(uploadFilePath)
	logrus.Tracef("Start full hash run: path=%s", uploadFilePath)
	file, err := os.OpenFile(uploadFilePath, os.O_RDWR, 0644)
	if err != nil {
		logrus.Tracef("Skip full hash run: open failed, path=%s, err=%v", uploadFilePath, err)
		return
	}
	defer func() {
		if err := file.Close(); err != nil {
			logrus.Errorf("Failed to close file: %v", err)
		}
	}()

	var (
		lastActivity int64
		contentSize  int64
		fileSize     uint64
		chunkSize    uint64
	)

	if ok := func() bool {
		lock := GetUploadingLock(uploadFilePath)
		lock.Lock()
		defer lock.Unlock()

		stat, err := file.Stat()
		if err != nil {
			logrus.Tracef("Skip full hash run: stat failed, path=%s, err=%v", uploadFilePath, err)
			return false
		}
		if stat.Size() < UploadingMetaSize {
			logrus.Tracef("Skip full hash run: file too small, path=%s, size=%d", uploadFilePath, stat.Size())
			return false
		}
		meta, err := ReadUploadingMeta(file, stat.Size(), UploadingMetaSize)
		if err != nil || meta == nil {
			logrus.Tracef("Skip full hash run: invalid meta, path=%s, err=%v", uploadFilePath, err)
			return false
		}
		if meta.FullHashReady {
			logrus.Tracef("Skip full hash run: full hash already ready, path=%s", uploadFilePath)
			return false
		}
		if meta.ChunkSizeByte == 0 {
			logrus.Tracef("Skip full hash run: missing chunk size, path=%s", uploadFilePath)
			return false
		}
		lastActivity = meta.LastActivityAt
		if lastActivity > 0 && time.Since(time.Unix(0, lastActivity)) < FullHashIdleDelay {
			logrus.Tracef("Skip full hash run: not idle enough, path=%s, lastActivity=%d", uploadFilePath, lastActivity)
			return false
		}
		totalChunks := CalculateChunks(meta.FileSize, meta.ChunkSizeByte)
		if totalChunks == 0 {
			logrus.Tracef("Skip full hash run: zero chunks, path=%s", uploadFilePath)
			return false
		}
		if _, err := EnsureBitsetRegion(file, meta.FileSize, meta.ChunkSizeByte, UploadingMetaSize); err != nil {
			logrus.Tracef("Skip full hash run: ensure bitset failed, path=%s, err=%v", uploadFilePath, err)
			return false
		}
		bitset, err := ReadChunkBitsetAt(file, int64(meta.FileSize), totalChunks)
		if err != nil {
			logrus.Tracef("Skip full hash run: read bitset failed, path=%s, err=%v", uploadFilePath, err)
			return false
		}
		lastChunkIdx, ok := LastUploadedChunk(bitset, totalChunks)
		if !ok {
			logrus.Tracef("Skip full hash run: no uploaded chunk found, path=%s", uploadFilePath)
			return false
		}
		contentSize = int64((lastChunkIdx + 1) * meta.ChunkSizeByte)
		if contentSize > int64(meta.FileSize) {
			contentSize = int64(meta.FileSize)
		}
		fileSize = meta.FileSize
		chunkSize = meta.ChunkSizeByte
		return true
	}(); !ok {
		return
	}

	hash, err := ComputeFullHash(file, contentSize)
	if err != nil {
		logrus.Tracef("Skip full hash run: compute failed, path=%s, contentSize=%d, err=%v", uploadFilePath, contentSize, err)
		return
	}

	lock := GetUploadingLock(uploadFilePath)
	lock.Lock()
	defer lock.Unlock()

	stat, err := file.Stat()
	if err != nil {
		logrus.Tracef("Skip full hash commit: stat failed, path=%s, err=%v", uploadFilePath, err)
		return
	}
	if stat.Size() < UploadingMetaSize {
		logrus.Tracef("Skip full hash commit: file too small, path=%s, size=%d", uploadFilePath, stat.Size())
		return
	}
	meta, err := ReadUploadingMeta(file, stat.Size(), UploadingMetaSize)
	if err != nil || meta == nil {
		logrus.Tracef("Skip full hash commit: invalid meta, path=%s, err=%v", uploadFilePath, err)
		return
	}
	if meta.FullHashReady || meta.LastActivityAt != lastActivity {
		logrus.Tracef("Skip full hash commit: stale state, path=%s, ready=%t, lastActivity=%d, expectedActivity=%d", uploadFilePath, meta.FullHashReady, meta.LastActivityAt, lastActivity)
		return
	}
	meta.FullHash = hash
	meta.FullHashReady = true
	if bitsetSize, err := EnsureBitsetRegion(file, fileSize, chunkSize, UploadingMetaSize); err == nil {
		metaOffset := int64(fileSize) + bitsetSize
		if err := WriteUploadingMeta(file, metaOffset, meta, UploadingMetaSize); err != nil {
			logrus.Tracef("Failed to persist full hash: path=%s, err=%v", uploadFilePath, err)
			return
		}
		logrus.Tracef("Full hash generated: path=%s, contentSize=%d, hash=%s", uploadFilePath, contentSize, hash)
		return
	}
	logrus.Tracef("Skip full hash commit: ensure bitset failed, path=%s", uploadFilePath)
}
