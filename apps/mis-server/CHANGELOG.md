# @scow/mis-server

## 1.5.0

### Minor Changes

- 63d1873: 账户新增封锁阈值，租户新增默认账户默认阈值以

### Patch Changes

- a097dd1: 新增无账户关系的用户修改所属租户且可以作为新增租户的管理员功能
- 8dd8c0e: 修改 Account 实体中原 blocked 字段名为 blocked_in_cluster ，表示在集群中是否为封锁状态
  增加字段 state ,字段值为 "NORMAL" , "FROZEN" , "BLOCKED_BY_ADMIN" 的枚举值，优化页面账户显示状态为正常、封锁、欠费
- 6139fec: 修复导出账户和导出充值记录接口缺失 limit，offset 过滤的问题
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
- 1bdccd827: 限制创建账户时的拥有者仅为当前租户下的用户
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
