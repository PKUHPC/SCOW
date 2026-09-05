# @scow/scow-adapters

## 1.11.7

### Patch Changes

- d1967f0: 修复 Jupyter 应用代理路径缺少主机和端口的问题
- 1c40c5e: "优化适配器层账户命名规范"
- a900a80: 提交作业增加提交后的“可见性确认”，但是不会影响作业的提交
- c1bb12a: 优化日志打印
- 037f680: "增加分布式推理并重构推理相关代码"
- d3b7488: 优化 HPC 作业管理页面，支持按账户、状态、作业 ID、作业名及提交/结束时间筛选，并统一未结束作业与历史作业入口。新增通用日期时间范围选择组件，并替换 MIS 和 Portal 中的时间筛选框组件。
- db26011: 修复因 reason 查询不到而丢弃刚提交作业的问题。
- 037f680: "增加定时任务持续清理作业附属资源"
- c6a7c87: 修复适配 crane v2 遇到的问题
- e7aaa78: "优化 pod reason 信息"

## 1.11.6

### Patch Changes

- 2d8e17c: 修复 AI、Crane 和 Crane AI 适配器中账户或用户封锁后无法查询已授权分区的问题。封锁状态继续限制作业提交和运行，但不再影响可用分区及资源信息展示。
- a68925e: "修复 depoy 中间状态异常 bug"
- 78afee8: 适配鹤思最新 V2.0 版本的 proto
- ead3257: 修复 crane 适配器 GetClusterInfo 接口未包含集群节点数据的问题
- fcbd40a: 查询已结束作业过滤 pending、running 状态的作业

## 1.11.5

### Patch Changes

- 45d378c: "开发机增加账号加速卡配额及容器部署引起的 bug 修复"
- 9a9b4fa: 同步时，账户是封锁的，slurm 中账户也是封锁的，这时不用收敛账户的分区权限
- 584166e: 修复账户欠费封锁后之前 Pending 的作业依然能运行的问题
- 7554ba2: 修复添加用户是执行命令报 Nothing added 却认为失败的问题

## 1.11.4

### Patch Changes

- a136207: 鹤思 AI 应用作业的建立连接功能
- f910038: 修复：1. 创建的新分区无法授权；2. 解封用户会将封锁的账户误解封；3. 修改 slurm.conf 后 scontrol reconfigure，缓存中的分区未更新。
- a46cdc1: 基于 scheduler adapter 的 partitionStrategy 优化创建账户和添加用户到账户流程：MIS 在资源管理开启时传递当前可开放分区，适配器在创建时直接收敛分区可用状态，减少创建后再封锁的窗口期，并修复空授权分区、账户封锁和后续重新授权场景下的状态一致性。
- 4202192: slurm 适配器 GetAccountAllowedPartitionByAssociation 补充账户下没有任何用户分区关联时通过 maxSubmitJobs 判断账户状态
- ee8bad1: 在 GetAllAccountsWithUsers / GetAllAccountsWithUsersAndBlockedDetails 接口中返回没有分区关联的账户用户数据
- 1722413: ldap 已删的用户，这时从账户中移出时，若没有运行的作业了，应该运行适配器从账户移出该用户
- 2e7f2bf: 修复执行 slurm 命令 Nothing modified 时，报该命令失败的问题
- a042731: 应用建立连接信息持久化及 crane-ai 的 tensorbord 启动命令适配器自己维护
- 660ad21: "修复 AI 作业运行时长和超时定时器计算"
- f6023cf: 仪表盘稳定性，避免因个别节点和分区信息获取失败导致整个接口失败
- 3abea29: "开发机增加 pipy 备用源"

## 1.11.3

### Patch Changes

- 749a6ed: "修复开发机 JupyterLab 登录密码生成"
- 013d085: 完善 AI 适配器环境变量与挂载配置
- be70914: 修复鹤思适配器删除账户失败的 bug
- f23cdf9: "修复 AI 适配器容器部署日志路径配置问题"
- 1db2326: "修复 TensorBoard 启动与挂载目录环境变量"
- e9c002a: 已失败 ai 开发机点击取消时不再报错
- 9713fca: 鹤思 ai 适配器支持 HPC 作业
- 30a2f2a: "修复推理作业 Deployment 状态判断逻辑及增加手动编译带过期时间的适配器"

## 1.11.2

### Patch Changes

- 9f9d2b1: "修复获取作业最大时长解析 bug"
- 00d1161: 删除开源许可声明，统一执行 lint format
- ee6a900: 修复 ai 适配器容器部署 bug
- a0fe773: 新增 crane-ai 适配器
