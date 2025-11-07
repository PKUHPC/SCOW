# @scow/config

## 1.11.1

### Patch Changes

- 6752734: shell 卡片增加集群描述/docs/deploy/config/cluster-config，桌面增加图标设置/docs/deploy/config/portal/desktop
- f0f144d: 新增同步存储使用量定时任务配置: docs/deploy/config/mis/storage/storage_manager
- b326570: 增加文件最大导出数据数量配置
- d556202: 各芯片旋转角度可配置/docs/deploy/config/quantum/intro

## 1.11.0

### Minor Changes

- bf8afc6: 增加 ai 监控的配置(docs/docs/deploy/config/ai/intro.md 中的 config/ai/config.yaml)

### Patch Changes

- 477db31: 增加 AI 定期删除 harbor 里不存在的镜像的配置(docs/deploy/config/ai/intro.md 中的 config/ai/config.yaml)

## 1.10.0

### Minor Changes

- cc28b1b: 删除了资源管理中用于防止数据冲突的 syncBlockStatusWhenStart 配置项；
  删除了文档中关于此配置项的说明 /SCOW/docs/deploy/config/resource/intro#配置开启资源管理系统；
  修改了原有文档中关于启动时同步的描述 /SCOW/docs/deploy/config/mis/schedulers/sync#刷新调度器账户/用户信息；
  在 cli/assets 的 init-full 目录下补充了关于资源管理/消息系统等相关配置项描述。

### Patch Changes

- 50f3902: 在 config/ai.yaml 文件 增加 UI 扩展 uiExtension 配置项
  文档相对路径 /SCOW/docs/integration/ui-extension
- f0ecf70: AI 申请开发机配置，/docs/deploy/config/ai/devhost 下
- Updated dependencies [50f3902]
- Updated dependencies [29f7e38]
  - @scow/lib-config@1.0.6

## 1.9.0

### Minor Changes

- e92c889: **在 auth.yaml 中将验证码功能变更为默认开启**
  文档: /SCOW/docs/deploy/config/auth/config#验证码功能

### Patch Changes

- a5f0e1d: 新增文件系统是否存在副本备份的配置，/docs/deploy/config/mis/storage/storage_manager
- 2ea2e6a: allowUserChangeJobTimeLimit 的范围由 限制用户 扩大到 限制用户和账户管理员(docs/deploy/config/mis/intro#编写后端服务配置)
- 58e7347: 在 portal.yaml 文件 loginDesktop 配置项中增加 shadowDesk 远程控制工具相关的配置
  文档相对路径/SCOW/docs/deploy/config/portal/intro
- 9edf6f9: ai 增加是否开启推理的配置。文档位置: /SCOW/docs/docs/deploy/config/ai/intro.md ### 修改安装配置文件
- 60709f3: 新增 file.edit.nonEditableFilenamePostfixes 不可编辑文件名后缀数组配置, /docs/deploy/config/ai/intro、/docs/deploy/config/portal/intro
- 3ed0aa1: 仪表盘配置，控制对普通用户的显示内容模式, 文档在/SCOW/docs/deploy/config/customization/custom-dashboard-user-display
- Updated dependencies [6f5c6ec]
- Updated dependencies [58e7347]
- Updated dependencies [3ed0aa1]
  - @scow/lib-config@1.0.5

## 1.8.2

### Patch Changes

- 579f164: AI 提交作业页面优化（默认镜像和运行命令）

## 1.8.1

### Patch Changes

- 562d068: 增加 quantum/config.yaml，配置量子系统相关事项，文档相对路径：/SCOW/docs/deploy/config/quantum/intro
- e6cf7d0: 使量子作业按比特秒计价从配置文件定义
- Updated dependencies [44af4cf]
  - @scow/lib-config@1.0.4

## 1.8.0

### Minor Changes

- 778e6c7: 在 common.yaml 中增加是否开启授权应用的配置 allowAppAuthorization,
  文档相对路径/SCOW/docs/deploy/config/customization/custom-app-authorization
- b961d74: 新增节点迁移功能相关配置，文档在/SCOW/docs/deploy/config/mis/migrate-node/index
- a4d7ac3: 新增同步账户/用户信息配置 syncAccountUser：包含 maxSyncDurationMinutes，syncHistoryDayPeriod 的配置项，
  文档相对路径/SCOW/docs/deploy/config/mis/schedulers/sync

### Patch Changes

- 5da1b58: 新增存储管理配置说明，文档地址 SCOW/docs/deploy/config/mis/storage/storage_manager

## 1.7.2

### Patch Changes

- 238a828: ai 提交应用和训练限制最大运行时间
- Updated dependencies [80d22df]
  - @scow/lib-config@1.0.3

## 1.7.1

### Patch Changes

- 10b1fa2: 获取作业 podId && 调度和启动事件信息，打印日志 && 完善 ai 推理
- 0904fad: 修复了在 ARM 架构下构建镜像时触发条件不正确的问题，确保 x86 和 ARM 架构下的镜像都能正确构建

## 1.7.0

### Minor Changes

- de86c6e: 修改 reservedAppAttribute 配置项，支持 type 为 fixedValue 与 select 的两种配置类型。

### Patch Changes

- 80bee99: 预生产环境自动更新 scow

## 1.6.4

### Patch Changes

- Updated dependencies [9cd4758]
- Updated dependencies [d3c4b57]
  - @scow/lib-config@1.0.2

## 1.6.3

### Patch Changes

- afaec8b: AI 添加文件编辑功能

## 1.6.2

### Patch Changes

- c641401: 优化消息查询等 sql，解决重复已读 bug
- ca98dac: primaryColor 下增加可选字段 darkModeColor

## 1.6.1

### Patch Changes

- aeac587: 新增消息订阅的用户提示和更多的通知方式
- 1a531ed: 已部署管理系统与资源管理系统的情况下，可以对 AI 集群的集群信息进行授权

## 1.6.0

### Minor Changes

- 701ebc7: 增加塔影交互式应用相关配置

### Patch Changes

- bec8a37: ai 增加公共只读挂载点
- a7e7585: 删除用户账户配置可选
- 6c6f8c6: 新增 ldap 的用户 loginShell 属性与删除用户时删除标识配置
- aa94edc: 消息系统新增消息过期时间和定期删除过期消息功能

## 1.5.3

### Patch Changes

- 721b227: 新增消息系统
- 9895952: 新增资源管理系统，增加对租户/账户的集群，分区授权和取消授权的功能

## 1.5.2

### Patch Changes

- 83df60b: 增加配置消费记录精度、最小消费金额的功能，默认精度为 2 位小数，默认最小消费金额为 0.01。

  ### 注意：此更新必定影响作业计费结果（除非您以前所有计费项价格皆为 0）如果您不想更改之前的版本中的计费逻辑，需要增加配置如下：

  ```yaml title="config/mis.yaml"
  jobChargeDecimalPrecision: 3
  jobMinCharge: 0
  ```

## 1.5.1

### Patch Changes

- 0275a9e: 修复系统初始化时因无法通过鉴权可用集群为空的问题
- 753a996: AI 增加多机多卡分布式训练和对华为 GPU 的特殊处理
- 1a096de: 修复门户系统集群登录节点只配置地址时路由渲染失败的问题，在集群配置接口返回中加入 scowd 配置信息
- 0eb668d: 修复系统初始化时作业价格表设置页面查询参数报错问题

## 1.5.0

### Minor Changes

- 806f778: 增加 scowd 配置

### Patch Changes

- b8d1270: 增加集群停用功能通用类型

## 1.4.5

### Patch Changes

- d080a8b: 修复在 common.yml 中自定义更改用户密码正则后在管理系统不生效的问题，
  增加平台管理和租户管理下修改用户密码的后端校验

## 1.4.4

### Patch Changes

- 94aa24c: 支持同时配置多个 UI 扩展。UI 扩展的实现有破坏性变更，请参考文档。
- e312efb: AI 模块支持创建 vnc 类型应用
- e312efb: ai 增加 vnc 功能，以 shell 方式进入容器功能和提交作业的优化
- 640a599: 支持填写多个 hook 地址

## 1.4.3

### Patch Changes

- 02d6a18: 集群配置新增 hpc 和 ai enabled 属性 区分 Ai 集群和 HPC 集群或者是融合集群
- d822db7: 集群配置增加 k8s 选项指明容器运行时

## 1.4.2

### Patch Changes

- 3242957: 在 aiConfig 下的 harborConfig 配置中增加 protocol 配置，默认值为 "http"

## 1.4.1

### Patch Changes

- afc3350: 在 mis.yaml 中增加 jobChargeMetadata 可选配置可记录需要存储的扣费作业的字段信息
- 8d417ba: mis 增加 allowUserChangeJobTimeLimit 参数控制普通用户是否可以修改作业时限
- 68447f7: mis 配置文件增加 addUserToAccount 相关参数
- Updated dependencies [afc3350]
  - @scow/lib-config@1.0.1

## 1.4.0

### Minor Changes

- d1c2e74: UI 扩展
- abb7e84: 管理系统新增集群监控功能

## 1.3.0

### Minor Changes

- ec06733f9f: 门户仪表盘删除之前的配置标题和文字，增加平台队列状态展示

## 1.2.1

### Patch Changes

- cad49a87d8: 修复 callbackUrl 固定为 http 的问题

## 1.2.0

### Minor Changes

- 5d2b75ccec: 在 common.yml 中增加可选配置项 systemLanguage，指定的语言必须为系统当前合法语言["zh_cn", "en"]的枚举值，允许用户指定系统唯一语言不再进行语言切换，或允许用户指定进入 SCOW 时的默认语言
- f577d9d1e4: 门户系统文件管理新增文件编辑功能

### Patch Changes

- a3d2f44af6: 门户及管理系统所有显示集群的地方按照集群中配置的优先级进行排序

## 1.1.0

### Minor Changes

- b33a2bd6bc: ui.yaml 下的 footer 增加 hostnameMap，其作用与 hostnameTextMap 一致，hostnameTextMap 在下一个大版本将会被删除
- b7f01512eb: 实现了跨集群传输模块
- 50d34d6ae3: 增加 scow 定时同步调度器用户封锁、账户封锁/解封状态的配置，可配置同步周期、是否启动

### Patch Changes

- 5bb922fe99: 增加集群配置文件中登录节点 LoginNode 地址唯一性验证
- ccbde14304: 使配置文件中文本配置项兼容国际化类型，实现自定义配置文本的国际化展示
- 29e4b1880a: ui.yaml 配置中的 hostnameMap 只可设置不带 port 的 hostname
- 8fc4c21f07: 增加交互式应用 appConfigSchema 中的应用说明配置项 appComment

## 1.0.0

### Major Changes

- 11f94f716: 发布 1.0

### Minor Changes

- ee89b11b9: 新增审计系统配置文件

### Patch Changes

- cb1e3500d: 在 mis.yaml 中增加可选填的自定义可查询消费类型 customChargeTypes
- Updated dependencies [11f94f716]
  - @scow/lib-config@1.0.0

## 0.5.0

### Minor Changes

- b96e5c4b2: 支持在导航栏右侧的用户下拉菜单中增加自定义链接
- f3dd67ecb: 增加用户通过代码自定义收费规则的功能

### Patch Changes

- 67911fd92: 增加 requireGpu 配置项
- 31dc79055: 在 mis.yaml 和 portal.yaml 下的 navLinks 中增加 openInNewPage 可选配置，默认为 false。修改一级导航配置项 url 变更为可选配置。
- 9f70e2121: 集群配置文件新增 priority，提供集群显示排序功能
- 6f278a7b9: portal 配置新增 desktopsDir, 保存登录节点桌面信息
- 1407743ad: 增加提交作业的命令框中的提示语句可配置

## 0.4.0

### Minor Changes

- 5b7f0e88f: 重构 scow，对接调度器适配器接口
- 5c3c63657: 集群配置文件增加登录节点桌面功能配置，TurboVNC 的安装路径配置，实现集群单独配置。

### Patch Changes

- 62083044e: 增加交互式应用配置文件中 logoPath 参数，实现用户自定义配置应用图标功能
- e97eb22fd: 集群配置登录节点新增节点展示名

## 0.3.1

### Patch Changes

- 0f64e5404: 交互式应用 URL 修改为/api/proxy/集群 ID/代理类型/节点 hostname/端口。如果有交互式应用在使用 get_ip 函数以生成 base path，请将 get_ip 调用修改为 hostname
- 81895f4be: 在 portal.yaml 和 mis.yaml 中增加 navLinks 来支持增加一级二级导航链接

## 0.3.0

### Minor Changes

- 901ecdb7e: 完全去除 mis.yaml 中 userIdPattern 配置。使 createUser.userIdPattern 过时，修改为使用 createUser.builtin.userIdPattern

### Patch Changes

- d2c8e765e: 优化创建交互式应用页面：在用户家目录下的 apps/app[Id]路径下存入上一次提交记录；创建了查找上一次提交记录的 API 接口，每次创建交互式应用时查找上一次提交记录，如果有则与当前集群下配置对比选择填入相应的值。
- Updated dependencies [ce077930a]
  - @scow/lib-config@0.2.2

## 0.2.0

### Minor Changes

- 7bd2578c4: SCOW API 增加静态 token 认证方法
- ef8b7eee0: 增加 SCOW Hook

### Patch Changes

- 9cb6822e6: 集群和应用配置文件可放在子文件夹中
- 74d718ba1: 集群配置文件 proxyGateway.autoSetupNginx 默认值改为 false
- cb90eb64b: 门户支持配置代理网关节点
- Updated dependencies [9cb6822e6]
- Updated dependencies [d6e06e841]
  - @scow/lib-config@0.2.1

## 0.1.2

### Patch Changes

- Updated dependencies [8145061ba]
  - @scow/lib-config@0.2.0

## 0.1.1

### Patch Changes

- 6814c3427: 交互式应用的自定义表单可以配置提示信息等
- c24e21662: publish .d.ts files
- Updated dependencies [c24e21662]
  - @scow/lib-config@0.1.1
