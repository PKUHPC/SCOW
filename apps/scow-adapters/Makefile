ARCH ?= amd64

.PHONY: protos build build-ai build-slurm build-crane build-crane-ai build-ai-expire build-slurm-expire lint test cranesched clean build-ci

# VERSION 可由外部传入（CI 通过 --build-arg 传递 tag 或分支名），
# 本地构建时自动从 git describe 获取，无 tag 时降级为 dev。
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")

EXPIRE_TIME ?= 2025-03-20T09:48:00+08:00
COMMIT_ID := $(shell git rev-parse --short HEAD)
BUILD_TIME := $(shell date +'%a, %d %b %Y %H:%M:%S %z')
LDFLAGS := -ldflags \
           "-X 'scow-adapters/pkg/common/utils.Version=$(VERSION)' \
           -X 'scow-adapters/pkg/common/utils.GitCommit=$(COMMIT_ID)' \
           -X 'scow-adapters/pkg/common/utils.BuildTime=$(BUILD_TIME)'"

EXPIRE_LDFLAGS := -ldflags \
           "-X 'scow-adapters/pkg/common/utils.Version=$(VERSION)' \
           -X 'scow-adapters/pkg/common/utils.GitCommit=$(COMMIT_ID)' \
           -X 'scow-adapters/pkg/common/utils.BuildTime=$(BUILD_TIME)' \
           -X 'scow-adapters/pkg/common/binary.ExpireTime=$(EXPIRE_TIME)'"

BIN_DIR := build/bin

LINT_PACKAGES := ./cmd/scow-ai-adapter/... \
                 ./cmd/scow-slurm-adapter/... \
                 ./cmd/scow-crane-adapter/... \
                 ./pkg/common/... \
                 ./pkg/ai/... \
                 ./pkg/slurm/... \
                 ./pkg/crane/...

protos: protos-adapters cranesched

protos-adapters:
	go tool buf generate --template buf.gen.yaml ../../libs/protos/scheduler-adapter

build: build-ai build-slurm build-crane
	@echo "- Building executables with $(GO_VERSION)..."
	@echo "    - Binaries are in ./$(BIN_DIR)/"

build-ai:
	@echo "- Building scow-ai-adapter with $(GO_VERSION)..."
	@mkdir -p $(BIN_DIR)
	@cd cmd/scow-ai-adapter/ && GOOS=linux GOARCH=${ARCH} go build $(LDFLAGS) \
					-o ../../$(BIN_DIR)/scow-ai-adapter || exit 1;
	@echo "    - Binaries are in ./$(BIN_DIR)/"

build-slurm:
	@echo "- Building scow-slurm-adapter with $(GO_VERSION)..."
	@mkdir -p $(BIN_DIR)
	@cd cmd/scow-slurm-adapter/ && CGO_ENABLED=1 GOARCH=${ARCH} go build $(LDFLAGS) \
					-o ../../$(BIN_DIR)/scow-slurm-adapter || exit 1;
	@echo "    - Binaries are in ./$(BIN_DIR)/"

build-crane:
	@echo "- Building scow-crane-adapter with $(GO_VERSION)..."
	@mkdir -p $(BIN_DIR)
	@cd cmd/scow-crane-adapter/ && CGO_ENABLED=1 GOARCH=${ARCH} go build $(LDFLAGS) \
					-o ../../$(BIN_DIR)/scow-crane-adapter || exit 1;
	@echo "    - Binaries are in ./$(BIN_DIR)/"

build-crane-ai:
	@echo "- Building scow-crane-ai-adapter with $(GO_VERSION)..."
	@mkdir -p $(BIN_DIR)
	@cd cmd/scow-crane-ai-adapter/ && CGO_ENABLED=1 GOARCH=${ARCH} go build $(LDFLAGS) \
					-o ../../$(BIN_DIR)/scow-crane-ai-adapter || exit 1;
	@echo "    - Binaries are in ./$(BIN_DIR)/"

build-ai-expire:
	@echo "- Building scow-ai-adapter with $(GO_VERSION)..."
	@cd cmd/scow-ai-adapter/ && GOARCH=${ARCH} go build $(EXPIRE_LDFLAGS) \
					-o ../../scow-ai-adapter || exit 1;
	@echo "    - Binaries are in ./"

build-slurm-expire:
	@echo "- Building scow-slurm-adapter with $(GO_VERSION)..."
	@cd cmd/scow-slurm-adapter/ && CGO_ENABLED=1 GOARCH=${ARCH} go build $(EXPIRE_LDFLAGS) \
					-o ../../scow-slurm-adapter || exit 1;
	@echo "    - Binaries are in ./"

lint:
	go vet $(LINT_PACKAGES)

test:
	go test

cranesched:
	go tool buf generate --template buf.genCrane.yaml https://github.com/PKUHPC/CraneSched.git#subdir=protos,tag=V1.1.3

build-ci:
	docker buildx build \
		--file Dockerfile \
		--target output \
		--output type=local,dest=docker-out \
		--build-arg VERSION=$(VERSION) \
		--build-arg TARGETARCH=$(ARCH) \
		../..

clean:
	@echo "- Cleaning build artifacts"
	@rm -rf build
