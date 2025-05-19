# @scow/ai

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
