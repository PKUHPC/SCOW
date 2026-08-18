# @scow/mis-server

## 1.11.6

### Patch Changes

- afdf408: 移除 SSH 分支并统一收敛为 scowd;cli 的 asset 中增加 scowd 的配置；
- 85284dd: 新增支持按字段投影查询历史作业的 `GetJobsWithFields` RPC，并在获取历史作业提交时间时使用轻量查询。
- d91cd50: 平台管理中增加未结束作业和所有作业菜单
- a43b5e4: 授权应用增加 HPC / AI 范围隔离，支持融合集群在两个平台使用相同 appId，并更新管理页面、操作日志对象和历史数据迁移。
- 63407df: 修复账户用户同步时，资源管理系统获取集群分区失败可能被误判为空授权分区并继续同步的问题
  增加多集群账户用户同步的异常兜底处理，避免未捕获异常导致集群分片失败记录遗漏
  修复账户分区授权模态框可能显示集群中已不存在分区的问题
- Updated dependencies [afdf408]
- Updated dependencies [c2f0c1c]
- Updated dependencies [85284dd]
- Updated dependencies [f58e4a4]
- Updated dependencies [85284dd]
- Updated dependencies [a43b5e4]
  - @scow/config@1.16.2
  - @scow/utils@1.1.5
  - @scow/lib-server@1.5.5
  - @scow/lib-scheduler-adapter@1.1.42
  - @scow/lib-hook@1.0.44
  - @scow/lib-notification@1.0.28
  - @scow/lib-scow-resource@0.2.27
  - @scow/protos@1.1.4

## 1.11.5

### Patch Changes

- 2fd4e63: 修复周期同步作业功能配置为关闭时页面错误显示为开启
  - @scow/lib-scowd@1.2.10

## 1.11.4

### Patch Changes

- aeb8bc2: 修复 mis-server 单测报错
- ee8bad1: 导入用户时返回没有分区关联的账户用户数据;
  导入用户时对维持解封状态的账户收敛授权分区
- 23a94d3: 增加统一的日志上下文信息
- a46cdc1: 基于 scheduler adapter 的 partitionStrategy 优化创建账户和添加用户到账户流程：MIS 在资源管理开启时传递当前可开放分区，适配器在创建时直接收敛分区可用状态，减少创建后再封锁的窗口期，并修复空授权分区、账户封锁和后续重新授权场景下的状态一致性。
- 9dd4357: hpc 的历史作业模版迁移至 mis 数据库中
- 3b1dbd5: 作业提交时间和开始时间差导致作业无法同步问题
- 1722413: 从账户中移除用户时，所有适配器返回的 Error 都是 NOT_FOUND，scow 删除该条关系、移出用户时不自动封锁用户
- Updated dependencies [23a94d3]
- Updated dependencies [3567ac0]
- Updated dependencies [a46cdc1]
  - @scow/lib-server@1.5.4
  - @scow/config@1.16.1
  - @scow/scheduler-adapter-protos@1.6.2
  - @scow/protos@1.1.3
  - @scow/lib-hook@1.0.43
  - @scow/lib-notification@1.0.27
  - @scow/lib-scow-resource@0.2.26
  - @scow/lib-scheduler-adapter@1.1.41

## 1.11.3

### Patch Changes

- bfe6ffc: 在门户系统获取授权应用、检查应用时按门户 HPC/AI 分类获取
  HPC 获取应用列表是拦截 getAppConnectionInfo 中捕获 AI 作业信息时返回的接口的错误
- 68309f0: 将作业和应用模板迁移至 MIS 数据库统一管理
- 68309f0: hpc 提交作业优化
- e0f253b: 增加适配器连接超时选项和提示
- c40d387: 修改注释、文案等账户拥有者概念为账户主管理
- 9713fca: 鹤思 ai 适配器支持 HPC 作业
- 68309f0: 提交应用优化
- Updated dependencies [013d085]
- Updated dependencies [bfe6ffc]
- Updated dependencies [e0f253b]
- Updated dependencies [c40d387]
- Updated dependencies [9713fca]
- Updated dependencies [1db2326]
- Updated dependencies [59348c8]
- Updated dependencies [59348c8]
- Updated dependencies [68309f0]
  - @scow/scheduler-adapter-protos@1.6.1
  - @scow/lib-server@1.5.3
  - @scow/lib-scheduler-adapter@1.1.40
  - @scow/protos@1.1.2
  - @scow/config@1.16.0
  - @scow/lib-hook@1.0.42
  - @scow/lib-notification@1.0.26
  - @scow/lib-scow-resource@0.2.25

## 1.11.2

### Patch Changes

- 3fccf34: 获取非 SCOW 用户提交的作业报错修复
- 44cf25f: 删除 scow 中调用适配器 getVersion 相关的代码，在后续版本的代码中 scow 版本与适配器版本维持一致
- 00d1161: 删除开源许可声明，统一执行 lint format
- 839c754: 修复 tsconfig rootDir 配置导致构建产物路径错误
- Updated dependencies [87682ee]
- Updated dependencies [06ceebd]
- Updated dependencies [e4fc0d7]
- Updated dependencies [46c4f2c]
- Updated dependencies [439e7ed]
- Updated dependencies [44cf25f]
- Updated dependencies [00d1161]
- Updated dependencies [96ede62]
- Updated dependencies [839c754]
  - @scow/config@1.15.0
  - @scow/lib-scowd@1.2.9
  - @scow/scheduler-adapter-protos@1.6.0
  - @scow/lib-server@1.5.2
  - @scow/scow-resource-protos@0.3.3
  - @scow/notification-protos@0.1.11
  - @scow/lib-scheduler-adapter@1.1.39
  - @scow/lib-scow-resource@0.2.24
  - @scow/lib-notification@1.0.25
  - @scow/protos@1.1.1
  - @scow/lib-config@1.0.9
  - @scow/lib-decimal@1.0.1
  - @scow/utils@1.1.4
  - @scow/lib-auth@1.0.5
  - @scow/lib-hook@1.0.41
  - @scow/lib-ssh@1.0.6

## 1.11.1

### Patch Changes

- 56979c6: 管理系统作业页面按规则在筛选框和作业列表增加用户与账户主管理员列，门户系统作业详情增加增加“用户 ID”和“用户姓名”字段
- 263e5f5: 账户充值记录汇总计算错误修复
- Updated dependencies [56979c6]
  - @scow/protos@1.1.0
  - @scow/lib-scowd@1.2.8
  - @scow/lib-hook@1.0.40
  - @scow/lib-scheduler-adapter@1.1.38
  - @scow/lib-server@1.5.1

## 1.11.0

### Patch Changes

- f8fe60d: 集成 Alertmanager 监控告警通知
- 2d3dcf6: 删除 dead code 并提取 AI 作业表单公共模块
- 00aa2eb: 为适配不同调度系统对主机名大小写处理不一致的情况，节点迁移功能在跨集群状态比对时采用大小写不敏感匹配
- 434cdf3: 实现 scowd 多登录节点负载均衡与请求亲和性路由
- Updated dependencies [f8fe60d]
- Updated dependencies [148099e]
- Updated dependencies [3d18a5c]
- Updated dependencies [e578c89]
- Updated dependencies [c981960]
- Updated dependencies [00aa2eb]
- Updated dependencies [434cdf3]
  - @scow/notification-protos@0.1.10
  - @scow/config@1.14.0
  - @scow/lib-server@1.5.0
  - @scow/scheduler-adapter-protos@1.5.5
  - @scow/scow-resource-protos@0.3.2
  - @scow/lib-scow-resource@0.2.23
  - @scow/lib-scowd@1.2.7
  - @scow/lib-notification@1.0.24
  - @scow/lib-hook@1.0.39
  - @scow/protos@1.0.39
  - @scow/lib-scheduler-adapter@1.1.37

## 1.10.2

### Patch Changes

- 5ff48b7: 账户充值记录查询优化。调整查询条件、列表字段、更改分页为后端分页。
- 2750f41: 通过优化 sql 查询语句与索引，优化消费记录接口时长问题
- 7f7a095: 在租户管理下的授权应用和授权集群分区页面增加账户拥有着的查询与展示
- e76e039: 账户管理-用户管理、平台与租户的用户列表、平台-用户登录解封增加用户 ID 和姓名筛选。修改了 getLockedUsers 接口，文档位于 docs/integration/auth/impl#get-lockusergetlockedusers。
- 7f7a095: 优化管理系统账户列表获取逻辑，优化资源管理授权集群分区页面数据逻辑
- 0c326bc: 修复账户消费记录导出时无法根据用户 id 和 name 模糊搜索的问题
- Updated dependencies [e76e039]
- Updated dependencies [ffc4632]
  - @scow/lib-auth@1.0.4
  - @scow/config@1.13.2
  - @scow/protos@1.0.38
  - @scow/lib-hook@1.0.38
  - @scow/lib-notification@1.0.23
  - @scow/lib-scow-resource@0.2.22
  - @scow/lib-server@1.4.13
  - @scow/lib-scheduler-adapter@1.1.36

## 1.10.1

### Patch Changes

- cf47ef2: 修复所有使用 grpc 项目的内存泄露问题
- Updated dependencies [cf47ef2]
- Updated dependencies [344b2da]
- Updated dependencies [a91add6]
- Updated dependencies [344b2da]
  - @scow/lib-scow-resource@0.2.21
  - @scow/lib-server@1.4.12
  - @scow/lib-hook@1.0.37
  - @scow/config@1.13.1
  - @scow/utils@1.1.3
  - @scow/scheduler-adapter-protos@1.5.4
  - @scow/protos@1.0.37
  - @scow/lib-notification@1.0.22
  - @scow/lib-scowd@1.2.6
  - @scow/lib-scheduler-adapter@1.1.35

## 1.10.0

### Minor Changes

- 8f30ca0: 增加进行中的作业定期计费

### Patch Changes

- a55189a: 账户/用户信息同步结果通知到管理员
- 79278d5: 优化资源管理服务的错误信息处理
- 1154951: 账户管理和租户管理的管理成员页面新增批量操作功能
- 79278d5: 管理系统平台管理员可配置启用 shell 的 root 权限
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
- Updated dependencies [1154951]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
- Updated dependencies [597ac23]
- Updated dependencies [79278d5]
- Updated dependencies [8f30ca0]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
  - @scow/config@1.13.0
  - @scow/lib-scheduler-adapter@1.1.34
  - @scow/protos@1.0.36
  - @scow/notification-protos@0.1.9
  - @scow/scheduler-adapter-protos@1.5.3
  - @scow/lib-config@1.0.8
  - @scow/lib-scowd@1.2.5
  - @scow/lib-hook@1.0.36
  - @scow/lib-notification@1.0.21
  - @scow/lib-scow-resource@0.2.20
  - @scow/lib-server@1.4.11

## 1.9.11

### Patch Changes

- c495538: 批量更新租户管理下已结束的作业价格，并增加操作日志
- 963a2b8: 使用统一的适配器接口
- 0cb903e: 修复过期白名单账户需要查看时才会删除的 bug
- Updated dependencies [a5eedd1]
- Updated dependencies [963a2b8]
- Updated dependencies [0cb903e]
- Updated dependencies [0cb903e]
- Updated dependencies [5686520]
- Updated dependencies [36880eb]
  - @scow/protos@1.0.35
  - @scow/scheduler-adapter-protos@1.5.2
  - @scow/config@1.12.1
  - @scow/lib-server@1.4.10
  - @scow/notification-protos@0.1.8
  - @scow/utils@1.1.2
  - @scow/lib-hook@1.0.35
  - @scow/lib-scheduler-adapter@1.1.33
  - @scow/lib-notification@1.0.20
  - @scow/lib-scow-resource@0.2.19

## 1.9.10

### Patch Changes

- 045b819: 修复 openapi 无法使用的问题
- 3f82bfc: 修改同步结果数据库更新逻辑，解决结果数据写入冲突问题
- 00c1241: 发现没有主管理员的账户时在页面不抛出错误，需要显示主管理员时兼容显示为 -
  修改 AccountBill 实体，让主管理员 ID 及姓名可以为空
- 3a16099: 升级 next 和相关依赖版本
- Updated dependencies [3a16099]
  - @scow/scow-resource-protos@0.3.1
  - @scow/notification-protos@0.1.7
  - @scow/lib-scow-resource@0.2.18
  - @scow/lib-notification@1.0.19
  - @scow/lib-server@1.4.9
  - @scow/lib-scowd@1.2.4
  - @scow/protos@1.0.34
  - @scow/lib-hook@1.0.34
  - @scow/lib-scheduler-adapter@1.1.32

## 1.9.9

### Patch Changes

- 4f1da40: 优化资源管理服务的错误信息处理
- 7b07e05: 管理系统平台管理员可配置启用 shell 的 root 权限
- Updated dependencies [5b29d63]
- Updated dependencies [acd7215]
- Updated dependencies [1298591]
- Updated dependencies [7b07e05]
- Updated dependencies [e5ff94c]
- Updated dependencies [ce6fc46]
- Updated dependencies [ce6fc46]
- Updated dependencies [64fb141]
  - @scow/config@1.12.0
  - @scow/lib-scheduler-adapter@1.1.31
  - @scow/notification-protos@0.1.6
  - @scow/lib-config@1.0.7
  - @scow/lib-scowd@1.2.3
  - @scow/protos@1.0.33
  - @scow/lib-hook@1.0.33
  - @scow/lib-notification@1.0.18
  - @scow/lib-scow-resource@0.2.17
  - @scow/lib-server@1.4.8

## 1.9.8

### Patch Changes

- Updated dependencies [6f77b4e]
  - @scow/config@1.11.2
  - @scow/lib-hook@1.0.32
  - @scow/lib-notification@1.0.17
  - @scow/lib-scow-resource@0.2.16
  - @scow/lib-server@1.4.7
  - @scow/protos@1.0.32
  - @scow/lib-scowd@1.2.2
  - @scow/lib-scheduler-adapter@1.1.30

## 1.9.8

### Patch Changes

- Updated dependencies [6f77b4e]
  - @scow/config@1.11.2
  - @scow/lib-hook@1.0.32
  - @scow/lib-notification@1.0.17
  - @scow/lib-scow-resource@0.2.16
  - @scow/lib-server@1.4.7
  - @scow/protos@1.0.32
  - @scow/lib-scowd@1.2.2
  - @scow/lib-scheduler-adapter@1.1.30

## 1.9.7

## 1.9.6

### Patch Changes

- 7985e57: 管理系统消费记录类型中量子作业在未开启量子部署时不主动开启
- f0f144d: 存储管理新增定时同步使用量和批量修改用户存储配额等功能
- 4f98a31: 作业列表字段调整以及导出功能优化
- Updated dependencies [6752734]
- Updated dependencies [f0f144d]
- Updated dependencies [4f98a31]
- Updated dependencies [b326570]
- Updated dependencies [6752734]
- Updated dependencies [d556202]
  - @scow/config@1.11.1
  - @scow/lib-scheduler-adapter@1.1.29
  - @scow/lib-server@1.4.6
  - @scow/protos@1.0.31
  - @scow/lib-hook@1.0.31
  - @scow/lib-notification@1.0.16
  - @scow/lib-scow-resource@0.2.15

## 1.9.5

### Patch Changes

- f1801d4: AI 和量子 API 获取认证 token 的 header 从 authorization 修改为 x-scow-api-auth-token
- Updated dependencies [477db31]
- Updated dependencies [b645b74]
- Updated dependencies [bf8afc6]
- Updated dependencies [b645b74]
  - @scow/config@1.11.0
  - @scow/protos@1.0.30
  - @scow/lib-hook@1.0.30
  - @scow/lib-notification@1.0.15
  - @scow/lib-scow-resource@0.2.14
  - @scow/lib-server@1.4.5
  - @scow/lib-scheduler-adapter@1.1.28

## 1.9.4

### Patch Changes

- 8d7c549: 管理系统已结束作业中增加量子作业
- f5d87e6: 开启集群资源管理服务，创建账户时，如果账户已经在集群中存在，不抛出错误，继续进行下一步
- 5b7ac14: 创建账户时，如果账户已经在集群中，不抛出错误，继续进行下一步
- cc28b1b: 修复当系统正在运行同步任务时退出后，再次启动系统后无法执行账户用户相关操作的问题;
  在 AccountUserSyncRecord 实体中增加 sync_status 索引
- 7a60757: Pending 的作业展示申请的资源数
- Updated dependencies [50f3902]
- Updated dependencies [cb4c2e8]
- Updated dependencies [29f7e38]
- Updated dependencies [50f3902]
- Updated dependencies [f0ecf70]
- Updated dependencies [cc28b1b]
  - @scow/lib-config@1.0.6
  - @scow/scheduler-adapter-protos@1.5.1
  - @scow/config@1.10.0
  - @scow/protos@1.0.29
  - @scow/lib-scheduler-adapter@1.1.27
  - @scow/lib-server@1.4.4
  - @scow/lib-hook@1.0.29
  - @scow/lib-notification@1.0.14
  - @scow/lib-scow-resource@0.2.13

## 1.9.3

### Patch Changes

- 358a7cb: 调整存储配额展示逻辑和列表用户列展示
- ca3371e: 修复导入用户时新建账户默认授权集群和分区没有写入，
  修改导入用户时需要写入禁用授权应用的账户对象列表为全新未创建过的账户
- 6f5c6ec: 量子 UI 同步其他系统变更以及部分遗漏细节完善、消费类型增加量子作业费用
- 358a7cb: 根据业务需要调整存储配额展示逻辑
- Updated dependencies [a5f0e1d]
- Updated dependencies [45117e6]
- Updated dependencies [6f5c6ec]
- Updated dependencies [2ea2e6a]
- Updated dependencies [58e7347]
- Updated dependencies [45117e6]
- Updated dependencies [58e7347]
- Updated dependencies [3ed0aa1]
- Updated dependencies [9edf6f9]
- Updated dependencies [60709f3]
- Updated dependencies [e92c889]
- Updated dependencies [3ed0aa1]
  - @scow/config@1.9.0
  - @scow/lib-scow-resource@0.2.12
  - @scow/lib-config@1.0.5
  - @scow/scow-resource-protos@0.3.0
  - @scow/protos@1.0.28
  - @scow/lib-server@1.4.3
  - @scow/lib-hook@1.0.28
  - @scow/lib-notification@1.0.13
  - @scow/lib-scheduler-adapter@1.1.26

## 1.9.2

### Patch Changes

- Updated dependencies [579f164]
  - @scow/config@1.8.2
  - @scow/lib-hook@1.0.27
  - @scow/lib-notification@1.0.12
  - @scow/lib-scow-resource@0.2.11
  - @scow/lib-server@1.4.2
  - @scow/protos@1.0.27
  - @scow/lib-scheduler-adapter@1.1.25

## 1.9.1

### Patch Changes

- ff956a2: 增加表单 tenant_default_app_removed_list, 增加租户默认授权应用的功能
- 6904a2a: 管理系统中 queued 状态作业只出现在 ai 集群中
- 20e3d50: 显示 QUEUED 状态的作业
- Updated dependencies [562d068]
- Updated dependencies [562d068]
- Updated dependencies [e6cf7d0]
- Updated dependencies [44af4cf]
  - @scow/lib-server@1.4.1
  - @scow/config@1.8.1
  - @scow/lib-config@1.0.4
  - @scow/lib-hook@1.0.26
  - @scow/lib-notification@1.0.11
  - @scow/lib-scow-resource@0.2.10
  - @scow/lib-scowd@1.2.1
  - @scow/protos@1.0.26
  - @scow/lib-scheduler-adapter@1.1.24

## 1.9.0

### Minor Changes

- 5da1b58: 新增租户管理员存储管理功能
- a4d7ac3: 原有同步账户封锁状态功能升级为同步账户/用户信息功能
- 778e6c7: 在管理系统增加对租户/账户授权交互式应用功能，在审计系统内增加授权/取消授权的日志
  并在 HPC 系统和 AI 系统实现仅展示可用应用

### Patch Changes

- 1874b38: 更新 @ddadaal/tsgrpc-server 0.19.6 至 0.19.7
- b961d74: 增加节点迁移页面与功能
- 0d36f92: 解封没有授权分区/队列的账户时删除调用 blockAccount 接口逻辑
  增加 AI 授权队列功能，在 AI 仪表盘、作业等页面增加获取授权队列逻辑
- 5772fea: 新增创建用户的表单项，修改用户列表展示和导出字段
- Updated dependencies [778e6c7]
- Updated dependencies [5da1b58]
- Updated dependencies [1874b38]
- Updated dependencies [b961d74]
- Updated dependencies [b961d74]
- Updated dependencies [b961d74]
- Updated dependencies [5da1b58]
- Updated dependencies [0d36f92]
- Updated dependencies [a4d7ac3]
- Updated dependencies [778e6c7]
- Updated dependencies [a4d7ac3]
  - @scow/config@1.8.0
  - @scow/lib-server@1.4.0
  - @scow/lib-scowd@1.2.0
  - @scow/lib-scow-resource@0.2.9
  - @scow/lib-scheduler-adapter@1.1.23
  - @scow/scheduler-adapter-protos@1.5.0
  - @scow/lib-hook@1.0.25
  - @scow/lib-notification@1.0.10
  - @scow/protos@1.0.25

## 1.8.5

### Patch Changes

- 5f156bd: 优化初始化大量账单时的 io
- 9739fff: 修复账户无消费但名下用户有退费时无法生成月账单的 bug
- 22b1eb6: 账单页面和修改作业计费功能文案优化，账单查询动作优化
- Updated dependencies [238a828]
- Updated dependencies [80d22df]
  - @scow/config@1.7.2
  - @scow/lib-config@1.0.3
  - @scow/lib-hook@1.0.24
  - @scow/lib-notification@1.0.9
  - @scow/lib-scow-resource@0.2.8
  - @scow/lib-server@1.3.14
  - @scow/lib-scowd@1.1.8

## 1.8.4

### Patch Changes

- Updated dependencies [10b1fa2]
- Updated dependencies [59fb3b4]
- Updated dependencies [0904fad]
- Updated dependencies [7482019]
  - @scow/config@1.7.1
  - @scow/protos@1.0.24
  - @scow/lib-auth@1.0.3
  - @scow/lib-hook@1.0.24
  - @scow/lib-notification@1.0.8
  - @scow/lib-scow-resource@0.2.7
  - @scow/lib-server@1.3.13
  - @scow/lib-scowd@1.1.7
  - @scow/lib-scheduler-adapter@1.1.22

## 1.8.3

## 1.8.2

### Patch Changes

- e233b4e: 将 fetchjob 定时任务抛错处理
- 2eca5d8: 新建租户和修改租户时限制已存在用户不能为租户管理员或财务人员
- 28acbf5: 修复部分基于 Promise.allSettled 的报错处理或日志不全等问题
- 40b9478: jobid 非唯一值导致计费调整 bug 修复
- 6be7582: scowd 替换除跨集群文件传输外的 ssh 所有相关逻辑
- 67c32a5: 用户列表关联账户字段导出异常修复
- Updated dependencies [80bee99]
- Updated dependencies [de86c6e]
- Updated dependencies [ed505ba]
- Updated dependencies [28acbf5]
- Updated dependencies [40b9478]
- Updated dependencies [6be7582]
- Updated dependencies [67c32a5]
  - @scow/config@1.7.0
  - @scow/lib-ssh@1.0.5
  - @scow/lib-scow-resource@0.2.6
  - @scow/protos@1.0.23
  - @scow/lib-scowd@1.1.6
  - @scow/lib-hook@1.0.23
  - @scow/lib-notification@1.0.7
  - @scow/lib-server@1.3.12
  - @scow/lib-scheduler-adapter@1.1.21

## 1.8.1

### Patch Changes

- 2632b1d: 已结束作业调整作业计费增加选择功能
- 1730b01: 修复部分 HttpError 的状态码判断为字符串导致前端无法正常展示错误的问题
- 217c4a3: 消息系统新增批量发送消息接口，并将作业完成通知改为批量发送
- Updated dependencies [9cd4758]
- Updated dependencies [d3c4b57]
- Updated dependencies [1730b01]
- Updated dependencies [217c4a3]
  - @scow/lib-config@1.0.2
  - @scow/lib-auth@1.0.2
  - @scow/notification-protos@0.1.5
  - @scow/config@1.6.4
  - @scow/protos@1.0.22
  - @scow/lib-notification@1.0.6
  - @scow/lib-hook@1.0.22
  - @scow/lib-scow-resource@0.2.5
  - @scow/lib-server@1.3.11
  - @scow/lib-scheduler-adapter@1.1.20

## 1.8.0

### Minor Changes

- 4bcc216: 增加月账单、年账单功能

### Patch Changes

- Updated dependencies [bfad31b]
- Updated dependencies [afaec8b]
  - @scow/lib-scow-resource@0.2.4
  - @scow/lib-notification@1.0.5
  - @scow/lib-server@1.3.10
  - @scow/config@1.6.3
  - @scow/protos@1.0.21
  - @scow/lib-hook@1.0.21
  - @scow/lib-scheduler-adapter@1.1.19

## 1.7.5

### Patch Changes

- d598517: slurm 数据库中开始时间为空的作业也同步到 scow 数据库
- 325d309: 删除用户账户判断适配器接口版本
- 6262855: 封锁或欠费账户无法添加用户
- 355a523: 修复将账户添加到白名单时没有获取到已授权分区以及解封账户时没有对未授权分区再次封锁的问题
  - @scow/protos@1.0.20
  - @scow/lib-hook@1.0.20
  - @scow/lib-scheduler-adapter@1.1.18
  - @scow/lib-server@1.3.9

## 1.7.4

### Patch Changes

- 46dfcf9: 增加导出已结束作业功能
- 52077cb: 修复记录账户计费计费项 id 错误的问题
- 76777c9: 修复 getJobs 数据获取不全
- a2f8a67: 增加删除用户账户 hook
- 249d35d: 平台统计页面最晚截止上一天，总额数据每日计算一次后存在数据库中并返回数据更新时间，UI 显示加上提示数据更新到昨天。
- Updated dependencies [0a670dc]
- Updated dependencies [c641401]
- Updated dependencies [ca98dac]
- Updated dependencies [ca98dac]
  - @scow/lib-ssh@1.0.4
  - @scow/config@1.6.2
  - @scow/notification-protos@0.1.4
  - @scow/protos@1.0.19
  - @scow/lib-hook@1.0.19
  - @scow/lib-scow-resource@0.2.3
  - @scow/lib-server@1.3.8
  - @scow/lib-notification@1.0.4
  - @scow/lib-scheduler-adapter@1.1.17

## 1.7.3

### Patch Changes

- b0a38e0: 用户表增加手机、组织和备注字段并允许平台和租户管理员修改用户信息
- 09d5e82: 计算作业价格时，只在最后进行一次四舍五入
  - @scow/protos@1.0.18
  - @scow/lib-hook@1.0.18
  - @scow/lib-scheduler-adapter@1.1.16
  - @scow/lib-server@1.3.7

## 1.7.2

### Patch Changes

- 1a531ed: 已部署管理系统与资源管理系统的情况下，可以对 AI 集群的集群信息进行授权
- 56e0152: 更新 @grpc/grpc-js 到 1.12.2
- 56e0152: scow 和 适配器交互添加双向 tls 校验
- Updated dependencies [aeac587]
- Updated dependencies [1a531ed]
- Updated dependencies [56e0152]
- Updated dependencies [56e0152]
  - @scow/notification-protos@0.1.3
  - @scow/config@1.6.1
  - @scow/scheduler-adapter-protos@1.4.1
  - @scow/scow-resource-protos@0.2.1
  - @scow/lib-scheduler-adapter@1.1.15
  - @scow/lib-scow-resource@0.2.2
  - @scow/lib-notification@1.0.3
  - @scow/protos@1.0.17
  - @scow/lib-server@1.3.6
  - @scow/lib-hook@1.0.17

## 1.7.1

### Patch Changes

- 17a5531: 修改删除用户账户的步骤顺序
- a38ef7f: 修改 getClusterNodesInfo 为门户和管理系统共用 grpc api，修改集群管理页面的节点信息计数方式
- 74789b4: 修复资源系统配置项中关闭启动时的状态同步没有生效的问题
- 6c6f8c6: 新增删除用户账户功能以及用户账户的删除状态带来的其他相关接口与测试文件完善
- a7e7585: 删除用户账户可选开启，以及默认改为关闭
- 6c6f8c6: 账户列表导出时增加主管理员 ID 和姓名筛选，操作日志修正为导出账户
- Updated dependencies [bec8a37]
- Updated dependencies [9880cd0]
- Updated dependencies [6c6f8c6]
- Updated dependencies [a7e7585]
- Updated dependencies [6c6f8c6]
- Updated dependencies [6c6f8c6]
- Updated dependencies [701ebc7]
- Updated dependencies [aa94edc]
  - @scow/config@1.6.0
  - @scow/lib-server@1.3.5
  - @scow/lib-auth@1.0.1
  - @scow/scheduler-adapter-protos@1.4.0
  - @scow/notification-protos@0.1.2
  - @scow/lib-hook@1.0.16
  - @scow/lib-scow-resource@0.2.1
  - @scow/protos@1.0.16
  - @scow/lib-scheduler-adapter@1.1.14
  - @scow/lib-notification@1.0.2

## 1.7.0

### Minor Changes

- 721b227: 新增消息系统
- 9895952: 新增资源管理系统，增加对租户/账户的集群，分区授权和取消授权的功能

### Patch Changes

- a16b1e1: 修复对特定分区操作的适配器接口报错信息处理，修复授权集群分区详情中集群名的展示
- c4b117d: 修改消息系统 ui
- Updated dependencies [a16b1e1]
- Updated dependencies [721b227]
- Updated dependencies [9895952]
  - @scow/lib-server@1.3.4
  - @scow/notification-protos@0.1.1
  - @scow/lib-notification@1.0.1
  - @scow/config@1.5.3
  - @scow/scow-resource-protos@0.2.0
  - @scow/lib-scow-resource@0.2.0
  - @scow/lib-hook@1.0.15
  - @scow/protos@1.0.15
  - @scow/lib-scheduler-adapter@1.1.13

## 1.6.4

### Patch Changes

- d32b7f6: 修复 shell 退出时 ssh 连接未正常关闭的问题
- d26b5c1: 作业费用更改时，如果费用减少需要充值，充值记录的 comment 中记录作业的 user 属性
- Updated dependencies [d32b7f6]
  - @scow/lib-server@1.3.3
  - @scow/lib-ssh@1.0.3

## 1.6.3

### Patch Changes

- 83df60b: 增加配置消费记录精度，默认精度为 2 位小数；
  增加最小作业消费金额的功能，默认最小作业消费金额为 0.01；
  账户、租户的余额展示精度与消费记录精度一致；
  充值金额展示的小数位与消费记录的精度保持一致；
  充值时数值输入框精度与消费记录的精度保持一致。
- 9300087: 修复设置租户默认阈值时会无视账户阈值的问题，并增加封锁和解封账户的日志
- Updated dependencies [abd69cb]
- Updated dependencies [83df60b]
  - @scow/lib-server@1.3.2
  - @scow/config@1.5.2
  - @scow/protos@1.0.14
  - @scow/lib-hook@1.0.14
  - @scow/lib-scheduler-adapter@1.1.12

## 1.6.2

### Patch Changes

- 67cc41c: 平台数据统计缓存函数设置缓存时间变量，并默认为 5 分钟
- 4bef1b3: 增加获取 SCOW API 版本的接口
- c214bd2: mis-server 启动时，不完整运行一次封锁状态同步
- 6eebd35: 在门户和管理系统启动时只检查启用中集群登录节点的 ssh 连接，在管理系统启用集群操作中检查登录节点的 ssh 连接
- Updated dependencies [0275a9e]
- Updated dependencies [753a996]
- Updated dependencies [a9e9011]
- Updated dependencies [1a096de]
- Updated dependencies [66a96ba]
- Updated dependencies [0eb668d]
  - @scow/config@1.5.1
  - @scow/lib-ssh@1.0.2
  - @scow/scheduler-adapter-protos@1.3.2
  - @scow/utils@1.1.1
  - @scow/lib-server@1.3.1
  - @scow/lib-hook@1.0.13
  - @scow/lib-scheduler-adapter@1.1.11
  - @scow/protos@1.0.13

## 1.6.1

## 1.6.0

### Minor Changes

- b8d1270: 在管理系统和门户系统中增加依赖于管理系统的集群停用功能，在数据库中新增 Cluster 表单
  **注意：停用后集群将不可用，集群所有数据不再更新。再启用后请手动同步平台数据！**

### Patch Changes

- 0a43348: 修改门户系统下提交作业或交互式应用时可以选择的账号为用户维度未封锁账号，分区为该用户在该集群下对应账号的可用分区；修改从模板提交作业时模板值可以直接提交
- d427530: 修复创建账户且判断为需要解封时未在集群中执行解封操作的问题
- Updated dependencies [b8d1270]
- Updated dependencies [b8d1270]
- Updated dependencies [806f778]
  - @scow/config@1.5.0
  - @scow/lib-server@1.3.0
  - @scow/lib-hook@1.0.12
  - @scow/protos@1.0.12
  - @scow/lib-scheduler-adapter@1.1.10

## 1.5.2

### Patch Changes

- daf3885: getWhitelistedAccounts 新增返回字段 expirationDate，whitelistAccount 新增字段 expirationDate，在 getWhitelistedAccounts 新增每次查询会检测 中是否有账户过期，有的话会自动删除
- f534377: 增加了 mis portal 中表格排序的功能，以及部分 UI 的修改
- 875fe29: 管理系统仪表盘账户信息显示卡片中可用余额逻辑和 UI 优化
- a50d5ce: 修复请求集群适配器接口的报错信息中出现嵌套型信息，导致页面报错信息显示不正确的问题
- 89191ea: 解决了 mis 系统中消费记录查询用户输入筛选条件后分页不正确的问题。
- a53bcad: 充值记录和消费记录支持多选账户搜索，充值记录增加类型搜索；导出充值记录和消费记录同步增加这两个搜索条件
- Updated dependencies [d080a8b]
  - @scow/config@1.4.5
  - @scow/lib-hook@1.0.11
  - @scow/lib-server@1.2.2
  - @scow/protos@1.0.11
  - @scow/lib-scheduler-adapter@1.1.9

## 1.5.1

### Patch Changes

- 583978b: 管理系统下的平台数据统计提交作业前十的用户数横坐标改为以 userName 的方式显示.
- Updated dependencies [94aa24c]
- Updated dependencies [e312efb]
- Updated dependencies [e312efb]
- Updated dependencies [640a599]
  - @scow/config@1.4.4
  - @scow/scheduler-adapter-protos@1.3.1
  - @scow/lib-hook@1.0.10
  - @scow/lib-server@1.2.1
  - @scow/protos@1.0.10
  - @scow/lib-scheduler-adapter@1.1.8

## 1.5.0

### Minor Changes

- 63d1873: 账户新增封锁阈值，租户新增默认账户默认阈值以

### Patch Changes

- a097dd1: 新增无账户关系的用户修改所属租户且可以作为新增租户的管理员功能
- 8dd8c0e: 修改 Account 实体中原 blocked 字段名为 blocked_in_cluster ，表示在集群中是否为封锁状态
  增加字段 state ,字段值为 "NORMAL" , "FROZEN" , "BLOCKED_BY_ADMIN" 的枚举值，优化页面账户显示状态为正常、封锁、欠费
- 6139fec: 修复导出账户和导出充值记录接口缺失 limit，offset 过滤的问题
- 850a7ee: 修改 UserAccount 实体中原 status 字段名为 blocked_in_cluster ,表示在集群中是否为封锁状态
  增加字段 state ,允许写入的值为 "NORMAL" , "BLOCKED_BY_ADMIN" 的枚举值
  页面增加用户在账户下的 限额 的状态的显示
- Updated dependencies [02d6a18]
- Updated dependencies [63d1873]
- Updated dependencies [d822db7]
  - @scow/config@1.4.3
  - @scow/lib-server@1.2.0
  - @scow/lib-hook@1.0.9
  - @scow/protos@1.0.9
  - @scow/lib-scheduler-adapter@1.1.7

## 1.4.3

### Patch Changes

- 08359cb: 使用外部认证系统时，外部系统未实现的功能在用户使用时提示用户功能未实现
- 443187e: 修复数据统计相关功能时区转换问题
- Updated dependencies [443187e]
- Updated dependencies [3242957]
- Updated dependencies [850bbcd]
  - @scow/lib-server@1.1.5
  - @scow/config@1.4.2
  - @scow/protos@1.0.8
  - @scow/lib-hook@1.0.8
  - @scow/lib-scheduler-adapter@1.1.6

## 1.4.2

### Patch Changes

- 448f6bf: 之前升级 mikroORM 时 cascade: [Cascade.ALL]属性会在删除 UserAccount 时把 User 和 Account 也删掉

## 1.4.1

### Patch Changes

- 186c359: 适配 mikro-orm 更新会修改 ref 字段默认为 null
- afc3350: charge_record 表增加字段 user_id 及 metadata, 以及增加了 time,tenant,account,user_id,type 各字段的索引
- afc3350: 增加消费记录中用户的显示、筛选及导出功能
- Updated dependencies [afc3350]
- Updated dependencies [8d417ba]
- Updated dependencies [68447f7]
  - @scow/lib-config@1.0.1
  - @scow/config@1.4.1
  - @scow/lib-hook@1.0.7
  - @scow/lib-server@1.1.4
  - @scow/protos@1.0.7
  - @scow/lib-scheduler-adapter@1.1.5

## 1.4.0

### Minor Changes

- 081fbcf: 管理系统新增用户列表，账户列表，消费记录，充值记录，操作记录的数据导出 csv 文件功能
- f023d52: 管理系统新增数据统计功能，统计用户，账户，租户，作业，消费及功能使用次数

### Patch Changes

- 408816f: 增加对用户及账户关系的错误兼容，如果适配器的报错都是已存在，视为添加成功，如果都是不存在，视为移除成功
- 9059919: 添加外部自定义认证系统
- Updated dependencies [d1c2e74]
- Updated dependencies [26bd8e7]
- Updated dependencies [abb7e84]
  - @scow/config@1.4.0
  - @scow/scheduler-adapter-protos@1.3.0
  - @scow/protos@1.0.6
  - @scow/lib-hook@1.0.6
  - @scow/lib-server@1.1.3
  - @scow/lib-scheduler-adapter@1.1.4

## 1.3.0

### Patch Changes

- Updated dependencies [ec06733f9f]
  - @scow/scheduler-adapter-protos@1.2.0
  - @scow/config@1.3.0
  - @scow/lib-scheduler-adapter@1.1.3
  - @scow/lib-hook@1.0.5
  - @scow/lib-server@1.1.2
  - @scow/protos@1.0.5

## 1.2.3

### Patch Changes

- 1a1189ad48: 管理系统 AllUserTable 恢复计数接口并且新增筛选参数
- Updated dependencies [cad49a87d8]
  - @scow/config@1.2.1
  - @scow/lib-hook@1.0.4
  - @scow/lib-server@1.1.1
  - @scow/protos@1.0.4
  - @scow/lib-scheduler-adapter@1.1.2

## 1.2.2

### Patch Changes

- 5b9116e3bd: hook(accountPaid、tenantPaid)增加的传参 type,、comment
  - @scow/protos@1.0.3
  - @scow/lib-hook@1.0.3
  - @scow/lib-scheduler-adapter@1.1.1
  - @scow/lib-server@1.1.0

## 1.2.1

## 1.2.0

### Minor Changes

- 35e026be3e: 修改获取消费记录方式为分别获取当前页面详细记录及消费记录的总量，总额。在 ChargeRecord 实体中添加(time,type,account_name,tenant_name)的复合索引,索引名 query_info
- f6f84b6d60: 管理系统未结束作业新增结束操作

### Patch Changes

- 3e13a35d2d: 移出用户前增加用户是否有运行中作业的判断
- af6a53dfcf: portal-server,auth,mis-server,audit-server 下 pino 日志的时间格式修改为八时区下的 YYYY-MM-DD HH:mm:ss
- 3bb178aebd: 修改页面表格默认显示数量为 50
- 438cf1aba4: 修改账户计费逻辑，由根据用户账户关系计算改为根据账户计算
- Updated dependencies [a3d2f44af6]
- Updated dependencies [f42488eb9e]
- Updated dependencies [5d2b75ccec]
- Updated dependencies [a79aa109bb]
- Updated dependencies [135f2b1be3]
- Updated dependencies [5d2b75ccec]
- Updated dependencies [f577d9d1e4]
  - @scow/config@1.2.0
  - @scow/lib-ssh@1.0.1
  - @scow/scheduler-adapter-protos@1.1.0
  - @scow/lib-scheduler-adapter@1.1.0
  - @scow/utils@1.1.0
  - @scow/lib-server@1.1.0
  - @scow/protos@1.0.2
  - @scow/lib-hook@1.0.2

## 1.1.0

### Minor Changes

- b7f01512eb: 实现了跨集群传输模块
- 50d34d6ae3: 增加 scow 定时同步调度器用户封锁、账户封锁/解封状态的功能

### Patch Changes

- 998dcff881: getAllUsers 接口增加 email 字段
- 6bf6a6e726: 优化修改作业时限，修复修改作业时限 bug 让修改作业时限时指定查询运行中状态的作业
- 914f6c85f8: 修改管理系统用户可见分区为按不同集群响应分开展示，页面展示顺序为按集群优先级顺序
- 3e775b5e15: 解决账户封锁信息展示、导入错误的问题
- 8822114c9b: 修复管理系统消费记录的测试用例中，查询结果按时间倒序排序随机性的问题
- Updated dependencies [b33a2bd6bc]
- Updated dependencies [b7f01512eb]
- Updated dependencies [eca87eaeb6]
- Updated dependencies [5bb922fe99]
- Updated dependencies [ccbde14304]
- Updated dependencies [50d34d6ae3]
- Updated dependencies [29e4b1880a]
- Updated dependencies [ccbde14304]
- Updated dependencies [8fc4c21f07]
  - @scow/config@1.1.0
  - @scow/lib-scheduler-adapter@1.0.1
  - @scow/lib-server@1.0.1
  - @scow/lib-hook@1.0.1
  - @scow/protos@1.0.1

## 1.0.0

### Major Changes

- 11f94f716: 发布 1.0

### Patch Changes

- cb1e3500d: 增加租户管理下和平台管理下的账户消费列表页面，优化账户消费列表显示
- 1fc3688b8: 暴露操作集群时后端返回的错误信息
- ffefb17b8: 修复账户添加用户提示语
- 3610e95da: portal-web 和 mis-web 的个人信息页面调整
- 1bdccd827: 限制创建账户时的主管理员仅为当前租户下的用户
- 0fbba98dd: 用户、账户、作业称呼统一
- 1269e3cef: 操作日志搜索时间精度到秒，展示操作者姓名以及每页默认展示 50 条记录
- Updated dependencies [ee89b11b9]
- Updated dependencies [ee89b11b9]
- Updated dependencies [cb1e3500d]
- Updated dependencies [11f94f716]
  - @scow/config@1.0.0
  - @scow/protos@1.0.0
  - @scow/lib-auth@1.0.0
  - @scow/lib-decimal@1.0.0
  - @scow/lib-hook@1.0.0
  - @scow/lib-config@1.0.0
  - @scow/scheduler-adapter-protos@1.0.0
  - @scow/lib-scheduler-adapter@1.0.0
  - @scow/lib-server@1.0.0
  - @scow/lib-ssh@1.0.0
  - @scow/utils@1.0.0

## 0.9.0

### Minor Changes

- f9c2080b9: fetchJob 功能支持分集群获取作业，从而可以自动导入新增集群的历史作业
- 1c5e3a307: 平台管理中增加租户列表显示
- f3dd67ecb: 增加用户通过代码自定义收费规则的功能

### Patch Changes

- 75951b5bb: 租户管理下账户列表，白名单账户显示优化；增加账户统计信息，用户数量显示等功能。
- d0a71ff79: 删除不用的 lib-slurm 库
- c7d5e50ef: 调整 CallOnAll 的返回类型
- f9fbd4cd2: 租户管理中拆分租户和账户充值记录查询，平台管理中租户查询充值记录时可以下拉选择租户
- 0be4c9ecf: 调整导入作业流程
- d49a34986: 优化租户管理和平台管理的用户列表，增加各角色用户总数显示，优化显示文字及列表结果排序
- 572530a01: mis-web 用户修改邮箱,用户原邮箱直接展示且不可修改，用户填写符合规则的新邮箱后即可直接修改邮箱。
- da5edd22c: 在集群与分区信息页面，实现仅显示用户有使用权限的分区信息
- 291f1d471: mis-web 管理系统 UI 文字和栏目优化。mis-server 返回租户信息中增加租户财务人员，返回平台信息中增加平台财务人员。
- 6522b47cf: 修改作业时限优化，将增加减少时限改为直接设置作业时限，并且检查是否大于作业的运行时间
- 8dcfc3f1a: 增加作业列表中 GPU 卡数的展示
- cce9d6c92: 取消用户限额时可选择是否同时解除对用户的封锁
- e87b2ce5f: 修复调用适配器 getJobById 时，循环 jobIdList 获取 jobId 问题
- 1c668544f: 增加 hook：jobsSaved，此 hook 在作业信息持久化到 scow 数据库后调用
- Updated dependencies [67911fd92]
- Updated dependencies [113e1e4ea]
- Updated dependencies [b96e5c4b2]
- Updated dependencies [31dc79055]
- Updated dependencies [572530a01]
- Updated dependencies [9f70e2121]
- Updated dependencies [6f278a7b9]
- Updated dependencies [8dcfc3f1a]
- Updated dependencies [1407743ad]
- Updated dependencies [f3dd67ecb]
  - @scow/config@0.5.0
  - @scow/lib-auth@0.3.0
  - @scow/lib-scheduler-adapter@0.2.1
  - @scow/protos@0.3.1
  - @scow/lib-hook@0.2.4
  - @scow/lib-server@0.2.0

## 0.8.1

## 0.8.0

### Minor Changes

- 5b7f0e88f: 重构 scow，对接调度器适配器接口

### Patch Changes

- 9da6fb5bc: 修复账户管理租户管理未结束作业查询结果不正确的问题，修复未结束作业批量搜索账户条件带入精确搜索中的问题
- 3f7afe8cb: 完善 mis-server 中针对 fetchJob 和 price 功能的测试，增大测试覆盖率
- e97eb22fd: 集群配置登录节点新增节点展示名
- 7a9973aa0: 修改 HTTP API 定义方式，去除生成 api-routes-schemas.json 步骤
- Updated dependencies [5b7f0e88f]
- Updated dependencies [62083044e]
- Updated dependencies [5c3c63657]
- Updated dependencies [e97eb22fd]
  - @scow/scheduler-adapter-protos@0.2.0
  - @scow/lib-scheduler-adapter@0.2.0
  - @scow/protos@0.3.0
  - @scow/config@0.4.0
  - @scow/lib-ssh@0.4.0
  - @scow/lib-hook@0.2.3
  - @scow/lib-server@0.2.0
  - @scow/lib-slurm@0.1.6

## 0.7.0

### Patch Changes

- 7df3b5e61: scow hook 中 accountBlocked、accountUnblocked 事件增加参数 tenantName
- b8b343894: 修复导入账户勾选加入白名单账户依然封锁问题
- d00ae0da3: 新增创建租户页面，同时创建该租户的管理员用户
- 17d8bcd31: 增加仅在 scow 数据库新增用户的 API
- 20a8d8925: 修改当从白名单移除账户时如果账户余额为 0 元则封锁账户
- 4bfd80986: 认证系统增加管理用户账户关系相关 API
- 487839e16: 租户信息管理员 id 展示 userId 修复
- 9e79e2a9f: 管理平台新增平台信息页面
- 81895f4be: mis.yaml 和 portal.yaml 中支持增加导航链接
- Updated dependencies [0f64e5404]
- Updated dependencies [4bfd80986]
- Updated dependencies [81895f4be]
  - @scow/config@0.3.1
  - @scow/lib-auth@0.2.1
  - @scow/protos@0.2.3
  - @scow/lib-hook@0.2.2
  - @scow/lib-server@0.2.0
  - @scow/lib-slurm@0.1.5

## 0.6.0

### Minor Changes

- 750a51e84: 修复用户从某些账号中移除但 slurm 并没有删除掉依赖关系从而导致仍然可以在该账号下提交作业的问题

### Patch Changes

- b78e1363f: 账户下的用户列表接口 response 增加 email 字段
- Updated dependencies [901ecdb7e]
- Updated dependencies [d2c8e765e]
- Updated dependencies [ce077930a]
  - @scow/config@0.3.0
  - @scow/lib-config@0.2.2
  - @scow/lib-hook@0.2.1
  - @scow/lib-server@0.2.0
  - @scow/protos@0.2.2
  - @scow/lib-slurm@0.1.4

## 0.5.0

### Minor Changes

- c2a8ab7a5: 删除认证系统验证用户姓名的 API，通过认证系统获取用户姓名和管理系统数据库实现
- 2ac7a9b4d: 当已存在的账户中有用户未导入，则可以勾选该账户并导入
- 7bd2578c4: SCOW API 增加静态 token 认证方法
- ef8b7eee0: 增加 SCOW Hook

### Patch Changes

- ff16142d3: 用户作业结算时，用户已用额度来源由租户作业费用改为账户作业费用
- 858c7a6c5: 创建用户时备注改为非必填，修复成功时不展示提示的问题
- e2c804923: 修改平台用户列表只能在第一页搜索用户问题；为了与租户管理的用户界面搜索统一，平台管理用户界面修改为模糊搜索
- d6e06e841: 读取配置文件时允许传入 logger 对象
- Updated dependencies [c2a8ab7a5]
- Updated dependencies [5c066e4a5]
- Updated dependencies [bb9d9bb8b]
- Updated dependencies [215ac2fc7]
- Updated dependencies [7bd2578c4]
- Updated dependencies [ef8b7eee0]
- Updated dependencies [9cb6822e6]
- Updated dependencies [74d718ba1]
- Updated dependencies [1562ebbd2]
- Updated dependencies [d6e06e841]
- Updated dependencies [cb90eb64b]
  - @scow/lib-auth@0.2.0
  - @scow/lib-ssh@0.3.0
  - @scow/config@0.2.0
  - @scow/lib-server@0.2.0
  - @scow/lib-hook@0.2.0
  - @scow/lib-config@0.2.1
  - @scow/protos@0.2.1
  - @scow/lib-slurm@0.1.3

## 0.4.0

### Minor Changes

- 86e0f5b2d: 整个系统打包为一个镜像
- db62f70af: 管理系统 GetJobs API 增加 start_bi_job_index 参数，用于获取从某一个 bi_job_index 开始的作业信息
- 0eb41fed5: 导入用户功能只支持导入默认租户

### Patch Changes

- bdc990a0c: 系统启动时，各个容器在日志中打印版本信息
- 0e02a46a0: 修复某些被封锁的账户仍能提交作业的 bug
- ece2b014d: 修复管理端的作业操作权限问题
- Updated dependencies [bdc990a0c]
- Updated dependencies [86e0f5b2d]
- Updated dependencies [419184a93]
- Updated dependencies [8145061ba]
  - @scow/utils@0.1.2
  - @scow/lib-decimal@0.2.0
  - @scow/protos@0.2.0
  - @scow/lib-ssh@0.2.0
  - @scow/lib-config@0.2.0
  - @scow/lib-slurm@0.1.2
  - @scow/config@0.1.2

## 0.3.0

### Patch Changes

- @scow/protos@0.1.1
- @scow/lib-slurm@0.1.1

## 0.2.0

### Minor Changes

- 84fcc4bf3: 增加配置日志输出选项功能
- 1a6b992db: 完善平台管理的租户列表，新增租户的创建时间
- 4ecca3d1e: 检查默认计费项是否完备
- 2b3648839: 优化导入用户模块，以账户为单位导入

### Patch Changes

- 99f806a33: 管理系统增加刷新 slurm 封锁状态功能
- Updated dependencies [6814c3427]
- Updated dependencies [c24e21662]
  - @scow/config@0.1.1
  - @scow/lib-config@0.1.1
  - @scow/lib-decimal@0.1.1

## 0.1.2

## 0.1.1
