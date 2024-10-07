# @scow/grpc-api

## 1.12.1

### Patch Changes

- 7c96613: 修改更名后的链接地址和文档描述

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
