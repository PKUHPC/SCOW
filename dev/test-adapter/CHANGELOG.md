# @scow/test-adapter

## 1.1.20

### Patch Changes

- Updated dependencies [148099e]
  - @scow/scheduler-adapter-protos@1.5.5

## 1.1.19

### Patch Changes

- cf47ef2: 修复所有使用 grpc 项目的内存泄露问题
- 344b2da: ai 进入容器从调用 k8sAPI 切换为调用适配器和集群删除 k8s 配置
- Updated dependencies [344b2da]
  - @scow/scheduler-adapter-protos@1.5.4

## 1.1.18

### Patch Changes

- 597ac23: 刷新交互时应用密码优先通过适配器获取
- Updated dependencies [597ac23]
- Updated dependencies [79278d5]
  - @scow/scheduler-adapter-protos@1.5.3
  - @scow/lib-config@1.0.8

## 1.1.17

### Patch Changes

- 963a2b8: 使用统一的适配器接口
- Updated dependencies [963a2b8]
  - @scow/scheduler-adapter-protos@1.5.2

## 1.1.16

### Patch Changes

- Updated dependencies [ce6fc46]
  - @scow/lib-config@1.0.7

## 1.1.15

### Patch Changes

- Updated dependencies [50f3902]
- Updated dependencies [cb4c2e8]
- Updated dependencies [29f7e38]
  - @scow/lib-config@1.0.6
  - @scow/scheduler-adapter-protos@1.5.1

## 1.1.14

### Patch Changes

- Updated dependencies [6f5c6ec]
- Updated dependencies [58e7347]
- Updated dependencies [3ed0aa1]
  - @scow/lib-config@1.0.5

## 1.1.13

### Patch Changes

- Updated dependencies [44af4cf]
  - @scow/lib-config@1.0.4

## 1.1.12

### Patch Changes

- b961d74: 增加节点迁移页面与功能
- a4d7ac3: 原有同步账户封锁状态功能升级为同步账户/用户信息功能
- Updated dependencies [b961d74]
- Updated dependencies [a4d7ac3]
  - @scow/scheduler-adapter-protos@1.5.0

## 1.1.11

### Patch Changes

- Updated dependencies [80d22df]
  - @scow/lib-config@1.0.3

## 1.1.10

### Patch Changes

- 217c4a3: 消息系统新增批量发送消息接口，并将作业完成通知改为批量发送
- Updated dependencies [9cd4758]
- Updated dependencies [d3c4b57]
  - @scow/lib-config@1.0.2

## 1.1.9

### Patch Changes

- 56e0152: 更新 @grpc/grpc-js 到 1.12.2
- Updated dependencies [56e0152]
  - @scow/scheduler-adapter-protos@1.4.1

## 1.1.8

### Patch Changes

- 6c6f8c6: 新增删除用户账户功能以及用户账户的删除状态带来的其他相关接口与测试文件完善
- Updated dependencies [6c6f8c6]
  - @scow/scheduler-adapter-protos@1.4.0

## 1.1.7

### Patch Changes

- 9895952: 新增资源管理系统，增加对租户/账户的集群，分区授权和取消授权的功能

## 1.1.6

### Patch Changes

- d32b7f6: 修复 shell 退出时 ssh 连接未正常关闭的问题

## 1.1.5

### Patch Changes

- Updated dependencies [753a996]
- Updated dependencies [66a96ba]
  - @scow/scheduler-adapter-protos@1.3.2

## 1.1.4

### Patch Changes

- e312efb: ai 增加 vnc 功能，以 shell 方式进入容器功能和提交作业的优化
- Updated dependencies [e312efb]
  - @scow/scheduler-adapter-protos@1.3.1

## 1.1.3

### Patch Changes

- Updated dependencies [afc3350]
  - @scow/lib-config@1.0.1

## 1.1.2

### Patch Changes

- Updated dependencies [26bd8e7]
  - @scow/scheduler-adapter-protos@1.3.0

## 1.1.1

### Patch Changes

- Updated dependencies [ec06733f9f]
  - @scow/scheduler-adapter-protos@1.2.0

## 1.1.0

### Minor Changes

- 135f2b1be3: 在门户系统的文件管理下，新增将文件直接作为作业文本提交调度器执行的功能，如果调度器 API 版本低于此接口版本报错

### Patch Changes

- Updated dependencies [135f2b1be3]
  - @scow/scheduler-adapter-protos@1.1.0

## 1.0.1

### Patch Changes

- ccbde14304: 实现 SCOW 门户系统与管理系统的页面国际化功能

## 1.0.0

### Major Changes

- 11f94f716: 发布 1.0

### Patch Changes

- Updated dependencies [11f94f716]
  - @scow/lib-config@1.0.0
  - @scow/scheduler-adapter-protos@1.0.0

## 0.2.0

### Minor Changes

- 5b7f0e88f: 重构 scow，对接调度器适配器接口

### Patch Changes

- 3f7afe8cb: 完善 mis-server 中针对 fetchJob 和 price 功能的测试，增大测试覆盖率
- Updated dependencies [5b7f0e88f]
  - @scow/scheduler-adapter-protos@0.2.0
