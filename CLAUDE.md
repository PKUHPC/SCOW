# SCOW (Super Computing On Web)

基于 Web 的超算门户与管理系统。pnpm monorepo，TypeScript 为主，部分 Go 代码。

## 常用命令

```bash
# 依赖安装
pnpm install

# 构建
pnpm build                      # 构建全部
pnpm build:libs                 # 仅构建 libs/
pnpm build:protos               # 构建 protobuf 生成代码
pnpm build:scow                 # 构建核心应用（不含 docs/cli/dev）

# 开发
pnpm prepareDev                 # 首次开发前必须执行：构建 libs + 生成代码
pnpm devenv                     # 启动开发依赖（MySQL/Redis/SSH/LDAP/test-adapter）
pnpm devenv:stop                # 停止开发依赖
pnpm dev:libs                   # watch 模式构建所有 libs

# 单个应用开发（在对应 apps/ 目录下）
pnpm dev                        # Next.js 应用启用 mock 模式（不依赖后端）
pnpm dev:server                 # Next.js 应用连接真实后端

# 代码质量
pnpm lint                       # oxlint 检查（pre-commit hook 自动执行）
pnpm test                       # 运行全部测试

# Protobuf
pnpm build:protos               # 重新生成 TS proto 代码
pnpm api:breaking               # 检查 proto API 破坏性变更

# 数据库迁移（在有 mikro-orm 的应用目录下）
pnpm orm migration:create       # 创建新迁移
pnpm orm migration:up           # 执行迁移
```

## 仓库结构

### 应用 (apps/)

**经典架构（Pages Router + gRPC）：**
- `portal-web` — 用户门户前端（Next.js Pages Router），作业/文件/Shell/交互式应用管理
- `portal-server` — 门户后端（@ddadaal/tsgrpc-server），gRPC 服务
- `mis-web` — 管理系统前端（Next.js Pages Router），用户/账户/计费/配额管理
- `mis-server` — 管理系统后端（tsgrpc-server + mikro-orm/MySQL）

**新架构（App Router + tRPC/Connect-RPC）：**
- `ai` — 智算平台（Next.js App Router + tRPC + mikro-orm）
- `quantum` — 量子云（Next.js Pages Router + Connect-RPC + mikro-orm）
- `notification` — 消息系统（Next.js App Router + Connect-RPC + mikro-orm）
- `resource` — 资源管理（Next.js App Router + Connect-RPC + mikro-orm）

**其他：**
- `auth` — 认证服务（Fastify）
- `audit-server` — 审计日志后端（tsgrpc-server + mikro-orm）
- `gateway` — API 网关（TypeScript，用 Handlebars 模板生成 nginx 配置并启动 nginx）
- `cli` — SCOW CLI 部署工具（@scow/cli）

### 公共库 (libs/)

**核心库：**
- `config` — 配置 schema 定义（Typebox），所有应用的配置来源
- `web` — 前端共享组件/布局/工具（lib-web），所有 Next.js 应用使用
- `server` — 后端共享库（lib-server）
- `protos/` — 多个 proto 代码生成包：scow、scheduler-adapter、scowd、notification 等
- `libconfig` — 环境变量配置框架（envConfig）和文件配置加载

**工具库：**
- `utils`、`decimal`、`ssh`、`auth`、`hook`、`operation-log`、`rich-error-model`
- `scheduler-adapter`、`scow-resource`、`scowd`、`asynchub`、`notification`

### Proto 定义 (protos/)

- 作为 `@scow/grpc-api` 包发布
- 子目录：`portal/`、`server/`、`audit/`、`common/`、`hook/`
- 使用 buf 做 lint 和 breaking change 检查

## 架构模式

### 后端服务（经典模式）
- 基于 `@ddadaal/tsgrpc-server`，通过 `plugin()` 注册服务和中间件
- 使用 `asyncClientCall` / `asyncUnaryCall` 调用其他 gRPC 服务
- 环境配置通过 `@scow/lib-config` 的 `envConfig()` 定义

### 前端 Next.js 应用（经典模式：portal-web/mis-web）
- Pages Router，使用 `@ddadaal/next-typed-api-routes-runtime` 定义类型安全的 API 路由
- API 路由用 Typebox schema（`typeboxRouteSchema`）定义请求/响应类型
- 状态管理用 simstate（`createStore`/`useStore`）
- 样式用 styled-components + Ant Design
- 客户端 API 调用通过 `src/apis/api.ts`（自动生成的类型安全客户端）

### 前端 Next.js 应用（新模式：ai/notification/resource）
- App Router + tRPC（ai）或 Connect-RPC
- 同一个 Next.js 进程内含 server 端逻辑（tRPC router + mikro-orm）
- 无独立后端服务

### 数据库（mikro-orm）
- mikro-orm v6 + MySQL/MariaDB
- Entity 定义在 `src/entities/` 目录，使用装饰器模式
- 迁移文件在 `src/migrations/`
- 新增 entity 后需要创建迁移：`pnpm orm migration:create`

### i18n
- 使用 `react-typed-i18n` 框架
- 翻译文件在各 app 的 `src/i18n/` 目录
- `zh_cn.ts` 为基准语言，其他语言文件结构与之对应

### 配置系统
- `libs/config/` 定义所有 SCOW 配置的 Typebox schema
- 运行时配置通过 `libs/libconfig` 的 `envConfig()` 从环境变量读取
- 文件配置通过 `getConfigFromFile()` / `getDirConfig()` 加载

## 代码规范

- **Lint**：oxlint（非 ESLint），配置在 `.oxlintrc.json`
- **格式化**：oxfmt，120 字符行宽，import 自动排序，配置在 `.oxfmtrc.json`
- **编辑器**：2 空格缩进，UTF-8，LF 换行（`.editorconfig`）
- **提交**：Conventional Commits（`type(scope): 描述`），pre-commit hook 自动 lint
- **版本**：Changesets 管理版本，变更需添加 changeset，基准分支为 `master`
- **文件结构**：源码 `src/`，测试 `tests/`，构建输出 `build/` 或 `.next/`，生成代码 `generated/`，环境变量 `env/`

## 测试

- Jest + ts-jest，配置在各包 `jest.config.js`
- 测试超时 30 秒，需要数据库的测试使用 `env/.env.test`
- 运行单个包测试：在包目录下 `pnpm test`

## Proto/gRPC 工作流

1. 编辑 `protos/` 下的 `.proto` 文件
2. 运行 `pnpm build:protos` 重新生成 TypeScript 代码
3. 生成配置在 `libs/protos/*/buf.gen.yaml`，使用 ts-proto 插件
4. 修改前检查破坏性变更：`pnpm api:breaking`

## 注意事项

- 修改 libs 后需重新构建才能在 apps 中生效（开发时用 `pnpm dev:libs` watch）
- 首次开发必须执行 `pnpm prepareDev`
- 开发依赖 Docker 服务通过 `pnpm devenv` 管理（MySQL:3306、Redis:6379、SSH:22222、LDAP:389）
- Next.js 的 `dev` 命令默认启用 mock（`NEXT_PUBLIC_USE_MOCK=1`），不依赖后端
