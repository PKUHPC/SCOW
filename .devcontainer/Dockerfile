FROM mcr.microsoft.com/devcontainers/typescript-node:22-bookworm

RUN corepack enable

# Install Go
ARG GO_VERSION=1.25.9
RUN curl -fsSL https://mirrors.aliyun.com/golang/go${GO_VERSION}.linux-amd64.tar.gz \
    | tar -C /usr/local -xz
ENV PATH=$PATH:/usr/local/go/bin
ENV GOPATH=/home/node/go
ENV PATH=$PATH:$GOPATH/bin
ENV GOPROXY=https://goproxy.cn,direct
