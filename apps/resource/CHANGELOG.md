# @scow/resource

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
