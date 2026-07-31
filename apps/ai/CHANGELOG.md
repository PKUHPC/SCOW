# @scow/ai

## 0.5.8

### Patch Changes

- 45d378c: "开发机增加账号加速卡配额及容器部署引起的 bug 修复"
- 7c629a6: ai 未筛选 portal 的集群修复
- 560108c: 优化数据资产的分享及复制在 scow 及 scowd 之间维持原子性操作
- Updated dependencies [560108c]
  - @scow/scowd-protos@0.8.0
  - @scow/lib-scowd@1.2.10

## 0.5.7

### Patch Changes

- 23a94d3: 增加统一的日志上下文信息
- fb6ab4b: 数据资产使用及作业详情展示优化，AI 提交作业使用数据资产时默认填充指定前缀+资源名称/版本的挂载路径
- af06530: 交互式应用 appComment 增加 markdown 格式渲染
- 837808c: 增加前端路径安全校验并统一工作目录与挂载路径规则；hpc 提交作业工作目录支持相对路径
- ba403a6: 首次进入系统切换多语言，语言 select 值未改变修复
- 0e868a4: ai 应用提交时未传 ImageName 修复
- c539ce2: 增加开发机再次提交功能
- c273ead: 智算增加平台管理员能够以 root 身份进入集群 master 节点
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
  - @scow/lib-notification@1.0.27
  - @scow/lib-operation-log@2.2.18
  - @scow/lib-scow-resource@0.2.26
  - @scow/lib-scheduler-adapter@1.1.41
  - @scow/rich-error-model@2.0.4

## 0.5.6

### Patch Changes

- 22a7f70: 修复文件重命名无提醒直接覆盖
- 94ee545: AI 数据资产相关页面的弹窗及搜索交互相关优化
- de13335: 推理最大运行时间开关上下对齐和环境变量 label 对齐
- bfe6ffc: 在门户系统获取授权应用、检查应用时按门户 HPC/AI 分类获取
  HPC 获取应用列表是拦截 getAppConnectionInfo 中捕获 AI 作业信息时返回的接口的错误
- f51dc4d: 公共数据资产镜像页面弹窗及搜索交互漏改修复
- 013d085: 支持 数据集/算法/模型 在 AI 提交作业页面中自定义挂载路径，在开发机作业中支持填写环境变量
  在 AI 提交作业页面添加内置环境变量 WORK_DIR, XDL_IP, VC_GPU_NUM, SCOW_AI_MODEL_PATH, SCOW_AI_DATASET_PATH, SCOW_AI_ALGORITHM_PATH
- e0f253b: 增加适配器连接超时选项和提示
- e9c002a: 已失败 ai 开发机点击取消时不再报错
- 68309f0: 增加 AI 作业模板功能
- 9713fca: 鹤思 ai 适配器支持 HPC 作业
- 59348c8: HPC 作业/应用， AI 应用/训练/推理/开发机作业 分别增加独立的作业最长运行时间配置
- 1db2326: 删除写入 tensorBoard_entry.sh 的逻辑，提交训练作业时只向适配器传递 tensorBoard 运行时 URL 前缀
- 68309f0: 重构 ai 再次提交：不再依赖参数文件而是迁移到数据库
- 92de2c3: 修复再次提交时，自定义挂载点的源路径未填入
- 0a1a819: UI 样式&交互整体走查
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
  - @scow/lib-notification@1.0.26
  - @scow/lib-scow-resource@0.2.25

## 0.5.5

### Patch Changes

- 3f2ba62: AI 文件管理添加同名文件是否覆盖提醒
- 0708d69: SCOW 整体响应式布局优化
- 44cf25f: 删除 scow 中调用适配器 getVersion 相关的代码，在后续版本的代码中 scow 版本与适配器版本维持一致
- 00d1161: 删除开源许可声明，统一执行 lint format
- bab79dc: 修复复制公共资产时修改权限的指定路径为复制的数据文件夹本身
- 96ede62: 交互式应用的自定义表单的输入框增加 password 类型
- 46c4f2c: **删除 AI config 下的 jobMonitor 配置，仅保留集群下的该配置**
  修复仅配置 AI config 导致用户角色查看监控数据的报错问题
- 873a79f: install.yaml 新增`novnc`配置，在顶层指定 novncClientImage, 优先级高于 portal 中所指定的 novncClientImage
  详细内容参考文档 /docs/deploy/config/novnc/config

  重构 novnc 服务启动逻辑，在 AI 或者 PORTAL 任一服务已配置时启动

  完善关于根路径访问的文档说明 /docs/deploy/config/customization/basepath

- 03851b5: harbor 不存在旧项目时,直接跳过迁移镜像数据的 Migration
- c56bdaa: 更新 nextjs 版本至 15.5.16
- 87682ee: 提交 AI 作业任务时传递 CSI 挂载模式及用户映射信息
- Updated dependencies [87682ee]
- Updated dependencies [06ceebd]
- Updated dependencies [e4fc0d7]
- Updated dependencies [46c4f2c]
- Updated dependencies [439e7ed]
- Updated dependencies [44cf25f]
- Updated dependencies [00d1161]
- Updated dependencies [0b41958]
- Updated dependencies [87682ee]
- Updated dependencies [96ede62]
- Updated dependencies [839c754]
- Updated dependencies [c56bdaa]
  - @scow/config@1.15.0
  - @scow/lib-scowd@1.2.9
  - @scow/scheduler-adapter-protos@1.6.0
  - @scow/lib-server@1.5.2
  - @scow/notification-protos@0.1.11
  - @scow/lib-scheduler-adapter@1.1.39
  - @scow/rich-error-model@2.0.4
  - @scow/lib-operation-log@2.2.16
  - @scow/lib-scow-resource@0.2.24
  - @scow/lib-notification@1.0.25
  - @scow/scowd-protos@0.7.0
  - @scow/protos@1.1.1
  - @scow/lib-config@1.0.9
  - @scow/lib-decimal@1.0.1
  - @scow/utils@1.1.4
  - @scow/lib-auth@1.0.5
  - @scow/lib-ssh@1.0.6
  - @scow/lib-web@1.6.2

## 0.5.4

### Patch Changes

- 1e4ac8c: 智算平台作业详情显示挂载点
- 92b2766: CLI 支持按模块启用/禁用 portal,ai,mis,quantum 模块。

  install.yaml 的`portal/mis/ai/quantum`新增`enabled`配置（默认为 true）

- 5082746: 优化文件上传逻辑
- 7647059: 添加数据资产时，默认选中集群
- 5bd3bb5: 补充 completeMultipartUpload 接口的 noCheckPermission 逻辑
- b4f7dde: 智算平台 UI 走查修改，主要涉及数据资产和公共数据资产页面的统一样式组件替换和按钮表格样式优化
- c8908df: 优化 AI 推理作业详情中 AI 推理应用的访问
- b65945b: 各系统仪表盘页面滚轴样式优化
- 0c8ffa0: 将 next 从 15.5.9 升级到 15.5.15
- Updated dependencies [5082746]
- Updated dependencies [5082746]
- Updated dependencies [56979c6]
- Updated dependencies [b4f7dde]
- Updated dependencies [8b2b13b]
- Updated dependencies [b65945b]
- Updated dependencies [f3a73f5]
- Updated dependencies [0c8ffa0]
  - @scow/scowd-protos@0.6.0
  - @scow/lib-web@1.6.1
  - @scow/protos@1.1.0
  - @scow/lib-scowd@1.2.8
  - @scow/lib-operation-log@2.2.15
  - @scow/rich-error-model@2.0.3
  - @scow/lib-scheduler-adapter@1.1.38
  - @scow/lib-server@1.5.1

## 0.5.3

### Patch Changes

- f8fe60d: 集成 Alertmanager 监控告警通知
- 6ef8e28: hpc 和 ai 提交作业 UI 调整
- 148099e: 重构 hpc 提交作业
- 2d3dcf6: 删除 dead code 并提取 AI 作业表单公共模块
- 41dd8f4: 上传文件/文件夹使用拖拽功能时只能拖拽对应类型的文件，如果出现错误类型增加提示，本次上传不进行上传
- b883196: AI 推理训练页面表单项设置错误
- b87bed6: 优化 ai 作业页面队列展示
- c981960: 增加以平台角色管理公共数据资产数据集、算法、模型、镜像的功能，并对现有数据资产进行相应影响，同时文件管理也允许平台管理访问公共数据资产路径，普通用户也可复制该路径。
- 1e06ee1: 修复授权的集群没有授权分区时不显示的问题
- 434cdf3: 实现 scowd 多登录节点负载均衡与请求亲和性路由
- 00aa2eb: 增加分享数据资产的文件夹所在的目录的可选配置 sharedTopDir
- 3d18a5c: 默认取消用户数据资产分享功能、运维数据资产脚本迁移、细化数据资产文件选择框文件选择报错提示
- Updated dependencies [f8fe60d]
- Updated dependencies [c981960]
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
  - @scow/notification-protos@0.1.10
  - @scow/config@1.14.0
  - @scow/lib-web@1.6.0
  - @scow/scowd-protos@0.5.0
  - @scow/lib-server@1.5.0
  - @scow/scheduler-adapter-protos@1.5.5
  - @scow/lib-scow-resource@0.2.23
  - @scow/lib-scowd@1.2.7
  - @scow/lib-notification@1.0.24
  - @scow/lib-operation-log@2.2.14
  - @scow/protos@1.0.39
  - @scow/lib-scheduler-adapter@1.1.37
  - @scow/rich-error-model@2.0.3

## 0.5.2

### Patch Changes

- 9b46f4a: 智算平台文件管理路径查询失败时抛出错误
- d8e2d51: 增加 ai 应用再次提交自定义属性回显；ai 作业名校验，应用作业名可清空；调整复制公共资产默认名称。
- fb60d5c: 修复侧边栏动作中文件管理子导航选中异常，去掉量子侧边栏二级导航自带的灰色背景
- 470b7ef: 修复 getUnreadMessages 调用导致 mis 的 init 页面需要登录的 bug、删除 BodyContainer
- ffc4632: 优化页面中 Input 组件失焦时会自动去除前后空格
- 028995a: 修复 AI 涉及集群选择的快捷入口跳转出错
- 4acbdcd: AI 数据资产的进入文件功能，因填充默认集群导致接口报错
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
  - @scow/lib-notification@1.0.23
  - @scow/lib-operation-log@2.2.13
  - @scow/lib-scow-resource@0.2.22
  - @scow/lib-server@1.4.13
  - @scow/rich-error-model@2.0.3
  - @scow/lib-scheduler-adapter@1.1.36

## 0.5.1

### Patch Changes

- 299b323: 用户修改邮箱增加校验权限
- 3fb2e8a: 修复 AI 及量子系统登录登出页面组件时由于没有认证信息而闪现前端异常报错的问题,
  统一各子系统无登录信息跳转至登录页面前 Loading 效果
- d4e02dc: 操作按钮鼠标悬浮时背景色随 UI 配置主题色变化, 作业模板 ICON 更换,自定义导航链接默认 ICON 更换,平台切换的按钮中文字 icon 一直都保持主题色
- cf47ef2: 修复所有使用 grpc 项目的内存泄露问题
- b2a9cb8: AI 分布式作业增加节点总容量限制
- c03aba9: 文件管理访问无权限的路径时 BUG 优化
- 0b5023f: 修复 ai 导航栏有些图标选中不变色
- 344b2da: ai 进入容器从调用 k8sAPI 切换为调用适配器和集群删除 k8s 配置
- f8957cb: 优化侧边栏文字和样式，子系统使用相同的公共组件；修复 AI 导航栏国际化不立即切换的问题
- c9ecafb: 前端控制台打印 error、warning 修复
- 7c80ba7: 实现 AI 集群停用
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
  - @scow/scowd-protos@0.4.1
  - @scow/utils@1.1.3
  - @scow/scheduler-adapter-protos@1.5.4
  - @scow/protos@1.0.37
  - @scow/lib-notification@1.0.22
  - @scow/lib-scowd@1.2.6
  - @scow/lib-scheduler-adapter@1.1.35

## 0.5.0

### Minor Changes

- 79278d5: 应用训练推理开发机统一和优化
- 79278d5: 优化 AI 功能菜单：新增数据资产一级菜单（包含数据集、镜像、算法、模型）；数据资产中“我的”和“公共”合并成一个页面通过 Tabs 展示；文件管理增加集群参数

### Patch Changes

- 97f80bc: ai 提交作业时只筛选出 ai 的集群和应用
- 026a713: 修复 ai 监控只允许管理员查看的问题
- 79278d5: 登录页面以及各系统 logo 图片颜色不随系统主题色变化修复
- 95b89d5: 完善 footer 配置及文档、ai 仪表盘未配置 resource 不展示数据 bug、创建应用信息报错优化
- 79278d5: ai 推理、公共挂载点、监控配置支持多集群
- 79278d5: 消息系统文档、日志、接口安全优化
- d871708: AI 作业增加一个保存所有 Session 信息的文件
- 5eb4f91: 调整侧边导航栏的宽度
- 79278d5: 修复 AI 未配置应用时直接 500 报错
- 79278d5: AI 和量子系增加页面标题、页面标题标签改为可配置
- c658998: 优化上传镜像，在镜像列表页面显示创建中进度日志
- f209732: 修复 AI 退出登录时不直接跳转登录页面的问题
- 9bb1fa3: 在门户/管理系统/AI 中扩展获取未读消息 metadata 类型包括对象及数组
- 79278d5: 升级 next 至 15.5.7 以修复https://nextjs.org/blog/CVE-2025-66478
- 07267b1: 恢复 HPC 压缩下载功能和原本的下载逻辑
- Updated dependencies [fab1829]
- Updated dependencies [79278d5]
- Updated dependencies [b4c002a]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
- Updated dependencies [ca83d79]
- Updated dependencies [79278d5]
- Updated dependencies [1154951]
- Updated dependencies [5eb4f91]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
- Updated dependencies [597ac23]
- Updated dependencies [79278d5]
- Updated dependencies [8f30ca0]
- Updated dependencies [c658998]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
  - @scow/lib-web@1.5.11
  - @scow/scowd-protos@0.4.0
  - @scow/config@1.13.0
  - @scow/lib-scheduler-adapter@1.1.34
  - @scow/protos@1.0.36
  - @scow/notification-protos@0.1.9
  - @scow/scheduler-adapter-protos@1.5.3
  - @scow/lib-config@1.0.8
  - @scow/lib-scowd@1.2.5
  - @scow/lib-notification@1.0.21
  - @scow/lib-operation-log@2.2.11
  - @scow/lib-scow-resource@0.2.20
  - @scow/lib-server@1.4.11
  - @scow/rich-error-model@2.0.2

## 0.4.11

### Patch Changes

- 7281dc1: 在一些页面中增加部分表格字段的排序
- be398ab: 增加主题色和灰色的色阶
- a5eedd1: portal、ai 仪表盘集群接口合并重构，新增 getAllSummaryClustersInfo 集群数据汇总接口
- 963a2b8: 使用统一的适配器接口
- 26c26a9: 修复 ai 旧作业的作业详情无法打开
- a3f3421: 处理 AI 开发时 NEXT 的警告、报错和 zod 废弃的 api
- 36880eb: 新增多个系统语言
- 3b6cea7: 修复当应用的 URL 的 querystring 和 scow 代理地址的参数相同时，这些参数无法被传递到应用中的问题
- Updated dependencies [7281dc1]
- Updated dependencies [a5eedd1]
- Updated dependencies [c495538]
- Updated dependencies [963a2b8]
- Updated dependencies [0cb903e]
- Updated dependencies [0cb903e]
- Updated dependencies [5686520]
- Updated dependencies [36880eb]
- Updated dependencies [be398ab]
- Updated dependencies [3b6cea7]
  - @scow/lib-web@1.5.10
  - @scow/protos@1.0.35
  - @scow/lib-operation-log@2.2.10
  - @scow/scheduler-adapter-protos@1.5.2
  - @scow/config@1.12.1
  - @scow/lib-server@1.4.10
  - @scow/notification-protos@0.1.8
  - @scow/utils@1.1.2
  - @scow/rich-error-model@2.0.2
  - @scow/lib-scheduler-adapter@1.1.33
  - @scow/lib-notification@1.0.20
  - @scow/lib-scow-resource@0.2.19

## 0.4.10

### Patch Changes

- 045b819: 修复 openapi 无法使用的问题
- 94316e1: 删除镜像时误删所有同名镜像
- 3a16099: 升级 next 和相关依赖版本
- Updated dependencies [3a16099]
  - @scow/notification-protos@0.1.7
  - @scow/lib-scow-resource@0.2.18
  - @scow/lib-notification@1.0.19
  - @scow/scowd-protos@0.3.4
  - @scow/lib-server@1.4.9
  - @scow/lib-scowd@1.2.4
  - @scow/protos@1.0.34
  - @scow/lib-operation-log@2.2.9
  - @scow/rich-error-model@2.0.2
  - @scow/lib-scheduler-adapter@1.1.32
  - @scow/lib-web@1.5.9

## 0.4.9

### Patch Changes

- cc87c57: 登录页面以及各系统 logo 图片颜色不随系统主题色变化修复
- e5ff94c: ai 推理、公共挂载点、监控配置支持多集群
- 21340c9: 快捷入口的链接以及登录集群中 shell 的按钮未考虑 SCOW base path 修复
- 1298591: 消息系统文档、日志、接口安全优化
- e4a8fc2: 修复 AI 未配置应用时直接 500 报错
- ce6fc46: AI 和量子系增加页面标题、页面标题标签改为可配置
- 8b458d0: 升级 next 至 15.5.7 以修复https://nextjs.org/blog/CVE-2025-66478
- 8d12e12: 修复开发机修复内存展示 BUG
- Updated dependencies [4bd522e]
- Updated dependencies [5b29d63]
- Updated dependencies [cc87c57]
- Updated dependencies [acd7215]
- Updated dependencies [21340c9]
- Updated dependencies [1298591]
- Updated dependencies [7b07e05]
- Updated dependencies [e5ff94c]
- Updated dependencies [ce6fc46]
- Updated dependencies [7b07e05]
- Updated dependencies [ce6fc46]
- Updated dependencies [64fb141]
- Updated dependencies [8b458d0]
  - @scow/scowd-protos@0.3.3
  - @scow/config@1.12.0
  - @scow/lib-web@1.5.8
  - @scow/lib-scheduler-adapter@1.1.31
  - @scow/notification-protos@0.1.6
  - @scow/lib-config@1.0.7
  - @scow/lib-scowd@1.2.3
  - @scow/protos@1.0.33
  - @scow/lib-notification@1.0.18
  - @scow/lib-operation-log@2.2.8
  - @scow/lib-scow-resource@0.2.17
  - @scow/lib-server@1.4.8
  - @scow/rich-error-model@2.0.2

## 0.4.8

### Patch Changes

- 2ff4aed: 删除 AI 作业状态用于提示的 popover, 增加部分状态颜色, AI 异常作业状态增加国际化显示
- 6f77b4e: 文件管理新增软链接处理，并增加不同文件类型的 icon
- Updated dependencies [6f77b4e]
- Updated dependencies [2ff4aed]
- Updated dependencies [6f77b4e]
- Updated dependencies [6f77b4e]
  - @scow/config@1.11.2
  - @scow/lib-web@1.5.7
  - @scow/scowd-protos@0.3.2
  - @scow/lib-notification@1.0.17
  - @scow/lib-operation-log@2.2.7
  - @scow/lib-scow-resource@0.2.16
  - @scow/lib-server@1.4.7
  - @scow/protos@1.0.32
  - @scow/lib-scowd@1.2.2
  - @scow/rich-error-model@2.0.2
  - @scow/lib-scheduler-adapter@1.1.30

## 0.4.8

### Patch Changes

- 2ff4aed: 删除 AI 作业状态用于提示的 popover, 增加部分状态颜色, AI 异常作业状态增加国际化显示
- 6f77b4e: 文件管理新增软链接处理，并增加不同文件类型的 icon
- Updated dependencies [6f77b4e]
- Updated dependencies [2ff4aed]
- Updated dependencies [6f77b4e]
- Updated dependencies [6f77b4e]
  - @scow/config@1.11.2
  - @scow/lib-web@1.5.7
  - @scow/scowd-protos@0.3.2
  - @scow/lib-notification@1.0.17
  - @scow/lib-operation-log@2.2.7
  - @scow/lib-scow-resource@0.2.16
  - @scow/lib-server@1.4.7
  - @scow/protos@1.0.32
  - @scow/lib-scowd@1.2.2
  - @scow/rich-error-model@2.0.2
  - @scow/lib-scheduler-adapter@1.1.30

## 0.4.7

### Patch Changes

- ea51140: 修复 ai 仪表盘页面控制台报错（manifest not found 和 svg 报错）
- 9cd005b: AI 监控的中已结束的作业默认展示全部数据 && 兼容没配置监控的情况,作业详情可以正常显示

## 0.4.6

### Patch Changes

- 1fb3d62: 虚拟 GPU 支持分布式训练
- 0821615: ai 队列限制单节点最大加速卡卡数
- 4f98a31: 作业列表字段调整以及导出功能优化
- 02cc336: layout 消息获取报错修复、登录节点 name 未处理国际化修复
- 6752734: 顶部导航栏只保留一级菜单，HPC 整合 shell 页和桌面页为登录集群页
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
  - @scow/lib-notification@1.0.16
  - @scow/lib-scow-resource@0.2.15
  - @scow/rich-error-model@2.0.2

## 0.4.5

### Patch Changes

- b645b74: 抽取 hpc 快捷入口为公共组件，ai 增加快捷入口
- bf8afc6: ai 作业详情中增加监控 tab
- 477db31: AI 定期删除 harbor 里不存在的镜像
- f1801d4: AI 和量子 API 获取认证 token 的 header 从 authorization 修改为 x-scow-api-auth-token
- b645b74: 快捷入口优化及 bugs 修复
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
  - @scow/lib-notification@1.0.15
  - @scow/lib-operation-log@2.2.5
  - @scow/lib-scow-resource@0.2.14
  - @scow/lib-server@1.4.5
  - @scow/rich-error-model@2.0.2
  - @scow/lib-scheduler-adapter@1.1.28

## 0.4.4

### Patch Changes

- be97bba: 修复开发机最大运行时限的单位切换为分钟时提交为字符串而非数字的问题
- 6aba3ed: 实现 AI 上传文件/上传文件夹的分片上传功能，AI 和门户上传组件增加传输进度与传输速度显示
- 6f35b8a: 修复交互式应用自定义文件组件没有正确传递 scowdEnabled，ssh 下上传文件时不展示上传进度和速度
- f6b1acf: 仪表盘平台概览和分区节点使用率展示数据不一致。节点使用率数据来源从原本的在适配器获取接口改为前端计算，用以解决适配器传递的节点使用率精度不够的问题
- 1697522: 修改了"用户第一次创建镜像报错 401 没权限"的问题
- 9b11653: 量子和 AI 的 API 支持静态秘密字符串认证： /docs/integration/scow-api-hook/api
- cc28b1b: 修复当系统正在运行同步任务时退出后，再次启动系统后无法执行账户用户相关操作的问题;
  在 AccountUserSyncRecord 实体中增加 sync_status 索引
- 50f3902: AI 支持 UI 扩展
- f53af0f: AI 作业名称要求 1-43 个小写字母、数字、'-'或者'.'，以字母开头，以字母或者数字结尾；模型、算法、数据集的名称及版本要求不允许中文字符，长度不能超过 50 字节且不能包含 '/' 字符
- f0ecf70: AI 新增申请开发机功能
- 50f3902: AI 和消息系统集成
- 29f7e38: 修复 ai uiExtension 配置、暂时注释 notification 卡片
- Updated dependencies [6aba3ed]
- Updated dependencies [50f3902]
- Updated dependencies [f0ecf70]
- Updated dependencies [29f7e38]
- Updated dependencies [50f3902]
- Updated dependencies [f0ecf70]
- Updated dependencies [cc28b1b]
- Updated dependencies [d4da4f5]
  - @scow/lib-web@1.5.4
  - @scow/lib-config@1.0.6
  - @scow/ai-scheduler-adapter-protos@1.1.3
  - @scow/lib-operation-log@2.2.4
  - @scow/config@1.10.0
  - @scow/protos@1.0.29
  - @scow/lib-scheduler-adapter@1.1.27
  - @scow/lib-server@1.4.4
  - @scow/lib-notification@1.0.14
  - @scow/lib-scow-resource@0.2.13
  - @scow/rich-error-model@2.0.2

## 0.4.3

### Patch Changes

- 20caddd: AI 数据分享，删除源文件夹后，无法再取消分享；推理和训练的工作目录修改为绝对路径
- 45117e6: 在 AI,HPC 提交作业和交互式应用时增加用户账户，账户集群分区的鉴权
- c790437: 修复了 ai 获取正在运行作业慢
- 326e3e8: 未结束作业没作业时隐藏滚动条
- e42b8f2: 删除 ai 文件管理列表 mode 列，将分享相关操作 userId 修改为普通用户
- 60709f3: 文件管理新增不可编辑文件后缀数组配置
- 3ed0aa1: 仪表盘配置，控制对普通用户的显示内容模式
- 3df34c4: 修改 ai 的检测应用是否可访问
- d1f6f9b: 在作业详情中增加镜像等内容显示
- a5f0e1d: 新增是否存在存储副本的配置，并提供提示
- 06c289a: 增加作业状态解释，增加容器 pending 说明展示
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

## 0.4.2

### Patch Changes

- 8ad4413: ai 作业的输出日志支持选择显示行数
- a38f1a4: ai 增加镜像配额，由 harbor 限制，并且兼容之前的版本，自动数据迁移
- 01c3cd0: 增加压缩解压缩、存储管理
- 579f164: AI 提交作业页面优化（默认镜像和运行命令）
- 8ad4413: 作业详情增加镜像信息和 pod 结束时间
- Updated dependencies [579f164]
  - @scow/config@1.8.2
  - @scow/lib-operation-log@2.2.2
  - @scow/lib-scow-resource@0.2.11
  - @scow/lib-server@1.4.2
  - @scow/lib-web@1.5.2
  - @scow/protos@1.0.27
  - @scow/rich-error-model@2.0.2
  - @scow/lib-scheduler-adapter@1.1.25

## 0.4.1

### Patch Changes

- ff956a2: 增加表单 tenant_default_app_removed_list, 增加租户默认授权应用的功能
- 664a30c: ai 带有复杂对象的查询请求改成 POST
- 7547140: AI 训练推理增加自定义环境变量
- b90381d: ai 分布式训练交互优化 和 修复 ai 事件信息过多或者翻页时显示不全
- 05e24b2: 仪表盘、表单 UI 优化、更换字体、table 表格操作项更换为 icon
- 4aa0263: 新增融合接口，减少仪表盘请求
- 562d068: 增加量子系统，包含提交展示量子作业、使用 jupyter 交互式应用、量子计费、使用帮助等基础功能
- dbcc148: ai 应用训练推理增加优先级
- 20e3d50: 修复再次提交作业时镜像的回显；未结束作业列表 pending 状态的作业显示申请的资源数
- d83b20f: AI 训练增加 TensorBoard 及查看
- 06e8d98: 正在运行镜像被删除后，未结束作业列表报错
- dbcc148: image 增加类型、端口、命令字段，镜像操作和提交作业相应修改
- 25d6396: 删除高性能计算与人工智能系统中交互式应用 10s 自动刷新 UI,
  添加 ended_sessions.json 文件，存储已结束的交互式应用 session 信息，优化后台查询性能
- 44af4cf: ai 提交应用 formData 无传递自定义的参数
- d10f80f: ai 镜像、算法、数据集和模型操作日志修改
- 3b724ac: ai footer 层级优化、dashboard entry ui 优化
- Updated dependencies [3545301]
- Updated dependencies [ff956a2]
- Updated dependencies [7547140]
- Updated dependencies [05e24b2]
- Updated dependencies [2dd5f4c]
- Updated dependencies [562d068]
- Updated dependencies [562d068]
- Updated dependencies [25d6396]
- Updated dependencies [d83b20f]
- Updated dependencies [e6cf7d0]
- Updated dependencies [44af4cf]
- Updated dependencies [3b724ac]
  - @scow/lib-web@1.5.1
  - @scow/lib-operation-log@2.2.1
  - @scow/ai-scheduler-adapter-protos@1.1.2
  - @scow/lib-server@1.4.1
  - @scow/config@1.8.1
  - @scow/scowd-protos@0.3.1
  - @scow/lib-config@1.0.4
  - @scow/lib-scow-resource@0.2.10
  - @scow/lib-scowd@1.2.1
  - @scow/protos@1.0.26
  - @scow/rich-error-model@2.0.2
  - @scow/lib-scheduler-adapter@1.1.24

## 0.4.0

### Minor Changes

- 778e6c7: 在管理系统增加对租户/账户授权交互式应用功能，在审计系统内增加授权/取消授权的日志
  并在 HPC 系统和 AI 系统实现仅展示可用应用

### Patch Changes

- 36cb511: 新增 AI 作业详情页，作业事件;新增 pod 列表、事件、日志
- eb1f439: 修复内存泄漏问题
- 36cec12: 修复 ai 再次提交作业后切换账户和分区无效
- 1874b38: 更新 next 14.2.4 至 14.2.30
- f4c5c4a: ai 再次提交作业页面切换账户刷新过期值
- 38ddbb9: 修复 misans 字体未加载、head 登录字段未居中
- 3c7eaf6: 调整 mis、portal、ai 个人信息页面布局样式，并将三系统个人信息页面展示内容统一
- 0d36f92: 解封没有授权分区/队列的账户时删除调用 blockAccount 接口逻辑
  增加 AI 授权队列功能，在 AI 仪表盘、作业等页面增加获取授权队列逻辑
- ebb4e3d: ai 应用训练推理增加优先级
- 40e9e1e: 再次提交作业从 cpu 分区自动切换到 gpu 分区，gpu 数默认 0
- be8bb65: 修改未开启资源管理时，仪表盘和创建应用作业页面 trpc 报错的问题
- 0f7e1d3: 修改 HPC 文件管理下已复制项展示位置, 增加 HPC 和 AI 下的文件夹复制移动的路径校验
- ac237b1: 1.调整 logo 位置 2.系统跳转下拉框 3.拓展菜单图标样式不随菜单颜色变化 4.英文遮挡 bug
- 54e95db: hpc、mis、ai 顶部侧边导航栏 UI 交互调整
  footer 调整只在 dashboard 展示
- c80e77a: 修复 pod 列表分页后，点击 事件 只响应第一页的 bug
- 9d967d0: 取消 misan 字体、优化图标引入
- Updated dependencies [778e6c7]
- Updated dependencies [5da1b58]
- Updated dependencies [1874b38]
- Updated dependencies [38ddbb9]
- Updated dependencies [3c7eaf6]
- Updated dependencies [b961d74]
- Updated dependencies [b961d74]
- Updated dependencies [5da1b58]
- Updated dependencies [0d36f92]
- Updated dependencies [ac237b1]
- Updated dependencies [778e6c7]
- Updated dependencies [54e95db]
- Updated dependencies [a4d7ac3]
  - @scow/config@1.8.0
  - @scow/lib-operation-log@2.2.0
  - @scow/lib-server@1.4.0
  - @scow/lib-scowd@1.2.0
  - @scow/lib-web@1.5.0
  - @scow/rich-error-model@2.0.2
  - @scow/lib-scow-resource@0.2.9
  - @scow/lib-scheduler-adapter@1.1.23
  - @scow/protos@1.0.25

## 0.3.5

### Patch Changes

- 79ce4a8: 创建目录和文件夹前先检查存在性
- 8826b02: ai 获取作业列表删除 host 和 port，增加分区、cpu、gpu、内存、节点展示
- 238a828: ai 提交应用和训练限制最大运行时间
- efb317b: ai 再次提交作业分区信息回显问题
- b45116f: 修改 HPC 与 AI 系统交互式应用列表中 10s 自动刷新功能默认为不开启
- 35e30e7: 修复门户流式接口未能正确中断导致的内存泄漏问题
- 083d57b: ai 中除了文件的其他所有 ssh 操作均接入 scowd
- Updated dependencies [238a828]
- Updated dependencies [80d22df]
  - @scow/config@1.7.2
  - @scow/lib-config@1.0.3
  - @scow/lib-operation-log@2.1.18
  - @scow/lib-scow-resource@0.2.8
  - @scow/lib-server@1.3.14
  - @scow/lib-web@1.4.14
  - @scow/lib-scowd@1.1.8

## 0.3.4

### Patch Changes

- 10b1fa2: 获取作业 podId && 调度和启动事件信息，打印日志 && 完善 ai 推理
- 9090beb: SCOW 中所有 GPU 改为 加速卡
- 02b64da: 操作日志整体优化
- 9d23c22: ai 导航栏与 mis 样式统一
- b5aa294: ai 文件操作接入 scowd
- 88fb722: 调整页脚配置方式
- Updated dependencies [10b1fa2]
- Updated dependencies [10b1fa2]
- Updated dependencies [88fb722]
- Updated dependencies [59fb3b4]
- Updated dependencies [0904fad]
- Updated dependencies [7482019]
  - @scow/config@1.7.1
  - @scow/ai-scheduler-adapter-protos@1.1.1
  - @scow/lib-web@1.4.13
  - @scow/protos@1.0.24
  - @scow/lib-auth@1.0.3
  - @scow/lib-operation-log@2.1.18
  - @scow/lib-scow-resource@0.2.7
  - @scow/lib-server@1.3.13
  - @scow/lib-scowd@1.1.7
  - @scow/rich-error-model@2.0.1
  - @scow/lib-scheduler-adapter@1.1.22

## 0.3.3

### Patch Changes

- cd936f7: 新建镜像选择远程镜像时增加集群参数
- 50acbfc: AI 添加远程镜像时支持输入用户名密码
- Updated dependencies [d029383]
  - @scow/lib-web@1.4.12

## 0.3.2

### Patch Changes

- 11f6329: 修复“同时添加多个挂载点，即使填上了挂载点的值后依然报字段验证错误”的问题
- b8df1cb: ai 支持添加多个算法数据集模型
- de86c6e: 新增 HPC 交互式应用中对保留配置项的自定义配置功能，同时新增 HTML 表单的文件路径配置功能
  在 HPC 中新增加强版文件选择组件，包括文件解压缩功能
  修复 AI 中文件解压缩的错误提示及路径刷新等问题
- d2bbecd: 修复门户系统点击工作目录跳转时会返回家目录的问题
  删除 HPC 和 AI 文件管理部分的前进回退按钮
- b035b47: select 选项选择的 customField 的值不会被 escape
- fa51159: 提交任务时长限制增加小时天单位
- Updated dependencies [80bee99]
- Updated dependencies [de86c6e]
- Updated dependencies [de86c6e]
- Updated dependencies [ed505ba]
- Updated dependencies [28acbf5]
- Updated dependencies [40b9478]
- Updated dependencies [67c32a5]
  - @scow/config@1.7.0
  - @scow/lib-operation-log@2.1.17
  - @scow/lib-ssh@1.0.5
  - @scow/lib-scow-resource@0.2.6
  - @scow/protos@1.0.23
  - @scow/lib-server@1.3.12
  - @scow/lib-web@1.4.11
  - @scow/rich-error-model@2.0.1
  - @scow/lib-scheduler-adapter@1.1.21

## 0.3.1

### Patch Changes

- 4cd4324: AI 创建应用、训练、推理时镜像选择逻辑优化
- 37f02be: AI 的交互式应用和 ws 代理部分加入代理网关节点相关逻辑
- 9ee3585: 修复作业会同时出现在未结束和已结束作业的问题
- 0deefeb: 修复 AI 中若选择的公共镜像，再次提交作业后镜像没法正常展示
- Updated dependencies [9cd4758]
- Updated dependencies [d3c4b57]
- Updated dependencies [1730b01]
- Updated dependencies [916aebc]
  - @scow/lib-config@1.0.2
  - @scow/lib-web@1.4.10
  - @scow/lib-auth@1.0.2
  - @scow/lib-operation-log@2.1.16
  - @scow/config@1.6.4
  - @scow/protos@1.0.22
  - @scow/lib-scow-resource@0.2.5
  - @scow/lib-server@1.3.11
  - @scow/rich-error-model@2.0.1
  - @scow/lib-scheduler-adapter@1.1.20

## 0.3.0

### Minor Changes

- 00b83a0: 增加推理功能

### Patch Changes

- a29b2b4: AI 提交训练和应用，勾选算法/数据集/模型后需变为必填项
- 78beaac: 删除同名同 tag 镜像后的再次创建提交作业的镜像缓存问题
- 85d742e: 修复 AI 在分享时，若（算法模型数据集）名称或者版本名称带有空格，则里面的内容不会复制过来
- b72e60b: AI 训练和应用提交优化:选择 数据集、模型、算法和镜像的时候提供搜索功能
- afaec8b: AI 添加文件编辑功能
- 7f3d255: 修复 AI 调用 mis-server 时携带 Scow API token 加强安全认证
- Updated dependencies [bfad31b]
- Updated dependencies [00b83a0]
- Updated dependencies [afaec8b]
  - @scow/lib-scow-resource@0.2.4
  - @scow/lib-server@1.3.10
  - @scow/lib-operation-log@2.1.15
  - @scow/config@1.6.3
  - @scow/lib-web@1.4.9
  - @scow/protos@1.0.21
  - @scow/rich-error-model@2.0.1
  - @scow/lib-scheduler-adapter@1.1.19

## 0.2.13

### Patch Changes

- 1ae20a2: 删除 ai 文件管理在终端中打开按钮
- e124465: 优化 listAppsessions，防止某个作业有问题导致整个作业列表显示不出来
- df930f7: 限制 ai 作业名长度和若长度超了截断
- 1c7fc04: 1.复制公共算法/数据集时，若重复复制到同一个文件夹，报错信息有误 2.公共数据集存在空白栏 3.公共镜像复制到本地后，集群为空
- 78cb011: 区分我的和公共的算法数据集模型
- 3d729a5: 修复镜像、数据集模型算法 id 可以是别人没分享出来的
- cd75359: 用户修改自身密码和邮箱增加操作日志
- Updated dependencies [cd75359]
  - @scow/lib-operation-log@2.1.14
  - @scow/protos@1.0.20
  - @scow/rich-error-model@2.0.1
  - @scow/lib-scheduler-adapter@1.1.18
  - @scow/lib-server@1.3.9
  - @scow/lib-web@1.4.8

## 0.2.12

### Patch Changes

- 7363662: 增加 ai 仪表盘
- b3f2c15: AI 增加国际化
- ca98dac: 在 SCOW 的 light mode 和 dark mode 下，可以选择两种不同的主题色
- 0a670dc: 不能讲软链接作为挂载点，前端可以直接选择用户家目录作为挂载点
- 35f48a8: AI 训练界面优化：如果选择了镜像|算法|模型|数据，展示相关描述信息
- Updated dependencies [1adb22b]
- Updated dependencies [0a670dc]
- Updated dependencies [46dfcf9]
- Updated dependencies [249d35d]
- Updated dependencies [c641401]
- Updated dependencies [ca98dac]
- Updated dependencies [7363662]
  - @scow/lib-web@1.4.7
  - @scow/lib-ssh@1.0.4
  - @scow/lib-operation-log@2.1.13
  - @scow/config@1.6.2
  - @scow/ai-scheduler-adapter-protos@1.1.0
  - @scow/protos@1.0.19
  - @scow/lib-scow-resource@0.2.3
  - @scow/lib-server@1.3.8
  - @scow/rich-error-model@2.0.1
  - @scow/lib-scheduler-adapter@1.1.17

## 0.2.11

### Patch Changes

- Updated dependencies [b0a38e0]
  - @scow/lib-operation-log@2.1.12
  - @scow/rich-error-model@2.0.1
  - @scow/lib-scheduler-adapter@1.1.16
  - @scow/lib-server@1.3.7
  - @scow/lib-web@1.4.6

## 0.2.10

### Patch Changes

- 87ff0e7: 修改 HPC 和 AI 的作业和应用的默认工作目录命名规则
- 1a531ed: 已部署管理系统与资源管理系统的情况下，可以对 AI 集群的集群信息进行授权
- 56e0152: 更新 @grpc/grpc-js 到 1.12.2
- f75af4b: hpc 应用作业列表和 AI 的作业列表修改作业名获取方式
- 56e0152: scow 和 适配器交互添加双向 tls 校验
- Updated dependencies [aeac587]
- Updated dependencies [1a531ed]
- Updated dependencies [56e0152]
- Updated dependencies [56e0152]
  - @scow/config@1.6.1
  - @scow/ai-scheduler-adapter-protos@1.0.1
  - @scow/lib-scheduler-adapter@1.1.15
  - @scow/rich-error-model@2.0.1
  - @scow/lib-operation-log@2.1.11
  - @scow/lib-scow-resource@0.2.2
  - @scow/lib-server@1.3.6
  - @scow/lib-web@1.4.5

## 0.2.9

### Patch Changes

- bec8a37: ai 增加公共只读挂载点
- 9880cd0: 去掉 HPC 和 AI 的提交应用和训练的检查重名
- a021f77: 训练选择挂载点提示字段验证错误
- c587554: ai 运行中的作业保存镜像改成异步
- Updated dependencies [bec8a37]
- Updated dependencies [9880cd0]
- Updated dependencies [6c6f8c6]
- Updated dependencies [a7e7585]
- Updated dependencies [6c6f8c6]
- Updated dependencies [701ebc7]
- Updated dependencies [aa94edc]
  - @scow/config@1.6.0
  - @scow/lib-server@1.3.5
  - @scow/lib-operation-log@2.1.10
  - @scow/lib-auth@1.0.1
  - @scow/lib-web@1.4.4
  - @scow/rich-error-model@2.0.0

## 0.2.8

### Patch Changes

- Updated dependencies [a16b1e1]
- Updated dependencies [721b227]
- Updated dependencies [9895952]
- Updated dependencies [0f02d9d]
- Updated dependencies [5746037]
  - @scow/lib-server@1.3.4
  - @scow/lib-operation-log@2.1.9
  - @scow/config@1.5.3
  - @scow/lib-web@1.4.3
  - @scow/rich-error-model@2.0.0

## 0.2.7

### Patch Changes

- Updated dependencies [d32b7f6]
  - @scow/lib-server@1.3.3
  - @scow/lib-ssh@1.0.3

## 0.2.6

### Patch Changes

- 5ba5ebb: 修复 AI 应用的工作目录和挂载点重复时报错
- e776999: ai 和 hpc 在提交作业和应用前检查一下是否重名
- 3d36aa0: TensorFlow 增加 psNode 和 workerNode 参数
- Updated dependencies [eec12d8]
- Updated dependencies [b2ee159]
- Updated dependencies [d3de802]
- Updated dependencies [acb1992]
- Updated dependencies [15a7bdd]
- Updated dependencies [abd69cb]
- Updated dependencies [83df60b]
  - @scow/lib-web@1.4.2
  - @scow/lib-operation-log@2.1.8
  - @scow/lib-server@1.3.2
  - @scow/config@1.5.2
  - @scow/rich-error-model@2.0.0

## 0.2.5

### Patch Changes

- fcc8c2b: ai 的数据库密码先从 install.yaml 中读取，若没配再从 ai 的 config 中读取
- 753a996: AI 增加多机多卡分布式训练和对华为 GPU 的特殊处理
- be429fc: ai 加上国际化的 Provider
- ca9bf27: 兼容低版本 chrome 浏览器，兼容 360 极速浏览器
- e9c8bfa: 增加 ai 的操作日志，涉及文件、镜像、数据集、算法、模型和作业应用'
- Updated dependencies [0275a9e]
- Updated dependencies [c61348a]
- Updated dependencies [753a996]
- Updated dependencies [57a91f6]
- Updated dependencies [a9e9011]
- Updated dependencies [66f3c0e]
- Updated dependencies [1a096de]
- Updated dependencies [5159efd]
- Updated dependencies [259f247]
- Updated dependencies [0eb668d]
- Updated dependencies [e9c8bfa]
- Updated dependencies [f14bf6c]
  - @scow/config@1.5.1
  - @scow/lib-ssh@1.0.2
  - @scow/lib-web@1.4.1
  - @scow/utils@1.1.1
  - @scow/lib-server@1.3.1
  - @scow/lib-operation-log@2.1.7
  - @scow/rich-error-model@2.0.0

## 0.2.4

### Patch Changes

- be61c74: 所有 Input.group compact 组件替换成 Space.Compact

## 0.2.3

### Patch Changes

- b8d1270: 同步操作日志服务中的日志类型，增加启用集群，停用集群
- Updated dependencies [b8d1270]
- Updated dependencies [b8d1270]
- Updated dependencies [806f778]
  - @scow/config@1.5.0
  - @scow/lib-server@1.3.0
  - @scow/lib-web@1.4.0
  - @scow/lib-operation-log@2.1.6
  - @scow/rich-error-model@2.0.0
  - @scow/lib-scheduler-adapter@1.1.10

## 0.2.2

### Patch Changes

- f534377: 增加了 mis portal 中表格排序的功能，以及部分 UI 的修改
- 7bcf3bb: AI 新增再次提交作业功能
- 0957f1a: 修改多平台镜像由于只在 nerdclt push 命令下指定 --all-platforms 导致其他平台层数据缺失无法推送的问题
- d080a8b: 增加 ai 系统下个人信息中修改密码的后端校验
- 6304074: 提交作业时，新增保留作业脚本的选项
- 44c8d67: 修改 copy 命令
- ad1a565: 数据集、算法、模型的分享去掉源文件地址参数；复制命令换用处理过的命令
- Updated dependencies [d080a8b]
- Updated dependencies [f534377]
  - @scow/config@1.4.5
  - @scow/lib-web@1.3.3
  - @scow/lib-operation-log@2.1.5
  - @scow/lib-server@1.2.2
  - @scow/rich-error-model@2.0.0
  - @scow/lib-scheduler-adapter@1.1.9

## 0.2.1

### Patch Changes

- 55a619e: 修复 更新算法和模型时查找已存在实体逻辑错误的问题
- c178b72: xterm npm 包更名
- 01bd823: 修复 trpc openapi 将 boolean params 全部转为 string 的问题
- e312efb: AI 模块支持创建 vnc 类型应用
- a737493: jupyter 启动命令参数 PasswordIdentityProvider.hashed_password 改为 ServerApp.password
- e312efb: ai 增加 vnc 功能，以 shell 方式进入容器功能和提交作业的优化
- a4d36e2: 启用 serverMinification，只关闭 name mangling
- 37fdf7e: 修改了 portal 中的部分 UI 样式,bannerTop 导航文字
- e312efb: ai 新增以 shell 的方式进入容器的功能
- Updated dependencies [94aa24c]
- Updated dependencies [e312efb]
- Updated dependencies [e312efb]
- Updated dependencies [640a599]
  - @scow/config@1.4.4
  - @scow/lib-web@1.3.2
  - @scow/scheduler-adapter-protos@1.3.1
  - @scow/lib-operation-log@2.1.4
  - @scow/lib-server@1.2.1
  - @scow/lib-scheduler-adapter@1.1.8
  - @scow/rich-error-model@2.0.0

## 0.2.0

### Minor Changes

- 63d1873: 账户新增封锁阈值，租户新增默认账户默认阈值以

### Patch Changes

- 3c5c8a6: 修复大镜像在 Containerd 运行时推送失败的问题
- a097dd1: 新增无账户关系的用户修改所属租户且可以作为新增租户的管理员功能
- 4e14446: 修复集群 partitions 为空时，页面崩溃的问题以及拼写错误
- 01cfdae: 修改对于 ssh 命令执行错误的判断
- 02d6a18: 新增集群区分 AI 功能和 HPC 功能配置
- b8d7684: 修复 ai 中创建或复制文件数据检查源文件时，后台没有打印日志的问题
- 24db413: 操作日志增加自定义操作类型
- d822db7: ai 系统新增支持 k8s 集群的 containerd 运行时
- 6d4b22c: AI 系统创建应用和训练页面 UI 交互优化
- 0f5d48f: 修复 AI 训练 coreCount 在 gpu 下传参错误问题
- Updated dependencies [02d6a18]
- Updated dependencies [146e19f]
- Updated dependencies [63d1873]
- Updated dependencies [24db413]
- Updated dependencies [d822db7]
- Updated dependencies [850a7ee]
  - @scow/config@1.4.3
  - @scow/lib-web@1.3.1
  - @scow/lib-server@1.2.0
  - @scow/lib-operation-log@2.1.3
  - @scow/rich-error-model@2.0.0
  - @scow/lib-scheduler-adapter@1.1.7

## 0.1.1

### Patch Changes

- 3242957: 修复创建失败的镜像无法删除的问题
- 8cba2eb: 修复修改模型版本时校验名称重复错误问题
- Updated dependencies [443187e]
- Updated dependencies [3242957]
- Updated dependencies [850bbcd]
  - @scow/lib-server@1.1.5
  - @scow/config@1.4.2
  - @scow/lib-operation-log@2.1.2
  - @scow/lib-web@1.3.0
  - @scow/rich-error-model@2.0.0
  - @scow/lib-scheduler-adapter@1.1.6
