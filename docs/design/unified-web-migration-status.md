# Unified Web Migration Status

更新时间：2026-07-14

## 当前目标

渐进式把 Portal、AI、Notification 和 Quantum 前端迁移到 `apps/unified-web`，通过 Gateway 的统一同源 HTTP 路径访问旧后端。MIS 与 Resource 暂不迁移。

每完成一个阶段必须：

1. 使用 mock 或真实环境检查页面。
2. 运行受影响范围的类型、i18n、lint 和生产构建。
3. 创建单独的 Conventional Commit。
4. 等待用户确认后再进入下一阶段。

## 已提交阶段

| Commit | 内容 |
| --- | --- |
| `a5dd4ce9e5` | 创建 unified-web 基础布局 |
| `24f461f918` | 调整左侧导航和迁移边界 |
| `f9b688ba7c` | 提升统一文件管理入口，目前页面仍是占位实现 |
| `267cef67e2` | Gateway 增加 `/unified` 预览和 `/api/{domain}` 重写 |
| `70413cc8fa` | i18next 扫描、提取和 default value 检查流程 |
| `518d8c92f3` | 迁移 Notification 用户消息与接收设置页面 |
| `eccda6c096` | 调整 Notification 交互并增加未读系统公告弹窗 |
| `95e920465f` | 整合 Portal/AI 仪表盘、旧版快捷入口和独立 dashboard i18n |
| `f8abbd57cc` | 完成顶部品牌、用户菜单、个人信息和退出登录 |
| `05d9511258` | 修复 unified-web CI 测试命令并对齐个人信息样式 |

## 当前阶段：UI Extension

状态：UI Extension 已完成功能实现、本地验证和阶段提交，等待用户检查；仪表盘仍等待部署到线上环境验证。不要回滚不属于当前任务的工作区改动。

### 上一里程碑：统一仪表盘

- `/dashboard` 照搬 Portal 仪表盘的顶部 `17/7` 栅格、快捷入口、消息卡片、资源卡片、饼图和概览表格。
- Portal REST 与 AI OpenAPI 分别获取当前用户可用集群和 summary cluster 数据。
- 任一数据源失败时保留另一来源；已知失败集群继续显示为不可用。
- 相同 `clusterId`：Portal 资源成功时使用 Portal 节点/CPU/GPU 数据；Portal 失败且 AI 成功时使用 AI 兜底。
- 相同 `clusterId` 两端都成功时，Portal 与 AI 的 `runningJobCount`、`pendingJobCount` 相加，同名分区的 `pendingJobCount` 相加。
- typed mock 同时提供 HPC 和 AI 集群，用于本地预览。
- 快捷入口直接复用 `@scow/lib-web` 旧版完整组件，保留拖动排序、删除、添加弹窗、集群选择、登录节点选择、应用选择和保存。
- Portal 与 AI 都启用时，快捷入口当前采用 Portal 用户配置；仅启用 AI 时采用 AI 用户配置。
- 消息卡片显示最新 3 条未读消息，并跳转统一 Notification 页面。
- 仪表盘翻译已从全局翻译资源拆到独立 `dashboard.json`。
- 顶部语言按钮移除 Tooltip，避免遮挡语言 Dropdown。

### 已完成：顶部栏与个人信息

- 顶部 Logo 和 favicon 改为通过旧系统图片接口获取，用户区不再显示头像占位。
- 新增全局 `/profile` 页面，沿用 MIS 样式和个人资料接口，并实现退出登录。
- Gateway 增加 `/api/unified/mis/*` 代理，仅供第一阶段的全局个人资料能力使用，不迁移 MIS/Resource 业务页面。
- Profile 已复制旧版九种语言翻译；其他尚未迁移领域仍使用英文和中文 fallback。

本阶段涉及的跨包改动：

- `apps/portal-web/src/pages/api/getAppInitialConfig.ts` 增加：
  - `dashboardUserDisplayMode`
  - `publicPath`
- `libs/web` 快捷入口中的 URL 拼接改为浏览器兼容工具，不再直接导入 Node `path`。
- `libs/web` 快捷入口静态 message 改为 `App.useApp()`，避免主题上下文警告。
- `apps/unified-web/vite.config.ts` 预构建 `@scow/config` 和共享 QuickEntry 的 CommonJS 子路径。
- `apps/mis-web/src/pages/api/getAppInitialConfig.ts` 暴露修改密码开关、密码规则和国际化错误提示。
- Gateway nginx 与 dev proxy 增加始终可用的 `/api/unified/mis/*` 重写；MIS 是必选基础系统，不再设置启停开关。

### 线上修复：API 隔离与登录守卫

- 统一 API 从 `/api/{domain}` 迁移到 `/api/unified/{domain}`，避免 `/api/notification/*` 抢占 Portal 旧消息接口。
- Gateway Nginx 与 dev proxy 使用相同命名空间，并保留 Portal 根路径 `/api/notification/getUnreadMessages` 等旧接口。
- 新增根级 `AuthenticationGuard`：Portal、AI、MIS 按优先级检查会话；明确未登录时跳转旧登录入口，请求失败时显示错误态。
- 退出登录后失效会话 query，由同一守卫完成跳转。

### 本阶段：UI Extension

- 已兼容扩展 `/api/manifests`、iframe `/extensions/*`、顶部链接、导航改写和旧版 `postMessage` 事件。
- manifest 保持旧协议的 `portal`、`ai`、`mis` 字段，不新增 `unified` 字段；统一前端聚合 Portal 与 AI 配置并按来源调用协议。
- Portal 与 AI 配置中的同名同 URL 扩展合并为一个实例；配置冲突时使用来源前缀避免 iframe 路由冲突。
- 顶部链接支持 priority、远程图标、自动刷新和新页面打开；Portal/AI 侧栏分别支持新增、删除、重排和嵌套导航。
- iframe 仅传递语言和暗色参数，不传递用户 token；从 MIS 当前会话读取的 token 仅用于调用扩展配置接口。postMessage 校验当前 iframe 来源后处理高度、标题、链接刷新、导航刷新和退出。
- 增加 typed real/mock client、zod 网络边界校验、4 项路径与导航单元测试，以及可交互 mock iframe。
- MIS 业务仍不迁移，本阶段不主动接入 MIS UI Extension 配置。
- UI Extension 完成验证并提交后暂停，等待用户检查再进入下一阶段。

验证结果：

- `apps/unified-web`: `pnpm test` 通过。
- `apps/unified-web`: `pnpm i18n:check` 通过，英文完成度 100%。
- `apps/unified-web`: `pnpm build` 通过。
- Dashboard、TopBar、i18n、Portal API 和共享 QuickEntry 定向 oxlint 通过。
- mock Vite 服务可在 `http://localhost:3001/dashboard` 启动；会话不会跨 AI 任务保证持续存在。
- Vite 共享 QuickEntry 和 `@scow/config` 预构建模块返回 200，服务器无模块加载错误。
- unified-web 类型检查、i18n 完整性检查、定向 oxlint 和生产构建通过。
- Gateway 13 项 Jest 测试和生产构建通过。
- mock 开发服务器的 `/profile` 返回 200，Vite HMR 无模块错误；当前环境没有浏览器 E2E。
- UI Extension Jest 2 个 suite、4 个测试通过；mock `/extensions/demo/overview.html` 与 iframe HTML 均返回 200。
- UI Extension 生产构建生成独立约 106 kB chunk；mock iframe 静态资源已进入构建产物。

已知验证限制：

- MIS 全量 TypeScript 检查被已有的 storage proto、operation log 和 mock 类型错误阻断；本阶段修改的 `getAppInitialConfig.ts` 未出现在错误列表，并已通过定向 oxlint。
- 生产主 chunk 约 1.93 MB，gzip 约 577 KB，Vite 报大 chunk 警告。当前不阻止线上功能测试，后续迁移需继续按领域拆包。
- `libs/web` 全量 TypeScript build 被已有的 `@xterm/*` 缺失和 storage proto 类型错误阻断；本次 QuickEntry 源码由 unified-web 生产构建覆盖验证。
- `portal-web` 单独 `tsc --noEmit` 被已有 FileManager storage、WebSocketTerminal 和 storage API 类型错误阻断；新增初始配置字段未产生额外错误。
- 尚未使用真实部署数据验证 Portal/AI summary API、认证 Cookie 和快捷入口保存。

## 上线测试清单

部署本阶段后优先验证：

1. Gateway 启用 unified preview，直接访问和刷新 `/unified/dashboard`。
2. Portal 部署在根路径时，旧 `/api/notification/getUnreadMessages` 正常，未被统一 Notification 路由抢占。
3. `/api/unified/portal/getAppInitialConfig` 和 `/api/unified/portal/dashboard/getAllSummaryClustersInfo` 正常且不出现重复 `/api`。
4. AI 的 `/api/unified/ai/config`、`/api/unified/ai/auth/userInfo`、`/api/unified/ai/resource/currentClusterIds`、`/api/unified/ai/dashboard/summaryClusters` 返回正常。
5. 清除 `SCOW_USER` 后访问 `/unified/*` 会跳转已启用系统的登录入口；Gateway/API 故障显示错误态而不是循环跳转。
6. Portal 与 AI 独有集群同时展示，集群名称国际化不为空。
7. 同 ID 集群资源不重复，作业数按 Portal + AI 累加。
8. 任一来源停用或返回错误时，另一来源仍展示，失败集群有不可用标识。
9. 快捷入口读取旧配置，编辑、拖动、添加、选择集群/登录节点/应用和保存后刷新仍保留。
10. 消息卡片、顶部未读角标、系统公告弹窗和消息列表缓存同步。
11. 语言 Dropdown 不被 Tooltip 遮挡，切换语言后仪表盘和旧 QuickEntry 文案更新。
12. 扩展服务 CORS 允许统一前端来源访问 `/api/manifests`、`/{portal|ai}/navbarLinks` 和 `/{portal|ai}/rewriteNavigations`。
13. 顶部扩展链接的图标、priority、自动刷新、站内/外跳转和新页面打开符合 manifest 返回值。
14. Portal 与 AI 侧栏都能被对应 manifest 改写，新增、删除、重排、嵌套、远程图标和旧 `svgIcon` 正常。
15. `/unified/extensions/*` 可直接访问和刷新，iframe 收到语言、暗色及原查询参数。
16. 扩展页更新高度/标题、刷新链接/导航和退出登录事件正常，其他窗口或来源的消息被忽略。

## 后续阶段

线上验证通过后按以下优先级继续：

1. 修复线上测试发现的统一仪表盘问题并提交独立 fix commit。
2. 检查并修复真实环境中的 UI Extension 兼容问题。
3. 迁移 Portal/AI 核心领域页面，复用统一仪表盘；具体先后在开始前按业务优先级确认。
4. 用户的文件功能重构合入后，再完成 `/files` 的 Portal + AI 文件管理整合；当前仅保留入口和占位页。
5. 将 Quantum 页面与 API 放到第一阶段后段迁移，保持旧样式和翻译。
6. 第一阶段稳定后再规划 MIS + Resource，不提前迁移 Resource。

继续任务前先阅读：

- `AGENTS.md`
- `apps/unified-web/AGENTS.md`
- `docs/design/unified-web-migration.md`
- 本文件
