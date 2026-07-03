# SCOW Agent 指南

SCOW (Super Computing On Web) 是基于 Web 的超算门户与管理系统。本仓库是 pnpm monorepo，主要使用 TypeScript，部分代码使用 Go。

## 工作规则

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
- `libs/` 包含共享库。
  - 核心库包括 `config`、`web`、`server`、`libconfig`，以及 `libs/protos/` 下的生成 proto 包。
  - 工具库包括 `utils`、`decimal`、`ssh`、`auth`、`hook`、`operation-log`、`rich-error-model`、`scheduler-adapter`、`scow-resource`、`scowd`、`asynchub`、`notification`。
- `protos/` 包含 `@scow/grpc-api` 的源 protobuf 定义，按 `portal/`、`server/`、`audit/`、`common/`、`hook/` 等领域组织。

## 架构约定

- 经典后端服务使用 `@ddadaal/tsgrpc-server`，通过 `plugin()` 注册服务和中间件，并使用 `asyncClientCall` 或 `asyncUnaryCall` 调用其他 gRPC 服务。
- `portal-web`、`mis-web` 等经典前端应用使用 Next.js Pages Router、`@ddadaal/next-typed-api-routes-runtime` 类型安全 API 路由、Typebox 路由 schema、simstate store、styled-components 和 Ant Design。
- 新架构应用按需使用 Next.js App Router、tRPC 或 Connect-RPC。`ai` 使用 tRPC 和 mikro-orm；`notification`、`resource` 使用 Connect-RPC 模式。
- 数据库代码使用 mikro-orm v6，数据库为 MySQL 或 MariaDB。Entity 位于 `src/entities/`，迁移文件位于 `src/migrations/`。
- i18n 使用 `react-typed-i18n`。各 app 的 `src/i18n/zh_cn.ts` 是基准语言文件，其他语言文件应保持结构一致。
- 配置 schema 位于 `libs/config/`，使用 Typebox。运行时环境配置通过 `@scow/lib-config` 的 `envConfig()`、`getConfigFromFile()`、`getDirConfig()` 等工具加载。

## 变更规则

- Proto 变更应从 `protos/` 下的 `.proto` 源文件开始。修改后运行 `pnpm build:protos`；涉及兼容性时运行 `pnpm api:breaking`。
- 影响数据库结构的 Entity 变更需要在对应 app 或服务中通过 `pnpm orm migration:create` 创建 mikro-orm 迁移。
- 配置结构变更应先修改 `libs/config/` 中的 schema，再按需更新调用方、默认值、文档和示例。
- 翻译变更应先更新 `zh_cn.ts`，再保持其他语言文件中的对应 key 一致。
- 修改共享 libs 后，依赖它们的 app 可能需要重新构建；按场景使用 `pnpm build:libs` 或 `pnpm dev:libs`。
- 当包级别的版本化变更需要发布说明或版本管理时，添加 changeset。

## 验证

- 按改动范围选择验证方式。小范围改动优先运行相关 package 的测试；共享库或跨 app 行为变更应使用更宽的验证命令。
- 使用 `pnpm lint` 进行仓库 lint 检查。
- 大范围变更使用 `pnpm test` 跑全量测试；否则在受影响 package 目录下运行 `pnpm test`。
- 修改共享契约、生成代码、配置 schema 或公共 API 时，应构建受影响的 app 或库。
- 测试使用 Jest + ts-jest。需要数据库配置的测试使用 `env/.env.test`。
- 涉及 VNC/noVNC 相关改动时，生成自测用例、测试建议、PR 说明或 review 结论必须提醒覆盖 noVNC 连接链路测试，例如 noVNC 页面打开、静态资源加载、WebSocket/VNC 连接建立和实际连接到已有桌面。若改动涉及 nginx/反向代理、路径转发、WebSocket upgrade、noVNC 镜像或 URL，也必须把这些作为重点验证项；无法覆盖时在自测说明中明确未测原因。

## PR 和提交约定

- 提交信息遵循 Conventional Commits：`type(scope): description`。
- 常见 type 包括 `feat`、`fix`、`refactor`、`chore`、`docs`。
- 基准分支为 `master`。
- 当 proto 字段、配置结构、公共接口或服务间契约需要协同升级时，说明 breaking change。
