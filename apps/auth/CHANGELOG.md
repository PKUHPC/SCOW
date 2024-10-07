# @scow/auth

## 1.6.4

### Patch Changes

- 7c96613: 修改更名后的链接地址和文档描述
- Updated dependencies [7c96613]
  - @scow/lib-config@1.0.2
  - @scow/config@1.5.3
  - @scow/lib-server@1.3.3
  - @scow/utils@1.1.2
  - @scow/lib-ssh@1.0.3

## 1.6.3

### Patch Changes

- Updated dependencies [abd69cb]
- Updated dependencies [83df60b]
  - @scow/lib-server@1.3.2
  - @scow/config@1.5.2

## 1.6.2

### Patch Changes

- Updated dependencies [0275a9e]
- Updated dependencies [753a996]
- Updated dependencies [a9e9011]
- Updated dependencies [1a096de]
- Updated dependencies [0eb668d]
  - @scow/config@1.5.1
  - @scow/lib-ssh@1.0.2
  - @scow/utils@1.1.1
  - @scow/lib-server@1.3.1

## 1.6.1

## 1.6.0

### Patch Changes

- Updated dependencies [b8d1270]
- Updated dependencies [b8d1270]
- Updated dependencies [806f778]
  - @scow/config@1.5.0
  - @scow/lib-server@1.3.0

## 1.5.2

### Patch Changes

- daf3885: mis 系统下，管理员添加白名单新增白名单账户过期字段
- f534377: 增加了 mis portal 中表格排序的功能，以及部分 UI 的修改
- Updated dependencies [d080a8b]
  - @scow/config@1.4.5
  - @scow/lib-server@1.2.2

## 1.5.1

### Patch Changes

- 37fdf7e: 修改了 portal 中的部分 UI 样式,bannerTop 导航文字
- Updated dependencies [94aa24c]
- Updated dependencies [e312efb]
- Updated dependencies [e312efb]
- Updated dependencies [640a599]
  - @scow/config@1.4.4
  - @scow/lib-server@1.2.1

## 1.5.0

### Patch Changes

- Updated dependencies [02d6a18]
- Updated dependencies [63d1873]
- Updated dependencies [d822db7]
  - @scow/config@1.4.3
  - @scow/lib-server@1.2.0

## 1.4.3

### Patch Changes

- 08359cb: 使用外部认证系统时，外部系统未实现的功能在用户使用时提示用户功能未实现
- Updated dependencies [443187e]
- Updated dependencies [3242957]
- Updated dependencies [850bbcd]
  - @scow/lib-server@1.1.5
  - @scow/config@1.4.2

## 1.4.2

## 1.4.1

### Patch Changes

- Updated dependencies [afc3350]
- Updated dependencies [8d417ba]
- Updated dependencies [68447f7]
  - @scow/lib-config@1.0.1
  - @scow/config@1.4.1
  - @scow/lib-server@1.1.4

## 1.4.0

### Patch Changes

- Updated dependencies [d1c2e74]
- Updated dependencies [abb7e84]
  - @scow/config@1.4.0
  - @scow/lib-server@1.1.3

## 1.3.0

### Patch Changes

- Updated dependencies [ec06733f9f]
  - @scow/config@1.3.0
  - @scow/lib-server@1.1.2

## 1.2.3

### Patch Changes

- cad49a87d8: 修复 callbackUrl 固定为 http 的问题
- Updated dependencies [cad49a87d8]
  - @scow/config@1.2.1
  - @scow/lib-server@1.1.1

## 1.2.2

### Patch Changes

- 969457662f: 修复 scow 存在的 web 安全漏洞
  - @scow/lib-server@1.1.0

## 1.2.1

## 1.2.0

### Minor Changes

- 5d2b75ccec: 增加用户指定系统语言功能，可以指定系统唯一语言不再进行语言切换，也可以指定进入 SCOW 时的默认初始语言

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
  - @scow/utils@1.1.0
  - @scow/lib-server@1.1.0

## 1.1.0

### Minor Changes

- ccbde14304: 实现 SCOW 门户系统与管理系统的页面国际化功能
- b33a2bd6bc: 在 ui.yaml 下的 footer 增加 hostnameMap，其作用与 hostnameTextMap 一致，根据不同 hostname 展示不同的 footer 文本

### Patch Changes

- 639b77a103: 修复了一些因国际化英文 label 太长被输入框遮挡；修复了登录页的验证码 placeholder 太长和文字超出屏幕的问题。
- d8a50f63ab: 登录界面 UI 新增根据不同域名展示不同内容
- f808c35de7: 修复登录框中输入框长度不一致的问题
- 51903e0732: 登录操作判断由 referer 改为 queryString 传 fromAuth 参数
- 74764b4f42: 新增登录界面登录按钮颜色可根据域名进行不同配置
- d8a50f63ab: 登录界面新增根据域名显示不同的背景颜色和背景图片
- Updated dependencies [b33a2bd6bc]
- Updated dependencies [b7f01512eb]
- Updated dependencies [5bb922fe99]
- Updated dependencies [ccbde14304]
- Updated dependencies [50d34d6ae3]
- Updated dependencies [29e4b1880a]
- Updated dependencies [ccbde14304]
- Updated dependencies [8fc4c21f07]
  - @scow/config@1.1.0
  - @scow/lib-server@1.0.1

## 1.0.0

### Major Changes

- 11f94f716: 发布 1.0

### Patch Changes

- d96e8ad91: auth 登录跳转回 web 页面时，判断 referer 是否包含 AUTH_EXTERNAL_URL + '/public/auth'以区分用户登录操作和切换门户/管理系统
- Updated dependencies [ee89b11b9]
- Updated dependencies [cb1e3500d]
- Updated dependencies [11f94f716]
  - @scow/config@1.0.0
  - @scow/lib-config@1.0.0
  - @scow/lib-ssh@1.0.0
  - @scow/utils@1.0.0

## 0.9.0

### Minor Changes

- 113e1e4ea: 在 auth 中添加了一个新的 capability 叫 checkPassword，用于检验密码。原先的修改密码 changePassword 不再需要旧密码

### Patch Changes

- 572530a01: mis-web 用户修改邮箱,用户原邮箱直接展示且不可修改，用户填写符合规则的新邮箱后即可直接修改邮箱。
- 785a14bf5: 修复 auth logo 在修改系统相对路径后无法显示的问题
- 72875e722: 新增 auth 登录界面可配置项
- b2a52c546: 全新 SCOW 登录界面
- Updated dependencies [67911fd92]
- Updated dependencies [b96e5c4b2]
- Updated dependencies [31dc79055]
- Updated dependencies [9f70e2121]
- Updated dependencies [6f278a7b9]
- Updated dependencies [1407743ad]
- Updated dependencies [f3dd67ecb]
  - @scow/config@0.5.0

## 0.8.1

## 0.8.0

### Minor Changes

- 5b7f0e88f: 重构 scow，对接调度器适配器接口

### Patch Changes

- e97eb22fd: 集群配置登录节点新增节点展示名
- 7a9973aa0: 修改 HTTP API 定义方式，去除生成 api-routes-schemas.json 步骤
- Updated dependencies [5b7f0e88f]
- Updated dependencies [62083044e]
- Updated dependencies [5c3c63657]
- Updated dependencies [e97eb22fd]
  - @scow/config@0.4.0
  - @scow/lib-ssh@0.4.0

## 0.7.0

### Patch Changes

- Updated dependencies [0f64e5404]
- Updated dependencies [81895f4be]
  - @scow/config@0.3.1

## 0.6.0

### Minor Changes

- 6f1c9f24e: 增加了 otp 功能

### Patch Changes

- Updated dependencies [901ecdb7e]
- Updated dependencies [d2c8e765e]
- Updated dependencies [ce077930a]
  - @scow/config@0.3.0
  - @scow/lib-config@0.2.2

## 0.5.0

### Minor Changes

- c2a8ab7a5: 删除认证系统验证用户姓名的 API，通过认证系统获取用户姓名和管理系统数据库实现
- bb9d9bb8b: 认证系统 GET /user API 增加返回用户姓名和邮箱
- 215ac2fc7: 认证系统 GET /validateToken 改为 GET /public/validateToken
- 0b0413806: LDAP 认证系统支持不配置创建用户选项

### Patch Changes

- 6236865ab: 之前 captcha 验证码只能靠浏览器刷新，输入错误验证码提交两种方式进行刷新，现在可以直接点击验证码进行刷新
- b69716c12: 修复 captcha 前后端参数不一致导致验证码的 svg 图片不显示，从而前端只有验证码输入框的问题
- 943195451: 认证系统支持测试用户功能
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
  - @scow/lib-config@0.2.1

## 0.4.0

### Minor Changes

- 9a1d3b81b: 认证系统新建用户和组时支持删除预添加的属性

### Patch Changes

- bdc990a0c: 系统启动时，各个容器在日志中打印版本信息
- 883521f26: 修复当部署的端口号非 80 时，回调地址出错的问题
- ac298dc4a: 登录页面增加必填校验，增加 logo
- Updated dependencies [bdc990a0c]
- Updated dependencies [86e0f5b2d]
- Updated dependencies [419184a93]
- Updated dependencies [8145061ba]
  - @scow/utils@0.1.2
  - @scow/lib-ssh@0.2.0
  - @scow/lib-config@0.2.0
  - @scow/config@0.1.2

## 0.3.0

## 0.2.0

### Minor Changes

- dc9852988: 修改 ldap.searchBase 为必填
- 84fcc4bf3: 增加配置日志输出选项功能
- 401a21ebe: 限制登录系统可回调域名和增加相关配置

### Patch Changes

- Updated dependencies [6814c3427]
- Updated dependencies [c24e21662]
  - @scow/config@0.1.1
  - @scow/lib-config@0.1.1

## 0.1.2

### Patch Changes

- 230b944a: 测试发布流水线

## 0.1.1

### Patch Changes

- 07a196c4: 测试发布流水线
