package handlers_test

import (
	"archive/zip"
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"connectrpc.com/connect"
	apiHandlers "github.com/PKUHPC/private-scow/apps/scowd/internal/api/storage/handlers"
	fileUtils "github.com/PKUHPC/private-scow/apps/scowd/internal/storage/file"
	serviceHandlers "github.com/PKUHPC/private-scow/apps/scowd/internal/storage/service/handlers"
	apiv1 "github.com/PKUHPC/private-scow/apps/scowd/protos/gen/api/storage"
	"github.com/PKUHPC/private-scow/apps/scowd/protos/gen/api/storage/apiv1connect"
)

func TestDownloadRejectsInvalidChunkSize(t *testing.T) {
	servers := map[string]apiv1connect.FileServiceHandler{
		"parent": &apiHandlers.FileServer{},
		"child":  &serviceHandlers.FileServer{},
		"k8s":    &apiHandlers.K8sFileServer{},
	}
	for name, server := range servers {
		for _, size := range []uint32{0, fileUtils.MaxDownloadChunkSizeByte + 1, ^uint32(0)} {
			t.Run(fmt.Sprintf("%s/%d", name, size), func(t *testing.T) {
				// 不提供用户、文件或流，确保在启动子进程、访问文件及发送数据前拒绝请求。
				errors := map[string]error{
					"download": server.Download(context.Background(), connect.NewRequest(&apiv1.DownloadRequest{
						ChunkSizeByte: size,
					}), nil),
					"compress": server.CompressAndDownload(context.Background(), connect.NewRequest(&apiv1.CompressAndDownloadRequest{
						ChunkSizeByte: size,
					}), nil),
				}
				for operation, err := range errors {
					if connect.CodeOf(err) != connect.CodeInvalidArgument {
						t.Errorf("%s: expected InvalidArgument, got %v", operation, err)
					} else if !strings.Contains(err.Error(), "chunk_size_byte") {
						t.Errorf("%s: expected chunk size validation error, got %v", operation, err)
					}
				}
			})
		}
	}
}

func TestDownloadAcceptsValidChunkSize(t *testing.T) {
	content := []byte("download chunk size boundary test")
	path := filepath.Join(t.TempDir(), "file.txt")
	if err := os.WriteFile(path, content, 0o600); err != nil {
		t.Fatal(err)
	}
	_, handler := apiv1connect.NewFileServiceHandler(&serviceHandlers.FileServer{})
	server := httptest.NewServer(handler)
	defer server.Close()
	client := apiv1connect.NewFileServiceClient(server.Client(), server.URL)

	for _, size := range []uint32{1, 64 * 1024, fileUtils.MaxDownloadChunkSizeByte} {
		t.Run(fmt.Sprint(size), func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			download, err := client.Download(ctx, connect.NewRequest(&apiv1.DownloadRequest{
				Path: path, ChunkSizeByte: size,
			}))
			if err != nil {
				t.Fatal(err)
			}
			defer download.Close()
			var data bytes.Buffer
			for download.Receive() {
				chunk := download.Msg().Chunk
				if len(chunk) == 0 || uint32(len(chunk)) > size {
					t.Fatalf("unexpected download chunk length: %d", len(chunk))
				}
				data.Write(chunk)
			}
			if err := download.Err(); err != nil {
				t.Fatal(err)
			}
			if !bytes.Equal(data.Bytes(), content) {
				t.Fatalf("download content mismatch: %q", data.Bytes())
			}

			compressed, err := client.CompressAndDownload(ctx, connect.NewRequest(&apiv1.CompressAndDownloadRequest{
				Paths: []string{path}, ChunkSizeByte: size,
			}))
			if err != nil {
				t.Fatal(err)
			}
			defer compressed.Close()
			data.Reset()
			for compressed.Receive() {
				chunk := compressed.Msg().Chunk
				if len(chunk) == 0 || uint32(len(chunk)) > size {
					t.Fatalf("unexpected compressed chunk length: %d", len(chunk))
				}
				data.Write(chunk)
			}
			if err := compressed.Err(); err != nil {
				t.Fatal(err)
			}
			archive, err := zip.NewReader(bytes.NewReader(data.Bytes()), int64(data.Len()))
			if err != nil {
				t.Fatal(err)
			}
			if len(archive.File) != 1 || archive.File[0].Name != "file.txt" {
				t.Fatalf("unexpected archive entries: %+v", archive.File)
			}
			entry, err := archive.File[0].Open()
			if err != nil {
				t.Fatal(err)
			}
			defer entry.Close()
			uncompressed, err := io.ReadAll(entry)
			if err != nil {
				t.Fatal(err)
			}
			if !bytes.Equal(uncompressed, content) {
				t.Fatalf("compressed download content mismatch: %q", uncompressed)
			}
		})
	}
}
