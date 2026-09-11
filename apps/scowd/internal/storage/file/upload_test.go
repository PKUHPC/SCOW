package file

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"syscall"
	"testing"
)

// MockDirEntry is a mock implementation of fs.DirEntry for testing purposes.
type MockDirEntry struct {
	name  string
	isDir bool
}

func (m MockDirEntry) Name() string {
	return m.name
}

func (m MockDirEntry) IsDir() bool {
	return m.isDir
}

func (m MockDirEntry) Type() fs.FileMode {
	return 0
}

func (m MockDirEntry) Info() (fs.FileInfo, error) {
	return nil, nil
}

func TestCheckSequentialFiles(t *testing.T) {
	tests := []struct {
		entries       []fs.DirEntry
		expectedError bool
	}{
		{
			entries: []fs.DirEntry{
				MockDirEntry{name: "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e_1.scowuploadtemp", isDir: false},
				MockDirEntry{name: "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e_2.scowuploadtemp", isDir: false},
				MockDirEntry{name: "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e_3.scowuploadtemp", isDir: false},
			},
			expectedError: false,
		},
		{
			entries: []fs.DirEntry{
				MockDirEntry{name: "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e_1.scowuploadtemp", isDir: false},
				MockDirEntry{name: "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e_3.scowuploadtemp", isDir: false}, // Missing 2nd chunk
			},
			expectedError: true,
		},
		{
			entries: []fs.DirEntry{
				MockDirEntry{name: "invalid_name.scowuploadtemp", isDir: false}, // Invalid name
			},
			expectedError: true,
		},
	}

	for _, test := range tests {
		tempDir := t.TempDir()

		// Create files and write matching data
		for _, entry := range test.entries {
			filePath := filepath.Join(tempDir, entry.Name())
			err := os.WriteFile(filePath, []byte("Hello World"), 0644)
			if err != nil {
				t.Fatal(err)
			}
		}

		// Call CheckSequentialFiles and check for error
		err := CheckSequentialFiles(test.entries, tempDir, 3)
		if test.expectedError && err == nil {
			t.Errorf("Expected error but got none")
		} else if !test.expectedError && err != nil {
			t.Errorf("Did not expect error but got: %v", err)
		}
	}
}

func TestPreallocateFileFallsBackWhenUnsupported(t *testing.T) {
	file, err := os.CreateTemp(t.TempDir(), "uploading-*")
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()

	const expectedSize = int64(4096)
	err = preallocateFile(file, expectedSize, func(int, uint32, int64, int64) error {
		return syscall.EOPNOTSUPP
	})
	if err != nil {
		t.Fatalf("preallocateFile returned an error: %v", err)
	}

	info, err := file.Stat()
	if err != nil {
		t.Fatal(err)
	}
	if info.Size() != expectedSize {
		t.Fatalf("expected file size %d, got %d", expectedSize, info.Size())
	}
}

func TestPreallocateFileReturnsUnexpectedError(t *testing.T) {
	file, err := os.CreateTemp(t.TempDir(), "uploading-*")
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()

	expectedErr := errors.New("preallocation failed")
	err = preallocateFile(file, 4096, func(int, uint32, int64, int64) error {
		return expectedErr
	})
	if !errors.Is(err, expectedErr) {
		t.Fatalf("expected %v, got %v", expectedErr, err)
	}
}
