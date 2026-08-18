# Unified Web Agent Guide

本文件适用于 `apps/unified-web/` 目录。开始修改前还必须遵守仓库根目录的 `AGENTS.md`。

## 目标与边界

- `unified-web` 是 SCOW 渐进式统一前端，技术栈为 Vite、React、React Router、TanStack Query、Zustand、Ant Design、styled-components 和 i18next。
- 第一阶段迁移 Portal、AI、Notification、Quantum。
- 当前优先迁移旧版 UI Extension；Quantum 保留在第一阶段后段，优先级低于 Portal/AI 核心能力。
- `/files` 最终统一 Portal 与 AI 文件管理，但用户已有尚未合入且影响较大的文件功能重构；在该重构合入前不得开始迁移文件管理。
- MIS 与 Resource 暂不迁移；Resource 属于 MIS，必须在第二阶段一起处理。
- 每次只完成一个可检查阶段，完成后运行验证、创建 Conventional Commit，并等待用户检查后再继续。
- 迁移页面时照搬旧版页面结构、样式和数据逻辑，不自行重新设计。确需调整时先说明原因。
- 发现 Portal、AI 等应用存在重复功能时，先整理差异并和用户确认统一方式。

## 应用结构

- `src/app/`：应用入口、Provider 装配、顶部栏、左侧导航、全局布局和路由注册。
- `src/pages/`：路由级页面，只负责组合业务功能和处理路由参数。
- `src/features/{domain}/`：领域页面、组件、typed client、real/mock client、TanStack Query hooks 和领域类型。
- `src/shared/`：跨层复用且不依赖上层目录的公共契约、UI、工具和基础能力。
- `src/api/http.ts`：统一领域 API 基地址 `/api/{domain}`。
- `src/i18n/locales/{language}/{namespace}.json`：领域独立翻译资源。

## 分层约束

- 依赖方向保持为：`app` 可依赖 `pages/features/shared`，`pages` 可依赖 `features/shared`，`features` 可依赖 `shared`；禁止反向依赖。
- `app` 只负责全局装配；业务请求和领域状态不得写入 `app/layout` 或路由注册文件。
- `pages` 保持轻量，不实现可复用业务逻辑；可复用逻辑应下沉到对应 `feature`。
- 一个 feature 不得深层导入另一个 feature 的内部文件；确需复用时只通过对方的 `index.ts` 公共入口，或将能力提升到 `shared`。
- feature 内部按需创建 `components/`、`api/`、`hooks/` 等目录；文件较少时保持扁平，不机械套目录。
- 不创建无明确归属的全局 `components/`、`stores/`、`hooks/` 收纳目录。全局布局归 `app/layout`，跨领域公共 UI 归 `shared/ui`。
- Zustand 只保存可变 UI 状态，并放在状态所有者附近；服务端状态不得复制进 Zustand。

## API 规则

- Portal REST 只调用 `/api/unified/portal/*`。
- AI HTTP/OpenAPI 只调用 `/api/unified/ai/*`。
- Notification Connect-RPC 只调用 `/api/unified/notification/*`。
- Quantum HTTP API 只调用 `/api/unified/quantum/*`。
- 全局个人资料、密码和退出能力调用 `/api/unified/mis/*`；这不代表 MIS 业务页面已进入第一阶段迁移。
- 不直接访问容器地址，也不在业务组件中拼旧应用内部地址。
- 每个领域定义同一个 `Api` 接口，由 `realClient.ts` 和 `mockClient.ts` 分别实现；业务组件不得判断 `VITE_USE_MOCK`。
- TanStack Query 管理请求、缓存、轮询和 mutation 后失效；Zustand 不保存请求结果。
- Portal 部署在根路径时，Gateway 会把 `/api/unified/portal/x` 重写为 Portal 的 `/api/x`，不要额外添加第二个 `/api`。
- 不得重新占用旧前端的 `/api/{domain}/*` 路径；Portal 已有 `/api/notification/*` 等接口，统一前端必须保留 `/api/unified` 命名空间。
- 根路由使用 AuthenticationGuard 检查会话。明确未登录时跳转已启用 Portal/AI/MIS 的旧登录入口，检查接口失败时显示错误态，不得当作未登录循环跳转。

## 路径与导入

- 使用 `src/...` 路径别名，避免多层 `../../../`。
- 跨 feature 导入使用其公共 `index.ts`，feature 内部可使用自身的 `src/features/{domain}/...` 绝对路径。
- 优先复用 `libs/web` 的浏览器通用组件；如果组件依赖 Next.js 或 Node 浏览器 polyfill，先拆分兼容边界。
- 修改 `libs/web` 后，正常验证应先构建共享库；不要提交 `libs/web/build` 等生成目录。
- 共享快捷入口使用 `@scow/lib-web/build/components/quickEntry`，其 URL 拼接必须保持浏览器兼容。

## 国际化

- 每个领域使用独立 namespace。仪表盘使用 `dashboard.json`，不得放回 `common.json`。
- 个人信息使用 `profile.json`，迁移时保留旧 `libs/web` Profile 的页面结构和已有九种语言翻译。
- `common.json` 只保存全局导航、顶部栏以及尚未形成领域的占位文案。
- `zh_cn` 是基准语言；迁移时复制旧版已有翻译，不重新发明文案。
- 每个 `t()` 调用必须传中文字符串 default value，例如 `t("key", "中文")`。
- 不允许动态 default value。动态业务名称直接显示，固定界面文案使用静态翻译 key。
- 语言菜单读取旧配置的 `SYSTEM_LANGUAGE_CONFIG.enabledLanguages`，支持 `zh_cn/en/ja/ko/fr/de/es/pt/ru`。
- 变更翻译后运行 `pnpm i18n:extract`，补齐英文，再运行 `pnpm i18n:check`。

## UI 约定

- 左侧为可折叠导航；顶部仅放通知、系统操作、主题、语言和用户菜单。
- Notification 不进入侧边栏，只从顶部通知图标进入。
- 语言 Dropdown 外不包 Tooltip，避免 Tooltip 遮挡菜单。
- 主题色读取旧 UI 配置，保留 hostname、默认色和暗色配置能力。
- 顶部品牌 Logo 和 favicon 从旧系统 `/logo`、`/icon` 接口读取，不复制成统一前端固定资源。
- SCOW 用户没有头像数据；用户区使用用户图标、姓名或 ID 和下拉箭头，不显示头像占位圆形。
- 不添加嵌套卡片或重新设计迁移页面。旧版卡片、表格、间距和响应式栅格应直接复用。

## 平台能力

- `/dashboard` 使用 Portal 仪表盘样式，聚合 Portal/HPC 与 AI 集群。
- 相同 `clusterId` 的资源数据优先采用 Portal；Portal 失败时用 AI 兜底。
- 相同 `clusterId` 两端都成功时，节点、CPU、GPU 只统计 Portal 一份，运行中和排队中作业数需要累加；同名分区的排队作业数也累加。
- `/files` 最终统一 Portal 与 AI 文件管理。目前仍是占位页，不要误认为已迁移。
- `/extensions/*` 应兼容旧版 UI Extension 协议。manifest 仍按 `portal`、`ai`、`mis` 分域，统一前端聚合已迁移来源，不新增 `unified` manifest 字段。
- 未读 `SystemNotification` 和 `MonitorAlert` 使用全局持久弹窗，每 5 分钟轮询，关闭或点击已读按钮都会标记已读。

## 开发与验证

在 `apps/unified-web` 下运行：

```bash
pnpm test
pnpm typecheck
pnpm i18n:extract
pnpm i18n:check
pnpm build
VITE_USE_MOCK=1 pnpm dev --host 0.0.0.0 --port 3001
```

定向 lint 从仓库根目录运行：

```bash
pnpm exec oxlint apps/unified-web/src
```

- 当前生产构建存在大 chunk 警告，不能将警告误报为构建失败；后续应按领域路由继续拆包。
- 涉及真实 API 时必须验证 Portal 根路径重写、Cookie、AI OpenAPI、Connect-RPC 和任一来源失败时的降级。
- 当前迁移状态和下一步记录在 `docs/design/unified-web-migration-status.md`。
