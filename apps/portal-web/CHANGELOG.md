# @scow/portal-web

## 1.6.4

### Patch Changes

- a47aa76: 增加获取交互式应用和作业模版 JSON.parse 错误的处理
- 92dd666: 修改了门户系统仪表盘表格中进度条的对齐方式、新增组件 CustomProgress。
- 213c7f2: 修复了当 getClusterNodesInfo 接口不存在时，进度条为 NaN 的情况。
- 7c96613: 修改更名后的链接地址和文档描述
- Updated dependencies [7c96613]
  - @scow/rich-error-model@2.0.1
  - @scow/lib-operation-log@2.1.9
  - @scow/lib-config@1.0.2
  - @scow/lib-decimal@1.0.1
  - @scow/config@1.5.3
  - @scow/utils@1.1.2
  - @scow/lib-auth@1.0.1
  - @scow/lib-ssh@1.0.3
  - @scow/lib-web@1.4.3
  - @scow/protos@1.0.15

## 1.6.3

### Patch Changes

- e776999: ai 和 hpc 在提交作业和应用前检查一下是否重名
- abd69cb: 接入 scowd 文件分片上传
- Updated dependencies [eec12d8]
- Updated dependencies [b2ee159]
- Updated dependencies [d3de802]
- Updated dependencies [acb1992]
- Updated dependencies [15a7bdd]
- Updated dependencies [abd69cb]
- Updated dependencies [83df60b]
  - @scow/lib-web@1.4.2
  - @scow/lib-operation-log@2.1.8
  - @scow/config@1.5.2
  - @scow/protos@1.0.14
  - @scow/rich-error-model@2.0.0

## 1.6.2

### Patch Changes

- c61348a: 右上角 nav 在生成 portal 及 mis 的 a 标签时不添加 base path
- f609a5c: 修复 mis 跳转 portal 失败的问题
- 1a096de: 修复门户系统集群登录节点只配置地址时路由渲染失败的问题，在集群配置接口返回中加入 scowd 配置信息
- 66a96ba: 修复了门户系统中节点在不同集群中重复计数的问题
- ca9bf27: 兼容低版本 chrome 浏览器，兼容 360 极速浏览器
- e9c8bfa: 增加 ai 的操作日志，涉及文件、镜像、数据集、算法、模型和作业应用'
- f14bf6c: UI 扩展增加导航栏链接自定义
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
  - @scow/lib-operation-log@2.1.7
  - @scow/protos@1.0.13
  - @scow/rich-error-model@2.0.0

## 1.6.1

### Patch Changes

- a047082: 调整门户快捷入口文字过多时图标高度不一致的问题；略微了门户系统 header 图标的样式；取消了门户系统表格默认选中的状态
- be61c74: 所有 Input.group compact 组件替换成 Space.Compact
- 4dfd5df: 修复了门户表格显示不正确的问题

## 1.6.0

### Minor Changes

- b8d1270: 在管理系统和门户系统中增加依赖于管理系统的集群停用功能
  **注意：停用后集群将不可用，集群所有数据不再更新。再启用后请手动同步平台数据！**

### Patch Changes

- fec0a57: 修复了本地开发环境出现 Hydration 报错的问题
- f21f3e0: 修改了 portal 部分 UI 的样式
- eacda16: 修复集群未停用但数据无法获取时的仪表盘页面显示
- 5a707df: 修复门户系统桌面功能页面 token 过期不能跳转登录页面的问题, 修改获取集群数据 token 验证失败时的返回
- 0a43348: 修改门户系统下提交作业或交互式应用时可以选择的账号为用户维度未封锁账号，分区为该用户在该集群下对应账号的可用分区；修改从模板提交作业时模板值可以直接提交
- 383a8bd: 添加 web shell 文件上传功能
- 9709d45: 修复选择模板来提交作业时没有获取到正确的模板数据的问题
- 3558bd4: 提交作业保存作业模板时最长运行时间的单位也保存入模板中
- 49b31cf: 修改了门户系统下仪表盘的样式和交互逻辑
- a0e9199: 修正了门户系统 GPU 显示不正确的问题，修复了门户系统图标大小不一样的问题
- Updated dependencies [b8d1270]
- Updated dependencies [b8d1270]
- Updated dependencies [806f778]
  - @scow/config@1.5.0
  - @scow/lib-web@1.4.0
  - @scow/lib-operation-log@2.1.6
  - @scow/protos@1.0.12
  - @scow/rich-error-model@2.0.0

## 1.5.2

### Patch Changes

- f534377: 增加了 mis portal 中表格排序的功能，以及部分 UI 的修改
- 6304074: 提交作业时，新增保留作业脚本的选项
- Updated dependencies [d080a8b]
- Updated dependencies [f534377]
  - @scow/config@1.4.5
  - @scow/lib-web@1.3.3
  - @scow/lib-operation-log@2.1.5
  - @scow/protos@1.0.11
  - @scow/rich-error-model@2.0.0

## 1.5.1

### Patch Changes

- 94aa24c: 支持同时配置多个 UI 扩展。UI 扩展的实现有破坏性变更，请参考文档。
- c178b72: xterm npm 包更名
- 37fdf7e: 修改了 portal 中的部分 UI 样式,bannerTop 导航文字
- 5c34421: 优化集群适配器访问异常时的页面错误信息展示
- Updated dependencies [94aa24c]
- Updated dependencies [e312efb]
- Updated dependencies [e312efb]
- Updated dependencies [640a599]
  - @scow/config@1.4.4
  - @scow/lib-web@1.3.2
  - @scow/lib-operation-log@2.1.4
  - @scow/protos@1.0.10
  - @scow/rich-error-model@2.0.0

## 1.5.0

### Minor Changes

- 63d1873: 账户新增封锁阈值，租户新增默认账户默认阈值以

### Patch Changes

- 10956eb: 修复 token 失效后切换系统不跳转回登录页面的问题
- a097dd1: 新增无账户关系的用户修改所属租户且可以作为新增租户的管理员功能
- 0ad604c: 仪表盘 cpu 和 gpu 利用率百分比显示错误
- 02d6a18: 新增集群区分 AI 功能和 HPC 功能配置
- 24db413: 操作日志增加自定义操作类型
- 79d19be: 改进门户快捷方式的 UI
- 25f9caf: 修复文件管理下在终端中打开连接失败及终端不显示登录节点名称的问题
- bc743ad: 修复快捷方式的 icon 显示大小问题
- d3d891a: 操作日志详细内容展示优化
- 1e25062: 改进门户系统仪表盘各个模块的背景设计
- Updated dependencies [02d6a18]
- Updated dependencies [146e19f]
- Updated dependencies [24db413]
- Updated dependencies [d822db7]
- Updated dependencies [850a7ee]
  - @scow/config@1.4.3
  - @scow/lib-web@1.3.1
  - @scow/lib-operation-log@2.1.3
  - @scow/protos@1.0.9
  - @scow/rich-error-model@2.0.0

## 1.4.3

### Patch Changes

- 08359cb: 使用外部认证系统时，外部系统未实现的功能在用户使用时提示用户功能未实现
- 410fb0e: 修复只需在文件传输时使用 touch -a 来更新时间戳，修复 touch -a 执行时 ssh 关闭报错，文件名特殊字符报错等问题
- 2f687c5: 仪表盘返回的监控数据替换 clusterId
- 48844dc: Web Shell 支持跳转到文件编辑页面
- Updated dependencies [3242957]
  - @scow/config@1.4.2
  - @scow/protos@1.0.8
  - @scow/lib-operation-log@2.1.2
  - @scow/lib-web@1.3.0
  - @scow/rich-error-model@2.0.0

## 1.4.2

## 1.4.1

### Patch Changes

- a41c45b: 修复文件管理列表连续双击文件名导致进入错误目录的问题
- f126469: 仪表盘处集群无法获取运行时不报 500 的错误提示和快捷方式跳转去掉 basePath
- Updated dependencies [afc3350]
- Updated dependencies [8d417ba]
- Updated dependencies [68447f7]
  - @scow/lib-config@1.0.1
  - @scow/config@1.4.1
  - @scow/lib-operation-log@2.1.1
  - @scow/lib-web@1.3.0
  - @scow/protos@1.0.7
  - @scow/rich-error-model@2.0.0

## 1.4.0

### Minor Changes

- 081fbcf: 管理系统新增用户列表，账户列表，消费记录，充值记录，操作记录的数据导出 csv 文件功能
- cb055c4: 门户仪表盘新增快捷入口，可以新增、删除、拖拽排序快捷方式
- d1c2e74: UI 扩展

### Patch Changes

- 201a3e2: 修复部分集群无法获取集群运行信息时导致仪表板无法展示其他正常信息
- 3ef7762: 回退 codemirror 版本，解决提交作业界面崩溃问题
- 43c52ee: 优化文件编辑功能
- 26bd8e7: 优化文件系统直接提交脚本任务时如果没有在脚本内指定工作目录，使脚本文件所在的绝对路径作为作业工作目录，并在确认提交对话框中给出提示
- Updated dependencies [081fbcf]
- Updated dependencies [d1c2e74]
- Updated dependencies [abb7e84]
  - @scow/lib-operation-log@2.1.0
  - @scow/config@1.4.0
  - @scow/lib-web@1.3.0
  - @scow/protos@1.0.6
  - @scow/rich-error-model@2.0.0

## 1.3.0

### Minor Changes

- ec06733f9f: 门户仪表盘删除之前的配置标题和文字，增加平台队列状态展示

### Patch Changes

- 6a0c73a972: 修复用户删除无权限目录时导致的崩溃问题
- c18479df2c: 修复了仪表盘信息面板 title 过长时折行问题和调整响应式样式
- 1a0b45131c: 修改终端登录欢迎语过长会报错的提示
- Updated dependencies [ec06733f9f]
  - @scow/config@1.3.0
  - @scow/lib-operation-log@2.0.5
  - @scow/lib-web@1.2.3
  - @scow/protos@1.0.5
  - @scow/rich-error-model@2.0.0

## 1.2.3

### Patch Changes

- cad49a87d8: 修复 callbackUrl 固定为 http 的问题
- 9a47c21397: 修复文件管理跳转路径导致的控制台报错
- Updated dependencies [cad49a87d8]
  - @scow/config@1.2.1
  - @scow/lib-web@1.2.3
  - @scow/lib-operation-log@2.0.4
  - @scow/protos@1.0.4
  - @scow/rich-error-model@2.0.0

## 1.2.2

### Patch Changes

- ce31a2c583: 修复文件编辑保存未携带路径的问题
- d383f8fa94: 更新至 next 14
- 3493cd9c8f: 修复/api/proxy 路径 websocket 无法建立连接问题
- Updated dependencies [d383f8fa94]
  - @scow/lib-web@1.2.2
  - @scow/protos@1.0.3
  - @scow/lib-operation-log@2.0.3
  - @scow/rich-error-model@2.0.0

## 1.2.1

### Patch Changes

- 1c10da55e5: 跨集群文件管理新增显示隐藏隐藏文件
- 04e5d68aae: 修复文件编辑器配置加载路径缺少斜杠的问题
- Updated dependencies [b84e4f9cc4]
  - @scow/lib-web@1.2.1

## 1.2.0

### Minor Changes

- 135f2b1be3: 在门户系统的文件管理下，新增将文件直接作为作业文本提交调度器执行的功能，如果调度器 API 版本低于此接口版本报错
- 5d2b75ccec: 增加用户指定系统语言功能，可以指定系统唯一语言不再进行语言切换，也可以指定进入 SCOW 时的默认初始语言
- f577d9d1e4: 门户系统文件管理新增文件编辑功能

### Patch Changes

- 62c7f32eb3: 优化 web 端 table，调整列的宽度以百分比固定，使其在大屏/小屏下展示更友好
- a3d2f44af6: 门户及管理系统所有显示集群的地方按照集群中配置的优先级进行排序
- a79aa109bb: sshConnect 时，提示语过长会使得连接失败，现在捕获了这个错误并提示用户
- 3bb178aebd: 修改页面表格默认显示数量为 50
- Updated dependencies [a3d2f44af6]
- Updated dependencies [f42488eb9e]
- Updated dependencies [5d2b75ccec]
- Updated dependencies [a79aa109bb]
- Updated dependencies [135f2b1be3]
- Updated dependencies [5d2b75ccec]
- Updated dependencies [f577d9d1e4]
  - @scow/config@1.2.0
  - @scow/lib-ssh@1.0.1
  - @scow/utils@1.1.0
  - @scow/lib-web@1.2.0
  - @scow/protos@1.0.2
  - @scow/lib-operation-log@2.0.2
  - @scow/rich-error-model@2.0.0

## 1.1.0

### Minor Changes

- b7f01512eb: 实现了跨集群传输模块
- ccbde14304: 实现 SCOW 门户系统与管理系统的页面国际化功能
- b33a2bd6bc: 在 ui.yaml 下的 footer 增加 hostnameMap，其作用与 hostnameTextMap 一致，根据不同 hostname 展示不同的 footer 文本

### Patch Changes

- 639b77a103: 修复了一些因国际化英文 label 太长被输入框遮挡；修复了登录页的验证码 placeholder 太长和文字超出屏幕的问题。
- 5a9bda6f4a: 对提交作业和应用的作业名，创建用户时的姓名、创建租户时租户名、充值时的类型、备注输入做长度控制，避免用户输入过长
- 8fc4c21f07: 在{app}.yaml 中增加对交互式应用说明的配置项
- 1bb1e07f1b: 修复一些 ESLINT 规则检查时的警告
- 29e4b1880a: 将 web 获取的 hostname 由 host 变为 hostname，不带 port
- ee48e8c2da: 修改交互式应用列表作业在 PENDING 状态时不显示剩余时间
- 5bb922fe99: 修改门户系统连接 shell 时 url 只显示登录节点的 address
- 4fb0881e89: 优化了 web 页面部分 table 超长连续字段（长数字和长单词）破坏表格布局的问题
- 51903e0732: 登录操作判断由 referer 改为 queryString 传 fromAuth 参数
- ee0545adf3: 修复文件大小上传限制只考虑单位为 G 的问题
- fdff28b2ef: 修改了国际化的中文显示差异，中文符号的全角，补充了部分漏项
- Updated dependencies [b33a2bd6bc]
- Updated dependencies [b7f01512eb]
- Updated dependencies [29e4b1880a]
- Updated dependencies [5bb922fe99]
- Updated dependencies [ccbde14304]
- Updated dependencies [6bf6a6e726]
- Updated dependencies [50d34d6ae3]
- Updated dependencies [29e4b1880a]
- Updated dependencies [ccbde14304]
- Updated dependencies [8fc4c21f07]
- Updated dependencies [4fb0881e89]
  - @scow/config@1.1.0
  - @scow/lib-web@1.1.0
  - @scow/lib-operation-log@2.0.1
  - @scow/protos@1.0.1
  - @scow/rich-error-model@2.0.0

## 1.0.0

### Major Changes

- 11f94f716: 发布 1.0

### Minor Changes

- ee89b11b9: 新增审计系统服务，记录门户系统及管理系统操作日志及展示

### Patch Changes

- d96e8ad91: auth 登录跳转回 web 页面时，判断 referer 是否包含 AUTH_EXTERNAL_URL + '/public/auth'以区分用户登录操作和切换门户/管理系统
- 3610e95da: portal-web 和 mis-web 的个人信息页面调整
- 945bbb5ec: 作业详情数据添加单位
- 0fbba98dd: 用户、账户、作业称呼统一
- 154f5a84a: 去掉 legacyBehavior，会影响 target=\_blank 在新窗口或标签中打开链接的效果
- Updated dependencies [cb1e3500d]
- Updated dependencies [ee89b11b9]
- Updated dependencies [ee89b11b9]
- Updated dependencies [946b1782a]
- Updated dependencies [a8034f395]
- Updated dependencies [cb1e3500d]
- Updated dependencies [11f94f716]
  - @scow/lib-web@1.0.0
  - @scow/config@1.0.0
  - @scow/lib-operation-log@2.0.0
  - @scow/protos@1.0.0
  - @scow/lib-auth@1.0.0
  - @scow/lib-decimal@1.0.0
  - @scow/lib-config@1.0.0
  - @scow/rich-error-model@2.0.0
  - @scow/lib-ssh@1.0.0
  - @scow/utils@1.0.0

## 0.9.0

### Minor Changes

- b96e5c4b2: 支持在导航栏右侧的用户下拉菜单中增加自定义链接
- 113e1e4ea: 管理系统中，租户/平台管理员修改自己管理的用户密码时无需原密码

### Patch Changes

- 31dc79055: 增加是否打开新的页面配置项，默认为 false,所有导航点击时不打开新的页面；修改一级导航 url 配置项为可选，没有配置时 则默认跳转次级第一个导航的 url
- 6f278a7b9: 门户系统桌面页面新增桌面信息，包括桌面名，桌面类型，创建时间。
- 9edc86930: 解决使用 crane 提交交互式应用任务失败提示信息不完全
- b76c4a122: 前端展示获取账户信息失败时后端返回的错误信息
- c09807f02: 修复文件管理无法打开终端的问题
- 143c9732e: 之前：退出登录或登陆过期时跳转到需要登录页面，现在：直接跳转到登录页面
- 6522b47cf: 修改作业时限优化，将增加减少时限改为直接设置作业时限，并且检查是否大于作业的运行时间
- 8dcfc3f1a: 增加作业列表中 GPU 卡数的展示
- 67911fd92: 交互式应用增加计算分区和软件应用版本的联动选择
- 1407743ad: 增加提交作业的命令框中的提示语句可配置
- 59cb5a418: 作业模版增加删除、重命名功能
- b79019ce1: 修复 storage 设置了默认集群但默认集群在 scow 上不存在导致网站无法加载的问题
- 638c18b29: 修改创建交互式应用页面应用图标展示形状为方形展示
- 9f70e2121: 门户系统去除默认集群选择功能，新增集群选择排序以及记录上次选择集群功能
- Updated dependencies [75951b5bb]
- Updated dependencies [67911fd92]
- Updated dependencies [113e1e4ea]
- Updated dependencies [1c74443b6]
- Updated dependencies [b96e5c4b2]
- Updated dependencies [d49a34986]
- Updated dependencies [31dc79055]
- Updated dependencies [572530a01]
- Updated dependencies [9f70e2121]
- Updated dependencies [6f278a7b9]
- Updated dependencies [6522b47cf]
- Updated dependencies [1407743ad]
- Updated dependencies [53e596584]
- Updated dependencies [f3dd67ecb]
- Updated dependencies [9f70e2121]
  - @scow/lib-web@0.4.0
  - @scow/config@0.5.0
  - @scow/lib-auth@0.3.0
  - @scow/protos@0.3.1
  - @scow/rich-error-model@1.0.1

## 0.8.1

### Patch Changes

- a978233fe: 修复 antd 主题没有应用完全的问题
- Updated dependencies [a978233fe]
  - @scow/lib-web@0.3.5

## 0.8.0

### Minor Changes

- 5b7f0e88f: 重构 scow，对接调度器适配器接口
- 5c3c63657: 实现登录节点桌面功能以及 TurboVNC 的安装路径在每个集群中单独配置

### Patch Changes

- fbb79be5e: 修改交互式应用上一次提交信息中的配置 HTML 表单中的 NUMBER 类型的值，直接提交校验不通过问题
- 1d683f5bb: 修复上传重复文件点击取消后仍然显示在上传列表中的问题
- 5c764a826: 通过代理网关节点解析主机名连接交互式应用，以及刷新 vnc 密码
- 4ad46057e: 修改交互式脚本执行 scirpt.sh 和 xstartup 问题，增加#!/bin/bash -l，增加 script.sh 可执行权限
- f1526d12f: 修复 shell 输入 sopen 跳转失败
- 26d543108: 修改门户系统上传文件限制，之前是文件大小没有限制，现在使用配置文件里的大小限制
- e78e56619: 利用 grpc rich-error-model 重构创建交互式应用错误处理，并添加错误信息展示窗口
- 99e2b08e1: 交互式应用提交作业页面，增加选择 GPU 及节点数的选项
- 62083044e: 实现各交互式应用在每个集群中单独配置，增加创建集群应用页面，增加创建时填写应用名和按应用名搜索已创建应用功能
- a2ec77f46: 修复单节点 CPU 核心数以及 GPU 卡数显示为总数的 bug
- e97eb22fd: 集群配置登录节点新增节点展示名
- 7a9973aa0: 修改 HTTP API 定义方式，去除生成 api-routes-schemas.json 步骤
- 6853606f8: 门户系统 shell 和桌面功能允许用户选择登录节点
- Updated dependencies [5b7f0e88f]
- Updated dependencies [62083044e]
- Updated dependencies [7d47155d9]
- Updated dependencies [a90e34b30]
- Updated dependencies [5c3c63657]
- Updated dependencies [e97eb22fd]
- Updated dependencies [ca6205f4e]
  - @scow/protos@0.3.0
  - @scow/config@0.4.0
  - @scow/lib-ssh@0.4.0
  - @scow/rich-error-model@1.0.1
  - @scow/lib-web@0.3.4

## 0.7.0

### Patch Changes

- 1aad4a345: 去掉 web 端多余的逗号
- 5b8b8be2c: 修复 dev container 和本地 vagrant 开发模式下集群配置不一致问题
- 09bcc565b: 交互式应用已创建的应用列表新增状态过滤，默认展示运行中应用
- 31198304c: portal-web 使用 custom server 注册 upgrade 事件，更新 next.js 至最新并恢复日常更新
- f74d6c6e1: 修复文件列表文件标题不可点击问题
- e011f42ff: 门户和管理系统添加 footer 展示 SCOW 版本和 github 跳转链接
- 8cf189cd2: 修改了 config 中 ENABLE_CHANGE_PASSWORD 与 authSupportsCreateUser 的类型属性可以为 Undefined
- 31b1662df: 修改 formatSize 公共函数传参单位统一问题
- 932c01255: portal-web 交互式应用列表状态筛选改为勾选只展示未结束的作业
- 27d346fd8: 修复 portal-web 项目 API 路径没有正确添加 base path 的问题
- a07fed634: 文件选择器及提交作业允许选择任意目录
- 4e304b61e: 提交作业选择文件目录后，工作目录不随作业名改变
- 81895f4be: mis.yaml 和 portal.yaml 中支持增加导航链接
- Updated dependencies [31198304c]
- Updated dependencies [e011f42ff]
- Updated dependencies [0f64e5404]
- Updated dependencies [4bfd80986]
- Updated dependencies [81895f4be]
- Updated dependencies [81895f4be]
  - @scow/lib-web@0.3.3
  - @scow/config@0.3.1
  - @scow/lib-auth@0.2.1
  - @scow/protos@0.2.3

## 0.6.0

### Patch Changes

- dc51bfde6: 浏览器关闭后，用户登录 cookie 失效
- 01e18fa28: 临时解决 Shell 和 VNC 类应用不可用的问题
- 7903c8cbd: 修复 app 自定义表单默认选项无法提交的问题
- 8b36bf0bc: 当交互式应用列表中存在内容时，刷新交互式应用列表不会使表格进入正在加载状态
- d2c8e765e: 优化创建交互式应用页面：在用户家目录下的 apps/app[Id]路径下存入上一次提交记录；创建了查找上一次提交记录的 API 接口，每次创建交互式应用时查找上一次提交记录，如果有则与当前集群下配置对比选择填入相应的值。
- 6021d29d7: 门户网站提交作业选择工作目录新增文件夹选择功能
- 020e7b8e0: 修改已创建的交互式应用页面刷新 checkbox 为居中显示
- 4ef4ddef6: 修复成功删除错误文件时的提醒
- 8b36bf0bc: 检查交互式应用是否可连接的逻辑移动到前端
- 0dcecf742: 提交作业页面显示优化：1.增加 integer 输入框的最大值输入限制及向下取整，并增加光标失焦后填写默认值最小值；2.修改内存显示；3.修改默认作业名显示；4.在 code-editor 中添加优先级提示语言的 placeholder。
- 7a64b72b0: 更新文件上传时文件列表中取消按钮的提示文本
- Updated dependencies [901ecdb7e]
- Updated dependencies [01e18fa28]
- Updated dependencies [d2c8e765e]
- Updated dependencies [ce077930a]
  - @scow/config@0.3.0
  - @scow/lib-web@0.3.2
  - @scow/lib-config@0.2.2
  - @scow/protos@0.2.2

## 0.5.0

### Minor Changes

- 2981664f4: 门户所有作业列增加开始、结束时间列，增加时间说明
- aa4d0ff1c: 为 PENDING 等需要显示作业未运行原因的状态的 APP，显示原因
- 7bd2578c4: SCOW API 增加静态 token 认证方法
- 88899d41f: 提交任务增加默认输出文件
- 1562ebbd2: 提交作业时增加 GPU 选项

### Patch Changes

- c50cb37d7: 修复使用模板时所有下拉列表项无法应用的问题
- 4dbb2028f: 修复 PENDING 状态的作业无法取消的问题
- fc36c57ca: 修复 web 项目第一次访问时页面布局混乱的问题
- a7fd75778: 修复文件管理界面，操作无权限文件/文件夹时页面的错误提示
- 8268e348e: 修改 DELETE 请求 body 为 query 使其合规
- 1c8d3e1c0: 提交作业时必须指定分区
- 02b5f6e22: 用户自定义表单默认选择第一项
- caefcddcd: 前端显示用户姓名时使用认证系统返回的用户姓名
- 3b0684b63: 文件管理页面新增按钮显示/不显示隐藏文件
- ce27d87ae: 文件管理页面排序优化，去除文件类型排序，默认文件名升序排序，文件和文件夹分开排序，其他属性排序一致时，按照名称排序
- e56b5c7db: Portal Web Shell 界面的标题显示集群 name
- 8de278c21: 文件管理系统下的文件夹不展示文件大小
- d6e06e841: 读取配置文件时允许传入 logger 对象
- 6a3bb43a8: portal web 文件管理页面展示文件大小按照单位展示最多三位有效数字，实际文件大小鼠标悬浮展示
- cb90eb64b: 门户支持配置代理网关节点
- Updated dependencies [c2a8ab7a5]
- Updated dependencies [5c066e4a5]
- Updated dependencies [bb9d9bb8b]
- Updated dependencies [215ac2fc7]
- Updated dependencies [fc36c57ca]
- Updated dependencies [7bd2578c4]
- Updated dependencies [ef8b7eee0]
- Updated dependencies [9cb6822e6]
- Updated dependencies [74d718ba1]
- Updated dependencies [caefcddcd]
- Updated dependencies [1562ebbd2]
- Updated dependencies [d6e06e841]
- Updated dependencies [cb90eb64b]
  - @scow/lib-auth@0.2.0
  - @scow/lib-ssh@0.3.0
  - @scow/lib-web@0.3.1
  - @scow/config@0.2.0
  - @scow/lib-config@0.2.1
  - @scow/protos@0.2.1

## 0.4.0

### Minor Changes

- 86e0f5b2d: 整个系统打包为一个镜像
- 882a247a1: 重构 app 的 sbatch options，gRPC 中与 custom_attributes 一起发送
- 523b4f8f2: 上传文件、请求最大体积限制可配置
- d4b0cde25: 创建 web 类交互式应用时由前端传入 base path，将节点名解析为 IP 地址的工作由 portal-server 完成
- 22a5bc3c2: 支持 shell 中跳转文件系统

### Patch Changes

- 944d56605: 修复文件管理界面打开终端问题
- bdc990a0c: 系统启动时，各个容器在日志中打印版本信息
- 419184a93: 修复 home 目录下创建文件夹失败的问题
- debcf7bc3: 从最终镜像中去除 next.js build cache，减小镜像大小
- 419184a93: 统一处理多个 sftp 操作命令报错
- ff7eec37e: 修复因 table 超出页面的问题，搜索模块、个人信息页面手机端样式兼容
- c860e7710: 禁止点击蒙层关闭上传文件对话框
- 1c8a948d8: 把代码中 SavedJobs 字样全部改为 JobTemplate
- Updated dependencies [bdc990a0c]
- Updated dependencies [86e0f5b2d]
- Updated dependencies [419184a93]
- Updated dependencies [ff7eec37e]
- Updated dependencies [8145061ba]
  - @scow/utils@0.1.2
  - @scow/lib-decimal@0.2.0
  - @scow/protos@0.2.0
  - @scow/lib-ssh@0.2.0
  - @scow/lib-web@0.3.0
  - @scow/lib-config@0.2.0
  - @scow/config@0.1.2

## 0.3.0

### Patch Changes

- @scow/protos@0.1.1

## 0.2.0

### Minor Changes

- 686054ac3: 增加 ListAvailableWms API
- c2a1dff41: 自定义 footer 和 portal 的 dashboard 文本支持 HTML 标签
- 5cd477d37: 门户系统修改 getAppAttributes API 为 getAppMetadata，从 portal-server 获取应用名称
- 5e4f6ac58: 支持动态设置 base path
- a9b64169c: 更新 LOGO、favicon、仪表盘图片的自定义方式

### Patch Changes

- 7d7bc0834: 修复 BASE_PATH 为/时，点击导航栏的 shell 跳转地址错误的问题
- b6347a367: 更新 next.js 版本并开启自动更新
- 9244b1079: 删除多余的 console.log
- 93eb54ea6: 修复图片没有正确加上 base path
- 6814c3427: 交互式应用的自定义表单可以配置提示信息等
- Updated dependencies [c2a1dff41]
- Updated dependencies [93eb54ea6]
- Updated dependencies [5e4f6ac58]
- Updated dependencies [a9b64169c]
- Updated dependencies [6814c3427]
- Updated dependencies [c24e21662]
  - @scow/lib-web@0.2.0
  - @scow/config@0.1.1
  - @scow/lib-config@0.1.1
  - @scow/lib-decimal@0.1.1
  - @scow/utils@0.1.1

## 0.1.2

## 0.1.1
