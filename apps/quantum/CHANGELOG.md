# @scow/quantum

## 0.1.20

### Patch Changes

- 237cd6c: 在门户系统、AI 和量子系统的用户下拉菜单中增加操作日志入口，并在新标签页打开管理系统的操作日志页面。
- afdf408: 移除 SSH 分支并统一收敛为 scowd;cli 的 asset 中增加 scowd 的配置；
- d91cd50: 平台管理中增加未结束作业和所有作业菜单
- Updated dependencies [afdf408]
- Updated dependencies [237cd6c]
- Updated dependencies [c2f0c1c]
- Updated dependencies [85284dd]
- Updated dependencies [315b116]
- Updated dependencies [f58e4a4]
- Updated dependencies [85284dd]
- Updated dependencies [a43b5e4]
  - @scow/config@1.16.2
  - @scow/lib-web@1.6.5
  - @scow/utils@1.1.5
  - @scow/lib-server@1.5.5
  - @scow/lib-scheduler-adapter@1.1.42
  - @scow/lib-operation-log@2.2.19
  - @scow/lib-scow-resource@0.2.27
  - @scow/protos@1.1.4
  - @scow/rich-error-model@2.0.4

## 0.1.19

### Patch Changes

- @scow/lib-scowd@1.2.10

## 0.1.18

### Patch Changes

- ba403a6: 首次进入系统切换多语言，语言 select 值未改变修复
- 6bad926: 量子系统检查 portal 下 jupyter 应用是否可连接逻辑重构
- Updated dependencies [23a94d3]
- Updated dependencies [fb6ab4b]
- Updated dependencies [3567ac0]
- Updated dependencies [837808c]
- Updated dependencies [a46cdc1]
- Updated dependencies [c273ead]
  - @scow/lib-server@1.5.4
  - @scow/lib-web@1.6.4
  - @scow/config@1.16.1
  - @scow/scheduler-adapter-protos@1.6.2
  - @scow/protos@1.1.3
  - @scow/lib-operation-log@2.2.18
  - @scow/lib-scow-resource@0.2.26
  - @scow/lib-scheduler-adapter@1.1.41
  - @scow/rich-error-model@2.0.4

## 0.1.17

### Patch Changes

- Updated dependencies [013d085]
- Updated dependencies [94ee545]
- Updated dependencies [68309f0]
- Updated dependencies [bfe6ffc]
- Updated dependencies [013d085]
- Updated dependencies [68309f0]
- Updated dependencies [e0f253b]
- Updated dependencies [c40d387]
- Updated dependencies [9713fca]
- Updated dependencies [1db2326]
- Updated dependencies [59348c8]
- Updated dependencies [59348c8]
- Updated dependencies [68309f0]
- Updated dependencies [68309f0]
- Updated dependencies [c23e1ac]
- Updated dependencies [0a1a819]
  - @scow/scheduler-adapter-protos@1.6.1
  - @scow/lib-web@1.6.3
  - @scow/lib-server@1.5.3
  - @scow/lib-scheduler-adapter@1.1.40
  - @scow/protos@1.1.2
  - @scow/config@1.16.0
  - @scow/lib-operation-log@2.2.17
  - @scow/rich-error-model@2.0.4
  - @scow/lib-scow-resource@0.2.25

## 0.1.16

### Patch Changes

- 00d1161: 删除开源许可声明，统一执行 lint format
- 873a79f: install.yaml 新增`novnc`配置，在顶层指定 novncClientImage, 优先级高于 portal 中所指定的 novncClientImage
  详细内容参考文档 /docs/deploy/config/novnc/config

  重构 novnc 服务启动逻辑，在 AI 或者 PORTAL 任一服务已配置时启动

  完善关于根路径访问的文档说明 /docs/deploy/config/customization/basepath

- c56bdaa: 更新 nextjs 版本至 15.5.16
- Updated dependencies [87682ee]
- Updated dependencies [06ceebd]
- Updated dependencies [e4fc0d7]
- Updated dependencies [46c4f2c]
- Updated dependencies [439e7ed]
- Updated dependencies [44cf25f]
- Updated dependencies [00d1161]
- Updated dependencies [0b41958]
- Updated dependencies [96ede62]
- Updated dependencies [839c754]
- Updated dependencies [c56bdaa]
  - @scow/config@1.15.0
  - @scow/lib-scowd@1.2.9
  - @scow/scheduler-adapter-protos@1.6.0
  - @scow/lib-server@1.5.2
  - @scow/lib-scheduler-adapter@1.1.39
  - @scow/rich-error-model@2.0.4
  - @scow/lib-operation-log@2.2.16
  - @scow/lib-scow-resource@0.2.24
  - @scow/protos@1.1.1
  - @scow/lib-config@1.0.9
  - @scow/lib-decimal@1.0.1
  - @scow/utils@1.1.4
  - @scow/lib-auth@1.0.5
  - @scow/lib-ssh@1.0.6
  - @scow/lib-web@1.6.2

## 0.1.15

### Patch Changes

- b65945b: 各系统仪表盘页面滚轴样式优化
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
  - @scow/lib-scowd@1.2.8
  - @scow/lib-operation-log@2.2.15
  - @scow/rich-error-model@2.0.3
  - @scow/lib-scheduler-adapter@1.1.38
  - @scow/lib-server@1.5.1

## 0.1.14

### Patch Changes

- 148099e: 1. 重构 hpc 交互式应用提交作业页面 2. 修改交互式应用菜单，不再以集群为维度
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
- Updated dependencies [434cdf3]
  - @scow/config@1.14.0
  - @scow/lib-web@1.6.0
  - @scow/lib-server@1.5.0
  - @scow/scheduler-adapter-protos@1.5.5
  - @scow/lib-scow-resource@0.2.23
  - @scow/lib-scowd@1.2.7
  - @scow/lib-operation-log@2.2.14
  - @scow/protos@1.0.39
  - @scow/lib-scheduler-adapter@1.1.37
  - @scow/rich-error-model@2.0.3

## 0.1.13

### Patch Changes

- fb60d5c: 修复侧边栏动作中文件管理子导航选中异常，去掉量子侧边栏二级导航自带的灰色背景
- 470b7ef: 修复 getUnreadMessages 调用导致 mis 的 init 页面需要登录的 bug、删除 BodyContainer
- ffc4632: 优化页面中 Input 组件失焦时会自动去除前后空格
- Updated dependencies [7f7a095]
- Updated dependencies [7f93a72]
- Updated dependencies [e76e039]
- Updated dependencies [fb60d5c]
- Updated dependencies [ffc4632]
- Updated dependencies [470b7ef]
- Updated dependencies [ffc4632]
- Updated dependencies [028995a]
  - @scow/lib-web@1.5.13
  - @scow/lib-auth@1.0.4
  - @scow/config@1.13.2
  - @scow/protos@1.0.38
  - @scow/lib-operation-log@2.2.13
  - @scow/lib-scow-resource@0.2.22
  - @scow/lib-server@1.4.13
  - @scow/rich-error-model@2.0.3
  - @scow/lib-scheduler-adapter@1.1.36

## 0.1.12

### Patch Changes

- 3fb2e8a: 修复 AI 及量子系统登录登出页面组件时由于没有认证信息而闪现前端异常报错的问题,
  统一各子系统无登录信息跳转至登录页面前 Loading 效果
- d4e02dc: 操作按钮鼠标悬浮时背景色随 UI 配置主题色变化, 作业模板 ICON 更换,自定义导航链接默认 ICON 更换,平台切换的按钮中文字 icon 一直都保持主题色
- cf47ef2: 修复所有使用 grpc 项目的内存泄露问题
- 20c94f3: 修复量子系统 logo 目录多余空格问题
- 11de67e: 在量子系统中追加灰色色阶，修复因灰色色阶找不到跳转量子系统失败的问题
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
  - @scow/rich-error-model@2.0.3
  - @scow/lib-operation-log@2.2.12
  - @scow/lib-scow-resource@0.2.21
  - @scow/lib-server@1.4.12
  - @scow/config@1.13.1
  - @scow/utils@1.1.3
  - @scow/scheduler-adapter-protos@1.5.4
  - @scow/protos@1.0.37
  - @scow/lib-scowd@1.2.6
  - @scow/lib-scheduler-adapter@1.1.35

## 0.1.11

### Patch Changes

- 79278d5: connectToApp 接口新增 jobId 参数
- 79278d5: 登录页面以及各系统 logo 图片颜色不随系统主题色变化修复
- 79278d5: AI 和量子系增加页面标题、页面标题标签改为可配置
- 79278d5: 升级 next 至 15.5.7 以修复https://nextjs.org/blog/CVE-2025-66478
- Updated dependencies [fab1829]
- Updated dependencies [b4c002a]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
- Updated dependencies [1154951]
- Updated dependencies [5eb4f91]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
- Updated dependencies [597ac23]
- Updated dependencies [79278d5]
- Updated dependencies [8f30ca0]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
  - @scow/lib-web@1.5.11
  - @scow/config@1.13.0
  - @scow/lib-scheduler-adapter@1.1.34
  - @scow/protos@1.0.36
  - @scow/scheduler-adapter-protos@1.5.3
  - @scow/lib-config@1.0.8
  - @scow/lib-scowd@1.2.5
  - @scow/lib-operation-log@2.2.11
  - @scow/lib-scow-resource@0.2.20
  - @scow/lib-server@1.4.11
  - @scow/rich-error-model@2.0.2

## 0.1.10

### Patch Changes

- 963a2b8: 使用统一的适配器接口
- 72601c2: 修复门户与量子作业相关 state 属性报错，以及量子 jupyter 回跳路径错误
- 36880eb: 新增多个系统语言
- Updated dependencies [7281dc1]
- Updated dependencies [a5eedd1]
- Updated dependencies [c495538]
- Updated dependencies [963a2b8]
- Updated dependencies [0cb903e]
- Updated dependencies [0cb903e]
- Updated dependencies [36880eb]
- Updated dependencies [be398ab]
- Updated dependencies [3b6cea7]
  - @scow/lib-web@1.5.10
  - @scow/protos@1.0.35
  - @scow/lib-operation-log@2.2.10
  - @scow/scheduler-adapter-protos@1.5.2
  - @scow/config@1.12.1
  - @scow/lib-server@1.4.10
  - @scow/utils@1.1.2
  - @scow/rich-error-model@2.0.2
  - @scow/lib-scheduler-adapter@1.1.33
  - @scow/lib-scow-resource@0.2.19

## 0.1.9

### Patch Changes

- 045b819: 修复 openapi 无法使用的问题
- 8ec4097: 修复量子系统 openapi 文档报错
- 3a16099: 升级 next 和相关依赖版本
- Updated dependencies [3a16099]
  - @scow/lib-scow-resource@0.2.18
  - @scow/lib-server@1.4.9
  - @scow/lib-scowd@1.2.4
  - @scow/protos@1.0.34
  - @scow/lib-operation-log@2.2.9
  - @scow/rich-error-model@2.0.2
  - @scow/lib-scheduler-adapter@1.1.32
  - @scow/lib-web@1.5.9

## 0.1.8

### Patch Changes

- 4bd522e: connectToApp 接口新增 jobId 参数
- cc87c57: 登录页面以及各系统 logo 图片颜色不随系统主题色变化修复
- ce6fc46: AI 和量子系增加页面标题、页面标题标签改为可配置
- cae38bf: 修复量子获取 logo 404、登录页页脚展示逻辑同页面中一致
- 8b458d0: 升级 next 至 15.5.7 以修复https://nextjs.org/blog/CVE-2025-66478
- Updated dependencies [5b29d63]
- Updated dependencies [cc87c57]
- Updated dependencies [acd7215]
- Updated dependencies [21340c9]
- Updated dependencies [7b07e05]
- Updated dependencies [e5ff94c]
- Updated dependencies [ce6fc46]
- Updated dependencies [7b07e05]
- Updated dependencies [ce6fc46]
- Updated dependencies [64fb141]
- Updated dependencies [8b458d0]
  - @scow/config@1.12.0
  - @scow/lib-web@1.5.8
  - @scow/lib-scheduler-adapter@1.1.31
  - @scow/lib-config@1.0.7
  - @scow/lib-scowd@1.2.3
  - @scow/protos@1.0.33
  - @scow/lib-operation-log@2.2.8
  - @scow/lib-scow-resource@0.2.17
  - @scow/lib-server@1.4.8
  - @scow/rich-error-model@2.0.2

## 0.1.7

### Patch Changes

- Updated dependencies [6f77b4e]
- Updated dependencies [2ff4aed]
- Updated dependencies [6f77b4e]
- Updated dependencies [6f77b4e]
  - @scow/config@1.11.2
  - @scow/lib-web@1.5.7
  - @scow/lib-operation-log@2.2.7
  - @scow/lib-scow-resource@0.2.16
  - @scow/lib-server@1.4.7
  - @scow/protos@1.0.32
  - @scow/lib-scowd@1.2.2
  - @scow/rich-error-model@2.0.2
  - @scow/lib-scheduler-adapter@1.1.30

## 0.1.7

### Patch Changes

- Updated dependencies [6f77b4e]
- Updated dependencies [2ff4aed]
- Updated dependencies [6f77b4e]
- Updated dependencies [6f77b4e]
  - @scow/config@1.11.2
  - @scow/lib-web@1.5.7
  - @scow/lib-operation-log@2.2.7
  - @scow/lib-scow-resource@0.2.16
  - @scow/lib-server@1.4.7
  - @scow/protos@1.0.32
  - @scow/lib-scowd@1.2.2
  - @scow/rich-error-model@2.0.2
  - @scow/lib-scheduler-adapter@1.1.30

## 0.1.6

### Patch Changes

- d556202: 芯片映射布局调整，增加布局大图，各芯片旋转角度可配置
- Updated dependencies [6752734]
- Updated dependencies [9491d98]
- Updated dependencies [f0f144d]
- Updated dependencies [f0f144d]
- Updated dependencies [4f98a31]
- Updated dependencies [b326570]
- Updated dependencies [6752734]
- Updated dependencies [d556202]
  - @scow/config@1.11.1
  - @scow/ai-scheduler-adapter-protos@1.1.5
  - @scow/lib-operation-log@2.2.6
  - @scow/lib-scheduler-adapter@1.1.29
  - @scow/lib-server@1.4.6
  - @scow/lib-web@1.5.6
  - @scow/protos@1.0.31
  - @scow/lib-scow-resource@0.2.15
  - @scow/rich-error-model@2.0.2

## 0.1.5

### Patch Changes

- f1801d4: AI 和量子 API 获取认证 token 的 header 从 authorization 修改为 x-scow-api-auth-token
- Updated dependencies [bf8afc6]
- Updated dependencies [477db31]
- Updated dependencies [b645b74]
- Updated dependencies [bf8afc6]
- Updated dependencies [3d58659]
- Updated dependencies [bf8afc6]
- Updated dependencies [b645b74]
  - @scow/ai-scheduler-adapter-protos@1.1.4
  - @scow/config@1.11.0
  - @scow/protos@1.0.30
  - @scow/lib-web@1.5.5
  - @scow/lib-operation-log@2.2.5
  - @scow/lib-scow-resource@0.2.14
  - @scow/lib-server@1.4.5
  - @scow/rich-error-model@2.0.2
  - @scow/lib-scheduler-adapter@1.1.28

## 0.1.4

### Patch Changes

- 8d7c549: 管理系统已结束作业中增加量子作业
- 9b11653: 量子和 AI 的 API 支持静态秘密字符串认证： /docs/integration/scow-api-hook/api
- Updated dependencies [6aba3ed]
- Updated dependencies [50f3902]
- Updated dependencies [f0ecf70]
- Updated dependencies [cb4c2e8]
- Updated dependencies [29f7e38]
- Updated dependencies [50f3902]
- Updated dependencies [f0ecf70]
- Updated dependencies [cc28b1b]
- Updated dependencies [d4da4f5]
  - @scow/lib-web@1.5.4
  - @scow/lib-config@1.0.6
  - @scow/ai-scheduler-adapter-protos@1.1.3
  - @scow/lib-operation-log@2.2.4
  - @scow/scheduler-adapter-protos@1.5.1
  - @scow/config@1.10.0
  - @scow/protos@1.0.29
  - @scow/lib-scheduler-adapter@1.1.27
  - @scow/lib-server@1.4.4
  - @scow/lib-scow-resource@0.2.13
  - @scow/rich-error-model@2.0.2

## 0.1.3

### Patch Changes

- 06a1579: 量子系统创建 jupyter 应用后跳转回量子系统
- 9532ecb: 提高 portal/mis-web 首页加载速度，修复大屏条件下第一屏会渲染出侧边栏的问题
- 6f5c6ec: 量子 UI 同步其他系统变更以及部分遗漏细节完善、消费类型增加量子作业费用
- dfb67b5: 芯片详情页门保真度数据表格和可视化图形
- Updated dependencies [a5f0e1d]
- Updated dependencies [45117e6]
- Updated dependencies [6f5c6ec]
- Updated dependencies [2ea2e6a]
- Updated dependencies [326e3e8]
- Updated dependencies [58e7347]
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
  - @scow/lib-scow-resource@0.2.12
  - @scow/lib-config@1.0.5
  - @scow/lib-web@1.5.3
  - @scow/protos@1.0.28
  - @scow/lib-server@1.4.3
  - @scow/lib-operation-log@2.2.3
  - @scow/rich-error-model@2.0.2
  - @scow/lib-scheduler-adapter@1.1.26

## 0.1.2

### Patch Changes

- Updated dependencies [579f164]
  - @scow/config@1.8.2
  - @scow/lib-operation-log@2.2.2
  - @scow/lib-scow-resource@0.2.11
  - @scow/lib-server@1.4.2
  - @scow/lib-web@1.5.2
  - @scow/protos@1.0.27
  - @scow/rich-error-model@2.0.2
  - @scow/lib-scheduler-adapter@1.1.25

## 0.1.1

### Patch Changes

- 562d068: 增加量子系统作业管理模块框架
- 3545301: 量子作业列表与详情显示增加比特秒以及一些 UI 细节
- 2dd5f4c: 量子链接功能与 UI 细节完善
- 562d068: 增加量子计算仪表盘
- 562d068: 增加量子系统，包含提交展示量子作业、使用 jupyter 交互式应用、量子计费、使用帮助等基础功能
- e6cf7d0: 使量子作业按比特秒计价从配置文件定义
- Updated dependencies [3545301]
- Updated dependencies [ff956a2]
- Updated dependencies [7547140]
- Updated dependencies [05e24b2]
- Updated dependencies [2dd5f4c]
- Updated dependencies [562d068]
- Updated dependencies [562d068]
- Updated dependencies [d83b20f]
- Updated dependencies [e6cf7d0]
- Updated dependencies [44af4cf]
- Updated dependencies [3b724ac]
  - @scow/lib-web@1.5.1
  - @scow/lib-operation-log@2.2.1
  - @scow/ai-scheduler-adapter-protos@1.1.2
  - @scow/lib-server@1.4.1
  - @scow/config@1.8.1
  - @scow/lib-config@1.0.4
  - @scow/lib-scow-resource@0.2.10
  - @scow/lib-scowd@1.2.1
  - @scow/protos@1.0.26
  - @scow/rich-error-model@2.0.2
  - @scow/lib-scheduler-adapter@1.1.24
