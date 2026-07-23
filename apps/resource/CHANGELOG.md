# @scow/resource

## 0.3.18

### Patch Changes

- 23a94d3: 增加统一的日志上下文信息
- a46cdc1: 基于 scheduler adapter 的 partitionStrategy 优化创建账户和添加用户到账户流程：MIS 在资源管理开启时传递当前可开放分区，适配器在创建时直接收敛分区可用状态，减少创建后再封锁的窗口期，并修复空授权分区、账户封锁和后续重新授权场景下的状态一致性。
- 3ee238d: 取消租户授权集群/分区时，如果出现报错，资源管理数据库相关数据未移除成功
- Updated dependencies [23a94d3]
- Updated dependencies [fb6ab4b]
- Updated dependencies [3567ac0]
- Updated dependencies [837808c]
- Updated dependencies [c273ead]
  - @scow/lib-server@1.5.4
  - @scow/lib-web@1.6.4
  - @scow/config@1.16.1
  - @scow/protos@1.1.3
  - @scow/lib-hook@1.0.43
  - @scow/lib-operation-log@2.2.18
  - @scow/lib-scheduler-adapter@1.1.41

## 0.3.17

### Patch Changes

- c40d387: 修改注释、文案等账户拥有者概念为账户主管理
- 0a1a819: UI 样式&交互整体走查
- Updated dependencies [94ee545]
- Updated dependencies [68309f0]
- Updated dependencies [bfe6ffc]
- Updated dependencies [013d085]
- Updated dependencies [68309f0]
- Updated dependencies [e0f253b]
- Updated dependencies [c40d387]
- Updated dependencies [59348c8]
- Updated dependencies [59348c8]
- Updated dependencies [68309f0]
- Updated dependencies [68309f0]
- Updated dependencies [c23e1ac]
- Updated dependencies [0a1a819]
  - @scow/lib-web@1.6.3
  - @scow/lib-server@1.5.3
  - @scow/lib-scheduler-adapter@1.1.40
  - @scow/protos@1.1.2
  - @scow/config@1.16.0
  - @scow/lib-hook@1.0.42
  - @scow/lib-operation-log@2.2.17

## 0.3.16

### Patch Changes

- 00d1161: 删除开源许可声明，统一执行 lint format
- c56bdaa: 更新 nextjs 版本至 15.5.16
- Updated dependencies [87682ee]
- Updated dependencies [46c4f2c]
- Updated dependencies [439e7ed]
- Updated dependencies [44cf25f]
- Updated dependencies [00d1161]
- Updated dependencies [0b41958]
- Updated dependencies [96ede62]
- Updated dependencies [839c754]
- Updated dependencies [c56bdaa]
  - @scow/config@1.15.0
  - @scow/lib-server@1.5.2
  - @scow/scow-resource-protos@0.3.3
  - @scow/lib-scheduler-adapter@1.1.39
  - @scow/lib-operation-log@2.2.16
  - @scow/protos@1.1.1
  - @scow/lib-config@1.0.9
  - @scow/lib-decimal@1.0.1
  - @scow/utils@1.1.4
  - @scow/lib-hook@1.0.41
  - @scow/lib-web@1.6.2

## 0.3.15

### Patch Changes

- 0c8ffa0: 将 next 从 15.5.9 升级到 15.5.15
- Updated dependencies [5082746]
- Updated dependencies [56979c6]
- Updated dependencies [b4f7dde]
- Updated dependencies [8b2b13b]
- Updated dependencies [b65945b]
- Updated dependencies [f3a73f5]
- Updated dependencies [0c8ffa0]
  - @scow/lib-web@1.6.1
  - @scow/protos@1.1.0
  - @scow/lib-hook@1.0.40
  - @scow/lib-operation-log@2.2.15
  - @scow/lib-scheduler-adapter@1.1.38
  - @scow/lib-server@1.5.1

## 0.3.14

### Patch Changes

- 148099e: 重构 hpc 提交作业
- 2d3dcf6: 删除 dead code 并提取 AI 作业表单公共模块
- Updated dependencies [f8fe60d]
- Updated dependencies [f3da786]
- Updated dependencies [6ef8e28]
- Updated dependencies [148099e]
- Updated dependencies [148099e]
- Updated dependencies [2d3dcf6]
- Updated dependencies [41dd8f4]
- Updated dependencies [3d18a5c]
- Updated dependencies [c981960]
- Updated dependencies [e578c89]
- Updated dependencies [c981960]
- Updated dependencies [00aa2eb]
- Updated dependencies [1733acd]
  - @scow/config@1.14.0
  - @scow/lib-web@1.6.0
  - @scow/lib-server@1.5.0
  - @scow/scow-resource-protos@0.3.2
  - @scow/lib-hook@1.0.39
  - @scow/lib-operation-log@2.2.14
  - @scow/protos@1.0.39
  - @scow/lib-scheduler-adapter@1.1.37

## 0.3.13

### Patch Changes

- 7f7a095: 在租户管理下的授权应用和授权集群分区页面增加账户拥有着的查询与展示
- 470b7ef: 修复 getUnreadMessages 调用导致 mis 的 init 页面需要登录的 bug、删除 BodyContainer
- ffc4632: 优化页面中 Input 组件失焦时会自动去除前后空格
- 7f7a095: 优化管理系统账户列表获取逻辑，优化资源管理授权集群分区页面数据逻辑
- Updated dependencies [7f7a095]
- Updated dependencies [7f93a72]
- Updated dependencies [fb60d5c]
- Updated dependencies [ffc4632]
- Updated dependencies [470b7ef]
- Updated dependencies [ffc4632]
- Updated dependencies [028995a]
  - @scow/lib-web@1.5.13
  - @scow/config@1.13.2
  - @scow/protos@1.0.38
  - @scow/lib-hook@1.0.38
  - @scow/lib-operation-log@2.2.13
  - @scow/lib-server@1.4.13
  - @scow/lib-scheduler-adapter@1.1.36

## 0.3.12

### Patch Changes

- d4e02dc: 操作按钮鼠标悬浮时背景色随 UI 配置主题色变化, 作业模板 ICON 更换,自定义导航链接默认 ICON 更换,平台切换的按钮中文字 icon 一直都保持主题色
- cf47ef2: 修复所有使用 grpc 项目的内存泄露问题
- c9ecafb: 前端控制台打印 error、warning 修复
- Updated dependencies [d4e02dc]
- Updated dependencies [cf47ef2]
- Updated dependencies [344b2da]
- Updated dependencies [a5e2a18]
- Updated dependencies [a91add6]
- Updated dependencies [344b2da]
- Updated dependencies [f8957cb]
- Updated dependencies [c9ecafb]
  - @scow/lib-web@1.5.12
  - @scow/lib-operation-log@2.2.12
  - @scow/lib-server@1.4.12
  - @scow/lib-hook@1.0.37
  - @scow/config@1.13.1
  - @scow/utils@1.1.3
  - @scow/protos@1.0.37
  - @scow/lib-scheduler-adapter@1.1.35

## 0.3.11

### Patch Changes

- 79278d5: 优化资源管理服务的错误信息处理
- 79278d5: 资源管理增加操作日志
- Updated dependencies [fab1829]
- Updated dependencies [b4c002a]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
- Updated dependencies [1154951]
- Updated dependencies [5eb4f91]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
- Updated dependencies [8f30ca0]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
  - @scow/lib-web@1.5.11
  - @scow/config@1.13.0
  - @scow/lib-scheduler-adapter@1.1.34
  - @scow/protos@1.0.36
  - @scow/lib-config@1.0.8
  - @scow/lib-hook@1.0.36
  - @scow/lib-operation-log@2.2.11
  - @scow/lib-server@1.4.11

## 0.3.10

### Patch Changes

- 36880eb: 新增多个系统语言
- Updated dependencies [7281dc1]
- Updated dependencies [a5eedd1]
- Updated dependencies [c495538]
- Updated dependencies [0cb903e]
- Updated dependencies [0cb903e]
- Updated dependencies [36880eb]
- Updated dependencies [be398ab]
- Updated dependencies [3b6cea7]
  - @scow/lib-web@1.5.10
  - @scow/protos@1.0.35
  - @scow/lib-operation-log@2.2.10
  - @scow/config@1.12.1
  - @scow/lib-server@1.4.10
  - @scow/utils@1.1.2
  - @scow/lib-hook@1.0.35
  - @scow/lib-scheduler-adapter@1.1.33

## 0.3.9

### Patch Changes

- 045b819: 修复 openapi 无法使用的问题
- 3a16099: 升级 next 和相关依赖版本
- Updated dependencies [3a16099]
  - @scow/scow-resource-protos@0.3.1
  - @scow/lib-server@1.4.9
  - @scow/protos@1.0.34
  - @scow/lib-hook@1.0.34
  - @scow/lib-operation-log@2.2.9
  - @scow/lib-scheduler-adapter@1.1.32
  - @scow/lib-web@1.5.9

## 0.3.8

### Patch Changes

- 4f1da40: 优化资源管理服务的错误信息处理
- 627aced: 资源管理增加操作日志
- Updated dependencies [5b29d63]
- Updated dependencies [cc87c57]
- Updated dependencies [acd7215]
- Updated dependencies [21340c9]
- Updated dependencies [7b07e05]
- Updated dependencies [e5ff94c]
- Updated dependencies [ce6fc46]
- Updated dependencies [7b07e05]
- Updated dependencies [ce6fc46]
- Updated dependencies [8b458d0]
  - @scow/config@1.12.0
  - @scow/lib-web@1.5.8
  - @scow/lib-scheduler-adapter@1.1.31
  - @scow/lib-config@1.0.7
  - @scow/protos@1.0.33
  - @scow/lib-hook@1.0.33
  - @scow/lib-operation-log@2.2.8
  - @scow/lib-server@1.4.8

## 0.3.7

### Patch Changes

- Updated dependencies [6f77b4e]
- Updated dependencies [2ff4aed]
- Updated dependencies [6f77b4e]
- Updated dependencies [6f77b4e]
  - @scow/config@1.11.2
  - @scow/lib-web@1.5.7
  - @scow/lib-hook@1.0.32
  - @scow/lib-server@1.4.7
  - @scow/protos@1.0.32
  - @scow/lib-scheduler-adapter@1.1.30

## 0.3.7

### Patch Changes

- Updated dependencies [6f77b4e]
- Updated dependencies [2ff4aed]
- Updated dependencies [6f77b4e]
- Updated dependencies [6f77b4e]
  - @scow/config@1.11.2
  - @scow/lib-web@1.5.7
  - @scow/lib-hook@1.0.32
  - @scow/lib-server@1.4.7
  - @scow/protos@1.0.32
  - @scow/lib-scheduler-adapter@1.1.30

## 0.3.6

### Patch Changes

- Updated dependencies [6752734]
- Updated dependencies [f0f144d]
- Updated dependencies [4f98a31]
- Updated dependencies [b326570]
- Updated dependencies [6752734]
- Updated dependencies [d556202]
  - @scow/config@1.11.1
  - @scow/lib-scheduler-adapter@1.1.29
  - @scow/lib-server@1.4.6
  - @scow/lib-web@1.5.6
  - @scow/protos@1.0.31
  - @scow/lib-hook@1.0.31

## 0.3.5

### Patch Changes

- Updated dependencies [477db31]
- Updated dependencies [b645b74]
- Updated dependencies [bf8afc6]
- Updated dependencies [bf8afc6]
- Updated dependencies [b645b74]
  - @scow/config@1.11.0
  - @scow/protos@1.0.30
  - @scow/lib-web@1.5.5
  - @scow/lib-hook@1.0.30
  - @scow/lib-server@1.4.5
  - @scow/lib-scheduler-adapter@1.1.28

## 0.3.4

### Patch Changes

- cc28b1b: 修复当系统正在运行同步任务时退出后，再次启动系统后无法执行账户用户相关操作的问题;
  在 AccountUserSyncRecord 实体中增加 sync_status 索引
- Updated dependencies [6aba3ed]
- Updated dependencies [50f3902]
- Updated dependencies [29f7e38]
- Updated dependencies [50f3902]
- Updated dependencies [f0ecf70]
- Updated dependencies [cc28b1b]
- Updated dependencies [d4da4f5]
  - @scow/lib-web@1.5.4
  - @scow/lib-config@1.0.6
  - @scow/config@1.10.0
  - @scow/protos@1.0.29
  - @scow/lib-scheduler-adapter@1.1.27
  - @scow/lib-server@1.4.4
  - @scow/lib-hook@1.0.29

## 0.3.3

### Patch Changes

- 45117e6: 在 AI,HPC 提交作业和交互式应用时增加用户账户，账户集群分区的鉴权
- ca3371e: 修复导入用户时新建账户默认授权集群和分区没有写入，
  修改导入用户时需要写入禁用授权应用的账户对象列表为全新未创建过的账户
- Updated dependencies [a5f0e1d]
- Updated dependencies [6f5c6ec]
- Updated dependencies [2ea2e6a]
- Updated dependencies [326e3e8]
- Updated dependencies [58e7347]
- Updated dependencies [45117e6]
- Updated dependencies [60709f3]
- Updated dependencies [58e7347]
- Updated dependencies [3ed0aa1]
- Updated dependencies [6f5c6ec]
- Updated dependencies [9edf6f9]
- Updated dependencies [60709f3]
- Updated dependencies [e92c889]
- Updated dependencies [3ed0aa1]
- Updated dependencies [3ede0e1]
  - @scow/config@1.9.0
  - @scow/lib-config@1.0.5
  - @scow/lib-web@1.5.3
  - @scow/scow-resource-protos@0.3.0
  - @scow/protos@1.0.28
  - @scow/lib-server@1.4.3
  - @scow/lib-hook@1.0.28
  - @scow/lib-scheduler-adapter@1.1.26

## 0.3.2

### Patch Changes

- c5530fb: 添加/移出默认授权集群或分区时同步更新租户下的所有账户的授权数据
  在与分区相关的接口中增加了在线集群下分区的鉴权逻辑，补充了部分接口中对在线集群的鉴权
- ca07c2c: 某一授权的集群分区信息获取失败时其他已授权集群分区正常返回
- Updated dependencies [579f164]
  - @scow/config@1.8.2
  - @scow/lib-hook@1.0.27
  - @scow/lib-server@1.4.2
  - @scow/lib-web@1.5.2
  - @scow/protos@1.0.27
  - @scow/lib-scheduler-adapter@1.1.25

## 0.3.1

### Patch Changes

- 05e24b2: 仪表盘、表单 UI 优化、更换字体、table 表格操作项更换为 icon
- Updated dependencies [3545301]
- Updated dependencies [05e24b2]
- Updated dependencies [2dd5f4c]
- Updated dependencies [562d068]
- Updated dependencies [562d068]
- Updated dependencies [e6cf7d0]
- Updated dependencies [44af4cf]
- Updated dependencies [3b724ac]
  - @scow/lib-web@1.5.1
  - @scow/lib-server@1.4.1
  - @scow/config@1.8.1
  - @scow/lib-config@1.0.4
  - @scow/lib-hook@1.0.26
  - @scow/protos@1.0.26
  - @scow/lib-scheduler-adapter@1.1.24

## 0.3.0

### Minor Changes

- 778e6c7: 在管理系统增加对租户/账户授权交互式应用功能，在审计系统内增加授权/取消授权的日志
  并在 HPC 系统和 AI 系统实现仅展示可用应用

### Patch Changes

- d92dbf4: 资源管理各集群分区页面按照集群优先级排序
- 1874b38: 更新 next 14.2.4 至 14.2.30
- 0d36f92: 解封没有授权分区/队列的账户时删除调用 blockAccount 接口逻辑
  增加 AI 授权队列功能，在 AI 仪表盘、作业等页面增加获取授权队列逻辑
- a4d7ac3: 原有同步账户封锁状态功能升级为同步账户/用户信息功能
- ac237b1: 1.调整 logo 位置 2.系统跳转下拉框 3.拓展菜单图标样式不随菜单颜色变化 4.英文遮挡 bug
- 54e95db: hpc、mis、ai 顶部侧边导航栏 UI 交互调整
  footer 调整只在 dashboard 展示
- Updated dependencies [778e6c7]
- Updated dependencies [5da1b58]
- Updated dependencies [1874b38]
- Updated dependencies [38ddbb9]
- Updated dependencies [3c7eaf6]
- Updated dependencies [b961d74]
- Updated dependencies [b961d74]
- Updated dependencies [5da1b58]
- Updated dependencies [ac237b1]
- Updated dependencies [778e6c7]
- Updated dependencies [54e95db]
- Updated dependencies [a4d7ac3]
  - @scow/config@1.8.0
  - @scow/lib-server@1.4.0
  - @scow/lib-web@1.5.0
  - @scow/lib-scheduler-adapter@1.1.23
  - @scow/lib-hook@1.0.25
  - @scow/protos@1.0.25

## 0.2.11

### Patch Changes

- Updated dependencies [238a828]
- Updated dependencies [80d22df]
  - @scow/config@1.7.2
  - @scow/lib-config@1.0.3
  - @scow/lib-hook@1.0.24
  - @scow/lib-server@1.3.14
  - @scow/lib-web@1.4.14

## 0.2.10

### Patch Changes

- 1fecca7: 在资源管理相关页面下不展示已删除的账户，在授权/取消授权逻辑中不处理已删除的账户
- Updated dependencies [10b1fa2]
- Updated dependencies [88fb722]
- Updated dependencies [59fb3b4]
- Updated dependencies [0904fad]
- Updated dependencies [7482019]
  - @scow/config@1.7.1
  - @scow/lib-web@1.4.13
  - @scow/protos@1.0.24
  - @scow/lib-hook@1.0.24
  - @scow/lib-server@1.3.13
  - @scow/lib-scheduler-adapter@1.1.22

## 0.2.9

### Patch Changes

- Updated dependencies [d029383]
  - @scow/lib-web@1.4.12

## 0.2.8

### Patch Changes

- de86c6e: 新增 HPC 交互式应用中对保留配置项的自定义配置功能，同时新增 HTML 表单的文件路径配置功能
  在 HPC 中新增加强版文件选择组件，包括文件解压缩功能
  修复 AI 中文件解压缩的错误提示及路径刷新等问题
- 28acbf5: 修复部分基于 Promise.allSettled 的报错处理或日志不全等问题
- Updated dependencies [80bee99]
- Updated dependencies [de86c6e]
- Updated dependencies [40b9478]
- Updated dependencies [67c32a5]
  - @scow/config@1.7.0
  - @scow/protos@1.0.23
  - @scow/lib-hook@1.0.23
  - @scow/lib-server@1.3.12
  - @scow/lib-web@1.4.11
  - @scow/lib-scheduler-adapter@1.1.21

## 0.2.7

### Patch Changes

- 353e732: 修复修改了 basePath 后没法连接 resource 的问题和补充了 notification 和 resource 的文档
- Updated dependencies [9cd4758]
- Updated dependencies [d3c4b57]
  - @scow/lib-config@1.0.2
  - @scow/lib-web@1.4.10
  - @scow/config@1.6.4
  - @scow/protos@1.0.22
  - @scow/lib-hook@1.0.22
  - @scow/lib-server@1.3.11
  - @scow/lib-scheduler-adapter@1.1.20

## 0.2.6

### Patch Changes

- d0b5adb: 删除资源管理与 mis-server 后端相互调用时的冗余认证逻辑
- bfad31b: 为资源管理系统、通知系统、管理系统、门户系统服务与服务之间的调用增加 token 校验,
  ** 注意，此 commit 之后，如配置资源管理系统或者通知系统，则需要配置 SCOW API Token **
- Updated dependencies [bfad31b]
- Updated dependencies [afaec8b]
  - @scow/lib-server@1.3.10
  - @scow/config@1.6.3
  - @scow/lib-web@1.4.9
  - @scow/protos@1.0.21
  - @scow/lib-hook@1.0.21
  - @scow/lib-scheduler-adapter@1.1.19

## 0.2.5

### Patch Changes

- 770a527: 修正 portal、mis、resource 的国际化顺序
- 355a523: 修复将账户添加到白名单时没有获取到已授权分区以及解封账户时没有对未授权分区再次封锁的问题
  - @scow/protos@1.0.20
  - @scow/lib-hook@1.0.20
  - @scow/lib-scheduler-adapter@1.1.18
  - @scow/lib-server@1.3.9
  - @scow/lib-web@1.4.8

## 0.2.4

### Patch Changes

- ca98dac: 在 SCOW 的 light mode 和 dark mode 下，可以选择两种不同的主题色
- Updated dependencies [1adb22b]
- Updated dependencies [249d35d]
- Updated dependencies [c641401]
- Updated dependencies [ca98dac]
  - @scow/lib-web@1.4.7
  - @scow/config@1.6.2
  - @scow/protos@1.0.19
  - @scow/lib-hook@1.0.19
  - @scow/lib-server@1.3.8
  - @scow/lib-scheduler-adapter@1.1.17

## 0.2.3

### Patch Changes

- 035ff28: 修复授权分区模态框中出现不同集群相同分区名时搜索集群分区展示错误问题
- 597955e: 增加授权账户集群与取消授权账户集群的 Hook
- 4b7b331: 修复正常账户在授权 AI 集群后没有在 AI 集群下解封的问题
  - @scow/protos@1.0.18
  - @scow/lib-hook@1.0.18
  - @scow/lib-scheduler-adapter@1.1.16
  - @scow/lib-server@1.3.7
  - @scow/lib-web@1.4.6

## 0.2.2

### Patch Changes

- 1a531ed: 已部署管理系统与资源管理系统的情况下，可以对 AI 集群的集群信息进行授权
- 56e0152: 更新 @grpc/grpc-js 到 1.12.2
- 56e0152: scow 和 适配器交互添加双向 tls 校验
- Updated dependencies [aeac587]
- Updated dependencies [1a531ed]
- Updated dependencies [56e0152]
- Updated dependencies [56e0152]
  - @scow/config@1.6.1
  - @scow/scow-resource-protos@0.2.1
  - @scow/lib-scheduler-adapter@1.1.15
  - @scow/protos@1.0.17
  - @scow/lib-server@1.3.6
  - @scow/lib-web@1.4.5

## 0.2.1

### Patch Changes

- 74789b4: 修复资源系统配置项中关闭启动时的状态同步没有生效的问题
- 6a16c51: 修复排序后模态框数据没有锁定到上一次打开的数据信息的问题，优化集群连接失败时的授权分区模态框内的提示
- Updated dependencies [bec8a37]
- Updated dependencies [9880cd0]
- Updated dependencies [a7e7585]
- Updated dependencies [6c6f8c6]
- Updated dependencies [701ebc7]
- Updated dependencies [aa94edc]
  - @scow/config@1.6.0
  - @scow/lib-server@1.3.5
  - @scow/lib-web@1.4.4
  - @scow/protos@1.0.16
  - @scow/lib-scheduler-adapter@1.1.14

## 0.2.0

### Minor Changes

- 9895952: 新增资源管理系统，增加对租户/账户的集群，分区授权和取消授权的功能

### Patch Changes

- a16b1e1: 修复对特定分区操作的适配器接口报错信息处理，修复授权集群分区详情中集群名的展示
- 337a9c6: 修复按用户角色展示租户管理和平台管理下的资源授权页面的问题
- Updated dependencies [a16b1e1]
- Updated dependencies [721b227]
- Updated dependencies [9895952]
- Updated dependencies [0f02d9d]
- Updated dependencies [5746037]
  - @scow/lib-server@1.3.4
  - @scow/config@1.5.3
  - @scow/lib-web@1.4.3
  - @scow/scow-resource-protos@0.2.0
  - @scow/protos@1.0.15
  - @scow/lib-scheduler-adapter@1.1.13
