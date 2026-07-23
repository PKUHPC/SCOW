# @scow/cli

## 1.11.4

### Patch Changes

- 7596a2a: 修复 cli compose logs -f 命令异常结束不删除 compose.yml 文件的问题
- af06530: 交互式应用 appComment 增加 markdown 格式渲染
- 381c41d: 补充集群配置中 `hpc.enabled` 的说明：该配置未显式配置时默认为 `true`；
  纯 AI 集群（如 k8s 集群）应显式配置为 `false`，避免管理系统对该集群调用 HPC 相关逻辑；
  同时承载 HPC 和 AI 业务的超智算集群可同时开启 `hpc.enabled` 和 `ai.enabled`。
- 6dc8026: 内置认证系统支持 OIDC 登录。文档：docs/deploy/config/auth/config
- 6bad926: 量子系统检查 portal 下 jupyter 应用是否可连接逻辑重构
- Updated dependencies [3567ac0]
  - @scow/config@1.16.1
  - @scow/lib-scheduler-adapter@1.1.41

## 1.11.3

### Patch Changes

- 59348c8: HPC 作业/应用， AI 应用/训练/推理/开发机作业 分别增加独立的作业最长运行时间配置
- Updated dependencies [e0f253b]
- Updated dependencies [59348c8]
- Updated dependencies [68309f0]
  - @scow/lib-scheduler-adapter@1.1.40
  - @scow/config@1.16.0

## 1.11.2

### Patch Changes

- 25d5dcc: 为 AI 集群的公共数据资产目录增加配置校验、远端创建命令和初始化模板指引。

  - `check-config` 现在会在启用 AI 时校验集群是否配置了 `ai.clusterPublicPath`
  - 新增 `create-configured-cluster-paths` 命令，可通过登录节点检查并创建已配置的公共数据资产目录
  - `cli init` 生成的集群配置模板增加了 `ai.clusterPublicPath` 示例和使用说明

- 439e7ed: 添加 scowctl 用户命令行工具 和 meta-server 提供部署元信息以及统一 API 文档。 修改了的文档：API: docs/docs/integration/scow-api-hook/api/api ； scowctl: docs/docs/info/scowctl
- 00d1161: 删除开源许可声明，统一执行 lint format
- 46c4f2c: **删除 AI config 下的 jobMonitor 配置，仅保留集群下的该配置**
  修复仅配置 AI config 导致用户角色查看监控数据的报错问题
- 873a79f: install.yaml 新增`novnc`配置，在顶层指定 novncClientImage, 优先级高于 portal 中所指定的 novncClientImage
  详细内容参考文档 /docs/deploy/config/novnc/config

  重构 novnc 服务启动逻辑，在 AI 或者 PORTAL 任一服务已配置时启动

  完善关于根路径访问的文档说明 /docs/deploy/config/customization/basepath

- 839c754: 修复 tsconfig rootDir 配置导致构建产物路径错误
- Updated dependencies [87682ee]
- Updated dependencies [06ceebd]
- Updated dependencies [46c4f2c]
- Updated dependencies [439e7ed]
- Updated dependencies [00d1161]
- Updated dependencies [96ede62]
- Updated dependencies [839c754]
  - @scow/config@1.15.0
  - @scow/lib-scowd@1.2.9
  - @scow/lib-scheduler-adapter@1.1.39
  - @scow/lib-config@1.0.9
  - @scow/utils@1.1.4

## 1.11.1

### Patch Changes

- 92b2766: CLI 支持按模块启用/禁用 portal,ai,mis,quantum 模块。

  install.yaml 的`portal/mis/ai/quantum`新增`enabled`配置（默认为 true）

- 66a7a39: 修复 docker compose 命令可用性检测不准确的问题
  - @scow/lib-scowd@1.2.8
  - @scow/lib-scheduler-adapter@1.1.38

## 1.11.0

### Patch Changes

- f341bec: CLI 运行 db 时可以输入中文
- f8fe60d: 集成 Alertmanager 监控告警通知
- c981960: 增加以平台角色管理公共数据资产数据集、算法、模型、镜像的功能，并对现有数据资产进行相应影响，同时文件管理也允许平台管理访问公共数据资产路径，普通用户也可复制该路径。
- 00aa2eb: 增加分享数据资产的文件夹所在的目录的可选配置 sharedTopDir
- 3d18a5c: 默认取消用户数据资产分享功能、运维数据资产脚本迁移、细化数据资产文件选择框文件选择报错提示
- Updated dependencies [f8fe60d]
- Updated dependencies [3d18a5c]
- Updated dependencies [e578c89]
- Updated dependencies [c981960]
- Updated dependencies [00aa2eb]
- Updated dependencies [434cdf3]
  - @scow/config@1.14.0
  - @scow/lib-scowd@1.2.7
  - @scow/lib-scheduler-adapter@1.1.37

## 1.10.2

### Patch Changes

- 345bb3b: 恢复支持 centos 7
- ffc4632: 在账户名，用户 ID 正则配置中增加前后空格会被忽略的描述
- 22655e8: 实现 check-clusters 命令,检查 scowd 和 adapter 是否可以正常连接,输出按集群组合展示
- Updated dependencies [ffc4632]
  - @scow/config@1.13.2
  - @scow/lib-scheduler-adapter@1.1.36

## 1.10.1

### Patch Changes

- Updated dependencies [344b2da]
- Updated dependencies [a91add6]
  - @scow/config@1.13.1

## 1.10.0

### Patch Changes

- 95b89d5: 完善 footer 配置及文档、ai 仪表盘未配置 resource 不展示数据 bug、创建应用信息报错优化
- 79278d5: ai 推理、公共挂载点、监控配置支持多集群
- 79278d5: 消息系统文档、日志、接口安全优化
- 79278d5: 管理系统平台管理员可配置启用 shell 的 root 权限
- 1bdc953: cli 如果配置了 fluentd，添加 fluentd 的健康检查，且所有容器等待 fluentd 启动后再启动。修复在高版本 docker 使用 cli 启动系统时，如果配置了 fluentd，其他容器无法正常启动的问题
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
- Updated dependencies [8f30ca0]
- Updated dependencies [79278d5]
  - @scow/config@1.13.0
  - @scow/lib-config@1.0.8

## 1.9.11

### Patch Changes

- Updated dependencies [0cb903e]
- Updated dependencies [36880eb]
  - @scow/config@1.12.1

## 1.9.10

## 1.9.9

### Patch Changes

- e5ff94c: ai 推理、公共挂载点、监控配置支持多集群
- 1298591: 消息系统文档、日志、接口安全优化
- 7b07e05: 管理系统平台管理员可配置启用 shell 的 root 权限
- Updated dependencies [5b29d63]
- Updated dependencies [7b07e05]
- Updated dependencies [e5ff94c]
- Updated dependencies [ce6fc46]
- Updated dependencies [ce6fc46]
  - @scow/config@1.12.0
  - @scow/lib-config@1.0.7

## 1.9.8

### Patch Changes

- 6f77b4e: 文件管理新增软链接处理，并增加不同文件类型的 icon
- Updated dependencies [6f77b4e]
  - @scow/config@1.11.2

## 1.9.8

### Patch Changes

- 6f77b4e: 文件管理新增软链接处理，并增加不同文件类型的 icon
- Updated dependencies [6f77b4e]
  - @scow/config@1.11.2

## 1.9.7

## 1.9.6

### Patch Changes

- f0f144d: 存储管理新增定时同步使用量和批量修改用户存储配额等功能
- d556202: 芯片映射布局调整，增加布局大图，各芯片旋转角度可配置
- 6752734: 顶部导航栏只保留一级菜单，HPC 整合 shell 页和桌面页为登录集群页
- Updated dependencies [6752734]
- Updated dependencies [f0f144d]
- Updated dependencies [b326570]
- Updated dependencies [d556202]
  - @scow/config@1.11.1

## 1.9.5

### Patch Changes

- 477db31: AI 定期删除 harbor 里不存在的镜像
- Updated dependencies [477db31]
- Updated dependencies [bf8afc6]
  - @scow/config@1.11.0

## 1.9.4

### Patch Changes

- 8d7c549: 管理系统已结束作业中增加量子作业
- db98376: CLI update 命令不再可用，请去文件服务器 85 上下载最新的 cli
- c419e18: cli 启动时检查如果配置了消息系统和资源管理系统则必须配置 scowApi.auth.token
- f0ecf70: AI 新增申请开发机功能
- Updated dependencies [50f3902]
- Updated dependencies [29f7e38]
- Updated dependencies [50f3902]
- Updated dependencies [f0ecf70]
- Updated dependencies [cc28b1b]
  - @scow/lib-config@1.0.6
  - @scow/config@1.10.0

## 1.9.3

### Patch Changes

- 60709f3: 文件管理新增不可编辑文件后缀数组配置
- 6f5c6ec: 量子 UI 同步其他系统变更以及部分遗漏细节完善、消费类型增加量子作业费用
- a5f0e1d: 新增是否存在存储副本的配置，并提供提示
- Updated dependencies [a5f0e1d]
- Updated dependencies [6f5c6ec]
- Updated dependencies [2ea2e6a]
- Updated dependencies [58e7347]
- Updated dependencies [58e7347]
- Updated dependencies [3ed0aa1]
- Updated dependencies [9edf6f9]
- Updated dependencies [60709f3]
- Updated dependencies [e92c889]
- Updated dependencies [3ed0aa1]
  - @scow/config@1.9.0
  - @scow/lib-config@1.0.5

## 1.9.2

### Patch Changes

- a38f1a4: 增加 ai 的配置文件模版
- Updated dependencies [579f164]
  - @scow/config@1.8.2

## 1.9.1

### Patch Changes

- 2dd5f4c: 量子链接功能与 UI 细节完善
- 562d068: 增加量子系统，包含提交展示量子作业、使用 jupyter 交互式应用、量子计费、使用帮助等基础功能
- e6cf7d0: 使量子作业按比特秒计价从配置文件定义
- Updated dependencies [562d068]
- Updated dependencies [e6cf7d0]
- Updated dependencies [44af4cf]
  - @scow/config@1.8.1
  - @scow/lib-config@1.0.4

## 1.9.0

### Patch Changes

- 5da1b58: 新增存储管理配置说明，文档地址 SCOW/docs/deploy/config/mis/storage/storage_manager
- Updated dependencies [778e6c7]
- Updated dependencies [b961d74]
- Updated dependencies [5da1b58]
- Updated dependencies [a4d7ac3]
  - @scow/config@1.8.0

## 1.8.5

### Patch Changes

- Updated dependencies [238a828]
- Updated dependencies [80d22df]
  - @scow/config@1.7.2
  - @scow/lib-config@1.0.3

## 1.8.4

### Patch Changes

- b5aa294: ai 文件操作接入 scowd
- Updated dependencies [10b1fa2]
- Updated dependencies [0904fad]
  - @scow/config@1.7.1

## 1.8.3

## 1.8.2

### Patch Changes

- cc0c01e: @octokit/rest 回退 20 版本
- 71cb79b: 修改 mis.yaml 文件里关于用户名的默认配置，不允许出现下划线\_
- 6be7582: scowd 替换除跨集群文件传输外的 ssh 所有相关逻辑
- Updated dependencies [80bee99]
- Updated dependencies [de86c6e]
  - @scow/config@1.7.0

## 1.8.1

### Patch Changes

- Updated dependencies [9cd4758]
- Updated dependencies [d3c4b57]
  - @scow/lib-config@1.0.2
  - @scow/config@1.6.4

## 1.8.0

### Patch Changes

- Updated dependencies [afaec8b]
  - @scow/config@1.6.3

## 1.7.5

## 1.7.4

### Patch Changes

- e552885: 修复 cli compose run 命令时命令行参数没有传给容器的问题
- Updated dependencies [c641401]
- Updated dependencies [ca98dac]
  - @scow/config@1.6.2

## 1.7.3

## 1.7.2

### Patch Changes

- 1a531ed: 已部署管理系统与资源管理系统的情况下，可以对 AI 集群的集群信息进行授权
- 56e0152: 更新 @grpc/grpc-js 到 1.12.2
- 56e0152: scow 和 适配器交互添加双向 tls 校验
- Updated dependencies [aeac587]
- Updated dependencies [1a531ed]
  - @scow/config@1.6.1

## 1.7.1

### Patch Changes

- 6c6f8c6: 新增删除用户账户功能以及用户账户的删除状态带来的其他相关接口与测试文件完善
- a7e7585: 删除用户账户可选开启，以及默认改为关闭
- Updated dependencies [bec8a37]
- Updated dependencies [a7e7585]
- Updated dependencies [6c6f8c6]
- Updated dependencies [701ebc7]
- Updated dependencies [aa94edc]
  - @scow/config@1.6.0

## 1.7.0

### Minor Changes

- 721b227: 新增消息系统
- 9895952: 新增资源管理系统，增加对租户/账户的集群，分区授权和取消授权的功能

### Patch Changes

- Updated dependencies [721b227]
- Updated dependencies [9895952]
  - @scow/config@1.5.3

## 1.6.4

## 1.6.3

### Patch Changes

- Updated dependencies [83df60b]
  - @scow/config@1.5.2

## 1.6.2

### Patch Changes

- Updated dependencies [0275a9e]
- Updated dependencies [753a996]
- Updated dependencies [1a096de]
- Updated dependencies [0eb668d]
  - @scow/config@1.5.1

## 1.6.1

## 1.6.0

### Minor Changes

- 806f778: 增加 HPC 文件和桌面功能的 scowd 支持
- b8d1270: 在管理系统和门户系统中增加依赖于管理系统的集群停用功能
  **注意：停用后集群将不可用，集群所有数据不再更新。再启用后请手动同步平台数据！**

### Patch Changes

- 5f14ce8: 修复更新 octokit 依赖后导致 cli 命令执行失败的问题
- Updated dependencies [b8d1270]
- Updated dependencies [806f778]
  - @scow/config@1.5.0

## 1.5.2

### Patch Changes

- Updated dependencies [d080a8b]
  - @scow/config@1.4.5

## 1.5.1

### Patch Changes

- e312efb: AI 模块支持创建 vnc 类型应用
- e312efb: ai 增加 vnc 功能，以 shell 方式进入容器功能和提交作业的优化
- Updated dependencies [94aa24c]
- Updated dependencies [e312efb]
- Updated dependencies [e312efb]
- Updated dependencies [640a599]
  - @scow/config@1.4.4

## 1.5.0

### Patch Changes

- 4a32bd7: 兼容旧版本自定义认证系统配置
- 7b9e0b6: 去掉 node-cron 表达式前秒的限制
- Updated dependencies [02d6a18]
- Updated dependencies [d822db7]
  - @scow/config@1.4.3

## 1.4.3

### Patch Changes

- Updated dependencies [3242957]
  - @scow/config@1.4.2

## 1.4.2

## 1.4.1

### Patch Changes

- 8d417ba: 增加配置项控制普通用户是否可以修改作业时限
- Updated dependencies [afc3350]
- Updated dependencies [8d417ba]
- Updated dependencies [68447f7]
  - @scow/lib-config@1.0.1
  - @scow/config@1.4.1

## 1.4.0

### Minor Changes

- cb055c4: 门户仪表盘新增快捷入口，可以新增、删除、拖拽排序快捷方式
- 9059919: 添加外部自定义认证系统
- abb7e84: 管理系统新增集群监控功能

### Patch Changes

- 2e69338: SCOW CLI 初始化配置文件分为简化版本和全版本
- b342df5: 修复 cli 由于 @sinclair/typebox 更新导致的编译问题
- Updated dependencies [d1c2e74]
- Updated dependencies [abb7e84]
  - @scow/config@1.4.0

## 1.3.0

### Minor Changes

- 2302a4639e: install.yaml 文件增加 mis.nodeOptions 参数，可传递给所有 node 服务参数，如“--max-old-space-size=8192”

### Patch Changes

- Updated dependencies [ec06733f9f]
  - @scow/config@1.3.0

## 1.2.3

### Patch Changes

- cad49a87d8: 修复 callbackUrl 固定为 http 的问题
- Updated dependencies [cad49a87d8]
  - @scow/config@1.2.1

## 1.2.2

### Patch Changes

- 969457662f: 修复 scow 存在的 web 安全漏洞

## 1.2.1

## 1.2.0

### Minor Changes

- 5d2b75ccec: 在 common.yml 中增加可选配置项 systemLanguage，指定的语言必须为系统当前合法语言["zh_cn", "en"]的枚举值，允许用户指定系统唯一语言不再进行语言切换，或允许用户指定进入 SCOW 时的默认语言
- f577d9d1e4: 门户系统文件管理新增文件编辑功能

### Patch Changes

- Updated dependencies [a3d2f44af6]
- Updated dependencies [5d2b75ccec]
- Updated dependencies [f577d9d1e4]
  - @scow/config@1.2.0

## 1.1.0

### Minor Changes

- b33a2bd6bc: 在 ui.yaml 下的 footer 增加 hostnameMap，其作用与 hostnameTextMap 一致，根据不同 hostname 展示不同的 footer 文本

### Patch Changes

- 5a9bda6f4a: 修改了示例配置文件，新的示例配置文件中默认配置了账户和用户的 ID 的格式，皆改为： 3-20 位数字、小写字母、下划线，以小写字母开头
- 24308f7d68: 修复 mis、portal 错误的文档，修复 cli 中 navLinks 错误的配置示例
- Updated dependencies [b33a2bd6bc]
- Updated dependencies [b7f01512eb]
- Updated dependencies [5bb922fe99]
- Updated dependencies [ccbde14304]
- Updated dependencies [50d34d6ae3]
- Updated dependencies [29e4b1880a]
- Updated dependencies [8fc4c21f07]
  - @scow/config@1.1.0

## 1.0.0

### Major Changes

- 11f94f716: 发布 1.0

### Minor Changes

- ee89b11b9: 新增审计系统服务，记录门户系统及管理系统操作日志及展示

### Patch Changes

- Updated dependencies [ee89b11b9]
- Updated dependencies [cb1e3500d]
- Updated dependencies [11f94f716]
  - @scow/config@1.0.0
  - @scow/lib-config@1.0.0

## 0.9.0

### Patch Changes

- 785a14bf5: 修复 auth logo 在修改系统相对路径后无法显示的问题
- Updated dependencies [67911fd92]
- Updated dependencies [b96e5c4b2]
- Updated dependencies [31dc79055]
- Updated dependencies [9f70e2121]
- Updated dependencies [6f278a7b9]
- Updated dependencies [1407743ad]
- Updated dependencies [f3dd67ecb]
  - @scow/config@0.5.0

## 0.8.1

## 0.8.0

### Minor Changes

- 5b7f0e88f: 重构 scow，对接调度器适配器接口
- f76716b00: cli 中移除用户可配置镜像地址，统一为：mirrors.pku.edu.cn/pkuhpc-icode/scow

### Patch Changes

- 1840515c3: 暴露 gateway 的环境变量 extra，可增加 nginx 的 server 配置
- e97eb22fd: 集群配置登录节点新增节点展示名
- 7a9973aa0: 修改 HTTP API 定义方式，去除生成 api-routes-schemas.json 步骤
- Updated dependencies [5b7f0e88f]
- Updated dependencies [62083044e]
- Updated dependencies [5c3c63657]
- Updated dependencies [e97eb22fd]
  - @scow/config@0.4.0

## 0.7.0

### Minor Changes

- 548bce714: 支持 CLI 插件

### Patch Changes

- bba446a18: 支持公共文件配置
- 4125d2ca0: 修复 CLI 初始化时，public/README.md 中文档不正确
- 81895f4be: mis.yaml 和 portal.yaml 中支持增加导航链接
- Updated dependencies [0f64e5404]
- Updated dependencies [81895f4be]
  - @scow/config@0.3.1

## 0.6.0

### Minor Changes

- 901ecdb7e: 支持使用外部页面创建用户

### Patch Changes

- Updated dependencies [901ecdb7e]
- Updated dependencies [d2c8e765e]
- Updated dependencies [ce077930a]
  - @scow/config@0.3.0
  - @scow/lib-config@0.2.2

## 0.5.0

### Minor Changes

- 47b99ad80: CLI 使用 pino logger
- 1562ebbd2: 提交作业时增加 GPU 选项

### Patch Changes

- 9a2ddbdd9: 当配置了 fluentd 日志，在执行 compose 命令或者生成 compose 配置时创建 log 目录并修改权限
- 943195451: 认证系统支持测试用户功能
- 7c4c857f5: 修改 init 出错
- 42b4cd123: cli 支持设置 HTTP 代理
- 695e5d590: install.yaml 支持配置网关服务器超时时间
- bbdf9390d: 修复系统 base path 和门户 base path 均为/时，管理系统不显示到门户的链接
- 1abd64a75: CLI 自定义认证系统环境变量配置允许字典形式
- 5411d4d64: cli 增加 check-config 命令，可检查 SCOW 配置文件格式
- cb90eb64b: 门户支持配置代理网关节点
- 8b10d20f1: 初始化时增加 fluent 配置文件
- f52067437: 修复 cli 更新 release 版本
- Updated dependencies [7bd2578c4]
- Updated dependencies [ef8b7eee0]
- Updated dependencies [9cb6822e6]
- Updated dependencies [74d718ba1]
- Updated dependencies [d6e06e841]
- Updated dependencies [cb90eb64b]
  - @scow/config@0.2.0
  - @scow/lib-config@0.2.1

## 0.4.0

### Minor Changes

- 8145061ba: 增加 scow-cli

### Patch Changes

- Updated dependencies [8145061ba]
  - @scow/lib-config@0.2.0
