# SCOW Agent 指南

SCOW (Super Computing On Web) 是基于 Web 的超算门户与管理系统。本仓库是 pnpm monorepo，主要使用 TypeScript，部分代码使用 Go。

## 工作规则

- 默认使用中文与用户沟通，并用中文撰写本地说明文档和注释；但代码标识符、API、配置项、日志、英文原文引用，以及已有英文风格文件应保持英文。
- 不得擅自操作暂存区、提交历史或远端分支。除非用户明确要求并授权具体范围，不要执行 `git add`、`git commit`、`git commit --amend`、`git reset`、`git rebase`、`git stash`、`git clean`、`git push` 等命令；默认只将修改保留在工作区。
- 修改代码前先阅读现有实现。优先沿用本仓库已有模式、工具函数和包边界，不轻易引入新抽象。
- 保持改动范围贴合当前任务。不要重写无关模块，也不要格式化无关文件。
- 不要手工修改生成代码、构建产物、`.next/`、`build/`、`generated/` 或 `tsconfig.tsbuildinfo`，除非任务明确要求根据源码变更重新生成。
- 尊重已有的脏工作区。不要回滚或覆盖不是你创建的改动。
- 使用 `pnpm` 运行脚本和处理依赖。不要引入其他包管理器。
- 做 UI 改动时，遵循对应 app 现有的 Next.js、Ant Design、styled-components 以及共享 `libs/web` 约定。

## 常用命令

```bash
# 安装依赖
pnpm install

# 首次开发准备：构建 libs 和生成代码
pnpm prepareDev

# 构建
pnpm build
pnpm build:libs
pnpm build:protos
pnpm build:scow
pnpm build:scowd

# 开发依赖服务和 watch
pnpm devenv
pnpm devenv:stop
pnpm dev:libs

# 质量检查
pnpm lint
pnpm test

# Proto 兼容性检查
pnpm api:breaking
```

单个 app 或 package 的脚本应在对应目录下运行，例如：

```bash
pnpm test
pnpm dev
pnpm dev:server
```

## Monorepo 结构

- `apps/` 包含可部署的应用和服务。
  - 经典架构：`portal-web`、`portal-server`、`mis-web`、`mis-server`。
  - 新架构：`ai`、`quantum`、`notification`、`resource`。
  - 其他服务：`auth`、`audit-server`、`gateway`、`cli`。
  - Go 服务：`scowd` 是部署在集群登录节点的守护进程；`scow-adapters` 包含调度器适配器，`scowctl` 提供命令行工具。
- `libs/` 包含共享库。
  - 核心库包括 `config`、`web`、`server`、`libconfig`，以及 `libs/protos/` 下的生成 proto 包。
  - 工具库包括 `utils`、`decimal`、`ssh`、`auth`、`hook`、`operation-log`、`rich-error-model`、`scheduler-adapter`、`scow-resource`、`scowd`、`asynchub`、`notification`。
- `protos/` 包含 `@scow/grpc-api` 的源 protobuf 定义，按 `portal/`、`server/`、`audit/`、`common/`、`hook/` 等领域组织。
- `libs/protos/scowd/protos/` 包含 SCOWD 的源 protobuf 定义；`libs/scowd/` 是 TypeScript 客户端库，`apps/scowd/` 是 Go 服务实现。
- `docs/docs/deploy/scowd/` 集中维护 SCOWD 部署、配置和资源限制文档，开发与构建说明见 [apps/scowd/README.md](apps/scowd/README.md)。

## 架构约定

- 经典后端服务使用 `@ddadaal/tsgrpc-server`，通过 `plugin()` 注册服务和中间件，并使用 `asyncClientCall` 或 `asyncUnaryCall` 调用其他 gRPC 服务。
- `portal-web`、`mis-web` 等经典前端应用使用 Next.js Pages Router、`@ddadaal/next-typed-api-routes-runtime` 类型安全 API 路由、Typebox 路由 schema、simstate store、styled-components 和 Ant Design。
- 新架构应用按需使用 Next.js App Router、tRPC 或 Connect-RPC。`ai` 使用 tRPC 和 mikro-orm；`notification`、`resource` 使用 Connect-RPC 模式。
- TypeScript 服务的数据库代码主要使用 mikro-orm v6，数据库为 MySQL 或 MariaDB。Entity 位于 `src/entities/`，迁移文件位于 `src/migrations/`。SCOWD 使用 SQLite，数据访问沿用其 Go 实现。
- i18n 使用 `react-typed-i18n`。各 app 的 `src/i18n/zh_cn.ts` 是基准语言文件，其他语言文件应保持结构一致。
- 配置 schema 位于 `libs/config/`，使用 Typebox。运行时环境配置通过 `@scow/lib-config` 的 `envConfig()`、`getConfigFromFile()`、`getDirConfig()` 等工具加载。

## SCOWD 开发约定

- 服务入口在 `apps/scowd/cmd/scowd/`，实现按职责组织于 `internal/` 下的 `api`、`application`、`storage`、`process`、`desktop`、`proxy` 等目录。新增代码沿用这些包边界。
- SCOWD 使用 Go + Connect-RPC。主进程以 root 启动，按请求用户创建和复用子进程；文件操作同时存在主进程转发、用户子进程与 K8s 路径，修改共用接口时检查三条路径及 portal-server、AI 的调用方。
- SCOWD 属于根 module `github.com/PKUHPC/private-scow`，没有独立的 `go.mod`。依赖和生成工具由根 `go.mod`、`go.sum` 管理，开发默认使用根 `go.work`，不要常规设置 `GOWORK=off`。适配器仍是 `go.work` 中的独立 module。
- 新增或调整 SCOWD Go 依赖时在根 module 中维护，先生成需要的 proto 再执行 `go mod tidy`。检查 `go.sum`、`go.work.sum` 的变更来源，只纳入与本次依赖调整有关的改动，避免无关的 checksum 重写或依赖升级。
- 在 `apps/scowd` 下执行 `pnpm prepareDev` 生成 Go proto。`buf`、`protoc-gen-go` 和 `protoc-gen-connect-go` 通过根 `go.mod` 的 `tool` 声明及 `go tool` 使用，无需另行全局安装。
- Go proto 生成配置为 `apps/scowd/buf.gen.yaml`，读取本仓库的 `libs/protos/scowd/protos/`，输出到 `apps/scowd/protos/gen/`；该目录为生成产物，不手改、不提交。不要改为拉取上游 SCOWD 仓库的 proto。
- SCOWD 自身 YAML 配置结构位于 `apps/scowd/internal/config/`，修改时同步 `apps/scowd/configs/` 中的内嵌示例和部署文档；SCOW 端的集群配置仍遵循 `libs/config/` 的 Typebox schema。
- `configs/`、`assets/` 通过 `resources.go` 内嵌。运行时从二进制旁的 `configs/scowd.yaml` 读取配置，SQLite 数据库 `scowd.db` 和默认日志 `logs/` 也在二进制旁；`init` 会向当前工作目录写入并覆盖配置。修改目录或安装流程时保持这些路径行为一致。

以下命令在仓库根目录执行：

```bash
pnpm --filter @scow/scowd prepareDev
pnpm --filter @scow/scowd lint
pnpm --filter @scow/scowd test
pnpm build:scowd
ARCH=arm64 pnpm --filter @scow/scowd build
```

SCOWD 的 `lint`、`test`、`build` 均先生成 Go proto，分别执行 `go vet`、`go test` 和 `CGO_ENABLED=0` 的 Linux 构建。构建入口为 `./cmd/scowd`，产物为 `apps/scowd/build/bin/scowd-amd64` 或 `scowd-arm64`。Docker 构建使用 `docker/Dockerfile.scowd` 和仓库根目录上下文；发布流水线为 `.github/workflows/scowd.yaml`，tag 发版需保留 amd64、arm64 双架构构建。

## 变更规则

- Proto 变更应从对应的 `.proto` 源文件开始：经典接口在 `protos/`，SCOWD 接口在 `libs/protos/scowd/protos/`。修改后运行 `pnpm build:protos`，SCOWD 还需生成 Go proto 并验证 Go 服务和 TypeScript 调用方。`pnpm api:breaking` 只检查根 `protos/`，SCOWD 契约变更需针对其 proto 目录单独执行 Buf 兼容性检查。
- 影响数据库结构的 Entity 变更需要在对应 app 或服务中通过 `pnpm orm migration:create` 创建 mikro-orm 迁移。
- SCOW 配置结构变更应先修改 `libs/config/` 中的 schema，再按需更新调用方、默认值、文档和示例；SCOWD 自身配置遵循上面的 Go 配置约定。
- 翻译变更应先更新 `zh_cn.ts`，再保持其他语言文件中的对应 key 一致。
- 修改共享 libs 后，依赖它们的 app 可能需要重新构建；按场景使用 `pnpm build:libs` 或 `pnpm dev:libs`。
- 当包级别的版本化变更需要发布说明或版本管理时，添加 changeset。

## 验证

- 按改动范围选择验证方式。小范围改动优先运行相关 package 的测试；共享库或跨 app 行为变更应使用更宽的验证命令。
- 使用 `pnpm lint` 进行仓库 lint 检查。
- 大范围变更使用 `pnpm test` 跑全量测试；否则在受影响 package 目录下运行 `pnpm test`。
- 修改共享契约、生成代码、配置 schema 或公共 API 时，应构建受影响的 app 或库。
- TypeScript 测试使用 Jest + ts-jest，需要数据库配置的测试使用 `env/.env.test`；SCOWD 使用 Go 原生测试，通过对应 pnpm 脚本运行。
- SCOWD 改动至少运行服务的 `lint`、`test`；影响构建、依赖或发布时验证 amd64 和 arm64 构建。下载与流式传输改动需覆盖参数边界、慢客户端背压、客户端取消、上游错误传播及资源释放；测试结果应区分自动化验证和真实集群验证。
- 涉及 VNC/noVNC 相关改动时，生成自测用例、测试建议、PR 说明或 review 结论必须提醒覆盖 noVNC 连接链路测试，例如 noVNC 页面打开、静态资源加载、WebSocket/VNC 连接建立和实际连接到已有桌面。若改动涉及 nginx/反向代理、路径转发、WebSocket upgrade、noVNC 镜像或 URL，也必须把这些作为重点验证项；无法覆盖时在自测说明中明确未测原因。

## PR 和提交约定

- 提交信息遵循 Conventional Commits：`type(scope): description`。
- 常见 type 包括 `feat`、`fix`、`refactor`、`chore`、`docs`。
- 基准分支为 `master`。
- 当 proto 字段、配置结构、公共接口或服务间契约需要协同升级时，说明 breaking change。
