# @scow/ai

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
