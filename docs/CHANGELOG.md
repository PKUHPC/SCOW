# @scow/docs

## 1.4.30

### Patch Changes

- 025d6b1: 新增全局 `adapter.timeoutSeconds` 配置，用于调整调度器适配器调用的默认超时时间，未配置时默认为 60 秒。
- 7e0b13e: 增加统一前端基础架构
- 3cbaa69: 支持为 Portal 交互式应用文件路径属性配置仅文件或仅目录，并可按完整文件扩展名过滤和校验文件

## 1.4.29

### Patch Changes

- af06530: 交互式应用 appComment 增加 markdown 格式渲染
- 4ad3bd2: 文档增加 SCOW 数据库增加大小写不敏感但是区分大小的说明
- 381c41d: 补充集群配置中 `hpc.enabled` 的说明：该配置未显式配置时默认为 `true`；
  纯 AI 集群（如 k8s 集群）应显式配置为 `false`，避免管理系统对该集群调用 HPC 相关逻辑；
  同时承载 HPC 和 AI 业务的超智算集群可同时开启 `hpc.enabled` 和 `ai.enabled`。
- 6dc8026: 内置认证系统支持 OIDC 登录。文档：docs/deploy/config/auth/config

## 1.4.28

### Patch Changes

- c40d387: 修改注释、文案等账户拥有者概念为账户主管理
- d7e28d9: feat(scowctl): 添加 macos-arm64 构建
- 11ef851: "增加 AI 适配器部署配置文档"
- 59348c8: HPC 作业/应用， AI 应用/训练/推理/开发机作业 分别增加独立的作业最长运行时间配置

## 1.4.27

### Patch Changes

- 25d5dcc: 为 AI 集群的公共数据资产目录增加配置校验、远端创建命令和初始化模板指引。

  - `check-config` 现在会在启用 AI 时校验集群是否配置了 `ai.clusterPublicPath`
  - 新增 `create-configured-cluster-paths` 命令，可通过登录节点检查并创建已配置的公共数据资产目录
  - `cli init` 生成的集群配置模板增加了 `ai.clusterPublicPath` 示例和使用说明

- 439e7ed: 添加 scowctl 用户命令行工具 和 meta-server 提供部署元信息以及统一 API 文档。 修改了的文档：API: docs/docs/integration/scow-api-hook/api/api ； scowctl: docs/docs/info/scowctl
- 00d1161: 删除开源许可声明，统一执行 lint format
- 96ede62: 交互式应用的自定义表单的输入框增加 password 类型
- 46c4f2c: **删除 AI config 下的 jobMonitor 配置，仅保留集群下的该配置**
  修复仅配置 AI config 导致用户角色查看监控数据的报错问题
- 873a79f: install.yaml 新增`novnc`配置，在顶层指定 novncClientImage, 优先级高于 portal 中所指定的 novncClientImage
  详细内容参考文档 /docs/deploy/config/novnc/config

  重构 novnc 服务启动逻辑，在 AI 或者 PORTAL 任一服务已配置时启动

  完善关于根路径访问的文档说明 /docs/deploy/config/customization/basepath

## 1.4.26

### Patch Changes

- 92b2766: CLI 支持按模块启用/禁用 portal,ai,mis,quantum 模块。

  install.yaml 的`portal/mis/ai/quantum`新增`enabled`配置（默认为 true）

## 1.4.25

### Patch Changes

- 071ee8f: 优化 AI 数据资产迁移文档以及脚本
- f8fe60d: 集成 Alertmanager 监控告警通知
- c981960: 增加以平台角色管理公共数据资产数据集、算法、模型、镜像的功能，并对现有数据资产进行相应影响，同时文件管理也允许平台管理访问公共数据资产路径，普通用户也可复制该路径。
- 00aa2eb: 为适配不同调度系统对主机名大小写处理不一致的情况，节点迁移功能在跨集群状态比对时采用大小写不敏感匹配
- 3d18a5c: 默认取消用户数据资产分享功能、运维数据资产脚本迁移、细化数据资产文件选择框文件选择报错提示

## 1.4.24

### Patch Changes

- e76e039: 账户管理-用户管理、平台与租户的用户列表、平台-用户登录解封增加用户 ID 和姓名筛选。修改了 getLockedUsers 接口，文档位于 docs/integration/auth/impl#get-lockusergetlockedusers。

## 1.4.23

### Patch Changes

- a91add6: 交互式应用表单项新增支持配置动态下拉框
- 344b2da: ai 进入容器从调用 k8sAPI 切换为调用适配器和集群删除 k8s 配置

## 1.4.22

### Patch Changes

- 95b89d5: 完善 footer 配置及文档、ai 仪表盘未配置 resource 不展示数据 bug、创建应用信息报错优化
- 79278d5: ai 推理、公共挂载点、监控配置支持多集群
- 79278d5: 消息系统文档、日志、接口安全优化
- 5058028: 增加 auth 配置中 token 过期时间的文档说明
- 79278d5: AI 和量子系增加页面标题、页面标题标签改为可配置
- bcfc7c1: 补充 shell 空闲超时时间影响因素说明
- 79278d5: 管理系统平台管理员可配置启用 shell 的 root 权限
- 79278d5: 登录页面优化 UI 优化、页脚更改为可配置

## 1.4.21

### Patch Changes

- 36880eb: 新增多个支持的语言，文档链接：

  1. 系统语言配置：docs/deploy/config/customization/custom-system-language.md
  2. 国际化文本字段配置：docs/deploy/config/customization/custom-config-i18n.md

- 0cb903e: 修复过期白名单账户需要查看时才会删除的 bug
- 36880eb: 新增多个系统语言

## 1.4.20

### Patch Changes

- 045b819: 修复 openapi 无法使用的问题

## 1.4.19

### Patch Changes

- e5ff94c: ai 推理、公共挂载点、监控配置支持多集群
- 1298591: 消息系统文档、日志、接口安全优化
- ce6fc46: AI 和量子系增加页面标题、页面标题标签改为可配置
- 7b07e05: 管理系统平台管理员可配置启用 shell 的 root 权限
- 5b29d63: 登录页面优化 UI 优化、页脚更改为可配置

## 1.4.18

### Patch Changes

- 6f77b4e: 文件管理新增软链接处理，并增加不同文件类型的 icon

## 1.4.18

### Patch Changes

- 6f77b4e: 文件管理新增软链接处理，并增加不同文件类型的 icon

## 1.4.17

### Patch Changes

- f0f144d: 存储管理新增定时同步使用量和批量修改用户存储配额等功能
- d556202: 芯片映射布局调整，增加布局大图，各芯片旋转角度可配置
- 6752734: 顶部导航栏只保留一级菜单，HPC 整合 shell 页和桌面页为登录集群页

## 1.4.16

### Patch Changes

- 477db31: AI 定期删除 harbor 里不存在的镜像
- bf8afc6: 增加 ai 监控的配置(docs/docs/deploy/config/ai/intro.md 中的 config/ai/config.yaml)
- f1801d4: AI 和量子 API 获取认证 token 的 header 从 authorization 修改为 x-scow-api-auth-token

## 1.4.15

### Patch Changes

- 9b11653: 量子和 AI 的 API 支持静态秘密字符串认证： /docs/integration/scow-api-hook/api
- cc28b1b: 修复当系统正在运行同步任务时退出后，再次启动系统后无法执行账户用户相关操作的问题;
  在 AccountUserSyncRecord 实体中增加 sync_status 索引
- 50f3902: AI 支持 UI 扩展
- f0ecf70: AI 新增申请开发机功能

## 1.4.14

### Patch Changes

- e92c889: 登录时默认开启验证码功能
- 60709f3: 文件管理新增不可编辑文件后缀数组配置
- 58e7347: 在登录节点桌面上增加 shadowdesk 远程控制工具
- 3ed0aa1: 仪表盘配置，控制对普通用户的显示内容模式
- 6f5c6ec: 量子 UI 同步其他系统变更以及部分遗漏细节完善、消费类型增加量子作业费用
- 358a7cb: 文档更新更多文件系统配置详情 /SCOW/docs/deploy/config/mis/storage/storage_manager
- a5f0e1d: 新增是否存在存储副本的配置，并提供提示

## 1.4.13

### Patch Changes

- d90b03b: 修复量子配置文档错误

## 1.4.12

### Patch Changes

- ff956a2: 增加表单 tenant_default_app_removed_list, 增加租户默认授权应用的功能
- 562d068: 增加量子系统，包含提交展示量子作业、使用 jupyter 交互式应用、量子计费、使用帮助等基础功能
- 0dcc325: 修复资源管理在 mis-web 下的可选配置判定及部署文档参数错误
- 7547140: 增加 ai 框架文档
- 3b724ac: ai footer 层级优化、dashboard entry ui 优化
- e6cf7d0: 使量子作业按比特秒计价从配置文件定义

## 1.4.11

### Patch Changes

- 5da1b58: 新增存储管理配置说明，文档地址 SCOW/docs/deploy/config/mis/storage/storage_manager
- a4d7ac3: 原有同步账户封锁状态功能升级为同步账户/用户信息功能

## 1.4.10

### Patch Changes

- 238a828: ai 提交应用和训练限制最大运行时间

## 1.4.9

### Patch Changes

- c161586: ai 接入多个集群时配置文件目录说明

## 1.4.8

### Patch Changes

- de86c6e: 新增 HPC 交互式应用中对保留配置项的自定义配置功能，同时新增 HTML 表单的文件路径配置功能
  在 HPC 中新增加强版文件选择组件，包括文件解压缩功能
  修复 AI 中文件解压缩的错误提示及路径刷新等问题
- 71cb79b: 修改 mis.yaml 文件里关于用户名的默认配置，不允许出现下划线\_
- 224a45b: 集群监控增加 dashboards 配置项说明
- 3669a48: 在交互式应用系统保留配置中扩展增加下拉框选项配置

## 1.4.7

### Patch Changes

- 353e732: 修复修改了 basePath 后没法连接 resource 的问题和补充了 notification 和 resource 的文档
- 353e732: 补充资源管理和消息系统的 address 配置文档

## 1.4.6

### Patch Changes

- bfad31b: 为资源管理系统、通知系统、管理系统、门户系统服务与服务之间的调用增加 token 校验,
  ** 注意，此 commit 之后，如配置资源管理系统或者通知系统，则需要配置 SCOW API Token **

## 1.4.5

### Patch Changes

- 428e083: 修改交互式应用 HTML 表单配置默认值的变量名为 defaultValue

## 1.4.4

### Patch Changes

- a7e7585: 删除用户账户可选开启，以及默认改为关闭

## 1.4.3

### Patch Changes

- 5746037: 修复 ui 扩展用户登出 bug，ui 扩展可通知 SCOW 登出用户

## 1.4.2

### Patch Changes

- eec12d8: UI 扩展增加导航栏链接自动刷新功能
- acb1992: UI 扩展页面支持修改标题
- 15a7bdd: UI 扩展返回的导航项允许指定 navs[].hideIfNotActive 属性

## 1.4.1

### Patch Changes

- 5159efd: UI 扩展导航栏链接修改 href 为 path，行为和导航项的 path 保持一致
- f14bf6c: UI 扩展增加导航栏链接自定义

## 1.4.0

### Minor Changes

- b8d1270: 在管理系统和门户系统中增加依赖于管理系统的集群停用功能
  **注意：停用后集群将不可用，集群所有数据不再更新。再启用后请手动同步平台数据！**

### Patch Changes

- 7285809: 添加 SCOW 部署与运维指引文档
- 383a8bd: 添加 web shell 文件上传功能

## 1.3.3

### Patch Changes

- 94aa24c: 支持同时配置多个 UI 扩展。UI 扩展的实现有破坏性变更，请参考文档。
- a737493: jupyter 启动命令参数 PasswordIdentityProvider.hashed_password 改为 ServerApp.password
- e312efb: ai 增加 vnc 功能，以 shell 方式进入容器功能和提交作业的优化
- 640a599: 支持填写多个 hook 地址

## 1.3.2

### Patch Changes

- abda3b2: 修改用户模型文档中账户状态及用户在账户中的状态描述的文字错误
- d822db7: ai 系统新增支持 k8s 集群的 containerd 运行时
- 7b9e0b6: 去掉 node-cron 表达式前秒的限制

## 1.3.1

### Patch Changes

- 2f7590a: 优化 AI 配置介绍的文档中部分格式与文字
- 48844dc: Web Shell 支持跳转到文件编辑页面

## 1.3.0

### Minor Changes

- d1c2e74: UI 扩展

### Patch Changes

- 2e69338: SCOW CLI 初始化配置文件分为简化版本和全版本

## 1.2.0

### Minor Changes

- ec06733f9f: 门户仪表盘删除之前的配置标题和文字，增加平台队列状态展示

### Patch Changes

- f03e821342: vagrant 部署方式优化,文档网站修改

## 1.1.2

### Patch Changes

- 969457662f: 修复 scow 存在的 web 安全漏洞

## 1.1.1

### Patch Changes

- 22441e3515: 添加管理员使用技巧博客，增加传输节点基础环境说明

## 1.1.0

### Minor Changes

- b7f01512eb: 实现了跨集群传输模块
- b33a2bd6bc: 在 ui.yaml 下的 footer 增加 hostnameMap，其作用与 hostnameTextMap 一致，根据不同 hostname 展示不同的 footer 文本

### Patch Changes

- 5a9bda6f4a: 对提交作业和应用的作业名，创建用户时的姓名、创建租户时租户名、充值时的类型、备注输入做长度控制，避免用户输入过长
- 01c54f2cbf: 将使用文档从文档网站移出
- d8a50f63ab: 登录界面 UI 新增根据不同域名展示不同内容
- 01c54f2cbf: 修改文档网站架构图和说明
- 95341b2a91: 在 README 中添加 SCOW 技术交流群二维码
- 75abd18806: 添加 v0.4.0 到 v1.0.0 升级说明文档
- ccbde14304: 实现 SCOW 门户系统与管理系统的页面国际化功能
- 24308f7d68: 修复 mis、portal 错误的文档，修复 cli 中 navLinks 错误的配置示例
- d8a50f63ab: 登录界面新增根据域名显示不同的背景颜色和背景图片
- f3537808a9: 修改 README 中二维码图片的相对路径地址

## 1.0.0

### Major Changes

- 11f94f716: 发布 1.0

### Minor Changes

- ee89b11b9: 新增审计系统服务，记录门户系统及管理系统操作日志及展示

### Patch Changes

- ae114aaec: 增加 SCOW API 中 audit-server 部分文档
- 3446787cf: relion、rstudio 和 vscode 等交互式应用示例文档更新

## 0.7.0

### Minor Changes

- 113e1e4ea: 在 auth 中添加了一个新的 capability 叫 checkPassword，用于检验密码。原先的修改密码 changePassword 不再需要旧密码
- b96e5c4b2: 支持在导航栏右侧的用户下拉菜单中增加自定义链接

### Patch Changes

- 31dc79055: 增加是否打开新的页面配置项，默认为 false,所有导航点击时不打开新的页面；修改一级导航 url 配置项为可选，没有配置时 则默认跳转次级第一个导航的 url
- 6f278a7b9: 门户系统桌面页面新增桌面信息，包括桌面名，桌面类型，创建时间。
- cb9b8708d: 修改自定义 favicon 文档中的错误信息
- bc7e40ca0: 修改文档网站架构图和说明
- defb92de7: 修改 vagrant 项目 faq 和多集群管理配置
- 72875e722: 新增 auth 登录界面可配置项
- 1407743ad: 增加提交作业的命令框中的提示语句可配置
- eabb00659: 修改 vagrant 集群说明，计费项未设置警告说明
- 9f70e2121: 门户系统去除默认集群选择功能，新增集群选择排序以及记录上次选择集群功能
- b2a52c546: 全新 SCOW 登录界面
- 01f244950: 增加用户密码正则配置的文档

## 0.6.0

### Minor Changes

- 5b7f0e88f: 重构 scow，对接调度器适配器接口
- 5c3c63657: 实现登录节点桌面功能以及 TurboVNC 的安装路径在每个集群中单独配置

### Patch Changes

- b6a02e4ae: 补充 vagrant 初始化部署的文档
- 6b6f08ac7: 修正文档部分交互式应用配置更新内的关联链接错误
- 1840515c3: 暴露 gateway 的环境变量 extra，可增加 nginx 的 server 配置
- e97eb22fd: 集群配置登录节点新增节点展示名
- 7a9973aa0: 修改 HTTP API 定义方式，去除生成 api-routes-schemas.json 步骤

## 0.5.0

### Minor Changes

- 548bce714: 支持 CLI 插件

### Patch Changes

- 0d9e3c051: 添加以下交互式应用示例配置：baltamatica、emacs、igv、jupyterlab、octave、rstudio、xfce
- 0f64e5404: 获取桌面和应用列表时，不再解析节点域名到 IP
- 4bfd80986: 认证系统增加管理用户账户关系相关 API
- 81895f4be: mis.yaml 和 portal.yaml 中支持增加导航链接

## 0.4.0

### Minor Changes

- 901ecdb7e: 支持使用外部页面创建用户

### Patch Changes

- f76b41a66: 增加通过 api-v{API 版本号}的 tag 获取某具体 SCOW API 的 proto 文件的方式
- b796fca16: 文档中配置部分提及`check-config` CLI 命令

## 0.3.0

### Minor Changes

- c2a8ab7a5: 删除认证系统验证用户姓名的 API，通过认证系统获取用户姓名和管理系统数据库实现
- bb9d9bb8b: 认证系统 GET /user API 增加返回用户姓名和邮箱
- 47b99ad80: CLI 使用 pino logger
- 215ac2fc7: 认证系统 GET /validateToken 改为 GET /public/validateToken
- 6d08aa823: 文档网站支持本地搜索
- 7bd2578c4: SCOW API 增加静态 token 认证方法
- ef8b7eee0: 增加 SCOW Hook
- 88899d41f: 提交任务增加默认输出文件
- 1562ebbd2: 提交作业时增加 GPU 选项

### Patch Changes

- c4138d75a: 丰富 scow-cli 文档，增加下载参考命令
- 943195451: 认证系统支持测试用户功能
- 9cb6822e6: 集群和应用配置文件可放在子文件夹中
- 42b4cd123: cli 支持设置 HTTP 代理
- 02b5f6e22: 用户自定义表单默认选择第一项
- 5411d4d64: cli 增加 check-config 命令，可检查 SCOW 配置文件格式
- cb90eb64b: 门户支持配置代理网关节点
- f52067437: 修复 cli 更新 release 版本

## 0.2.0

### Minor Changes

- 9a1d3b81b: 认证系统新建用户和组时支持删除预添加的属性
- 8145061ba: 增加 scow-cli
- d4b0cde25: 创建 web 类交互式应用时由前端传入 base path，将节点名解析为 IP 地址的工作由 portal-server 完成
- 22a5bc3c2: 支持 shell 中跳转文件系统

### Patch Changes

- 9a9159505: 增加集群网络连接要求
- 883521f26: 修复当部署的端口号非 80 时，回调地址出错的问题
- 06cd94230: 刷新 slurm 封锁状态和同步作业信息状态功能放到平台调试中

## 0.1.0

### Minor Changes

- dc9852988: 修改 ldap.searchBase 为必填
- 84fcc4bf3: 增加配置日志输出选项功能
- c2a1dff41: 自定义 footer 和 portal 的 dashboard 文本支持 HTML 标签
- 5e4f6ac58: 支持动态设置 base path
- a9b64169c: 更新 LOGO、favicon、仪表盘图片的自定义方式
- 401a21ebe: 限制登录系统可回调域名和增加相关配置

### Patch Changes

- 6814c3427: 交互式应用的自定义表单可以配置提示信息等
- 3eacac0db: 添加刷新 slurm 封锁状态文档
