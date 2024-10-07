# @scow/mis-web

## 1.6.4

### Patch Changes

- 0fa5887: 设置封锁阈值界面优化
- 7c96613: 修改更名后的链接地址和文档描述
- Updated dependencies [7c96613]
  - @scow/rich-error-model@2.0.1
  - @scow/lib-operation-log@2.1.9
  - @scow/lib-config@1.0.2
  - @scow/lib-decimal@1.0.1
  - @scow/config@1.5.3
  - @scow/utils@1.1.2
  - @scow/lib-auth@1.0.1
  - @scow/lib-web@1.4.3
  - @scow/protos@1.0.15

## 1.6.3

### Patch Changes

- 6ab5659: 增加租户管理下的用户列表的关联账户跳转到账户管理的功能
- 83df60b: 增加配置消费记录精度，默认精度为 2 位小数；
  增加最小作业消费金额的功能，默认最小作业消费金额为 0.01；
  账户、租户的余额展示精度与消费记录精度一致；
  充值金额展示的小数位与消费记录的精度保持一致；
  充值时数值输入框精度与消费记录的精度保持一致。
- 1287509: 将操作日志、消费记录、结束作业的默认排序改为按照时间倒序。
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

- 0275a9e: 修复系统初始化时因无法通过鉴权可用集群为空的问题
- c61348a: 右上角 nav 在生成 portal 及 mis 的 a 标签时不添加 base path
- f609a5c: 修复 mis 跳转 portal 失败的问题
- c214bd2: mis-server 启动时，不完整运行一次封锁状态同步
- ca9bf27: 兼容低版本 chrome 浏览器，兼容 360 极速浏览器
- 0eb668d: 修复系统初始化时作业价格表设置页面查询参数报错问题
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
  - @scow/lib-web@1.4.1
  - @scow/utils@1.1.1
  - @scow/lib-operation-log@2.1.7
  - @scow/protos@1.0.13
  - @scow/rich-error-model@2.0.0

## 1.6.1

### Patch Changes

- 4ab2cec: 导出数据时增加编码选项
- be61c74: 所有 Input.group compact 组件替换成 Space.Compact

## 1.6.0

### Minor Changes

- b8d1270: 在管理系统和门户系统中增加依赖于管理系统的集群停用功能
  **注意：停用后集群将不可用，集群所有数据不再更新。再启用后请手动同步平台数据！**

### Patch Changes

- 5a707df: 修复门户系统桌面功能页面 token 过期不能跳转登录页面的问题, 修改获取集群数据 token 验证失败时的返回
- 0a43348: 修改门户系统下提交作业或交互式应用时可以选择的账号为用户维度未封锁账号，分区为该用户在该集群下对应账号的可用分区；修改从模板提交作业时模板值可以直接提交
- 5b6af87: 修改了 mis 系统下充值、消费账户前十的统计图的横坐标为 userName;修复了 mis 系统下系统使用量横坐标显示不全的问题。
- f91ba34: 修正了 mis 系统下平台数据统计横坐标的表现形式
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

- daf3885: getWhitelistedAccounts 新增返回字段 expirationDate，whitelistAccount 新增字段 expirationDate，在 getWhitelistedAccounts 新增每次查询会检测 中是否有账户过期，有的话会自动删除
- d080a8b: 修复在 common.yml 中自定义更改用户密码正则后在管理系统不生效的问题，
  增加平台管理和租户管理下修改用户密码的后端校验
- c7f2646: 操作日志文案修改：移动文件/文件夹改为移动或重命名文件/文件夹
- daf3885: mis 系统下，管理员添加白名单新增白名单账户过期字段
- 90217ac: 操作日志自定义操作类型合并至操作行为进行搜索查询
- f534377: 增加了 mis portal 中表格排序的功能，以及部分 UI 的修改
- 875fe29: 管理系统仪表盘账户信息显示卡片中可用余额逻辑和 UI 优化
- 98a166f: 修复了平台数据统计图（折线图）溢出的问题.
- 89191ea: 解决了 mis 系统中消费记录查询用户输入筛选条件后分页不正确的问题。
- f0b3162: 将白名单过期时间选择的最小日期调整至+1 天,将所选择日期的时分秒调整至 24:00:00(00:00:00).
- a53bcad: 充值记录和消费记录支持多选账户搜索，充值记录增加类型搜索；导出充值记录和消费记录同步增加这两个搜索条件
- Updated dependencies [d080a8b]
- Updated dependencies [f534377]
  - @scow/config@1.4.5
  - @scow/lib-web@1.3.3
  - @scow/lib-operation-log@2.1.5
  - @scow/protos@1.0.11
  - @scow/rich-error-model@2.0.0

## 1.5.1

### Patch Changes

- 93be965: 账户白名单、账户消费记录下都支持以用户 ID 和姓名搜索
- 94aa24c: 支持同时配置多个 UI 扩展。UI 扩展的实现有破坏性变更，请参考文档。
- 583978b: 管理系统下的平台数据统计提交作业前十的用户数横坐标改为以 userName 的方式显示.
- 37fdf7e: 修改了 portal 中的部分 UI 样式,bannerTop 导航文字
- 5c34421: 优化集群适配器访问异常时的页面错误信息展示
- e44340d: 修复了管理系统下消费记录总数金额显示错误以及翻页的问题
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
- 16f4465: 初始化的用户管理新增前端搜索
- a097dd1: 新增无账户关系的用户修改所属租户且可以作为新增租户的管理员功能
- a970dc7: 优化管理系统用户可见分区页面 Loading 样式
- bd21171: 修改变更租户管理下用户列表中可用账户的列名为 关联账户
- 8dd8c0e: 修改 Account 实体中原 blocked 字段名为 blocked_in_cluster ，表示在集群中是否为封锁状态
  增加字段 state ,字段值为 "NORMAL" , "FROZEN" , "BLOCKED_BY_ADMIN" 的枚举值，优化页面账户显示状态为正常、封锁、欠费
- 02d6a18: 新增集群区分 AI 功能和 HPC 功能配置
- 24db413: 操作日志增加自定义操作类型
- 0e3ff89: 统一修改规范用户及账户状态 正常和封锁 为 Available, Blocked；操作 封锁和解封 为 Block,Unblock
- 850a7ee: 修改 UserAccount 实体中原 status 字段名为 blocked_in_cluster ,表示在集群中是否为封锁状态
  增加字段 state ,允许写入的值为 "NORMAL" , "BLOCKED_BY_ADMIN" 的枚举值
  页面增加用户在账户下的 限额 的状态的显示
- d3d891a: 操作日志详细内容展示优化
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

- efcd9a8: 修改集群监控 iframe 高度自适应
- 08359cb: 使用外部认证系统时，外部系统未实现的功能在用户使用时提示用户功能未实现
- 443187e: 修复数据统计相关功能时区转换问题
- a56ec73: 修复平台管理页面账户消费记录搜索账户名时传参错误问题
- 2df6de8: 创建用户，账户，租户或添加用户，白名单账户时，对 input 框输入的 用户/账户/租户名称 去掉前后空格
- Updated dependencies [3242957]
  - @scow/config@1.4.2
  - @scow/protos@1.0.8
  - @scow/lib-operation-log@2.1.2
  - @scow/lib-web@1.3.0
  - @scow/rich-error-model@2.0.0

## 1.4.2

## 1.4.1

### Patch Changes

- 8d417ba: 增加配置项控制普通用户是否可以修改作业时限
- afc3350: 增加消费记录中用户的显示、筛选及导出功能
- 68447f7: mis 增加控制添加用户至账户相关配置
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
- d1c2e74: UI 扩展
- f023d52: 管理系统新增数据统计功能，统计用户，账户，租户，作业，消费及功能使用次数
- abb7e84: 管理系统新增集群监控功能

### Patch Changes

- 408816f: 增加对用户及账户关系的错误兼容，如果适配器的报错都是已存在，视为添加成功，如果都是不存在，视为移除成功
- e6efacf: 修复解封账户时错误提示是变量的问题
- 5144723: 管理系统的租户管理和平台管理中的账户列表新增拥有者姓名或 id 搜索项
- Updated dependencies [081fbcf]
- Updated dependencies [d1c2e74]
- Updated dependencies [abb7e84]
  - @scow/lib-operation-log@2.1.0
  - @scow/config@1.4.0
  - @scow/lib-web@1.3.0
  - @scow/protos@1.0.6
  - @scow/rich-error-model@2.0.0

## 1.3.0

### Patch Changes

- Updated dependencies [ec06733f9f]
  - @scow/config@1.3.0
  - @scow/lib-operation-log@2.0.5
  - @scow/lib-web@1.2.3
  - @scow/protos@1.0.5
  - @scow/rich-error-model@2.0.0

## 1.2.3

### Patch Changes

- cad49a87d8: 修复 callbackUrl 固定为 http 的问题
- 1a1189ad48: 管理系统 AllUserTable 恢复计数接口并且新增筛选参数
- Updated dependencies [cad49a87d8]
  - @scow/config@1.2.1
  - @scow/lib-web@1.2.3
  - @scow/lib-operation-log@2.0.4
  - @scow/protos@1.0.4
  - @scow/rich-error-model@2.0.0

## 1.2.2

### Patch Changes

- d383f8fa94: 更新至 next 14
- 63c6fd5d4b: 管理系统充值列表传参优化，删除多余参数，统一为 searchType 控制
- Updated dependencies [d383f8fa94]
  - @scow/lib-web@1.2.2
  - @scow/protos@1.0.3
  - @scow/lib-operation-log@2.0.3
  - @scow/rich-error-model@2.0.0

## 1.2.1

### Patch Changes

- 7afd8a7225: 修复平台管理员无法进入创建租户页面的权限问题
- Updated dependencies [b84e4f9cc4]
  - @scow/lib-web@1.2.1

## 1.2.0

### Minor Changes

- 35e026be3e: 修改获取消费记录方式为分别获取当前页面详细记录及消费记录的总量，总额。在 ChargeRecord 实体中添加(time,type,account_name,tenant_name)的复合索引,索引名 query_info
- 135f2b1be3: 在门户系统的文件管理下，新增将文件直接作为作业文本提交调度器执行的功能，如果调度器 API 版本低于此接口版本报错
- a78a6e0b56: 操作日志新增操作内容模糊搜索功能
- 5d2b75ccec: 增加用户指定系统语言功能，可以指定系统唯一语言不再进行语言切换，也可以指定进入 SCOW 时的默认初始语言
- f6f84b6d60: 管理系统未结束作业新增结束操作

### Patch Changes

- 99d01eb605: 适应 scow slurm 适配器仅可取消提交当前作业用户的作业
- 3e13a35d2d: 移出用户前增加用户是否有运行中作业的判断
- 62c7f32eb3: 优化 web 端 table，调整列的宽度以百分比固定，使其在大屏/小屏下展示更友好
- e20be6f9f1: 修改充值页面时间筛选与账户/租户筛选交互不一致问题。修改为只有当点击搜索时才发起查询请求。
- a3d2f44af6: 门户及管理系统所有显示集群的地方按照集群中配置的优先级进行排序
- 3bb178aebd: 修改页面表格默认显示数量为 50
- Updated dependencies [a3d2f44af6]
- Updated dependencies [5d2b75ccec]
- Updated dependencies [135f2b1be3]
- Updated dependencies [5d2b75ccec]
- Updated dependencies [f577d9d1e4]
  - @scow/config@1.2.0
  - @scow/utils@1.1.0
  - @scow/lib-web@1.2.0
  - @scow/protos@1.0.2
  - @scow/lib-operation-log@2.0.2
  - @scow/rich-error-model@2.0.0

## 1.1.0

### Minor Changes

- ccbde14304: 实现 SCOW 门户系统与管理系统的页面国际化功能
- b33a2bd6bc: 在 ui.yaml 下的 footer 增加 hostnameMap，其作用与 hostnameTextMap 一致，根据不同 hostname 展示不同的 footer 文本
- 50d34d6ae3: 增加 scow 定时同步调度器用户封锁、账户封锁/解封状态的功能

### Patch Changes

- 639b77a103: 修复了一些因国际化英文 label 太长被输入框遮挡；修复了登录页的验证码 placeholder 太长和文字超出屏幕的问题。
- 7fd6a5cfa0: 修复 mis-web 中用户和账户列表 tab 数量会随 tab 切换而变化的问题
- 5a9bda6f4a: 对提交作业和应用的作业名，创建用户时的姓名、创建租户时租户名、充值时的类型、备注输入做长度控制，避免用户输入过长
- 24a037e800: 补充租户管理员权限也可以查看租户管理下的账户充值记录页面
- 9b7bff2bf0: 修复平台管理下用户列表修改用户密码成功与错误时的提示文字错误
- 1bb1e07f1b: 修复一些 ESLINT 规则检查时的警告
- 9180882615: 修复 mis-web 中账户列表和用户列表页面统计数量不随搜索而变化的问题
- ec1f96ad7b: 充值完成后清空充值表单；修改租户充值记录导航栏文本:租户管理->财务管理->充值记录：改为租户充值记录.
- 6bf6a6e726: 优化修改作业时限，修复修改作业时限 bug 让修改作业时限时指定查询运行中状态的作业
- 914f6c85f8: 修改管理系统用户可见分区为按不同集群响应分开展示，页面展示顺序为按集群优先级顺序
- 4fb0881e89: 优化了 web 页面部分 table 超长连续字段（长数字和长单词）破坏表格布局的问题
- 51903e0732: 登录操作判断由 referer 改为 queryString 传 fromAuth 参数
- ac3396c66c: 修改用户空间搜索已结束的作业时，账户选择框除现在所属账户外可以输入其他账户值进行搜索
- c50b18e255: 修改 mis-web 下后端返回的操作日志内容，在 mis-web 前端处理操作类型，操作行为，操作详细的展示
- f4f14ba51a: 新增创建用户和从账户中移除用户操作等待提示语
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

- cb1e3500d: 增加租户管理下和平台管理下的账户消费列表页面，优化账户消费列表显示
- 1fc3688b8: 暴露操作集群时后端返回的错误信息
- dfee2d354: 修复操作日志记录查不到用户信息报错问题
- d96e8ad91: auth 登录跳转回 web 页面时，判断 referer 是否包含 AUTH_EXTERNAL_URL + '/public/auth'以区分用户登录操作和切换门户/管理系统
- 8f0e51b3f: 管理系统用户可见分区查询时账户遍历时更改为 Promise.All()节省查询时间
- 946b1782a: 修改作业时限操作日志内容展示修复及创建操作日志错误捕获 bug 修复
- ffefb17b8: 修复账户添加用户提示语
- 3610e95da: portal-web 和 mis-web 的个人信息页面调整
- f784837d3: 增加租户管理、平台管理的账户列表封锁账户的功能
- 945bbb5ec: 作业详情数据添加单位
- 1bdccd827: 限制创建账户时的拥有者仅为当前租户下的用户
- 0fbba98dd: 用户、账户、作业称呼统一
- 1269e3cef: 操作日志搜索时间精度到秒，展示操作者姓名以及每页默认展示 50 条记录
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
  - @scow/utils@1.0.0

## 0.9.0

### Minor Changes

- 1c5e3a307: 平台管理中增加租户列表显示
- b96e5c4b2: 支持在导航栏右侧的用户下拉菜单中增加自定义链接
- 113e1e4ea: 管理系统中，租户/平台管理员修改自己管理的用户密码时无需原密码
- f3dd67ecb: 增加用户通过代码自定义收费规则的功能

### Patch Changes

- 75951b5bb: 租户管理下账户列表，白名单账户显示优化；增加账户统计信息，用户数量显示等功能。
- 31dc79055: 增加是否打开新的页面配置项，默认为 false,所有导航点击时不打开新的页面；修改一级导航 url 配置项为可选，没有配置时 则默认跳转次级第一个导航的 url
- f9fbd4cd2: 租户管理中拆分租户和账户充值记录查询，平台管理中租户查询充值记录时可以下拉选择租户
- 666567732: 之前历史作业批量搜索和精确搜索的条件分割有误，精确搜索会带上批量搜索的一些条件，现在各自搜索只会带上自己的条件
- d49a34986: 优化租户管理和平台管理的用户列表，增加各角色用户总数显示，优化显示文字及列表结果排序
- 9fd95a97a: 为作业详情页的作业执行时间，作业等待时间，作业时间限制添加单位说明
- 572530a01: mis-web 用户修改邮箱,用户原邮箱直接展示且不可修改，用户填写符合规则的新邮箱后即可直接修改邮箱。
- da5edd22c: 在集群与分区信息页面，实现仅显示用户有使用权限的分区信息
- 6e0d03044: 解决开发环境下 mis-web 进入 dashboard 页面报错的问题
- 12ecb668e: 修复多次点击用户空间-已结束作业列表，接口会自动加上账户筛选条件的问题
- 143c9732e: 之前：退出登录或登陆过期时跳转到需要登录页面，现在：直接跳转到登录页面
- 291f1d471: mis-web 管理系统 UI 文字和栏目优化。mis-server 返回租户信息中增加租户财务人员，返回平台信息中增加平台财务人员。
- 2f3b9e98d: 管理系统集群名展示改为集群的 displayName
- 0f8ade56c: 租户管理员增加账户管理员的所有权限，比如添加用户、限额、封锁、设为管理员和移除用户。
- 01559259c: 修复 setAsInitAdmin.ts 和 unsetInitAdmin.ts 文件命名错误
- 6522b47cf: 修改作业时限优化，将增加减少时限改为直接设置作业时限，并且检查是否大于作业的运行时间
- 8dcfc3f1a: 增加作业列表中 GPU 卡数的展示
- 5362b438c: 修改平台管理获取账户列表的权限
- 4b12bed3f: 修改管理系统用户空间集群分区的计量方式显示，修改为与作业价格表中显示方式一致
- cce9d6c92: 取消用户限额时可选择是否同时解除对用户的封锁
- f3d9849ce: 复用账户列表组件，除个别特殊显示外实现平台管理下的账户列表与租户管理下的账户列表功能统一
- ba67cac99: 修复 Schema 中使用 Type.Union([Type.String(), Type.Undefined()])错误，改为 Type.Optional(Type.String())
- 1c668544f: 增加 hook：jobsSaved，此 hook 在作业信息持久化到 scow 数据库后调用
- c84ff2eb8: 为租户管理员增加租户财务人员权限和平台管理员增加平台财务人员权限
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

## 0.8.1

### Patch Changes

- a978233fe: 修复 antd 主题没有应用完全的问题
- Updated dependencies [a978233fe]
  - @scow/lib-web@0.3.5

## 0.8.0

### Minor Changes

- 5b7f0e88f: 重构 scow，对接调度器适配器接口

### Patch Changes

- 9da6fb5bc: 修复账户管理租户管理未结束作业查询结果不正确的问题，修复未结束作业批量搜索账户条件带入精确搜索中的问题
- bbbb040c9: 用户不属于任何一个账户时仪表盘不展示未完成作业列表
- 4c71a2a4b: 账户充值和租户充值允许负数
- d668f50ff: 租户管理历史作业页面打开时作业结束时间的查询时分秒修改为 00:00:00-23:59:59
- 7d2ac2666: 修复平台信息页面角色权限校验错误问题
- 7a9973aa0: 修改 HTTP API 定义方式，去除生成 api-routes-schemas.json 步骤
- 4a7229dbd: 修复集群和分区信息展示界面中核心数、gpu 数、内存量展示为分区总数的问题
- Updated dependencies [5b7f0e88f]
- Updated dependencies [62083044e]
- Updated dependencies [a90e34b30]
- Updated dependencies [5c3c63657]
- Updated dependencies [e97eb22fd]
  - @scow/protos@0.3.0
  - @scow/config@0.4.0
  - @scow/lib-web@0.3.4

## 0.7.0

### Patch Changes

- 1aad4a345: 去掉 web 端多余的逗号
- 1227c7347: 修复导入用户时账户选择默认拥有者提交无效问题
- 31198304c: portal-web 使用 custom server 注册 upgrade 事件，更新 next.js 至最新并恢复日常更新
- d00ae0da3: 新增创建租户页面，同时创建该租户的管理员用户
- e011f42ff: 门户和管理系统添加 footer 展示 SCOW 版本和 github 跳转链接
- 8cf189cd2: 修改了 config 中 ENABLE_CHANGE_PASSWORD 与 authSupportsCreateUser 的类型属性可以为 Undefined
- 07160d9de: 修改了管理系统用户空间集群和分区信息页面集群项跨越行数显示不正确的问题
- 9e79e2a9f: 管理平台新增平台信息页面
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

### Minor Changes

- 901ecdb7e: 支持使用外部页面创建用户

### Patch Changes

- dc51bfde6: 浏览器关闭后，用户登录 cookie 失效
- 01e18fa28: 临时解决 Shell 和 VNC 类应用不可用的问题
- ed073f9ac: 管理系统右上角用户名以管理系统数据库为准
- f5e1d45ab: 管理系统导入账户时, 在没有拥有者的情况下账户拥有者默认选择账户的第一个用户
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

- c2a8ab7a5: 删除认证系统验证用户姓名的 API，通过认证系统获取用户姓名和管理系统数据库实现
- 2ac7a9b4d: 当已存在的账户中有用户未导入，则可以勾选该账户并导入

### Patch Changes

- 5cc5ef9a5: 修复账户管理员在账户管理页面搜索账户充值记录时，除首次搜索外丢失 accountName 参数名导致接口报错无权限问题
- 9c5c3c11c: 租户列表余额展示精确到 3 位小数，租户充值时金额只精确到 2 位小数
- e833bdb74: 修复创建用户时，管理系统后端没有检查新用户的 ID 是否符合配置文件中定义的规则
- 70ab2e1d7: 修复用户空间-已结束作业批量搜索的账户条件会带入到精确搜索中
- c3907e855: 管理系统设置价格时允许设置为 0 元
- fc36c57ca: 修复 web 项目第一次访问时页面布局混乱的问题
- fc01bce1b: 租户历史作业计费价格表不显示平台计费项
- 858c7a6c5: 创建用户时备注改为非必填，修复成功时不展示提示的问题
- 2abcb9e40: 修复了一个 bug，曾导致当用户修改集群配置后，无法计算出正确的计费项 id
- 977600e34: 修复了一个 bug，该 bug 曾导致分页情况下导入的账户没有拥有者
- 8268e348e: 修改 DELETE 请求 body 为 query 使其合规
- e2c804923: 修改平台用户列表只能在第一页搜索用户问题；为了与租户管理的用户界面搜索统一，平台管理用户界面修改为模糊搜索
- 4e05475c0: 管理系统修改没有设置创建用户 ID 正则规则时无法启动 mis-web 的问题
- 8c5751582: 平台管理租户充值记录过滤条件 tenantName 手动清空时，传参由“”改为 undefined
- 230a8f07c: 修复租户财务人员获取租户下的所有账号信息无权限，平台财务人员访问平台下的所有租户信息无权限问题
- caefcddcd: 前端显示用户姓名时使用认证系统返回的用户姓名
- d6e06e841: 读取配置文件时允许传入 logger 对象
- 40b98669e: 租户管理页面可以查看作业价格表的历史记录
- Updated dependencies [c2a8ab7a5]
- Updated dependencies [bb9d9bb8b]
- Updated dependencies [215ac2fc7]
- Updated dependencies [fc36c57ca]
- Updated dependencies [7bd2578c4]
- Updated dependencies [ef8b7eee0]
- Updated dependencies [9cb6822e6]
- Updated dependencies [74d718ba1]
- Updated dependencies [caefcddcd]
- Updated dependencies [d6e06e841]
- Updated dependencies [cb90eb64b]
  - @scow/lib-auth@0.2.0
  - @scow/lib-web@0.3.1
  - @scow/config@0.2.0
  - @scow/lib-config@0.2.1
  - @scow/protos@0.2.1

## 0.4.0

### Minor Changes

- 86e0f5b2d: 整个系统打包为一个镜像
- 50a5b858c: 系统初试化页面用户选择下拉框支持搜索
- 0eb41fed5: 导入用户功能只支持导入默认租户

### Patch Changes

- fb2af3d6c: 修复充值记录查询的 bug
- bdc990a0c: 系统启动时，各个容器在日志中打印版本信息
- 584069cfd: 修复账户管理下的作业列表，只能正常显示第一个账户的数据的问题
- debcf7bc3: 从最终镜像中去除 next.js build cache，减小镜像大小
- 5deada9da: 初始化页面获取丢失默认价格接口不做登录校验
- ff7eec37e: 修复因 table 超出页面的问题，搜索模块、个人信息页面手机端样式兼容
- 06cd94230: 刷新 slurm 封锁状态和同步作业信息状态功能放到平台调试中
- 8b666552e: 解决再次添加用户不成功的问题
- ece2b014d: 修复管理端的作业操作权限问题
- 0ed5d925e: ID 为空时精确搜索页面展示搜索结果
- Updated dependencies [bdc990a0c]
- Updated dependencies [86e0f5b2d]
- Updated dependencies [ff7eec37e]
- Updated dependencies [8145061ba]
  - @scow/utils@0.1.2
  - @scow/lib-decimal@0.2.0
  - @scow/protos@0.2.0
  - @scow/lib-web@0.3.0
  - @scow/lib-config@0.2.0
  - @scow/config@0.1.2

## 0.3.0

### Minor Changes

- 73939f15f: 在租户计费价格表中使用新的 ui

### Patch Changes

- @scow/protos@0.1.1

## 0.2.0

### Minor Changes

- b6f28ba26: 优化平台管理部分的计费价格模块
- 1a6b992db: 完善平台管理的租户列表，新增租户的创建时间
- c55bfd32d: 在初始化界面使用新的计费 UI
- 4ecca3d1e: 检查默认计费项是否完备
- 2b3648839: 优化导入用户模块，以账户为单位导入
- 5e4f6ac58: 支持动态设置 base path
- a9b64169c: 更新 LOGO、favicon、仪表盘图片的自定义方式

### Patch Changes

- 99f806a33: 管理系统增加刷新 slurm 封锁状态功能
- 2ba2c8b47: 给账户添加用户时，如果用户不存在，弹出创建用户 modal 创建完成后，自动将用户加入到账户中
- b6347a367: 更新 next.js 版本并开启自动更新
- 93eb54ea6: 修复图片没有正确加上 base path
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
