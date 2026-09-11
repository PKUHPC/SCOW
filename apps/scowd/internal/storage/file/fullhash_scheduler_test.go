package file

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestRunFullHashPersistsMeta(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "sample.uploading")
	content := []byte("abcdefghij")
	chunkSize := uint64(4)
	fileSize := uint64(len(content))
	totalChunks := CalculateChunks(fileSize, chunkSize)
	bitsetSize := GetBitsetSize(fileSize, chunkSize)

	file, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0644)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := file.WriteAt(content, 0); err != nil {
		t.Fatal(err)
	}
	if _, err := EnsureBitsetRegion(file, fileSize, chunkSize, UploadingMetaSize); err != nil {
		t.Fatal(err)
	}
	for idx := uint64(0); idx < totalChunks; idx++ {
		if err := MarkChunkUploadedAt(file, int64(fileSize), totalChunks, idx); err != nil {
			t.Fatal(err)
		}
	}
	meta := &UploadingMeta{
		FileSize:       fileSize,
		ChunkSizeByte:  chunkSize,
		LastActivityAt: time.Now().Add(-2 * FullHashIdleDelay).UnixNano(),
	}
	if err := WriteUploadingMeta(file, int64(fileSize)+bitsetSize, meta, UploadingMetaSize); err != nil {
		t.Fatal(err)
	}
	expectedHash, err := ComputeFullHash(file, int64(fileSize))
	if err != nil {
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}

	runFullHash(path)

	file, err = os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = file.Close() }()

	stat, err := file.Stat()
	if err != nil {
		t.Fatal(err)
	}
	meta, err = ReadUploadingMeta(file, stat.Size(), UploadingMetaSize)
	if err != nil {
		t.Fatal(err)
	}
	if !meta.FullHashReady {
		t.Fatal("full hash was not marked ready")
	}
	if meta.FullHash != expectedHash {
		t.Fatalf("unexpected full hash: got %q want %q", meta.FullHash, expectedHash)
	}
}
