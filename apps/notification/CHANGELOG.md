# @scow/notification

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
