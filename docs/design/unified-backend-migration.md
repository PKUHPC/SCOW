# SCOW 统一后端渐进式迁移方案

## 1. 背景与目标

当前 SCOW 后端由多套 TypeScript/Next.js 服务组成，服务之间通过旧式 gRPC、REST、tRPC 和 Connect-RPC 交互。现有系统已经开始建设统一前端，因此后端需要在不影响现有用户和部署方式的前提下，逐步收敛到统一的 Go + Connect-RPC 后端。

本方案的目标不是一次性重写全部后端，而是建设一个可渐进替换的模块化单体：

- 生产环境最终运行一个 `scow-server` Go 进程和一个 Go 镜像；
- 内部按业务域组织模块，避免形成无边界的大单体；
- 对外主产品域为 HPC、AI、MIS；
- Notification 和 Resource 作为 MIS 的内部模块，未来数据并入 MIS 数据库；
- Quantum 保留为独立产品域；
- 以 Proto + Connect-RPC 作为新后端的统一契约和传输基础；
- 兼容现有 `SCOW_USER` 会话、旧 API 和 Docker Compose/scow-cli 部署；
- 通过双轨、影子校验、灰度切流和可回滚方式替换旧 TypeScript 服务。

本阶段只定义架构和迁移路线，不实施 Go 服务、Proto、Gateway、部署配置或数据库变更。

## 2. 当前后端现状

### 2.1 服务和协议

当前后端大致分为以下几类：

- `portal-server`：HPC 门户后端，主要使用 `@ddadaal/tsgrpc-server`，内部大量调用调度器适配器和 scowd；
- `mis-server`：管理系统后端，负责用户、租户、账户、授权、计费、配置等能力，主要使用 TypeScript gRPC；
- `ai`：使用 Next.js、tRPC、OpenAPI 和旧 gRPC 客户端，依赖 Kubernetes、Harbor 和 AI 适配器；
- `quantum`：具有独立页面、后端逻辑和数据库，作为独立产品域保留；
- `notification`：已经使用 Connect-RPC，但运行在 Next.js 服务中，拥有独立数据库；
- `resource`：同时使用 tRPC 和 Connect-RPC，负责资源授权规则，拥有独立数据库；
- `auth`、`audit-server`、`gateway`：分别承担认证、审计和统一 HTTP 入口能力；
- `scow-adapters`：已经是 Go 项目，负责与 Slurm、Crane、Kubernetes 等集群或调度器交互。

Proto 源码分布在 `protos/` 和部分独立的 `libs/protos/*` 包中。现有 Go 代码主要集中在 `apps/scow-adapters`，核心业务后端尚未迁移到 Go。

### 2.2 部署入口

现有生产部署以 Docker Compose 和 scow-cli 为主，Gateway/Nginx 是唯一公网 HTTP 入口。后端服务容器一般不直接暴露给外部客户端，内部通过服务名和端口互相访问。

统一前端已经通过 Gateway 使用统一 API 命名空间，并保留旧应用路径作为迁移期兼容入口。

## 3. 目标架构

### 3.1 整体拓扑

```text
统一前端 / 外部客户端
          |
        Gateway
          |
    scow-server:5000
          |
    interfaces layer
          |
  +-------+--------+---------+---------+
  |       |        |         |         |
 HPC     AI       MIS      Quantum   Platform
                  |
          +-------+--------+
          |                |
   Notification        Resource
```

`scow-server` 使用一个 HTTP/Connect 服务端和一个进程内服务注册表。对外由统一接口层注册 HPC、AI、MIS、Quantum 以及跨领域接口，接口层再编排内部领域应用服务。

### 3.2 模块化单体原则

模块化单体的目标是统一运行时，而不是取消业务边界：

- 每个模块拥有自己的 Application、Domain、Repository 和外部客户端；
- 模块只能通过公开的模块接口访问其他模块；
- 禁止跨模块直接访问 Repository 或数据库表；
- 同一进程内的模块调用使用类型化 Go 接口，不通过本机 HTTP 回环；
- 模块接口形态尽量与 Connect service 对齐，未来可以将本地实现替换为 Connect client；
- 所有模块共享发布周期，但使用模块级配置、超时、并发限制和切流开关；
- 进程无状态，可通过运行多个 `scow-server` 副本扩容。

### 3.3 接口层与领域层

后端分为三层：

```text
interfaces/   # 对外 API、协议适配和跨领域编排
domains/      # HPC、AI、MIS、Quantum 业务规则和领域应用服务
platform/     # 认证、错误、日志、配置、数据库等基础设施
```

接口层负责：

- 注册 Connect-RPC service；
- 处理 API 版本、请求校验和 DTO 映射；
- 读取认证上下文；
- 编排一个或多个领域应用服务；
- 设置超时、并发和取消；
- 聚合结果、处理部分失败；
- 统一错误码、分页和响应结构；
- 兼容旧 REST、tRPC、gRPC 和 Connect API。

接口层不直接访问数据库、scheduler、SSH 或 Kubernetes，也不实现 HPC/AI/MIS 的业务规则。领域层负责业务不变量、事务、Repository 和外部系统调用。

典型依赖关系：

```text
Connect Handler
      |
interfaces/dashboard, files, interactive
      |
domains/hpc, domains/ai, domains/mis, domains/quantum
      |
Repository / Adapter / External System
```

跨领域能力归入接口层：

- `interfaces/dashboard`：聚合 HPC 和 AI 仪表盘；
- `interfaces/files`：根据存储引用编排 HPC/AI 文件 Provider；
- `interfaces/interactive`：编排 HPC 登录节点 Shell、登录节点桌面以及未来 AI 开发环境会话。

HPC 和 AI 不依赖这些接口模块，避免循环依赖。

### 3.4 建议目录

```text
apps/backend-go/
├── cmd/
│   └── scow-server/
├── internal/
│   ├── app/                    # 进程组装、模块注册、生命周期
│   ├── platform/
│   │   ├── auth/               # SCOW_USER 校验和 Principal
│   │   ├── connect/             # Connect/gRPC 中间件
│   │   ├── config/
│   │   ├── database/
│   │   ├── error/
│   │   └── observability/
│   ├── interfaces/
│   │   ├── connect/             # Connect service 注册和协议适配
│   │   ├── hpc/
│   │   ├── ai/
│   │   ├── mis/
│   │   ├── quantum/
│   │   ├── dashboard/           # HPC + AI 聚合
│   │   ├── files/               # HPC/AI 文件统一入口
│   │   └── interactive/         # Shell、桌面和 VNC 会话编排
│   └── domains/
│       ├── hpc/
│       ├── ai/
│       ├── mis/
│       │   ├── notification/
│       │   └── resource/
│       └── quantum/
└── gen/                        # Buf 生成代码，不手工修改
```

## 4. 模块边界

### 4.1 Platform

Platform 只提供基础能力，不包含具体业务规则：

- `SCOW_USER` Cookie/Token 校验；
- 用户、租户、账户上下文；
- Connect/gRPC interceptor；
- 统一错误码和结构化错误详情；
- 日志、Trace、Metrics；
- 配置加载和密钥读取；
- 数据库连接池和迁移运行器；
- 健康检查、优雅关闭和请求生命周期管理。

### 4.2 HPC

HPC 模块承载现有 Portal 能力：

- 集群配置、集群状态和资源概览；
- Dashboard 数据；
- 作业和应用；
- HPC 文件管理；
- Shell、Desktop 和 noVNC；
- scheduler adapter 和 scowd 客户端。

HPC 通过 MIS 模块接口获取用户、租户、账户和授权信息，不直接访问 MIS 数据库。

### 4.3 AI

AI 模块承载：

- AI 集群和资源；
- 数据集、算法、模型和镜像；
- AI 作业、训练和开发环境；
- Harbor、Kubernetes 和 AI 适配器集成。

AI 的用户、租户、账户和授权依赖 MIS 模块接口。

### 4.4 MIS

MIS 是管理系统主模块，负责：

- 用户、租户、账户；
- 管理员和授权；
- 计费、账单和额度；
- 系统配置；
- 存储和管理端能力。

Notification 和 Resource 隶属于 MIS：

- Notification 负责消息、未读状态和订阅配置；
- Resource 负责资源授权、账户/租户规则和分区规则；
- 两者作为 MIS 内部模块运行，不作为新的一级产品系统建设；
- 迁移初期可以继续访问各自旧数据库，后续数据逐步并入 MIS 数据库。

### 4.5 Quantum

Quantum 保留为独立产品域和独立模块：

- 保留独立的 Quantum API 和页面入口；
- 初期继续使用独立数据库；
- 通过 MIS 模块接口获取用户、租户、账户和计费相关能力；
- 不在本次方案中强行并入 HPC、AI 或 MIS 数据库。

## 5. Proto、Connect-RPC 与 API 兼容策略

### 5.1 契约来源

- 继续以仓库 Proto 源码为契约来源；
- 保留现有 `scow.portal`、`scow.server`、Notification 和 Resource 包，避免破坏旧客户端；
- 新设计的接口使用版本化包，例如：
  - `scow.hpc.v1`；
  - `scow.ai.v1`；
  - `scow.mis.v1`；
  - `scow.quantum.v1`；
- Notification 和 Resource 的新能力放在 MIS 领域契约中；
- 使用 Buf 生成 Go protobuf、Go Connect handler/client 和 TypeScript Connect client；
- 生成代码只通过生成命令更新，不手工修改。

### 5.2 传输方式

`scow-server` 同时支持：

- Connect over HTTP/1.1；
- Connect over HTTP/2；
- 原生 gRPC；
- gRPC-Web。

浏览器和统一前端主要使用 Connect。旧 TypeScript 服务和适配器可以继续使用现有 gRPC 或 Connect 客户端。

### 5.3 对外 API 域

新的稳定 API 域为：

```text
/api/hpc/*
/api/ai/*
/api/mis/*
/api/quantum/*
```

统一前端现有的 `/api/unified/*` 路径继续作为过渡入口，由 Gateway 映射到对应产品域。

Notification 和 Resource 不再新增独立的一级 API 域。迁移期间保留旧路径兼容别名，并制定明确的下线版本和日期。

### 5.4 错误模型

统一使用 Connect/Google RPC 状态码，并支持结构化错误详情：

- `ErrorInfo`；
- `BadRequest`；
- `PreconditionFailure`；
- `RetryInfo`；
- 领域需要的业务错误详情。

业务代码不直接向客户端暴露数据库错误、第三方 SDK 错误或内部堆栈。

## 6. 认证、授权与跨模块调用

### 6.1 认证

迁移期继续使用现有 auth 服务和 `SCOW_USER` 会话：

1. Gateway 原样转发 Cookie 和 Authorization；
2. Go interceptor 调用 auth 的 token 校验接口；
3. 将用户身份转换为统一的 `Principal` 放入 Go `context`；
4. 领域模块从上下文中获取用户身份，不自行解析 Cookie；
5. 不信任客户端或 Gateway 注入的用户身份 Header。

服务间调用首期使用配置的服务 Token，并依靠内部网络隔离。mTLS 可以作为后续安全增强，不作为第一阶段前置条件。

### 6.2 授权

认证和授权分开处理：

- Platform 负责确认“请求是谁发出的”；
- MIS 负责提供用户、租户、账户和授权信息；
- HPC、AI、Quantum 负责执行自身资源和操作权限；
- Gateway 不承载领域授权逻辑。

### 6.3 跨模块调用与接口编排

同一进程内：

```text
interfaces/* -> domains/* Application Interface
domains/hpc, domains/ai, domains/quantum -> MIS Module Interface
```

接口层负责编排，不使用 HTTP 回环，不直接查询任何领域数据库。领域模块之间也不直接访问对方 Repository。模块接口应保持稳定，未来如果某个模块独立部署，可以替换为 Connect client。

典型编排关系：

```text
interfaces/dashboard
  ├── hpc.Application.GetDashboardSummary()
  └── ai.Application.GetDashboardSummary()

interfaces/files
  ├── hpc.FileProvider
  └── ai.FileProvider

interfaces/interactive
  ├── hpc.InteractiveProvider
  └── ai.InteractiveProvider
```

Dashboard、文件管理和交互会话的统一响应、部分成功策略、连接信息和错误映射由接口层负责；实际业务规则、存储访问、SSH、scowd、VNC 和 Kubernetes 操作由对应领域模块负责。

在阶段 1 至阶段 3 中，MIS Go 模块尚未迁移完成时，由旧 MIS Connect/gRPC 客户端实现这个模块接口；阶段 4 再将实现替换为进程内 MIS 模块。这样 HPC、AI、Quantum 可以先迁移，而不需要等待 MIS 代码完成。

跨模块异步通知首期不引入消息平台。确实出现多个消费者后，再采用 Outbox + 事件流方案。

## 7. 数据库归属与 MIS 合库方案

### 7.1 初始阶段

数据库暂时保持现状：

```text
HPC       -> Portal 现有数据库或数据源
AI        -> AI 数据库
MIS       -> MIS 数据库
Notif     -> Notification 数据库
Resource  -> Resource 数据库
Quantum   -> Quantum 数据库
```

即使 Notification 和 Resource 已经作为 MIS 子模块运行，初期仍保留各自 Repository 和数据库连接配置。

约束：

- 不跨模块直接查库；
- 不建立长期双写；
- 不建立跨库事务；
- 通过模块接口完成跨域调用；
- 读接口先影子比对，再小流量切换；
- 写接口始终只有一个权威实现。

### 7.2 合库时机与顺序

合库不是业务代码迁移的前置条件，也不在 Notification/Resource 刚完成代码迁移后立即执行。HPC、AI、Quantum 和 MIS 的全部业务代码迁移完成并稳定运行后，才进入 Notification/Resource 合库阶段。

采用“先完成所有代码、后统一数据库”的顺序：

1. 在同一个 `scow-server` 中实现并完成 HPC、AI、Quantum、MIS、Notification、Resource 的业务能力；
2. 继续使用各自旧数据库完成代码迁移、切流和行为校验；
3. 等所有相关业务代码完成并稳定运行后，冻结 Notification/Resource 数据模型变更窗口；
4. 设计 MIS 目标表、索引、约束和数据迁移脚本；
5. 全量迁移 Notification/Resource 历史数据到 MIS 数据库；
6. 进行短期双读或增量一致性校验；
7. 切换 Notification/Resource Repository 到 MIS 数据库；
8. 停止旧数据库写入；
9. 验证完成后归档旧表和旧数据库。

合库后，Notification 和 Resource 仍然保留独立模块，只改变数据存储归属。需要跨模块事务时，应通过 MIS Application Service 设计明确的业务操作，不允许各模块任意共享事务。

## 8. Gateway 切流与回滚

每个产品域支持以下模式：

```text
legacy   -> 旧 TypeScript 服务
shadow   -> 用户使用旧服务，同时请求 Go 做结果比对
canary   -> 按用户、租户或比例切到 Go
go       -> Go 模块正式承载
```

建议配置：

```text
BACKEND_HPC_MODE
BACKEND_AI_MODE
BACKEND_MIS_MODE
BACKEND_QUANTUM_MODE
BACKEND_*_CANARY_PERCENT
BACKEND_GO_URL
```

Notification 和 Resource 由 `BACKEND_MIS_MODE` 统一控制；迁移期间可以为其旧兼容路径配置独立别名。

切流原则：

- 读请求允许影子校验和灰度切换；
- 写请求任何时刻只有一个权威实现；
- 写请求不自动 fallback，避免重复提交；
- 保留 Cookie、Authorization、请求 ID、Trace、查询参数和请求体；
- 保留下载、SSE、流式响应、Shell/WebSocket 和 noVNC upgrade；
- 每个领域都必须具备独立回滚开关。

## 9. 分阶段迁移路线

### 阶段 0：Go 单体基础设施

完成：

- `cmd/scow-server`；
- Connect/gRPC mux 和模块注册机制；
- Proto 生成；
- SCOW_USER 认证 interceptor；
- 统一错误、日志、Trace、Metrics；
- 配置、健康检查和优雅关闭；
- Gateway 双轨路由；
- 一个 Go 镜像、Compose 服务和 scow-cli 配置；
- `/health/live`、`/health/ready` 和 `/metrics`。

此阶段不承载生产业务。

### 阶段 1：HPC

按风险拆分：

1. 集群配置和集群状态；
2. Dashboard 和只读查询；
3. 作业和应用查询；
4. 作业提交和取消；
5. 文件管理；
6. Shell、Desktop 和 noVNC。

每类能力独立切流，不一次替换整个 Portal。

本阶段的用户、租户、账户和授权调用通过 MIS 兼容适配器访问旧 MIS 服务。

### 阶段 2：AI

先迁移集群、资源和资产查询，再迁移作业提交、镜像、Harbor、Kubernetes 和开发环境能力。

本阶段继续通过 MIS 兼容适配器获取用户、租户、账户和授权信息。

### 阶段 3：Quantum

Quantum 继续作为独立 API 域和独立模块迁移，数据库暂时保持独立。其用户、租户、账户和计费调用统一通过 MIS 模块接口完成。

在 MIS Go 模块完成前，Quantum 的 MIS 模块接口由旧 MIS 服务适配器实现。

### 阶段 4：MIS 及其内部模块

迁移 MIS 核心能力以及作为 MIS 子模块的 Notification 和 Resource：

- 用户、租户、账户、授权、计费、账单、系统配置、存储和管理端能力；
- 消息查询、未读消息、订阅设置和消息写操作；
- 资源授权、账户/租户规则和分区查询；
- Notification 和 Resource 继续使用各自旧数据库；
- 统一前端和旧客户端通过 Gateway 完成兼容切流。

完成后，MIS 成为 HPC、AI 和 Quantum 统一依赖的身份、账户和授权模块。此阶段只完成业务代码和服务切流，不进行数据库合并。

### 阶段 5：Notification/Resource 合库

该阶段必须在前述所有业务代码迁移完成并稳定后执行：

- 冻结 Notification/Resource 数据模型变更；
- 将两者表结构和历史数据迁移到 MIS 数据库；
- 完成双读或增量一致性校验；
- 切换 Repository 到 MIS 数据库；
- 停止旧数据库写入；
- 保留旧 API 兼容层；
- 验证完成后归档旧数据库。

## 10. 部署、观测与运维

### 10.1 部署

最终新增一个 `scow-server` Compose 服务：

- 一个 Go 镜像；
- 一个内部监听端口；
- 不直接暴露公网端口；
- Gateway 负责外部路由；
- 支持 Docker Compose 和 scow-cli；
- 支持多副本部署；
- 数据库迁移作为独立部署步骤执行。

### 10.2 资源和故障隔离

单进程不能按领域单独扩缩容，也会扩大进程级故障影响范围。需要：

- 每个模块独立的超时和并发限制；
- 独立数据库连接池或连接池配额；
- 文件、Shell、AI 作业等重任务使用独立 worker pool；
- 依赖故障使用熔断或快速失败；
- 单模块异常不能阻塞健康检查和其他模块。

### 10.3 观测

至少记录：

- Connect 方法成功率和错误码分布；
- P50/P95/P99 延迟；
- 数据库查询和连接池状态；
- 影子校验差异率；
- Go/旧服务流量比例；
- goroutine、内存和 GC；
- 各模块超时、熔断和回滚次数。

## 11. 测试与验收标准

每个阶段必须具备：

- Proto lint、生成代码检查和 breaking check；
- Connect/gRPC/gRPC-Web 契约测试；
- 旧实现与 Go 实现的影子结果比对；
- 用户、租户、账户和权限隔离测试；
- MySQL、Redis、Auth、scheduler adapter 集成测试；
- Gateway Cookie、下载、SSE、流式响应和 WebSocket 测试；
- 单体服务模块注册、健康检查、优雅关闭测试；
- 单模块依赖故障和超时隔离测试；
- 连接池、内存和 goroutine 压力测试；
- canary、回滚和旧服务恢复测试。

涉及 HPC Desktop/noVNC 时，必须验证：

1. noVNC 页面可以打开；
2. 静态资源可以加载；
3. WebSocket/VNC 连接可以建立；
4. 能够实际连接到已有桌面。

## 12. 风险、限制与未决事项

### 已知风险

- 单体进程的故障影响面大于独立微服务；
- 所有模块共享发布周期；
- 共享进程可能导致连接池、内存和 CPU 争用；
- 旧 API 语义与新 Proto 语义可能不一致；
- Notification/Resource 合库涉及表结构、索引、历史数据和权限语义迁移；
- 文件、Shell、Desktop、AI Kubernetes 操作和 noVNC 的迁移风险显著高于普通 CRUD。

### 解决原则

- 通过模块边界、接口、超时和资源配额控制单体复杂度；
- 通过影子校验、灰度和领域级回滚控制切流风险；
- 通过 Proto 版本和 breaking check 控制契约演进；
- 通过先统一服务边界、后合并数据库降低 MIS 合库风险；
- 复杂长连接能力独立验收，不与普通 API 一起切换。

### 后续需要单独决策的事项

- Go 服务最终使用的数据库迁移工具；
- 是否引入 mTLS；
- Outbox 事件流的具体实现；
- 旧 API 兼容路径的最终下线版本和时间；
- Quantum 数据库未来是否需要并入其他领域。
