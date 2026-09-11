# SCOWD

SCOWD 是运行在集群节点上的 Go 服务，提供文件、存储配额、交互式应用、桌面、Shell 和代理能力。

源码迁自 [PKUHPC/SCOWD](https://github.com/PKUHPC/SCOWD)，基于提交 `6825724b4d4784553890ef3cbeb3cf55fe84ed70`（`feat: v1.12.0 (#115)`）。服务继续使用独立的 `scowd` Go module；`libs/scowd` 是 TypeScript 客户端库。

## 本地开发与构建

需要 Linux、Go 1.25.6 或更新版本、make 和仓库指定的 pnpm。以下命令在本目录执行：

```bash
# 从本仓库 libs/protos/scowd/protos 生成 Go 和 Connect-RPC 代码
pnpm prepareDev

# 编译 Linux amd64，输出 build/bin/scowd-amd64
pnpm build

# 指定架构、版本或有效期（默认无有效期）
ARCH=arm64 VERSION=v1.12.0 pnpm build
VERSION=v1.12.0 EXPIRE_TIME=2027-12-31T00:00:00+08:00 pnpm build

pnpm lint
pnpm test

# 以仓库根目录为 Docker 构建上下文，导出相同命名的二进制
ARCH=arm64 pnpm build:docker
```

也可在仓库根目录执行 `pnpm build:scowd`。根目录的 `pnpm prepareDev`、`pnpm lint`、`pnpm test` 会包含本服务；`pnpm build:scow` 不包含独立部署的 SCOWD。

Proto 唯一来源是 `../../libs/protos/scowd/protos`。生成文件位于 `protos/gen`，不提交到 Git；不再通过 GitHub token 或远端分支/tag 获取 proto。修改 proto 后重新运行 `pnpm prepareDev`。

## 运行

```bash
./build/bin/scowd-amd64 --version
./build/bin/scowd-amd64 init
# 根据集群环境修改 configs/scowd.yaml 后运行
./build/bin/scowd-amd64
```

`init` 会将内嵌配置写到当前工作目录的 `configs/`，会覆盖同名文件。systemd 服务示例见 `configs/scowd.service`，请根据安装位置调整路径。服务依赖集群用户、存储及桌面等宿主机环境，部署方式沿用上游。

## 流水线

- `test-build-publish.yaml` 构建 SCOWD：PR/master 构建 amd64，tag 同时构建 arm64。发布路径为 `scowbin/scowd/<master|tag|pr-N>/scowd-<amd64|arm64>`，PR 关闭时清理对应产物。
- `build-multi-arch-expire.yaml` 支持手动构建 arm64 和注入 `expire_time`，使用 `target` 指定产物目录。默认不注入有效期；指定时须使用 RFC3339 时间格式。
- Docker 构建使用 `docker/Dockerfile.scowd`，只导出二进制。proto 与服务源码来自同一次 checkout，版本号使用当前 SCOW 分支/tag。

## 集群回归验证

`pnpm test` 覆盖迁入的 Go 单元测试。部署前还需在真实集群检查文件读写/传输、存储配额、Shell、应用代理和桌面功能。

桌面和代理回归需覆盖 noVNC 页面打开、静态资源加载、WebSocket/VNC 连接建立，以及实际连接到已有桌面；涉及反向代理时同时检查路径转发和 WebSocket upgrade。无集群、桌面和代理环境时，单元测试无法代替这部分连接链路验证。
