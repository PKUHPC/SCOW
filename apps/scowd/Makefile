ARCH ?= amd64
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
EXPIRE_TIME ?=
BIN_DIR := build/bin
LDFLAGS := -ldflags "-s -w -X 'scowd/internal/process/common.Version=$(VERSION)' -X 'scowd/internal/utils/binary.ExpireTime=$(EXPIRE_TIME)'"

.PHONY: protos build build-docker lint test

protos:
	# 使用 SCOWD 自己的 Go module 工具声明，避免仓库根 go.work 覆盖工具集。
	GOWORK=off go tool buf generate --template buf.gen.yaml ../../libs/protos/scowd/protos

build: protos
	CGO_ENABLED=0 GOOS=linux GOARCH=$(ARCH) go build $(LDFLAGS) -o $(BIN_DIR)/scowd-$(ARCH) ./cmd/scowd

build-docker:
	docker buildx build --file ../../docker/Dockerfile.scowd \
		--target scowd-target --platform linux/$(ARCH) \
		--build-arg VERSION="$(VERSION)" --build-arg EXPIRE_TIME="$(EXPIRE_TIME)" \
		--output type=local,dest=$(BIN_DIR) ../..

lint: protos
	CGO_ENABLED=0 go vet ./...

test: protos
	CGO_ENABLED=0 go test -timeout 5m ./...
