# @scow/portal-server

## 1.11.0

### Minor Changes

- 148099e: 重构 hpc 提交作业

### Patch Changes

- 2d3dcf6: 删除 dead code 并提取 AI 作业表单公共模块
- 5160f9e: 修复创建交互式应用时内存需求计算错误并重新设计创建交互式应用接口数据类型
- 434cdf3: 实现 scowd 多登录节点负载均衡与请求亲和性路由
- Updated dependencies [f8fe60d]
- Updated dependencies [c981960]
- Updated dependencies [148099e]
- Updated dependencies [3d18a5c]
- Updated dependencies [e578c89]
- Updated dependencies [c981960]
- Updated dependencies [00aa2eb]
- Updated dependencies [434cdf3]
  - @scow/config@1.14.0
  - @scow/scowd-protos@0.5.0
  - @scow/lib-server@1.5.0
  - @scow/scheduler-adapter-protos@1.5.5
  - @scow/lib-scow-resource@0.2.23
  - @scow/lib-scowd@1.2.7
  - @scow/protos@1.0.39
  - @scow/lib-scheduler-adapter@1.1.37
  - @scow/rich-error-model@2.0.3

## 1.10.2

### Patch Changes

- Updated dependencies [ffc4632]
  - @scow/config@1.13.2
  - @scow/protos@1.0.38
  - @scow/lib-scow-resource@0.2.22
  - @scow/lib-server@1.4.13
  - @scow/rich-error-model@2.0.3
  - @scow/lib-scheduler-adapter@1.1.36

## 1.10.1

### Patch Changes

- cf47ef2: 修复所有使用 grpc 项目的内存泄露问题
- a91add6: 交互式应用表单项新增支持配置动态下拉框
- 344b2da: ai 进入容器从调用 k8sAPI 切换为调用适配器和集群删除 k8s 配置
- Updated dependencies [cf47ef2]
- Updated dependencies [344b2da]
- Updated dependencies [a91add6]
- Updated dependencies [344b2da]
  - @scow/rich-error-model@2.0.3
  - @scow/lib-scow-resource@0.2.21
  - @scow/lib-server@1.4.12
  - @scow/config@1.13.1
  - @scow/scowd-protos@0.4.1
  - @scow/utils@1.1.3
  - @scow/scheduler-adapter-protos@1.5.4
  - @scow/protos@1.0.37
  - @scow/lib-scowd@1.2.6
  - @scow/lib-scheduler-adapter@1.1.35

## 1.10.0

### Patch Changes

- 79278d5: connectToApp 接口新增 jobId 参数
- ca83d79: 登录节点桌面优化数据展示和错误提示
- 597ac23: 刷新交互时应用密码优先通过适配器获取
- d871708: 读取当前集群的、或者旧版本的不包含集群信息的相同 ID 的作业信息
- 79278d5: scow 接入 scowd 版跨集群文件传输
- 07267b1: 恢复 HPC 压缩下载功能和原本的下载逻辑
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
- Updated dependencies [ca83d79]
- Updated dependencies [79278d5]
- Updated dependencies [1154951]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
- Updated dependencies [597ac23]
- Updated dependencies [79278d5]
- Updated dependencies [8f30ca0]
- Updated dependencies [c658998]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
  - @scow/scowd-protos@0.4.0
  - @scow/config@1.13.0
  - @scow/lib-scheduler-adapter@1.1.34
  - @scow/protos@1.0.36
  - @scow/scheduler-adapter-protos@1.5.3
  - @scow/lib-config@1.0.8
  - @scow/lib-scowd@1.2.5
  - @scow/lib-scow-resource@0.2.20
  - @scow/lib-server@1.4.11
  - @scow/rich-error-model@2.0.2

## 1.9.11

### Patch Changes

- a5eedd1: portal、ai 仪表盘集群接口合并重构，新增 getAllSummaryClustersInfo 集群数据汇总接口
- 963a2b8: 使用统一的适配器接口
- 72601c2: 修复门户与量子作业相关 state 属性报错，以及量子 jupyter 回跳路径错误
- 36880eb: 新增多个系统语言
- Updated dependencies [a5eedd1]
- Updated dependencies [963a2b8]
- Updated dependencies [0cb903e]
- Updated dependencies [0cb903e]
- Updated dependencies [36880eb]
  - @scow/protos@1.0.35
  - @scow/scheduler-adapter-protos@1.5.2
  - @scow/config@1.12.1
  - @scow/lib-server@1.4.10
  - @scow/utils@1.1.2
  - @scow/rich-error-model@2.0.2
  - @scow/lib-scheduler-adapter@1.1.33
  - @scow/lib-scow-resource@0.2.19

## 1.9.10

### Patch Changes

- a77aa71: 修复 shadowdesk 应用启动后还未生成 shadowdesk_session.json 文件期间交互式应用列表报错
- 3a16099: 升级 next 和相关依赖版本
- Updated dependencies [3a16099]
  - @scow/lib-scow-resource@0.2.18
  - @scow/scowd-protos@0.3.4
  - @scow/lib-server@1.4.9
  - @scow/lib-scowd@1.2.4
  - @scow/protos@1.0.34
  - @scow/rich-error-model@2.0.2
  - @scow/lib-scheduler-adapter@1.1.32

## 1.9.9

### Patch Changes

- 4bd522e: connectToApp 接口新增 jobId 参数
- 64fb141: scow 接入 scowd 版跨集群文件传输
- Updated dependencies [4bd522e]
- Updated dependencies [5b29d63]
- Updated dependencies [acd7215]
- Updated dependencies [7b07e05]
- Updated dependencies [e5ff94c]
- Updated dependencies [ce6fc46]
- Updated dependencies [ce6fc46]
- Updated dependencies [64fb141]
  - @scow/scowd-protos@0.3.3
  - @scow/config@1.12.0
  - @scow/lib-scheduler-adapter@1.1.31
  - @scow/lib-config@1.0.7
  - @scow/lib-scowd@1.2.3
  - @scow/protos@1.0.33
  - @scow/lib-scow-resource@0.2.17
  - @scow/lib-server@1.4.8
  - @scow/rich-error-model@2.0.2

## 1.9.8

### Patch Changes

- 3195c7a: HPC 如果有因为延时而不能立即返回的正在运行的应用，再次获取时在 ended_sessions.json 文件中忽略他们
- 6f77b4e: 文件管理新增软链接处理，并增加不同文件类型的 icon
- Updated dependencies [6f77b4e]
- Updated dependencies [6f77b4e]
  - @scow/config@1.11.2
  - @scow/scowd-protos@0.3.2
  - @scow/lib-scow-resource@0.2.16
  - @scow/lib-server@1.4.7
  - @scow/protos@1.0.32
  - @scow/lib-scowd@1.2.2
  - @scow/rich-error-model@2.0.2
  - @scow/lib-scheduler-adapter@1.1.30

## 1.9.8

### Patch Changes

- 3195c7a: HPC 如果有因为延时而不能立即返回的正在运行的应用，再次获取时在 ended_sessions.json 文件中忽略他们
- 6f77b4e: 文件管理新增软链接处理，并增加不同文件类型的 icon
- Updated dependencies [6f77b4e]
- Updated dependencies [6f77b4e]
  - @scow/config@1.11.2
  - @scow/scowd-protos@0.3.2
  - @scow/lib-scow-resource@0.2.16
  - @scow/lib-server@1.4.7
  - @scow/protos@1.0.32
  - @scow/lib-scowd@1.2.2
  - @scow/rich-error-model@2.0.2
  - @scow/lib-scheduler-adapter@1.1.30

## 1.9.7

## 1.9.6

### Patch Changes

- 9272a0a: 修复 portal-server 遍历 appData 下的 sessions 时，没有跳过文件，引发日志中的错误
- 4f98a31: 作业列表字段调整以及导出功能优化
- 6752734: 顶部导航栏只保留一级菜单，HPC 整合 shell 页和桌面页为登录集群页
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
  - @scow/lib-scow-resource@0.2.15
  - @scow/rich-error-model@2.0.2

## 1.9.5

### Patch Changes

- Updated dependencies [477db31]
- Updated dependencies [b645b74]
- Updated dependencies [bf8afc6]
- Updated dependencies [b645b74]
  - @scow/config@1.11.0
  - @scow/protos@1.0.30
  - @scow/lib-scow-resource@0.2.14
  - @scow/lib-server@1.4.5
  - @scow/rich-error-model@2.0.2
  - @scow/lib-scheduler-adapter@1.1.28

## 1.9.4

### Patch Changes

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
  - @scow/lib-scow-resource@0.2.13
  - @scow/rich-error-model@2.0.2

## 1.9.3

### Patch Changes

- 45117e6: 在 AI,HPC 提交作业和交互式应用时增加用户账户，账户集群分区的鉴权
- 1429cb8: hpc 的 ssh 提交应用的工作路径改为绝对路径
- 58e7347: 在登录节点桌面上增加 shadowdesk 远程控制工具
- b9ebb97: 解决文件管理页面进入 shell 功能无法进入到对应目录的问题
- Updated dependencies [a5f0e1d]
- Updated dependencies [45117e6]
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
  - @scow/lib-scow-resource@0.2.12
  - @scow/lib-config@1.0.5
  - @scow/protos@1.0.28
  - @scow/lib-server@1.4.3
  - @scow/rich-error-model@2.0.2
  - @scow/lib-scheduler-adapter@1.1.26

## 1.9.2

### Patch Changes

- 3c03a17: 无论是否有权限都展示快捷入口中已添加的交互式应用图标
- Updated dependencies [579f164]
  - @scow/config@1.8.2
  - @scow/lib-scow-resource@0.2.11
  - @scow/lib-server@1.4.2
  - @scow/protos@1.0.27
  - @scow/rich-error-model@2.0.2
  - @scow/lib-scheduler-adapter@1.1.25

## 1.9.1

### Patch Changes

- 54c35c1: HPC 提交作业时采用 getAvailablePartitions 单一逻辑接口
- 25d6396: 删除高性能计算与人工智能系统中交互式应用 10s 自动刷新 UI,
  添加 ended_sessions.json 文件，存储已结束的交互式应用 session 信息，优化后台查询性能
- 308256e: 修复获取交互式应用列表时，当 appDir 中有文件时会无法加载数据的问题
- Updated dependencies [562d068]
- Updated dependencies [562d068]
- Updated dependencies [25d6396]
- Updated dependencies [e6cf7d0]
- Updated dependencies [44af4cf]
  - @scow/lib-server@1.4.1
  - @scow/config@1.8.1
  - @scow/scowd-protos@0.3.1
  - @scow/lib-config@1.0.4
  - @scow/lib-scow-resource@0.2.10
  - @scow/lib-scowd@1.2.1
  - @scow/protos@1.0.26
  - @scow/rich-error-model@2.0.2
  - @scow/lib-scheduler-adapter@1.1.24

## 1.9.0

### Minor Changes

- 778e6c7: 在管理系统增加对租户/账户授权交互式应用功能，在审计系统内增加授权/取消授权的日志
  并在 HPC 系统和 AI 系统实现仅展示可用应用

### Patch Changes

- eb1f439: 修复内存泄漏问题
- d511518: 上一次交互式应用记录获取失败时直接按默认参数打开创建应用页面
- 1874b38: 更新 @ddadaal/tsgrpc-server 0.19.6 至 0.19.7
- b961d74: 增加节点迁移页面与功能
- 0f7e1d3: 修改 HPC 文件管理下已复制项展示位置, 增加 HPC 和 AI 下的文件夹复制移动的路径校验
- Updated dependencies [778e6c7]
- Updated dependencies [5da1b58]
- Updated dependencies [eb1f439]
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
  - @scow/scowd-protos@0.3.0
  - @scow/lib-server@1.4.0
  - @scow/lib-scowd@1.2.0
  - @scow/rich-error-model@2.0.2
  - @scow/lib-scow-resource@0.2.9
  - @scow/lib-scheduler-adapter@1.1.23
  - @scow/scheduler-adapter-protos@1.5.0
  - @scow/protos@1.0.25

## 1.8.5

### Patch Changes

- 79ce4a8: 创建目录和文件夹前先检查存在性
- 083d57b: 修改了调用 scowd 的 chmod
- 35e30e7: 修复门户流式接口未能正确中断导致的内存泄漏问题
- Updated dependencies [238a828]
- Updated dependencies [80d22df]
- Updated dependencies [083d57b]
  - @scow/config@1.7.2
  - @scow/lib-config@1.0.3
  - @scow/scowd-protos@0.2.7
  - @scow/lib-scow-resource@0.2.8
  - @scow/lib-server@1.3.14
  - @scow/lib-scowd@1.1.8

## 1.8.4

### Patch Changes

- 1363e71: 实现 SCOWD 的文件解压缩，并在 SCOWD 开启时文件管理下增加解压缩功能
- 59fb3b4: 交互式应用调用 shadoedesk 接口更改为动态可配置，支持配置多个 shadowdesk
- f9c0e7b: 将 sumbitJob 和 submitJobAsFile 接口中 ssh 相关替换为 scowd
- Updated dependencies [10b1fa2]
- Updated dependencies [1363e71]
- Updated dependencies [59fb3b4]
- Updated dependencies [0904fad]
- Updated dependencies [f9c0e7b]
- Updated dependencies [7482019]
  - @scow/config@1.7.1
  - @scow/scowd-protos@0.2.6
  - @scow/protos@1.0.24
  - @scow/lib-scow-resource@0.2.7
  - @scow/lib-server@1.3.13
  - @scow/lib-scowd@1.1.7
  - @scow/rich-error-model@2.0.1
  - @scow/lib-scheduler-adapter@1.1.22

## 1.8.3

### Patch Changes

- 76677e9: 修复 shell 只进入第一个登录节点的问题

## 1.8.2

### Patch Changes

- de86c6e: 新增 HPC 交互式应用中对保留配置项的自定义配置功能，同时新增 HTML 表单的文件路径配置功能
  在 HPC 中新增加强版文件选择组件，包括文件解压缩功能
  修复 AI 中文件解压缩的错误提示及路径刷新等问题
- 3669a48: 在交互式应用系统保留配置中扩展增加下拉框选项配置
- 6be7582: scowd 替换除跨集群文件传输外的 ssh 所有相关逻辑
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
  - @scow/scowd-protos@0.2.5
  - @scow/lib-scowd@1.1.6
  - @scow/lib-server@1.3.12
  - @scow/rich-error-model@2.0.1
  - @scow/lib-scheduler-adapter@1.1.21

## 1.8.1

### Patch Changes

- 71c83bb: 修复 portal 中应用无需密码但是也得生成，不然会报错
- 3a27437: 将 initShellFile 逻辑转移至 scowd
- 916aebc: HPC 文件管理新增文件夹上传，在线压缩和压缩下载功能
- Updated dependencies [9cd4758]
- Updated dependencies [d3c4b57]
- Updated dependencies [916aebc]
  - @scow/lib-config@1.0.2
  - @scow/scowd-protos@0.2.4
  - @scow/config@1.6.4
  - @scow/protos@1.0.22
  - @scow/lib-scowd@1.1.5
  - @scow/lib-scow-resource@0.2.5
  - @scow/lib-server@1.3.11
  - @scow/rich-error-model@2.0.1
  - @scow/lib-scheduler-adapter@1.1.20

## 1.8.0

### Patch Changes

- 31a83ad: scowd 交互式应用连接不去代理网关节点获取 IP
- Updated dependencies [bfad31b]
- Updated dependencies [afaec8b]
  - @scow/lib-scow-resource@0.2.4
  - @scow/lib-server@1.3.10
  - @scow/config@1.6.3
  - @scow/protos@1.0.21
  - @scow/rich-error-model@2.0.1
  - @scow/lib-scheduler-adapter@1.1.19

## 1.7.5

### Patch Changes

- @scow/protos@1.0.20
- @scow/rich-error-model@2.0.1
- @scow/lib-scheduler-adapter@1.1.18
- @scow/lib-server@1.3.9

## 1.7.4

### Patch Changes

- Updated dependencies [0a670dc]
- Updated dependencies [c641401]
- Updated dependencies [ca98dac]
  - @scow/lib-ssh@1.0.4
  - @scow/config@1.6.2
  - @scow/protos@1.0.19
  - @scow/lib-scow-resource@0.2.3
  - @scow/lib-server@1.3.8
  - @scow/rich-error-model@2.0.1
  - @scow/lib-scheduler-adapter@1.1.17

## 1.7.3

### Patch Changes

- bb0b697: 交互式应用全面接入 scowd
- Updated dependencies [bb0b697]
  - @scow/scowd-protos@0.2.3
  - @scow/protos@1.0.18
  - @scow/lib-scowd@1.1.4
  - @scow/rich-error-model@2.0.1
  - @scow/lib-scheduler-adapter@1.1.16
  - @scow/lib-server@1.3.7

## 1.7.2

### Patch Changes

- 87ff0e7: 修改 HPC 和 AI 的作业和应用的默认工作目录命名规则
- 56e0152: 更新 @grpc/grpc-js 到 1.12.2
- f75af4b: hpc 应用作业列表和 AI 的作业列表修改作业名获取方式
- 56e0152: scow 和 适配器交互添加双向 tls 校验
- Updated dependencies [aeac587]
- Updated dependencies [1a531ed]
- Updated dependencies [56e0152]
- Updated dependencies [56e0152]
  - @scow/config@1.6.1
  - @scow/scheduler-adapter-protos@1.4.1
  - @scow/lib-scheduler-adapter@1.1.15
  - @scow/rich-error-model@2.0.1
  - @scow/lib-scow-resource@0.2.2
  - @scow/protos@1.0.17
  - @scow/lib-server@1.3.6
  - @scow/lib-scowd@1.1.3

## 1.7.1

### Patch Changes

- 667a123: 增加获取交互式应用和作业模版 JSON.parse 错误的处理
- 9880cd0: 去掉 HPC 和 AI 的提交应用和训练的检查重名
- a38ef7f: 修改 getClusterNodesInfo 为门户和管理系统共用 grpc api，修改集群管理页面的节点信息计数方式
- 6e4241b: 新增 scowd 下载文件时的背压处理
- 873fa96: 在检查 web 应用和 vnc 应用检查连接时，忽略代理网关的配置，通过模拟到端口的 http 请求检查端口是否开放
- 701ebc7: 增加塔影交互式应用配置和链接流程
- Updated dependencies [bec8a37]
- Updated dependencies [9880cd0]
- Updated dependencies [a7e7585]
- Updated dependencies [6c6f8c6]
- Updated dependencies [6c6f8c6]
- Updated dependencies [701ebc7]
- Updated dependencies [aa94edc]
  - @scow/config@1.6.0
  - @scow/lib-server@1.3.5
  - @scow/scheduler-adapter-protos@1.4.0
  - @scow/lib-scow-resource@0.2.1
  - @scow/protos@1.0.16
  - @scow/lib-scheduler-adapter@1.1.14
  - @scow/rich-error-model@2.0.0

## 1.7.0

### Minor Changes

- 9895952: 新增资源管理系统，增加对租户/账户的集群，分区授权和取消授权的功能

### Patch Changes

- Updated dependencies [a16b1e1]
- Updated dependencies [721b227]
- Updated dependencies [9895952]
  - @scow/lib-server@1.3.4
  - @scow/scowd-protos@0.2.2
  - @scow/config@1.5.3
  - @scow/lib-scow-resource@0.2.0
  - @scow/lib-scowd@1.1.2
  - @scow/protos@1.0.15
  - @scow/rich-error-model@2.0.0
  - @scow/lib-scheduler-adapter@1.1.13

## 1.6.4

### Patch Changes

- d32b7f6: 修复 shell 退出时 ssh 连接未正常关闭的问题
- Updated dependencies [d32b7f6]
  - @scow/lib-server@1.3.3
  - @scow/lib-ssh@1.0.3

## 1.6.3

### Patch Changes

- ac6805d: scowd 新增 app service 和 GetAppLastSubmission 接口
- e776999: ai 和 hpc 在提交作业和应用前检查一下是否重名
- abd69cb: 接入 scowd 文件分片上传
- Updated dependencies [ac6805d]
- Updated dependencies [abd69cb]
- Updated dependencies [83df60b]
  - @scow/scowd-protos@0.2.1
  - @scow/lib-scowd@1.1.1
  - @scow/lib-server@1.3.2
  - @scow/config@1.5.2
  - @scow/protos@1.0.14
  - @scow/rich-error-model@2.0.0
  - @scow/lib-scheduler-adapter@1.1.12

## 1.6.2

### Patch Changes

- a9e9011: 修复获取 scowdClient 时拼接地址的错误
- 4bef1b3: 增加获取 SCOW API 版本的接口
- 1a096de: 修复门户系统集群登录节点只配置地址时路由渲染失败的问题，在集群配置接口返回中加入 scowd 配置信息
- 66a96ba: 修复了门户系统中节点在不同集群中重复计数的问题
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
  - @scow/lib-scheduler-adapter@1.1.11
  - @scow/protos@1.0.13
  - @scow/rich-error-model@2.0.0

## 1.6.1

## 1.6.0

### Minor Changes

- 806f778: 增加 HPC 文件和桌面功能的 scowd 支持
- b8d1270: 在管理系统和门户系统中增加依赖于管理系统的集群停用功能
  **注意：停用后集群将不可用，集群所有数据不再更新。再启用后请手动同步平台数据！**

### Patch Changes

- 0a43348: 修改门户系统下提交作业或交互式应用时可以选择的账号为用户维度未封锁账号，分区为该用户在该集群下对应账号的可用分区；修改从模板提交作业时模板值可以直接提交
- 383a8bd: 添加 web shell 文件上传功能
- 3558bd4: 提交作业保存作业模板时最长运行时间的单位也保存入模板中
- Updated dependencies [806f778]
- Updated dependencies [b8d1270]
- Updated dependencies [b8d1270]
- Updated dependencies [806f778]
  - @scow/scowd-protos@0.2.0
  - @scow/lib-scowd@1.1.0
  - @scow/config@1.5.0
  - @scow/lib-server@1.3.0
  - @scow/protos@1.0.12
  - @scow/rich-error-model@2.0.0
  - @scow/lib-scheduler-adapter@1.1.10

## 1.5.2

### Patch Changes

- a50d5ce: 修复请求集群适配器接口的报错信息中出现嵌套型信息，导致页面报错信息显示不正确的问题
- 6304074: 提交作业时，新增保留作业脚本的选项
- Updated dependencies [d080a8b]
  - @scow/config@1.4.5
  - @scow/lib-server@1.2.2
  - @scow/protos@1.0.11
  - @scow/rich-error-model@2.0.0
  - @scow/lib-scheduler-adapter@1.1.9

## 1.5.1

### Patch Changes

- Updated dependencies [94aa24c]
- Updated dependencies [e312efb]
- Updated dependencies [e312efb]
- Updated dependencies [640a599]
  - @scow/config@1.4.4
  - @scow/scheduler-adapter-protos@1.3.1
  - @scow/lib-server@1.2.1
  - @scow/protos@1.0.10
  - @scow/lib-scheduler-adapter@1.1.8
  - @scow/rich-error-model@2.0.0

## 1.5.0

### Patch Changes

- 02d6a18: 新增集群区分 AI 功能和 HPC 功能配置
- Updated dependencies [02d6a18]
- Updated dependencies [63d1873]
- Updated dependencies [d822db7]
  - @scow/config@1.4.3
  - @scow/lib-server@1.2.0
  - @scow/protos@1.0.9
  - @scow/rich-error-model@2.0.0
  - @scow/lib-scheduler-adapter@1.1.7

## 1.4.3

### Patch Changes

- 941340a: 修复目录文件过多时导致的 touch 命令报错
- 410fb0e: 修复只需在文件传输时使用 touch -a 来更新时间戳，修复 touch -a 执行时 ssh 关闭报错，文件名特殊字符报错等问题
- 48844dc: Web Shell 支持跳转到文件编辑页面
- Updated dependencies [443187e]
- Updated dependencies [3242957]
- Updated dependencies [850bbcd]
  - @scow/lib-server@1.1.5
  - @scow/config@1.4.2
  - @scow/protos@1.0.8
  - @scow/rich-error-model@2.0.0
  - @scow/lib-scheduler-adapter@1.1.6

## 1.4.2

## 1.4.1

### Patch Changes

- Updated dependencies [afc3350]
- Updated dependencies [8d417ba]
- Updated dependencies [68447f7]
  - @scow/lib-config@1.0.1
  - @scow/config@1.4.1
  - @scow/lib-server@1.1.4
  - @scow/protos@1.0.7
  - @scow/rich-error-model@2.0.0
  - @scow/lib-scheduler-adapter@1.1.5

## 1.4.0

### Minor Changes

- cb055c4: 门户仪表盘新增快捷入口，可以新增、删除、拖拽排序快捷方式
- f023d52: 管理系统新增数据统计功能，统计用户，账户，租户，作业，消费及功能使用次数

### Patch Changes

- 201a3e2: 修复部分集群无法获取集群运行信息时导致仪表板无法展示其他正常信息
- 26bd8e7: 优化文件系统直接提交脚本任务时如果没有在脚本内指定工作目录，使脚本文件所在的绝对路径作为作业工作目录，并在确认提交对话框中给出提示
- Updated dependencies [d1c2e74]
- Updated dependencies [26bd8e7]
- Updated dependencies [abb7e84]
  - @scow/config@1.4.0
  - @scow/scheduler-adapter-protos@1.3.0
  - @scow/protos@1.0.6
  - @scow/lib-server@1.1.3
  - @scow/lib-scheduler-adapter@1.1.4
  - @scow/rich-error-model@2.0.0

## 1.3.0

### Minor Changes

- ec06733f9f: 门户仪表盘删除之前的配置标题和文字，增加平台队列状态展示

### Patch Changes

- 6a0c73a972: 修复用户删除无权限目录时导致的崩溃问题
- Updated dependencies [ec06733f9f]
  - @scow/scheduler-adapter-protos@1.2.0
  - @scow/config@1.3.0
  - @scow/lib-scheduler-adapter@1.1.3
  - @scow/lib-server@1.1.2
  - @scow/protos@1.0.5
  - @scow/rich-error-model@2.0.0

## 1.2.3

### Patch Changes

- Updated dependencies [cad49a87d8]
  - @scow/config@1.2.1
  - @scow/lib-server@1.1.1
  - @scow/protos@1.0.4
  - @scow/rich-error-model@2.0.0
  - @scow/lib-scheduler-adapter@1.1.2

## 1.2.2

### Patch Changes

- 3d83f9cbdb: 在 portal-server 中使用交互式应用的 getConnectionConfig 接口，以适配容器式的作业调度器
  - @scow/protos@1.0.3
  - @scow/rich-error-model@2.0.0
  - @scow/lib-scheduler-adapter@1.1.1
  - @scow/lib-server@1.1.0

## 1.2.1

## 1.2.0

### Minor Changes

- 135f2b1be3: 在门户系统的文件管理下，新增将文件直接作为作业文本提交调度器执行的功能，如果调度器 API 版本低于此接口版本报错

### Patch Changes

- af6a53dfcf: portal-server,auth,mis-server,audit-server 下 pino 日志的时间格式修改为八时区下的 YYYY-MM-DD HH:mm:ss
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
  - @scow/rich-error-model@2.0.0

## 1.1.0

### Minor Changes

- b7f01512eb: 实现了跨集群传输模块

### Patch Changes

- 8fc4c21f07: 在{app}.yaml 中增加对交互式应用说明的配置项
- eca87eaeb6: 修复当作业相关的时间为 0 时，返回空字符串的情况
- ccbde14304: 实现 SCOW 门户系统与管理系统的页面国际化功能
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
  - @scow/protos@1.0.1
  - @scow/rich-error-model@2.0.0

## 1.0.0

### Major Changes

- 11f94f716: 发布 1.0

### Patch Changes

- 11922d134: 修复桌面功能以 root 创建文件夹导致工作目录权限错误问题
- Updated dependencies [ee89b11b9]
- Updated dependencies [ee89b11b9]
- Updated dependencies [cb1e3500d]
- Updated dependencies [11f94f716]
  - @scow/config@1.0.0
  - @scow/protos@1.0.0
  - @scow/lib-config@1.0.0
  - @scow/scheduler-adapter-protos@1.0.0
  - @scow/rich-error-model@2.0.0
  - @scow/lib-scheduler-adapter@1.0.0
  - @scow/lib-server@1.0.0
  - @scow/lib-ssh@1.0.0
  - @scow/utils@1.0.0

## 0.9.0

### Patch Changes

- 6f278a7b9: 门户系统桌面页面新增桌面信息，包括桌面名，桌面类型，创建时间。
- d0a71ff79: 删除不用的 lib-slurm 库
- 9edc86930: 解决使用 crane 提交交互式应用任务失败提示信息不完全
- da5edd22c: 在集群与分区信息页面，实现仅显示用户有使用权限的分区信息
- 8dcfc3f1a: 增加作业列表中 GPU 卡数的展示
- 59cb5a418: 作业模版增加删除、重命名功能
- Updated dependencies [67911fd92]
- Updated dependencies [b96e5c4b2]
- Updated dependencies [31dc79055]
- Updated dependencies [9f70e2121]
- Updated dependencies [6f278a7b9]
- Updated dependencies [8dcfc3f1a]
- Updated dependencies [1407743ad]
- Updated dependencies [f3dd67ecb]
  - @scow/config@0.5.0
  - @scow/lib-scheduler-adapter@0.2.1
  - @scow/protos@0.3.1
  - @scow/lib-server@0.2.0
  - @scow/rich-error-model@1.0.1

## 0.8.1

## 0.8.0

### Minor Changes

- 5b7f0e88f: 重构 scow，对接调度器适配器接口
- 5c3c63657: 实现登录节点桌面功能以及 TurboVNC 的安装路径在每个集群中单独配置

### Patch Changes

- 5c764a826: 通过代理网关节点解析主机名连接交互式应用，以及刷新 vnc 密码
- 4ad46057e: 修改交互式脚本执行 scirpt.sh 和 xstartup 问题，增加#!/bin/bash -l，增加 script.sh 可执行权限
- e78e56619: 利用 grpc rich-error-model 重构创建交互式应用错误处理，并添加错误信息展示窗口
- 99e2b08e1: 交互式应用提交作业页面，增加选择 GPU 及节点数的选项
- 62083044e: 实现各交互式应用在每个集群中单独配置，增加创建集群应用页面，增加创建时填写应用名和按应用名搜索已创建应用功能
- f4c64b51e: 修复多集群登录节点时，查看桌面信息里缺失对旧配置的兼容问题
- e97eb22fd: 集群配置登录节点新增节点展示名
- 7a9973aa0: 修改 HTTP API 定义方式，去除生成 api-routes-schemas.json 步骤
- 6853606f8: 门户系统 shell 和桌面功能允许用户选择登录节点
- Updated dependencies [5b7f0e88f]
- Updated dependencies [62083044e]
- Updated dependencies [7d47155d9]
- Updated dependencies [5c3c63657]
- Updated dependencies [e97eb22fd]
- Updated dependencies [ca6205f4e]
  - @scow/scheduler-adapter-protos@0.2.0
  - @scow/lib-scheduler-adapter@0.2.0
  - @scow/protos@0.3.0
  - @scow/config@0.4.0
  - @scow/lib-ssh@0.4.0
  - @scow/rich-error-model@1.0.1
  - @scow/lib-server@0.2.0
  - @scow/lib-slurm@0.1.6

## 0.7.0

### Patch Changes

- 0f64e5404: 获取桌面和应用列表时，不再解析节点域名到 IP
- Updated dependencies [0f64e5404]
- Updated dependencies [81895f4be]
  - @scow/config@0.3.1
  - @scow/protos@0.2.3
  - @scow/lib-server@0.2.0
  - @scow/lib-slurm@0.1.5

## 0.6.0

### Patch Changes

- d2c8e765e: 优化创建交互式应用页面：在用户家目录下的 apps/app[Id]路径下存入上一次提交记录；创建了查找上一次提交记录的 API 接口，每次创建交互式应用时查找上一次提交记录，如果有则与当前集群下配置对比选择填入相应的值。
- 8b36bf0bc: 检查交互式应用是否可连接的逻辑移动到前端
- Updated dependencies [901ecdb7e]
- Updated dependencies [d2c8e765e]
- Updated dependencies [ce077930a]
  - @scow/config@0.3.0
  - @scow/lib-config@0.2.2
  - @scow/lib-server@0.2.0
  - @scow/protos@0.2.2
  - @scow/lib-slurm@0.1.4

## 0.5.0

### Minor Changes

- 2981664f4: 门户所有作业列增加开始、结束时间列，增加时间说明
- aa4d0ff1c: 为 PENDING 等需要显示作业未运行原因的状态的 APP，显示原因
- 7bd2578c4: SCOW API 增加静态 token 认证方法
- 88899d41f: 提交任务增加默认输出文件
- 1562ebbd2: 提交作业时增加 GPU 选项

### Patch Changes

- a7fd75778: 修复文件管理界面，操作无权限文件/文件夹时页面的错误提示
- 583e9f98b: 修复交互式应用创建后初始化阶段无法连接问题
- d6e06e841: 读取配置文件时允许传入 logger 对象
- cb90eb64b: 门户支持配置代理网关节点
- Updated dependencies [5c066e4a5]
- Updated dependencies [7bd2578c4]
- Updated dependencies [ef8b7eee0]
- Updated dependencies [9cb6822e6]
- Updated dependencies [74d718ba1]
- Updated dependencies [1562ebbd2]
- Updated dependencies [d6e06e841]
- Updated dependencies [cb90eb64b]
  - @scow/lib-ssh@0.3.0
  - @scow/config@0.2.0
  - @scow/lib-server@0.2.0
  - @scow/lib-config@0.2.1
  - @scow/protos@0.2.1
  - @scow/lib-slurm@0.1.3

## 0.4.0

### Minor Changes

- 86e0f5b2d: 整个系统打包为一个镜像
- 882a247a1: 重构 app 的 sbatch options，gRPC 中与 custom_attributes 一起发送
- d4b0cde25: 创建 web 类交互式应用时由前端传入 base path，将节点名解析为 IP 地址的工作由 portal-server 完成

### Patch Changes

- bdc990a0c: 系统启动时，各个容器在日志中打印版本信息
- 613c26e91: 修复当一个 slurm 用户对同一个账户在不同分区中有不同配置时，列出所有账户时账户列表重复的问题
- 419184a93: 统一处理多个 sftp 操作命令报错
- 5a0698707: portal-server 启动时在/etc/profile.d 配置 shell 打开文件所需功能
- 187244443: apps/portal-server/src/clusterops/api/app.ts 中 CreateAppRequest 中去除 sbatchOptions
- 1c8a948d8: 把代码中 SavedJobs 字样全部改为 JobTemplate
- Updated dependencies [bdc990a0c]
- Updated dependencies [86e0f5b2d]
- Updated dependencies [419184a93]
- Updated dependencies [8145061ba]
  - @scow/utils@0.1.2
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
- 686054ac3: 增加 ListAvailableWms API
- 5cd477d37: 门户系统修改 getAppAttributes API 为 getAppMetadata，从 portal-server 获取应用名称

### Patch Changes

- 6814c3427: 交互式应用的自定义表单可以配置提示信息等
- Updated dependencies [6814c3427]
- Updated dependencies [c24e21662]
  - @scow/config@0.1.1
  - @scow/lib-config@0.1.1

## 0.1.2

## 0.1.1
