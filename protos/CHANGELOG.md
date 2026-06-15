# @scow/grpc-api

## 1.34.1

### Patch Changes

- 00d1161: 删除开源许可声明，统一执行 lint format
- 3fccf34: 未结束作业接口修改 user_name 为可选字段

## 1.34.0

### Minor Changes

- 5082746: 新增 completeMultipartUpload 接口，废弃 mergeFileChunks 接口，修改 initMultipartUpload 接口参数

## 1.33.0

### Minor Changes

- 5160f9e: `CreateAppSessionRequest` 中的内存字段从 `string memory` 改为 `uint32 memory_mb`，类型由格式化字符串改为以 MB 为单位的整数
- 148099e: common/config.proto 中 Partition 增加分区描述；增加获取可用账户下用可用集群 GetAvailableAccountsAndClusters；增加计算作业费用 CalculateJobPrice；增加保存作业模板 SaveAsJobTemplate。

### Patch Changes

- f8fe60d: 集成 Alertmanager 监控告警通知
- 148099e: 1. 重构 hpc 交互式应用提交作业页面 2. 修改交互式应用菜单，不再以集群为维度
- 2d3dcf6: 删除 dead code 并提取 AI 作业表单公共模块
- 148099e: listAppSessions 增加 clusters 传参

## 1.32.0

### Minor Changes

- e76e039: GetAllUsers、GetPlatformUsersCounts、ExportUser 增加用户名和用户 ID 字段

### Patch Changes

- 5ff48b7: 账户充值记录查询优化。调整查询条件、列表字段、更改分页为后端分页。
- 7f7a095: 在 app_authorization.proto 中的 GetTargetAppAuthorizations 接口中增加账户主管理员 id 和 name 的查询与返回参数
- 0c326bc: 修复账户消费记录导出时无法根据用户 id 和 name 模糊搜索的问题

## 1.31.0

### Minor Changes

- a91add6: 新增 runScript 接口

### Patch Changes

- 344b2da: ai 进入容器从调用 k8sAPI 切换为调用适配器和集群删除 k8s 配置

## 1.30.0

### Minor Changes

- 1154951: 将 cancelJobChargeLimit、setJobChargeLimit、removeUserFromAccount、blockUserInAccount、
  unblockUserInAccount 拓展增加 userIds 参数，并将 userId 改为 optional。
- 79278d5: 管理系统平台管理员配置是否启用 shell 的 root 权限，增加 getIsUserEnabledRootShell 接口判断用户是否允许使用 shell 的 root 权限
- 79278d5: 在审计系统的 proto 中增加资源管理下与集群/分区授权相关的 message

### Patch Changes

- 79278d5: connectToApp 接口新增 jobId 参数
- ca83d79: 登录节点桌面优化数据展示和错误提示
- 8f30ca0: 管理端 getRunningJobs 增加返回参数：accountPrice、tenantPrice、chargingPeriod 的起止时间（startTime、endTime）

## 1.29.0

### Minor Changes

- c495538: 已结束作业查询和导出新增 jobsOfJobIds 的 target，增加 changeJobPrice 操作日志
- 0cb903e: getUserStatus 接口新增 accountNames 参数用于缩小查询范围

### Patch Changes

- 36880eb: 新增多个系统语言

## 1.28.0

### Minor Changes

- 00c1241: **修改以下 proto 接口中 ownerId 及 ownerName 相关项为可选**:
  GetWhitelistedAccountsResponse, GetAccountsResponse, GetBillsResponse
  **修改以下返回值带有 JobInfo 的 proto 接口中 ownerId 及 ownerName 相关项为可选**:
  ExportJobRecordResponse, GetJobsResponse, GetJobByBiJobIndexResponse
  **修改以下 HOOK 的 proto 接口中 ownerId 及 ownerName 相关项为可选**:
  JobsSaved, AccountDeleted

## 1.27.0

### Minor Changes

- 7b07e05: 管理系统平台管理员配置是否启用 shell 的 root 权限，增加 getIsUserEnabledRootShell 接口判断用户是否允许使用 shell 的 root 权限
- 627aced: 在审计系统的 proto 中增加资源管理下与集群/分区授权相关的 message

### Patch Changes

- 4bd522e: connectToApp 接口新增 jobId 参数

## 1.26.0

### Minor Changes

- 6f77b4e: FileType 类型新增软链接，并将其从 FileInfo 中移动到外层

## 1.26.0

### Minor Changes

- 6f77b4e: FileType 类型新增软链接，并将其从 FileInfo 中移动到外层

## 1.25.0

### Minor Changes

- 4f98a31: 增加未结束作业和已结束左右的返回参数
- 6752734: shell 卡片增加集群描述，桌面增加图标设置
- 8e15ab8: 将部分 AI 操作日志 protobuf 中后加的参数修改为 optional

### Patch Changes

- 56634b6: 补充修改保存镜像操作日志 protobuf 中后添加的镜像名参数为可选型
- f0f144d: 存储管理新增定时同步使用量和批量修改用户存储配额等功能

## 1.24.0

### Minor Changes

- 8d7c549: 管理系统已结束作业中增加量子作业调用 getQuantumJobInfo 接口

### Patch Changes

- f0ecf70: AI 新增申请开发机功能

## 1.23.2

### Patch Changes

- 58e7347: 在 proto/portal 下对 desktop 的增删改查的 Request/Response 增加可选参数兼容 shadowdesk 控制工具.
- a5f0e1d: 新增是否存在存储副本的配置，并提供提示

## 1.23.1

### Patch Changes

- 3c03a17: 在快捷入口的 message AppEntry 增加可选参数 app_logo_path
  仅在 getQuickEntries 中使用，在获取后匹配当前交互式应用配置中的图标路径

## 1.23.0

### Minor Changes

- ff956a2: 增加默认授权应用相关接口: getTenantApps, updateDefaultApp
  增加默认授权应用相关日志 message: AddToDefaultApps, RemoveFromDefaultApps

### Patch Changes

- d10f80f: ai 镜像、算法、数据集和模型操作日志修改

## 1.22.0

### Minor Changes

- 5da1b58: 新增租户管理员存储管理功能
- a4d7ac3: 新增同步账户用户信息数据相关接口 StartAccountUserSynchronization，ListAccountUserSynchronizations，CheckAccountUserSynchronizationRunning
- 778e6c7: 在 proto/server 下增加授权交互式应用的 proto 文件 app_authorization,
  在 proto/portal 下对 listAvailableApps 中增加可选查询参数 user_id 获取用户可用应用列表,
  在 proto/audit 中增加授权交互式应用日志的相关 message
- b961d74: 新增节点迁移状态获取与节点迁移相关接口

### Patch Changes

- 5772fea: 新增创建用户的表单项，修改用户列表展示和导出字段

## 1.21.0

### Minor Changes

- 02b64da: 调整操作日志中部分行为操作对象的参数

## 1.20.0

### Minor Changes

- de86c6e: 在 app.proto 中增加交互式应用系统保留配置项相关的 proto
  在 file.proto 中新增解压缩文件的接口
- 3669a48: 修改 app.proto 中 getAppMetadataResoonse 的 ReservedAppAttribute, 支持 fixedValue 与 select 两种配置型

## 1.19.0

### Minor Changes

- 71c83bb: 修复 portal 中应用无需密码但是也得生成，不然会报错
- 916aebc: HPC 文件管理新增文件夹上传，在线压缩和压缩下载功能

## 1.18.0

### Minor Changes

- 4bcc216: 增加获取加增加获取月/年账单的接口：GetBills，
  增加获取账户账单以用户为详情维度的接口：GetUserBills，
  在上述接口中，term 是指一个周期，比如某一个月，或者某一年

### Patch Changes

- 00b83a0: 增加推理功能

## 1.17.0

### Minor Changes

- 6262855: AddUserToAccount 增加了 is_tenant_admin 参数，新增 isAccountBelowBlockThreshold 接口，判断账户是否低于封锁阈值

### Patch Changes

- d598517: mis-server 作业信息查询接口及导出接口中的 time_start 变为 optional
- 6262855: 封锁或欠费账户无法添加用户

## 1.16.0

### Minor Changes

- a2f8a67: 增加删除用户和账户 hook
- 249d35d: GetStatisticInfo,GetChargeRecordsTotalCount,GetJobTotalCount 的返回增加数据产生更新时间的字段
- 46dfcf9: 增加导出已结束作业接口

## 1.15.0

### Minor Changes

- 597955e: 增加授权账户集群与取消授权账户集群的 Hook
- b0a38e0: 用户表增加手机、组织和备注字段并允许平台和租户管理员修改用户信息

## 1.14.1

### Patch Changes

- f75af4b: ListAppSessions 返回增加 jobName

## 1.14.0

### Minor Changes

- a38ef7f: 将 portal 中的 getClusterNodesInfo 移动到 common 下作为共用 grpc api，标记原有接口为 deprecated
- 6c6f8c6: 新增删除用户账户相关接口
- 701ebc7: 增加塔影交互式应用接口和相关字段

### Patch Changes

- bef6181: 改进了门户仪表盘中计算分区、平台的节点逻辑
- b66dcfe: 适配器 getClusterInfo 新增返回接口参数.
- 873fa96: 在 protos/portal/app 的 AppSession 中增加 appType 的返回值

## 1.13.0

### Minor Changes

- 721b227: 新增消息系统

## 1.12.0

### Minor Changes

- abd69cb: 接入 scowd 文件分片上传

## 1.11.0

### Minor Changes

- 4bef1b3: 增加获取 SCOW API 版本的接口
- 66a96ba: 新增 getClusterNodesInfo 接口，用于获取集群分区节点信息。

### Patch Changes

- c214bd2: 当 mis-server 正在进行一次封锁状态同步时，调用 server/AdminService.UpdateBlockStatus API 会抛出`AlreadyExists`错误
- e9c8bfa: 增加 ai 的操作日志，涉及文件、镜像、数据集、算法、模型和作业应用'

## 1.10.0

### Minor Changes

- 5b6af87: 将 mis-server 中 getTopChargeAccount、getTopPayAccount 返回值新增 userName
- 3558bd4: JobTemplate 与 ListAllJobsResponse 增加 max_time_unit 可选字段
- b8d1270: 新增集群停用功能 api: getClustersRuntimeInfo, activateCluster, deactivateCluster
  新增获取集群配置信息 api： getClusterConfigFiles
- 0a43348: 在 common/config 下新增 getAvailablePartitionsForCluster 作为门户/管理系统共用 proto,管理系统下原 proto 标记为已过时；在 listAccounts 下新增可选 AccountStatusFilter 查询参数
- 806f778: 获取配置时返回 scowd 的配置

## 1.9.0

### Minor Changes

- 89191ea: GetPaginatedChargeRecords 添加字段 user_id_or_name，将 GetChargeRecordsTotalCount 中的 userIds 改为 user_id_or_name.
- 875fe29: 管理系统仪表盘账户信息显示卡片中可用余额逻辑和 UI 优化
- 6304074: JobTemplate 新增 script_output 可选字段，SubmitJobRequest 新增可选字段 script_output。
- daf3885: getWhitelistedAccounts 新增返回字段 expirationDate，whitelistAccount 新增字段 expirationDate，在 getWhitelistedAccounts 新增每次查询会检测 中是否有账户过期，有的话会自动删除
- a53bcad: 充值记录和消费记录支持多选账户搜索，充值记录增加类型搜索；导出充值记录和消费记录同步增加这两个搜索条件
- f534377: 为 getOperationLogs、 getPaginatedChargeRecords、 getJobs 三个 API 新增了 sortBy、sortOreder 参数，表示排序的列、排序方式（升序、降序、默认）

### Patch Changes

- f534377: 增加了 mis portal 中表格排序的功能，以及部分 UI 的修改

## 1.8.1

### Patch Changes

- 583978b: 管理系统下的平台数据统计提交作业前十的用户数横坐标改为以 userName 的方式显示.

## 1.8.0

### Minor Changes

- a097dd1: server 增加 ChangeTenant 接口修改用户的所属租户，增加 CreateTenantWithExistingUserAsAdmin 接口允许创建租户时指定已有用户作为租户管理员
- 63d1873: 新增 SetBlockThreshold， SetDefaultAccountBlockThreshold 以及 audit 新增以上接口的 operation_event

### Patch Changes

- 850a7ee: 在 getAccountUsers 接口中增加 userStateInAccount , displayedUserState 的返回值
- 785de17: 修改 GetFileMetadataResponse 中文件大小 size 为 uint64
- d3d891a: 门户系统部分操作类型增加 clusterId 及 loginNode 参数
- 24db413: 增加 GetCustomEventTypes 接口获取自定义操作类型，增加 CustomEvent 保存自定义操作类型
- 8dd8c0e: 在 GetAccounts 接口中增加账户状态，账户显示状态，账户白名单状态的返回值，exportAccounts 接口中增加欠费，冻结的查询参数

## 1.7.0

### Minor Changes

- 443187e: GetDailyCharge,GetDailyPay,GetNewJobCount,GetNewUserCount,GetActiveUserCount 接口新增 time_zone 参数以及返回类型由时间戳改为 date

### Patch Changes

- 410fb0e: 在文件管理的 readDirectory 接口下增加可选参数 updateAccessTime，只在文件传输功能时更新时间戳

## 1.6.0

### Minor Changes

- afc3350: charge 接口增加可选入参 user_id,metadata, 消费记录查询接口增加查询参数 user_ids,增加返回值 user_id 与 metadata

## 1.5.0

### Minor Changes

- f023d52: 新增数据统计接口，audit 新增 GetActiveUserCount，GetPortalUsageCount，GetMisUsageCount, server 新增 GetTopChargeAccount，GetDailyCharge，GetTopPayAccount，GetDailyPay，GetStatisticInfo，GetTopSubmitJobUsers，GetNewJobCount，GetJobTotalCount，GetNewUserCount
- 081fbcf: server 新增 Export Service, 新增 ExportAccount, ExportUser, ExportChargeRecord, ExportPayRecord 接口，audit-server 新增 ExportOperationLog 接口
- cb055c4: 门户仪表盘新增快捷入口，可以新增、删除、拖拽排序快捷方式

### Patch Changes

- 201a3e2: 修复部分集群无法获取集群运行信息时导致仪表板无法展示其他正常信息

## 1.4.0

### Minor Changes

- ec06733f9f: 门户仪表盘删除之前的配置标题和文字，增加平台队列状态展示

## 1.3.1

### Patch Changes

- 1a1189ad48: GetPlatformUsersCounts 新增 id_or_name 参数

## 1.3.0

### Minor Changes

- 5b9116e3bd: hook(accountPaid、tenantPaid) 增加的传参 type,、comment

## 1.2.0

### Minor Changes

- 135f2b1be3: 新增 submitFileAsJob 接口，直接把文件作为作业提交调度器执行
- 35e026be3e: 标记原有 getChargeRecords 接口为已过时，将在下一个大版本发布后被删除，新增 getPaginatedChargeRecords 与 getChargeRecordsTotalCount 接口，分别获取当前消费记录页面的详细信息与消费记录的总量，总额
- f6f84b6d60: 管理系统未结束作业新增结束操作
- a78a6e0b56: GetOperationLogs 新增 operation_detail 传参用于模糊搜索

## 1.1.0

### Minor Changes

- b7f01512eb: 实现了跨集群传输模块
- 914f6c85f8: 新增 getAvailablePartitionsForPartitions 接口获取某个集群下可见分区信息，getAvailablePartitions 变更为 deprecated 将在下一个大版本中被删除
- 50d34d6ae3: 增加 scow 定时同步调度器用户封锁、账户封锁/解封状态的接口，返回失败的账户、用户的信息
  增加获取 scow 定时同步调度器用户封锁、账户封锁/解封状态配置信息的接口
  增加设置 scow 定时同步调度器用户封锁、账户封锁/解封状态配置启动/关闭的接口
  后续版本版本将会删除 updateBlockStatus 接口

### Patch Changes

- bd6783e89e: 修改 FILEINFO 中文件 size 的类型为 unit 64
- ccbde14304: 修改交互式应用的 html 配置表单的 lable 与 placeholder 的 grpc 类型为 i18nStringType
- 8fc4c21f07: 在 getAppMetadata 的返回值中增加交互式应用说明 app_comment
- 998dcff881: getAllUsers 接口增加 email 字段

## 1.0.0

### Major Changes

- 11f94f716: 发布 1.0

### Minor Changes

- ee89b11b9: 新增审计系统，增加 CreateOperationLog 和 GetOperationLogs 接口定义
- cb1e3500d: GetChargeRecords 改用 oneOf 拆分成查询账户消费记录或租户消费记录的各种情况,增加消费类型 type 的查询参数

### Patch Changes

- 3610e95da: 获取用户信息接口 GetUserInfoResponse 增加用户创建时间
- f784837d3: 增加租户管理、平台管理的账户列表封锁账户的功能
- 1269e3cef: 新增 getUsersByIds 接口以供操作日志查询操作者姓名

## 0.6.0

### Minor Changes

- 1c5e3a307: 增加了平台获取所有账户的接口——GetAllAccounts
- 6522b47cf: ChangeJobTimeLimitRequest 的传参由传差值 delta 改为传作业时限 limit
- f9fbd4cd2: GetPaymentRecords 因情况太多，改用 oneOf 的写法拆分参数

### Patch Changes

- 1c668544f: 增加 hook：jobsSaved；将 server 中的 JobInfo 提取到 common 中供 hook、server 使用
- 67911fd92: 增加 requireGpu 配置项
- 6f278a7b9: 修改 CreateDesktop 传参增加 desktop_name, ListUserDesktop 返回新增 Desktop。
- 59cb5a418: 增加删除作业模板接口 DeleteJobTemplate、重命名作业模板接口 RenameJobTemplate
- 572530a01: mis-web 用户修改邮箱,用户原邮箱直接展示且不可修改，用户填写符合规则的新邮箱后即可直接修改邮箱。
- 75951b5bb: 在获取账户白名单 getWhitelistedAccounts 接口返回值中增加账户余额 balance
- 291f1d471: 租户信息中增加租户财务人员，平台信息中增加平台财务人员
- d49a34986: 增加 getPlatformUsersCounts 接口获取平台用户列表各角色总数，在 getAllUsers 中增加查询排序信息及查询角色的可选查询参数
- cce9d6c92: 取消用户限额接口增加可同时取消封锁属性
- 8dcfc3f1a: 增加作业列表中 GPU 卡数的展示
- da5edd22c: 根据调度器接口信息，在 mis 下新增 getAvailablePartitions 接口，实现获取用户有使用权限的分区信息

## 0.5.0

### Minor Changes

- 5b7f0e88f: 重构 scow，对接调度器适配器接口
- 5c3c63657: ListAvailableWms 新增传参集群 ID
- 6853606f8: shell 和桌面相关接口增加 login_node 参数

### Patch Changes

- 99e2b08e1: 创建交互式应用, 新增节点数，gpu 卡数及总内存传参
- 62083044e: 修改了 GetAppMetadata，ListAvailableApps，CreateAppSession 及 ListAppSessions 以满足增加集群查询参数，作业名，应用名及应用图标配置路径

## 0.4.1

### Patch Changes

- 7df3b5e61: scow hook 中 accountBlocked、accountUnblocked 事件增加参数 tenantName
- 17d8bcd31: 增加仅在 scow 数据库新增用户的 API
- d00ae0da3: 创建租户 api 修改，新增创建租户管理员用户逻辑
- 9e79e2a9f: 新增 getAdminInfo api 获取平台信息

## 0.4.0

### Minor Changes

- 8b36bf0bc: ListAppSessions 返回的 AppSession 中，去掉 ready 属性，增加 host 和 port，表示应用监听的主机和端口

### Patch Changes

- d2c8e765e: 优化创建交互式应用页面：在用户家目录下的 apps/app[Id]路径下存入上一次提交记录；创建了查找上一次提交记录的 API 接口，每次创建交互式应用时查找上一次提交记录，如果有则与当前集群下配置对比选择填入相应的值。
- b78e1363f: 账户下的用户列表接口 response 增加 email 字段

## 0.3.0

### Minor Changes

- c2a8ab7a5: 删除认证系统验证用户姓名的 API，通过认证系统获取用户姓名和管理系统数据库实现
- 2981664f4: 门户所有作业列增加开始、结束时间列，增加时间说明
- 2ac7a9b4d: 当已存在的账户中有用户未导入，则可以勾选该账户并导入
- aa4d0ff1c: 为 PENDING 等需要显示作业未运行原因的状态的 APP，显示原因
- ef8b7eee0: 增加 SCOW Hook
- 1c8d3e1c0: 提交作业时必须指定分区
- 1562ebbd2: 提交作业时增加 GPU 选项

### Patch Changes

- 858c7a6c5: 创建用户时备注改为非必填，修复成功时不展示提示的问题

## 0.2.0

### Minor Changes

- 882a247a1: 重构 app 的 sbatch options，gRPC 中与 custom_attributes 一起发送
- d4b0cde25: 创建 web 类交互式应用时由前端传入 base path，将节点名解析为 IP 地址的工作由 portal-server 完成
- db62f70af: 管理系统 GetJobs API 增加 start_bi_job_index 参数，用于获取从某一个 bi_job_index 开始的作业信息
- 0eb41fed5: 导入用户功能只支持导入默认租户

### Patch Changes

- 1c8a948d8: 把代码中 SavedJobs 字样全部改为 JobTemplate

## 0.1.3

### Patch Changes

- e7a5c8b8f: 在发布的文件中添加 buf.yaml
