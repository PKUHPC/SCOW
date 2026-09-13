---
title: SCOWD 介绍及配置
sidebar_position: 1
---

# SCOWD 介绍及配置

SCOWD（SCOW Daemon）是部署在集群登录节点上的守护进程，提供文件、存储配额、跨集群文件传输、交互式应用、桌面、Shell 和代理能力。它通过 Go/Connect-RPC 服务承接原先大量依赖 SSH 的节点操作；部分操作仍会调用 SSH 或集群命令。

当前每个集群登录节点都必须配置 SCOWD，不能再通过集群级 `scowd.enabled` 关闭。已有部署的配置迁移见 [scowd 配置迁移](../upgrade/scowd-required.md)。

源码现位于本仓库 `apps/scowd`，Go 依赖统一由根 `go.mod/go.sum/go.work` 管理；`libs/protos/scowd/protos` 是协议来源，`libs/scowd` 是 TypeScript 客户端库。

## 获取二进制

### 下载预编译版

当前发布仓库为 `https://ccrepo.pku.edu.cn/repository/scowbin/scowd/`。示例下载 master 的 amd64 产物：

```bash
TARGET=master
ARCH=amd64
curl -fL -o scowd "https://ccrepo.pku.edu.cn/repository/scowbin/scowd/${TARGET}/scowd-${ARCH}"
chmod 0755 scowd
./scowd --version
```

PR 产物目录是 `pr-N`，手动构建使用流水线 `target` 输入指定目录。默认 master/PR 仅构建 amd64；`v**` tag 构建 amd64 和 arm64，手动构建可开启 `build_arm64`。下载 arm64 前需确认目标目录下已有该架构的产物。

当前 `.github/workflows/scowd.yaml` 的上传脚本尚未为 tag 单独设置目录，tag 自动构建会使用 `pr-` 目录。若需按版本归档，可在对应 tag 手动触发构建并设置 `target` 为版本号。当前构建入口不提供独立的 `scowd-centos7` 产物或混淆构建选项；普通构建默认没有过期时间。

### 从本仓库编译

准备 Linux、根 `go.mod` 指定的 Go 版本、make 和根 `package.json` 指定的 pnpm，在本仓库根目录执行：

```bash
pnpm install
pnpm --filter @scow/scowd prepareDev
pnpm build:scowd
```

输出为 `apps/scowd/build/bin/scowd-amd64`。在 `apps/scowd` 目录下可使用：

```bash
# 交叉编译 arm64
ARCH=arm64 VERSION=dev pnpm build

# 设置过期时间（默认不设置）
VERSION=dev EXPIRE_TIME=2027-12-31T00:00:00+08:00 pnpm build

# 使用 Docker 构建并导出二进制
ARCH=arm64 VERSION=dev pnpm build:docker
```

默认使用根 Go workspace，不需要设置 `GOWORK=off`。`go tool` 自动下载和编译根 `go.mod` 声明的 Buf、protoc-gen-go、protoc-gen-connect-go。Proto 来自本次 checkout，无需再克隆独立 SCOWD 仓库或从远端获取 proto。

有效期为 RFC3339 时间，程序启动时检查，并在运行期间每 30 分钟检查一次；不是到期瞬间退出。编译和测试命令详见仓库 `apps/scowd/README.md`。

## 安装与初始化

以下以安装到 `/scowd` 为例，假定当前目录已有下载好的 `scowd` 二进制：

```bash
sudo install -d -m 0755 /scowd
sudo install -m 0755 ./scowd /scowd/scowd
cd /scowd
sudo ./scowd init
sudo install -d -m 0700 /scowd/certs
```

`init` 生成 `configs/scowd.yaml` 和 `configs/scowd.service`，写入位置是当前工作目录，**会覆盖同名文件**。服务读取的是二进制旁的 `configs/scowd.yaml`，所以应在安装目录执行 `init`。仅首次部署执行，升级时保留原配置和证书。

正常运行以 root 启动主进程，由子进程切换到请求用户的 UID/GID；需要节点上存在对应用户、家目录以及该功能使用的集群工具。配置文件由管理员维护，证书私钥限制为 root 可读。不要用原文中的 `chmod 744` 修复配置目录访问问题：目录访问需要执行权限，且后续读取需求应根据实际子进程日志确认。

默认日志目录为二进制旁的 `logs/`，SQLite 数据库为 `scowd.db`。升级应保留数据库，避免丢失桌面等持久化状态。

### 基础配置

编辑 `/scowd/configs/scowd.yaml`：

```yaml
server:
  host: "0.0.0.0"
  port: 9999

TLS:
  enabled: false
```

这是隔离测试环境的最小示例。生产部署启用下节的双向 TLS，按部署网络设置监听地址和访问范围。修改监听地址、TLS、代理等启动时初始化的配置后，应重启 SCOWD；配置读取虽有按修改时间更新的缓存，但并非所有设置都会自动作用于已运行服务。

## 双向 TLS

SCOW 和 SCOWD 各持有证书与私钥，双方信任签发对方证书的 CA。`TLS.enabled=true` 时 SCOWD 要求并验证客户端证书。证书的 SAN 必须包含实际连接使用的 IP 或域名。

以下为在管理员受控目录中用 OpenSSL 签发测试证书的示例，将 `login01.example.com`、`192.168.1.101` 和 `scow.example.com` 替换为真实地址。已有证书体系的部署使用现有 CA 签发，无需创建新 CA。

```bash
umask 077
openssl genrsa -out ca.key 4096
openssl req -x509 -new -key ca.key -sha256 -days 3650 -subj '/CN=SCOW CA' -out ca.crt

openssl genrsa -out scowd.key 4096
openssl req -new -key scowd.key -subj '/CN=login01.example.com' -out scowd.csr
cat > scowd.ext <<'CERT'
subjectAltName=DNS:login01.example.com,IP:192.168.1.101
extendedKeyUsage=serverAuth,clientAuth
CERT
openssl x509 -req -in scowd.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out scowd.crt -days 365 -sha256 -extfile scowd.ext

openssl genrsa -out scow.key 4096
openssl req -new -key scow.key -subj '/CN=scow.example.com' -out scow.csr
cat > scow.ext <<'CERT'
subjectAltName=DNS:scow.example.com
extendedKeyUsage=clientAuth
CERT
openssl x509 -req -in scow.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out scow.crt -days 365 -sha256 -extfile scow.ext

openssl verify -CAfile ca.crt scowd.crt scow.crt
openssl x509 -in scowd.crt -noout -ext subjectAltName
```

SCOWD 证书同时允许 `serverAuth` 和 `clientAuth`，因为跨集群传输会复用此证书作为客户端身份。CA 私钥留在签发环境，无需部署到 SCOW 或 SCOWD。

将 `ca.crt`、`scowd.crt`、`scowd.key` 安装到 SCOWD 节点 `/scowd/certs/` 后，修改配置：

```yaml
TLS:
  enabled: true
  caCertPath: /scowd/certs/ca.crt
  serverCertPath: /scowd/certs/scowd.crt
  serverPrivateKeyPath: /scowd/certs/scowd.key
```

在 SCOW 部署目录中，将 `ca.crt`、`scow.crt`、`scow.key` 放到 `config/scowd/certs/`，在 `install.yaml` 配置：

```yaml
scowd:
  ssl:
    enabled: true
    caCertPath: ./scowd/certs/ca.crt
    scowCertPath: ./scowd/certs/scow.crt
    scowPrivateKeyPath: ./scowd/certs/scow.key
```

这些 SCOW 端路径相对其 `config/` 目录；SCOWD 端示例则使用节点上的绝对路径。不要混淆两台机器的证书存放位置。SCOWD 的 TLS 和 SCOW 的 `scowd.ssl.enabled` 必须一致。

## systemd 服务

内嵌 `configs/scowd.service` 默认使用 `/scowd` 作为工作目录，以 root 运行，保留 PATH、TERM、`KillMode=process` 等配置。若安装在其他位置，修改 `ExecStart` 和 `WorkingDirectory` 后再安装：

```bash
cd /scowd
sudo install -m 0644 configs/scowd.service /etc/systemd/system/scowd.service
sudo systemctl daemon-reload
sudo systemctl enable --now scowd
sudo systemctl status scowd
sudo journalctl -u scowd -n 100 --no-pager
```

更新配置或二进制后执行 `sudo systemctl restart scowd`。前台排查时先停止 systemd 服务，再在安装目录执行 `sudo ./scowd`，避免端口冲突。

## SCOW 集群配置

在 SCOW 部署目录的 `config/clusters/hpc01.yaml` 中为每个登录节点配置端口：

```yaml
displayName: hpc01
adapterUrl: 192.168.1.10:8999
loginNodes:
  - name: login01
    address: 192.168.1.101
    scowd:
      port: 9999
```

不要增加旧的集群级 `scowd.enabled`。在 SCOW 部署目录验证并应用配置：

```bash
./cli check-config
./cli check-clusters
./cli compose up -d
```

`check-clusters` 会检查 SCOWD 健康状态。`compose up -d` 更新 SCOW 服务，SCOWD 自身由登录节点的 systemd 管理。

## 可选配置

### 日志

```yaml
logger:
  level: info
  directory: /scowd/logs
  retentionDays: 90
  compressDays: 3
```

未配置日志目录时使用二进制旁的 `logs/`。默认级别 `info`，日志保留 90 天、超过 3 天压缩。主进程和用户子进程使用不同日志路径。

### 子进程资源与空闲回收

```yaml
childProcess:
  resourceLimits:
    enabled: true
    cpuCores: 2
    memoryMB: 1024
  shellIdleTimeoutMinutes: 60
```

资源限制作用于用户子进程，使用 systemd/cgroup；部署节点需支持 `systemd-run`。不可用时可能回退到无资源限制的 exec 模式，须通过日志和实际 cgroup 验证，详见 [子进程资源限制](resource-limits.md)。

非 Shell 子进程默认空闲 10 分钟回收。使用过 Shell 的子进程在无连接后按 `shellIdleTimeoutMinutes` 回收，配置小于等于 0 时使用默认 60 分钟；有 Shell 连接时不会按该空闲策略回收。

### AI 与共享文件夹

```yaml
ai:
  enabled: true
  sharedFolderPath: /data/.shared
  containerRuntime: containerd
```

`ai.enabled=true` 时 `sharedFolderPath` 必填，启用相应 AI 文件处理方式；不能将此开关理解为跳过所有文件路径或权限检查。`containerRuntime` 支持 `containerd`、`docker`，未配置时使用 containerd。

### 跨集群文件传输

在对应集群的 SCOW 配置中设置：

```yaml
crossClusterFileTransfer:
  enabled: true
  transferNode: login01.example.com:9999
```

发送端 SCOWD 需要访问接收端的地址与端口。启用 TLS 时，两端 SCOWD 需信任对方证书，且仍能与 SCOW 通信；证书同时用于客户端和服务端认证。

SCOWD 的传输分片大小可选配置：

```yaml
fileTransfer:
  chunkSizeMB: 40
```

当前代码默认 40 MiB（配置项名沿用 `MB`），小于等于 0 时使用默认值。内嵌配置模板的注释仍写作 100MB，以这里说明的代码默认值为准。

### VNC 密码刷新与 Slurm

当前 VNC 密码刷新**优先使用 SSH**，SSH 失败且请求带有 JobId 时再尝试 `srun`。如果用户 PATH 中没有 `srun`，可配置 Slurm 命令目录：

```yaml
slurm:
  binPath: /opt/slurm/bin
```

## SCOWD 代理网关

SCOWD 支持适配器 TCP 代理和交互式应用 HTTP 代理，分别配置监听端口。示例写入 `/scowd/configs/scowd.yaml`：

```yaml
proxy:
  adapterProxy:
    enabled: true
    host: "0.0.0.0"
    port: 8999
    adapterAddress: 192.168.1.10:8999
    adapterTLS:
      enabled: false
  appProxy:
    enabled: true
    host: "0.0.0.0"
    port: 9000
```

`adapterAddress` 使用 `host:port`，不要加 `http://`。SCOW 到适配器代理的 TLS 复用 SCOWD 顶层 `TLS`；代理到真实适配器的 TLS 由 `adapterTLS` 单独控制：

```yaml
adapterTLS:
  enabled: true
  caCertPath: /scowd/certs/adapter-ca.crt
  clientCertPath: /scowd/certs/adapter-client.crt
  clientPrivateKeyPath: /scowd/certs/adapter-client.key
```

上面的 `adapterTLS` 字段应放在 `proxy.adapterProxy` 下。在 SCOW 集群配置中将连接目标指向代理：

```yaml
adapterUrl: 192.168.1.101:8999
proxyGateway:
  url: http://192.168.1.101:9000
```

`appProxy` 当前监听 HTTP，不随顶层 `TLS.enabled` 切换为 HTTPS。若适配器代理启用了 TLS，在 SCOW 的 `install.yaml` 中配置 `adapter.ssl` 验证代理证书；该入口复用 SCOWD 服务端证书，因此可使用与 `scowd.ssl` 相同的 CA 和客户端证书：

```yaml
adapter:
  ssl:
    enabled: true
    caCertPath: ./scowd/certs/ca.crt
    scowCertPath: ./scowd/certs/scow.crt
    scowPrivateKeyPath: ./scowd/certs/scow.key
```

## 部署后验证

- 在 SCOW 端执行配置与集群检查，验证 TLS、地址、端口和健康状态。
- 使用实际集群用户验证文件读写、权限和存储配额；启用跨集群传输时验证双向连通及证书。
- 打开 Shell，提交交互式应用，检查日志与用户子进程回收。
- noVNC 必须覆盖页面打开、静态资源加载、WebSocket/VNC 连接建立，以及实际连接到已有桌面；启用代理时重点检查 URL、路径转发和 WebSocket upgrade。

单元测试与文档构建不覆盖上述真实集群链路。没有登录节点、代理和已有桌面环境时，应在自测记录中明确这些项目未测。
