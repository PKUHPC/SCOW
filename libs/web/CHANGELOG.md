# @scow/lib-web

## 1.3.1

### Patch Changes

- 146e19f: 去掉导航栏多余的下划线

## 1.3.0

### Minor Changes

- d1c2e74: UI 扩展

## 1.2.3

### Patch Changes

- cad49a87d8: 修复 callbackUrl 固定为 http 的问题

## 1.2.2

### Patch Changes

- d383f8fa94: 更新至 next 14

## 1.2.1

### Patch Changes

- b84e4f9cc4: 暂时解决 tab 标签在最右侧时的抖动问题

## 1.2.0

### Minor Changes

- 5d2b75ccec: 增加用户指定系统语言功能，可以指定系统唯一语言不再进行语言切换，也可以指定进入 SCOW 时的默认初始语言

### Patch Changes

- Updated dependencies [135f2b1be3]
  - @scow/utils@1.1.0

## 1.1.0

### Minor Changes

- ccbde14304: 实现 SCOW 门户系统与管理系统的页面国际化功能

### Patch Changes

- 29e4b1880a: 将 web 获取的 hostname 由 host 变为 hostname，不带 port
- 6bf6a6e726: 优化修改作业时限，修复修改作业时限 bug 让修改作业时限时指定查询运行中状态的作业
- 4fb0881e89: 优化了 web 页面部分 table 超长连续字段（长数字和长单词）破坏表格布局的问题

## 1.0.0

### Major Changes

- 11f94f716: 发布 1.0

### Patch Changes

- cb1e3500d: 增加租户管理下和平台管理下的账户消费列表页面，优化账户消费列表显示
- Updated dependencies [11f94f716]
  - @scow/utils@1.0.0

## 0.4.0

### Minor Changes

- b96e5c4b2: 支持在导航栏右侧的用户下拉菜单中增加自定义链接

### Patch Changes

- 75951b5bb: 租户管理下账户列表，白名单账户显示优化；增加账户统计信息，用户数量显示等功能。
- 1c74443b6: 修复账户管理中多账户的侧边栏过长的问题
- d49a34986: 优化租户管理和平台管理的用户列表，增加各角色用户总数显示，优化显示文字及列表结果排序
- 6522b47cf: 修改作业时限优化，将增加减少时限改为直接设置作业时限，并且检查是否大于作业的运行时间
- 53e596584: 修复第一次打开账户管理页面侧边栏全部打开和联动横向菜单栏展开相应的侧面菜单栏
- 9f70e2121: 门户系统去除默认集群选择功能，新增集群选择排序以及记录上次选择集群功能

## 0.3.5

### Patch Changes

- a978233fe: 修复 antd 主题没有应用完全的问题

## 0.3.4

### Patch Changes

- a90e34b30: 修改 favicon 和 logo 访问时错误参属下返回的报错信息为固定文字“Invalid request Value”

## 0.3.3

### Patch Changes

- 31198304c: portal-web 使用 custom server 注册 upgrade 事件，更新 next.js 至最新并恢复日常更新
- e011f42ff: 门户和管理系统添加 footer 展示 SCOW 版本和 github 跳转链接
- 81895f4be: mis.yaml 和 portal.yaml 中支持增加导航链接

## 0.3.2

### Patch Changes

- 01e18fa28: 临时解决 Shell 和 VNC 类应用不可用的问题

## 0.3.1

### Patch Changes

- fc36c57ca: 修复 web 项目第一次访问时页面布局混乱的问题
- caefcddcd: 前端显示用户姓名时使用认证系统返回的用户姓名

## 0.3.0

### Minor Changes

- 86e0f5b2d: 整个系统打包为一个镜像

### Patch Changes

- ff7eec37e: 修复因 table 超出页面的问题，搜索模块、个人信息页面手机端样式兼容
- Updated dependencies [bdc990a0c]
  - @scow/utils@0.1.2

## 0.2.0

### Minor Changes

- c2a1dff41: 自定义 footer 和 portal 的 dashboard 文本支持 HTML 标签
- 5e4f6ac58: 支持动态设置 base path
- a9b64169c: 更新 LOGO、favicon、仪表盘图片的自定义方式

### Patch Changes

- 93eb54ea6: 修复图片没有正确加上 base path
- Updated dependencies [c24e21662]
  - @scow/utils@0.1.1
