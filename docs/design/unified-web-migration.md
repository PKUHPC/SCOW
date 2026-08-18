# SCOW 统一 React 前端迁移计划

当前执行进度、未提交工作和下一步见 [`unified-web-migration-status.md`](./unified-web-migration-status.md)。

## 目标架构

- 新建 `apps/unified-web`，使用 Vite、React、React Router、TanStack Query 和 Zustand。
- 不新增 BFF 服务；增强现有 `apps/gateway`，由 nginx 托管 SPA 静态资源并代理领域 API。
- 第一阶段统一 Portal、AI、Notification、Quantum；MIS 与属于 MIS 的 Resource 保持原样，第二阶段一起迁移。
- 第一阶段五个领域全部完成后一次性切换，旧 UI 源码保留一个稳定版本后再删除。

## 页面与 API 路由

统一页面使用领域命名空间：

- `/dashboard`
- `/files/*`
- `/portal/*`
- `/ai/*`
- `/notification/*`
- `/quantum/*`
- 第二阶段增加 `/mis/*` 和 `/resource/*`

Gateway 提供同源 API 地址，并将领域前缀剥离后代理到旧应用：

- `/api/unified/portal/*` → `portal-web`
- `/api/unified/ai/*` → `ai`
- `/api/unified/notification/*` → `notification`
- `/api/unified/quantum/*` → `quantum`
- 第二阶段增加 `/api/unified/mis/*` → `mis-web` 和 `/api/unified/resource/*` → `resource`

REST 使用 Axios，tRPC 使用官方 tRPC Client，Connect-RPC 使用官方 Connect Web Client。代理必须保留请求方法、查询参数、请求体、Cookie、认证头、响应状态和响应头，并支持 multipart、下载、SSE 与 WebSocket upgrade。

## 前端状态模型

- TanStack Query 管理用户、权限、配置、列表、详情、任务状态和提交结果等服务端状态。
- Zustand 管理左侧导航折叠状态、移动端 Drawer、主题、UI 偏好及确有必要的跨页面草稿；语言状态由 i18next 管理并持久化。
- React Router 管理领域、页面、路径参数和查询参数。
- React Context 只保留 QueryClient、i18n、主题等稳定 Provider，不再承载复杂可变业务状态。
- 不将 TanStack Query 数据复制到 Zustand，避免双重数据源。

## 统一布局

- 顶部左侧保留 SCOW Logo，中间不放页面导航。
- 顶部右侧放通知、系统状态或快捷操作、主题、语言和用户菜单。
- Portal、AI、Quantum 及其子页面放在页面左侧树形导航中。
- Portal 与 AI 不再各自保留仪表盘入口，统一使用全局 `/dashboard`。
- Portal 与 AI 不再各自保留文件管理入口，统一使用全局 `/files`，覆盖用户可访问的 HPC 与 AI 集群。
- Notification 不进入侧边栏，通过顶部通知图标进入消息页面。
- 桌面端导航默认展开并可折叠，折叠状态由 Zustand 持久化；移动端使用从左侧弹出的 Drawer。
- 当前路由对应的领域分组自动展开并高亮，菜单根据启用模块和用户权限过滤。

## 实施阶段

统一前端迁移期间通过 `/unified` 提供预览入口，现有 Portal、AI、Quantum、MIS 及其 API 路径保持不变。统一 API 使用 `/api/unified/{domain}`，Gateway 再重写为旧应用原始 API 路径；例如 Portal 部署在根路径时，`/api/unified/portal/getAppInitialConfig` 内部转为 `/api/getAppInitialConfig`。不得使用 `/api/{domain}`，因为 Portal 已存在 `/api/notification/*` 等旧接口。

### 1. 基础设施

- 创建 Vite SPA、React Router 路由注册、TanStack Query Client 和 Zustand Layout Store。
- 拆分 `libs/web` 的浏览器通用组件与 Next 专属适配，新增 React Router 适配层，同时保留旧 Next 应用兼容性。
- 建立领域模块注册表，每个模块声明路由、导航、权限判断和 API Client。
- 复用 Portal 仪表盘的页面结构和展示逻辑，建立统一集群概览数据模型。
- 复用 Portal 文件管理的页面结构与交互，按所选集群类型调用 Portal 或 AI 文件 API。
- 迁移过程中发现跨应用重复能力时，先整理页面、权限、数据源和交互差异并与产品确认，再决定提升为平台能力、保留领域实现或仅抽取共享组件。

### 2. Gateway

- 将 `unified-web` 构建产物纳入 SCOW 镜像并由 nginx 静态托管。
- 对 SPA 页面启用 `index.html` history fallback，但排除 `/api`、`/meta`、`/auth/public`、noVNC 和静态资源。
- 增加领域 API 上游、路径重写、超时、流式响应和 WebSocket 配置。
- 开发环境提供与生产环境一致的 API 路径。
- Gateway 启动时将 Vite 构建中的统一前端路径和 SCOW 全局 basePath 占位符替换为实际部署值，以支持 `/scow/unified` 等自定义路径。
- `/meta` 决定启用模块；统一前端主题和品牌配置从 MIS 初始配置读取。

### 3. 非 MIS 页面迁移

- Notification、Dashboard 和全局个人信息完成后优先迁移旧版 UI Extension，再迁移 Portal/AI 核心页面；Quantum 保留在第一阶段后段。
- 统一文件管理等待用户尚未合入的文件功能重构，在该重构合入前不迁移 `/files`。
- 替换 Next Link、Router、Image、Head、Server Component 和 `getServerSideProps`。
- 所有领域页面只访问 `/api/{domain}`，不得直接访问容器内部地址或旧外部 basePath。
- 统一仪表盘分别通过 Portal API 获取 HPC 集群、通过 AI tRPC 获取 AI 集群，归一化后合并展示；任一来源失败时保留另一来源的数据并标识失败集群。
- 统一文件管理同时展示 HPC 与 AI 集群，保持目录浏览、上传、下载、编辑、压缩和跨集群传输能力；不因集群类型拆分一级入口。
- 开发和测试通过 `VITE_USE_MOCK=1` 启用 typed mock client；mock 与真实 client 实现相同领域接口，不在业务组件中判断 mock 状态。
- Notification 从 iframe/扩展页模式迁移为顶部图标入口和统一 SPA 页面；Resource 与 MIS 在第二阶段一起处理。

### 国际化迁移规则

- `unified-web` 使用 i18next 与 `react-i18next`，每个领域使用独立 namespace，`zh_cn` 继续作为基准语言。
- 迁移某个页面或领域时，将实际使用的旧翻译复制到 `apps/unified-web/src/i18n/locales`，不让统一前端长期跨目录引用旧应用源码。
- 保留旧翻译 key 的层级结构，优先复用已有文案；调用 `t` 时必须传入中文基准文案作为 default value，使扫描提取可以自动生成 `zh_cn` 内容。
- 可选语言继续读取 `SYSTEM_LANGUAGE_CONFIG.enabledLanguages`，支持 `zh_cn`、`en`、`ja`、`ko`、`fr`、`de`、`es`、`pt`、`ru`；右上角语言菜单只展示配置启用的语言，并同步 i18next、Ant Design、Cookie、localStorage 和 HTML `lang`。
- 新增文案先写入 `zh_cn`，再同步所有配置启用的语言；渐进迁移期间尚未复制的语言 namespace 回退到英文和简体中文。
- `pnpm i18n:scan` 检查未国际化的界面文本，`pnpm i18n:fix:preview` 预览自动包装结果，`pnpm i18n:fix` 逐条确认后改写。
- 自动改写属于启发式辅助，不能直接批量提交；动态插值、重复文案和协议字符串必须人工确认，日志、测试值等使用 `i18next-instrument-ignore` 显式排除。
- `pnpm i18n:extract` 更新语言目录，`pnpm i18n:defaults` 拒绝缺少 default value 的翻译调用，`pnpm i18n:check` 作为提交前完整性检查。

### 4. 第一阶段切换

- Gateway 将统一 SPA 作为默认入口，同时继续将 `/mis` 转发到旧 `mis-web`。
- 非 MIS 旧应用只保留为内部 API 上游，不再公开页面和静态资源。
- 根路径跳转到统一 `/dashboard`；仪表盘根据实际启用的 Portal 和 AI 模块加载对应集群数据。
- 稳定一个版本后删除旧应用中的页面、布局和前端专属依赖。

### 5. MIS 整合

- 将 MIS 与 Resource 页面迁入 `/mis/*`、`/resource/*`，API 改走 `/api/unified/mis/*`、`/api/unified/resource/*`。
- 接入统一左侧导航、顶部操作区、Zustand Layout Store、TanStack Query 和权限模型。
- 单独处理 Grafana 代理、财务、租户、存储、量子计费和 Resource 管理扩展。
- 验证完成后取消旧 `mis-web` 页面的公开路由，并按相同策略清理旧 UI。

## 验证要求

- 验证深层 SPA 路由直接访问、刷新、前进后退和无权限页面。
- 验证左侧导航展开、折叠、持久化、权限过滤、路由高亮和移动端 Drawer。
- 验证 Axios REST、tRPC batching、Connect-RPC、Cookie、错误码和 OpenAPI。
- 验证文件上传、分片上传、大文件下载、SSE、长请求取消和代理超时。
- 验证 Shell、AI 开发环境及其他 WebSocket 链路。
- 重点验证 noVNC 页面打开、静态资源加载、WebSocket/VNC 建连及实际连接已有桌面；无法覆盖时明确记录原因。
- 验证过渡期旧 MIS 与统一 SPA 共享 `SCOW_USER` Cookie。

## 已确定边界

- 新前端不使用 Next.js，也不提供 SSR。
- 不兼容旧页面 URL，不添加旧路径重定向。
- Gateway 是第一阶段唯一的 HTTP 聚合入口。
- 第一阶段不统一 REST、tRPC、Connect-RPC 的协议和数据模型。
- 顶部不再承载页面导航，Portal、AI、Quantum 导航统一放在页面左侧，Notification 仅保留顶部图标入口。
- 主题色优先读取现有 UI 配置中的 hostnameMap、defaultColor 和 darkModeColor，并继续使用 SCOW 默认色作为缺省值。
