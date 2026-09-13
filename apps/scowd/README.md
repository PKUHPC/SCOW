# SCOWD

SCOWD（SCOW Daemon）部署在集群登录节点，向 SCOW 提供文件操作、存储配额、跨集群文件传输、交互式应用、桌面、Shell 和代理服务。当前 SCOW 要求每个集群登录节点配置 SCOWD 端口。

- [介绍、安装与配置](../../docs/docs/deploy/scowd/configuration.md)
- [子进程资源限制技术方案](../../docs/docs/deploy/scowd/resource-limits.md)

## 代码与依赖

服务源码由 [PKUHPC/SCOWD](https://github.com/PKUHPC/SCOWD) 迁入，初始迁移基于提交 `6825724b4d4784553890ef3cbeb3cf55fe84ed70`。后续开发和构建在本 monorepo 中进行。

```text
apps/scowd/
├── cmd/scowd/       # main、init、Shell 脚本初始化入口
├── internal/        # API、应用、存储、桌面、进程、代理等实现
├── assets/          # 内嵌 Shell 脚本
├── configs/         # 内嵌配置与 systemd 服务示例
├── resources.go     # go:embed 资源声明
├── protos/gen/      # 本地生成的 Go/Connect-RPC 代码，不提交
└── build/bin/       # 编译产物，不提交
```

SCOWD 属于根 module `github.com/PKUHPC/private-scow`，依赖和生成工具由根 `go.mod`、`go.sum` 管理，默认使用根 `go.work`。本目录没有独立的 Go module。

Proto 来源为 [libs/protos/scowd/protos](../../libs/protos/scowd/protos)，Buf managed 配置负责将 Go import 映射到根 module 下的路径；[libs/scowd](../../libs/scowd) 是 TypeScript 客户端库。生成代码使用同一次 checkout 中的 proto，无需额外拉取远端仓库或配置 GitHub token。

## 开发与构建

需要 Linux、根 `go.mod` 指定的 Go 版本、make 和根 `package.json` 指定的 pnpm。首次使用先在仓库根目录执行 `pnpm install`。以下命令在 `apps/scowd` 下执行：

```bash
# 生成 proto；go tool 按根 go.mod 的 tool 声明自动下载并编译所需工具
pnpm prepareDev

# 默认构建 Linux amd64：build/bin/scowd-amd64
pnpm build

# Linux arm64：build/bin/scowd-arm64
ARCH=arm64 VERSION=dev pnpm build

# 可选：注入有效期，默认不设置；时间格式为 RFC3339
VERSION=dev EXPIRE_TIME=2027-12-31T00:00:00+08:00 pnpm build

pnpm lint
pnpm test

# Docker 构建并导出二进制到 build/bin，无需本机安装 Go
ARCH=arm64 VERSION=dev pnpm build:docker
```

`build`、`lint`、`test` 均先生成 proto。在仓库根目录可执行 `pnpm build:scowd` 或 `pnpm --filter @scow/scowd test`；根目录 `pnpm prepareDev`、`pnpm lint`、`pnpm test` 也包含本服务。新增 Go 依赖时在根目录维护，生成 proto 后运行 `go mod tidy`。

Docker 构建文件为 [docker/Dockerfile.scowd](../../docker/Dockerfile.scowd)，上下文是仓库根目录。它复制根 `go.mod/go.sum` 及所需服务源码，以 `CGO_ENABLED=0` 交叉编译，`scowd-target` 阶段只导出二进制。

## 安装与运行

推荐将二进制安装到固定目录（以下为 `/scowd`），再在该目录执行 `init`。以下命令从 `apps/scowd` 开始：

```bash
sudo install -d -m 0755 /scowd
sudo install -m 0755 build/bin/scowd-amd64 /scowd/scowd
cd /scowd
./scowd --version
sudo ./scowd init
# 修改 /scowd/configs/scowd.yaml 后启动
sudo ./scowd
```

`init` 将内嵌配置写到**当前工作目录**的 `configs/`，会覆盖同名文件；实际启动时从**二进制所在目录**的 `configs/scowd.yaml` 读取配置。因此不要在 `apps/scowd` 下运行 `./build/bin/scowd-amd64 init` 后直接启动该二进制。

服务以 root 启动，按请求用户身份运行子进程。首次正常启动会初始化 Shell 脚本、日志及 SQLite 数据库：默认日志位于二进制旁的 `logs/`，数据库为同目录的 `scowd.db`。升级时保留配置、证书与数据库，不要重新运行 `init` 覆盖现有配置。systemd 部署、TLS 和 SCOW 端配置见[安装与配置文档](../../docs/docs/deploy/scowd/configuration.md)。

## 构建发布

[.github/workflows/scowd.yaml](../../.github/workflows/scowd.yaml) 使用当前 checkout 的源码和 proto 生成、测试并编译：

| 触发方式 | 架构 |
| --- | --- |
| master push / PR | amd64 |
| `v**` tag push | amd64、arm64 |
| 手动触发 | amd64；`build_arm64=true` 时增加 arm64 |

手动构建支持 `expire_time` 和 `target`。产物命名为 `scowd-amd64`、`scowd-arm64`，上传路径为 `scowbin/scowd/<target>/scowd-<arch>`；master 使用 `master`，PR 使用 `pr-N`，手动构建使用输入的 `target`，PR 关闭时清理对应产物。

当前上传脚本尚未为 tag 单独设置目标目录，tag 自动构建会落入 `pr-` 目录，不能假定已有按 tag 归档的下载地址。需要按版本归档时，可选择对应 tag 手动触发并将 `target` 设为版本号。

## 验证

单元测试不替代集群验证。部署后检查文件读写、存储配额、跨集群传输、Shell、应用代理和桌面功能。noVNC 需覆盖页面打开、静态资源加载、WebSocket/VNC 建立连接及实际连接到已有桌面；修改代理配置时同时检查路径转发和 WebSocket upgrade。无集群和桌面环境时，应明确记录这部分未测。
