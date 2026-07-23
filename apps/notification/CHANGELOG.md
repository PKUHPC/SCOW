# @scow/notification

## 0.2.30

### Patch Changes

- 23a94d3: 增加统一的日志上下文信息
- Updated dependencies [23a94d3]
- Updated dependencies [fb6ab4b]
- Updated dependencies [3567ac0]
- Updated dependencies [837808c]
- Updated dependencies [c273ead]
  - @scow/lib-server@1.5.4
  - @scow/lib-web@1.6.4
  - @scow/config@1.16.1
  - @scow/protos@1.1.3
  - @scow/lib-notification@1.0.27
  - @scow/lib-scheduler-adapter@1.1.41

## 0.2.29

### Patch Changes

- c40d387: 修改注释、文案等账户拥有者概念为账户主管理
- c23e1ac: 操作日志功能整合到 header 右侧下拉菜单
- Updated dependencies [94ee545]
- Updated dependencies [68309f0]
- Updated dependencies [bfe6ffc]
- Updated dependencies [013d085]
- Updated dependencies [68309f0]
- Updated dependencies [e0f253b]
- Updated dependencies [c40d387]
- Updated dependencies [59348c8]
- Updated dependencies [59348c8]
- Updated dependencies [68309f0]
- Updated dependencies [68309f0]
- Updated dependencies [c23e1ac]
- Updated dependencies [0a1a819]
  - @scow/lib-web@1.6.3
  - @scow/lib-server@1.5.3
  - @scow/lib-scheduler-adapter@1.1.40
  - @scow/protos@1.1.2
  - @scow/config@1.16.0
  - @scow/lib-notification@1.0.26

## 0.2.28

### Patch Changes

- 0708d69: SCOW 整体响应式布局优化
- 00d1161: 删除开源许可声明，统一执行 lint format
- c56bdaa: 更新 nextjs 版本至 15.5.16
- Updated dependencies [87682ee]
- Updated dependencies [46c4f2c]
- Updated dependencies [439e7ed]
- Updated dependencies [44cf25f]
- Updated dependencies [00d1161]
- Updated dependencies [0b41958]
- Updated dependencies [96ede62]
- Updated dependencies [839c754]
- Updated dependencies [c56bdaa]
  - @scow/config@1.15.0
  - @scow/lib-server@1.5.2
  - @scow/notification-protos@0.1.11
  - @scow/lib-scheduler-adapter@1.1.39
  - @scow/lib-notification@1.0.25
  - @scow/protos@1.1.1
  - @scow/lib-config@1.0.9
  - @scow/utils@1.1.4
  - @scow/lib-web@1.6.2

## 0.2.27

### Patch Changes

- 8b2b13b: 优化消息系统管理员相关菜单页面
- 421f94b: 优化消息系统用户相关页面
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
  - @scow/lib-scheduler-adapter@1.1.38
  - @scow/lib-server@1.5.1

## 0.2.26

### Patch Changes

- f8fe60d: 集成 Alertmanager 监控告警通知
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
  - @scow/notification-protos@0.1.10
  - @scow/config@1.14.0
  - @scow/lib-web@1.6.0
  - @scow/lib-server@1.5.0
  - @scow/lib-notification@1.0.24
  - @scow/protos@1.0.39
  - @scow/lib-scheduler-adapter@1.1.37

## 0.2.25

### Patch Changes

- 470b7ef: 修复 getUnreadMessages 调用导致 mis 的 init 页面需要登录的 bug、删除 BodyContainer
- ffc4632: 优化页面中 Input 组件失焦时会自动去除前后空格
- Updated dependencies [7f7a095]
- Updated dependencies [7f93a72]
- Updated dependencies [fb60d5c]
- Updated dependencies [ffc4632]
- Updated dependencies [470b7ef]
- Updated dependencies [ffc4632]
- Updated dependencies [028995a]
  - @scow/lib-web@1.5.13
  - @scow/config@1.13.2
  - @scow/protos@1.0.38
  - @scow/lib-notification@1.0.23
  - @scow/lib-server@1.4.13
  - @scow/lib-scheduler-adapter@1.1.36

## 0.2.24

### Patch Changes

- d4e02dc: 操作按钮鼠标悬浮时背景色随 UI 配置主题色变化, 作业模板 ICON 更换,自定义导航链接默认 ICON 更换,平台切换的按钮中文字 icon 一直都保持主题色
- cf47ef2: 修复所有使用 grpc 项目的内存泄露问题
- f8957cb: 优化侧边栏文字和样式，子系统使用相同的公共组件；修复 AI 导航栏国际化不立即切换的问题
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
  - @scow/lib-server@1.4.12
  - @scow/config@1.13.1
  - @scow/utils@1.1.3
  - @scow/protos@1.0.37
  - @scow/lib-notification@1.0.22
  - @scow/lib-scheduler-adapter@1.1.35

## 0.2.23

### Patch Changes

- a55189a: 账户/用户信息同步结果通知到管理员
- 79278d5: 消息系统文档、日志、接口安全优化
- Updated dependencies [fab1829]
- Updated dependencies [b4c002a]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
- Updated dependencies [1154951]
- Updated dependencies [5eb4f91]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
- Updated dependencies [8f30ca0]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
- Updated dependencies [79278d5]
  - @scow/lib-web@1.5.11
  - @scow/config@1.13.0
  - @scow/lib-scheduler-adapter@1.1.34
  - @scow/protos@1.0.36
  - @scow/notification-protos@0.1.9
  - @scow/lib-config@1.0.8
  - @scow/lib-notification@1.0.21
  - @scow/lib-server@1.4.11

## 0.2.22

### Patch Changes

- 3dba5ce: 优化发送消息交互体验
- 5686520: 管理员发送消息页面新增管理员历史发送消息列表
- 36880eb: 新增多个系统语言
- 88a33b2: 修复 metadata 错误的函数调用
- Updated dependencies [7281dc1]
- Updated dependencies [a5eedd1]
- Updated dependencies [0cb903e]
- Updated dependencies [0cb903e]
- Updated dependencies [5686520]
- Updated dependencies [36880eb]
- Updated dependencies [be398ab]
- Updated dependencies [3b6cea7]
  - @scow/lib-web@1.5.10
  - @scow/protos@1.0.35
  - @scow/config@1.12.1
  - @scow/lib-server@1.4.10
  - @scow/notification-protos@0.1.8
  - @scow/lib-scheduler-adapter@1.1.33
  - @scow/lib-notification@1.0.20

## 0.2.21

### Patch Changes

- 3a16099: 升级 next 和相关依赖版本
- Updated dependencies [3a16099]
  - @scow/notification-protos@0.1.7
  - @scow/lib-notification@1.0.19
  - @scow/lib-server@1.4.9
  - @scow/protos@1.0.34
  - @scow/lib-scheduler-adapter@1.1.32
  - @scow/lib-web@1.5.9

## 0.2.20

### Patch Changes

- 1298591: 消息系统文档、日志、接口安全优化
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
- Updated dependencies [8b458d0]
  - @scow/config@1.12.0
  - @scow/lib-web@1.5.8
  - @scow/lib-scheduler-adapter@1.1.31
  - @scow/notification-protos@0.1.6
  - @scow/lib-config@1.0.7
  - @scow/protos@1.0.33
  - @scow/lib-notification@1.0.18
  - @scow/lib-server@1.4.8

## 0.2.19

### Patch Changes

- Updated dependencies [6f77b4e]
- Updated dependencies [2ff4aed]
- Updated dependencies [6f77b4e]
- Updated dependencies [6f77b4e]
  - @scow/config@1.11.2
  - @scow/lib-web@1.5.7
  - @scow/lib-notification@1.0.17
  - @scow/lib-server@1.4.7
  - @scow/protos@1.0.32
  - @scow/lib-scheduler-adapter@1.1.30

## 0.2.19

### Patch Changes

- Updated dependencies [6f77b4e]
- Updated dependencies [2ff4aed]
- Updated dependencies [6f77b4e]
- Updated dependencies [6f77b4e]
  - @scow/config@1.11.2
  - @scow/lib-web@1.5.7
  - @scow/lib-notification@1.0.17
  - @scow/lib-server@1.4.7
  - @scow/protos@1.0.32
  - @scow/lib-scheduler-adapter@1.1.30

## 0.2.18

### Patch Changes

- Updated dependencies [6752734]
- Updated dependencies [f0f144d]
- Updated dependencies [4f98a31]
- Updated dependencies [b326570]
- Updated dependencies [6752734]
- Updated dependencies [d556202]
  - @scow/config@1.11.1
  - @scow/lib-scheduler-adapter@1.1.29
  - @scow/lib-server@1.4.6
  - @scow/lib-web@1.5.6
  - @scow/protos@1.0.31
  - @scow/lib-notification@1.0.16

## 0.2.17

### Patch Changes

- Updated dependencies [477db31]
- Updated dependencies [b645b74]
- Updated dependencies [bf8afc6]
- Updated dependencies [bf8afc6]
- Updated dependencies [b645b74]
  - @scow/config@1.11.0
  - @scow/protos@1.0.30
  - @scow/lib-web@1.5.5
  - @scow/lib-notification@1.0.15
  - @scow/lib-server@1.4.5
  - @scow/lib-scheduler-adapter@1.1.28

## 0.2.16

### Patch Changes

- 50f3902: AI 和消息系统集成
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
  - @scow/lib-notification@1.0.14

## 0.2.15

### Patch Changes

- Updated dependencies [a5f0e1d]
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
  - @scow/lib-config@1.0.5
  - @scow/lib-web@1.5.3
  - @scow/protos@1.0.28
  - @scow/lib-server@1.4.3
  - @scow/lib-notification@1.0.13
  - @scow/lib-scheduler-adapter@1.1.26

## 0.2.14

### Patch Changes

- Updated dependencies [579f164]
  - @scow/config@1.8.2
  - @scow/lib-notification@1.0.12
  - @scow/lib-server@1.4.2
  - @scow/lib-web@1.5.2
  - @scow/protos@1.0.27
  - @scow/lib-scheduler-adapter@1.1.25

## 0.2.13

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
  - @scow/lib-notification@1.0.11
  - @scow/protos@1.0.26
  - @scow/lib-scheduler-adapter@1.1.24

## 0.2.12

### Patch Changes

- 1874b38: 更新 next 14.2.4 至 14.2.30
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
  - @scow/lib-notification@1.0.10
  - @scow/protos@1.0.25

## 0.2.11

### Patch Changes

- Updated dependencies [238a828]
- Updated dependencies [80d22df]
  - @scow/config@1.7.2
  - @scow/lib-config@1.0.3
  - @scow/lib-notification@1.0.9
  - @scow/lib-server@1.3.14
  - @scow/lib-web@1.4.14

## 0.2.10

### Patch Changes

- 9a0565c: 修改兜底报错,避免出现 undefined 一类提示
- Updated dependencies [10b1fa2]
- Updated dependencies [88fb722]
- Updated dependencies [59fb3b4]
- Updated dependencies [0904fad]
- Updated dependencies [7482019]
  - @scow/config@1.7.1
  - @scow/lib-web@1.4.13
  - @scow/protos@1.0.24
  - @scow/lib-notification@1.0.8
  - @scow/lib-server@1.3.13
  - @scow/lib-scheduler-adapter@1.1.22

## 0.2.9

### Patch Changes

- Updated dependencies [d029383]
  - @scow/lib-web@1.4.12

## 0.2.8

### Patch Changes

- dc2a243: 优化消息系统定时删除过期消息的逻辑
- Updated dependencies [80bee99]
- Updated dependencies [de86c6e]
- Updated dependencies [40b9478]
- Updated dependencies [67c32a5]
  - @scow/config@1.7.0
  - @scow/protos@1.0.23
  - @scow/lib-notification@1.0.7
  - @scow/lib-server@1.3.12
  - @scow/lib-web@1.4.11
  - @scow/lib-scheduler-adapter@1.1.21

## 0.2.7

### Patch Changes

- 217c4a3: 消息系统新增批量发送消息接口，并将作业完成通知改为批量发送
- Updated dependencies [9cd4758]
- Updated dependencies [d3c4b57]
- Updated dependencies [217c4a3]
  - @scow/lib-config@1.0.2
  - @scow/lib-web@1.4.10
  - @scow/notification-protos@0.1.5
  - @scow/config@1.6.4
  - @scow/protos@1.0.22
  - @scow/lib-notification@1.0.6
  - @scow/lib-server@1.3.11
  - @scow/lib-scheduler-adapter@1.1.20

## 0.2.6

### Patch Changes

- bfad31b: 为资源管理系统、通知系统、管理系统、门户系统服务与服务之间的调用增加 token 校验,
  ** 注意，此 commit 之后，如配置资源管理系统或者通知系统，则需要配置 SCOW API Token **
- Updated dependencies [bfad31b]
- Updated dependencies [afaec8b]
  - @scow/lib-notification@1.0.5
  - @scow/lib-server@1.3.10
  - @scow/config@1.6.3
  - @scow/lib-web@1.4.9
  - @scow/protos@1.0.21
  - @scow/lib-scheduler-adapter@1.1.19

## 0.2.5

### Patch Changes

- 8ea184e: 修复消息系统铃铛状态获取不对的问题
- aea62f5: user_message_read 表添加联合唯一索引
  - @scow/protos@1.0.20
  - @scow/lib-scheduler-adapter@1.1.18
  - @scow/lib-web@1.4.8

## 0.2.4

### Patch Changes

- c641401: 优化消息查询等 sql，解决重复已读 bug
- ca98dac: 在 SCOW 的 light mode 和 dark mode 下，可以选择两种不同的主题色
- Updated dependencies [1adb22b]
- Updated dependencies [249d35d]
- Updated dependencies [c641401]
- Updated dependencies [ca98dac]
- Updated dependencies [ca98dac]
  - @scow/lib-web@1.4.7
  - @scow/config@1.6.2
  - @scow/notification-protos@0.1.4
  - @scow/protos@1.0.19
  - @scow/lib-notification@1.0.4
  - @scow/lib-scheduler-adapter@1.1.17

## 0.2.3

### Patch Changes

- 2ca3fe6: 优化门户和管理系统定时消息查询,隐藏报错
  - @scow/protos@1.0.18
  - @scow/lib-scheduler-adapter@1.1.16
  - @scow/lib-web@1.4.6

## 0.2.2

### Patch Changes

- aeac587: 新增消息订阅的用户提示和更多的通知方式
- 56e0152: 更新 @grpc/grpc-js 到 1.12.2
- 56e0152: scow 和 适配器交互添加双向 tls 校验
- Updated dependencies [aeac587]
- Updated dependencies [1a531ed]
- Updated dependencies [56e0152]
- Updated dependencies [56e0152]
  - @scow/notification-protos@0.1.3
  - @scow/config@1.6.1
  - @scow/lib-scheduler-adapter@1.1.15
  - @scow/lib-notification@1.0.3
  - @scow/protos@1.0.17
  - @scow/lib-web@1.4.5

## 0.2.1

### Patch Changes

- aa94edc: 消息系统新增消息过期时间和定期删除过期消息功能
- Updated dependencies [bec8a37]
- Updated dependencies [a7e7585]
- Updated dependencies [6c6f8c6]
- Updated dependencies [701ebc7]
- Updated dependencies [aa94edc]
  - @scow/config@1.6.0
  - @scow/notification-protos@0.1.2
  - @scow/lib-web@1.4.4
  - @scow/protos@1.0.16
  - @scow/lib-scheduler-adapter@1.1.14
  - @scow/lib-notification@1.0.2

## 0.2.0

### Minor Changes

- 721b227: 新增消息系统

### Patch Changes

- c4b117d: 修改消息系统 ui
- Updated dependencies [721b227]
- Updated dependencies [9895952]
- Updated dependencies [0f02d9d]
- Updated dependencies [5746037]
  - @scow/notification-protos@0.1.1
  - @scow/lib-notification@1.0.1
  - @scow/config@1.5.3
  - @scow/lib-web@1.4.3
  - @scow/protos@1.0.15
  - @scow/lib-scheduler-adapter@1.1.13
