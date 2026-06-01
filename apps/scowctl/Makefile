ARCH ?= amd64
GOOS ?= linux
CGO_ENABLED ?= 0

.PHONY: build lint test clean

# VERSION 可由外部传入（CI 通过 --build-arg 传递 tag 或分支名），
# 本地构建时自动从 git describe 获取，无 tag 时降级为 dev。
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")

BIN_DIR := build/bin
BINARY := scowctl
LDFLAGS := -ldflags "-s -w -X 'main.version=$(VERSION)'"

build:
	@echo "- Building $(BINARY) for $(GOOS)/$(ARCH)..."
	@mkdir -p $(BIN_DIR)
	@CGO_ENABLED=$(CGO_ENABLED) GOOS=$(GOOS) GOARCH=$(ARCH) go build -trimpath $(LDFLAGS) \
		-o $(BIN_DIR)/$(BINARY) .
	@echo "    - Binary is in ./$(BIN_DIR)/"

lint:
	go vet ./...

test:
	go test ./...

clean:
	@echo "- Cleaning build artifacts"
	@rm -rf build
