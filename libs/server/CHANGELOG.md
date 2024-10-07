# @scow/lib-server

## 1.3.3

### Patch Changes

- 7c96613: 修改更名后的链接地址和文档描述
- Updated dependencies [7c96613]
  - @scow/lib-scheduler-adapter@1.1.13
  - @scow/rich-error-model@2.0.1
  - @scow/config@1.5.3
  - @scow/utils@1.1.2
  - @scow/protos@1.0.15

## 1.3.2

### Patch Changes

- abd69cb: 接入 scowd 文件分片上传
- Updated dependencies [83df60b]
  - @scow/config@1.5.2
  - @scow/protos@1.0.14
  - @scow/rich-error-model@2.0.0
  - @scow/lib-scheduler-adapter@1.1.12

## 1.3.1

### Patch Changes

- 1a096de: 修复门户系统集群登录节点只配置地址时路由渲染失败的问题，在集群配置接口返回中加入 scowd 配置信息
- Updated dependencies [0275a9e]
- Updated dependencies [753a996]
- Updated dependencies [a9e9011]
- Updated dependencies [1a096de]
- Updated dependencies [66a96ba]
- Updated dependencies [0eb668d]
  - @scow/config@1.5.1
  - @scow/scheduler-adapter-protos@1.3.2
  - @scow/utils@1.1.1
  - @scow/lib-scheduler-adapter@1.1.11
  - @scow/protos@1.0.13
  - @scow/rich-error-model@2.0.0

## 1.3.0

### Minor Changes

- b8d1270: 在管理系统和门户系统中增加依赖于管理系统的集群停用功能
  **注意：停用后集群将不可用，集群所有数据不再更新。再启用后请手动同步平台数据！**

### Patch Changes

- Updated dependencies [b8d1270]
- Updated dependencies [806f778]
  - @scow/config@1.5.0
  - @scow/protos@1.0.12
  - @scow/rich-error-model@2.0.0
  - @scow/lib-scheduler-adapter@1.1.10

## 1.2.2

### Patch Changes

- Updated dependencies [d080a8b]
  - @scow/config@1.4.5
  - @scow/protos@1.0.11
  - @scow/rich-error-model@2.0.0
  - @scow/lib-scheduler-adapter@1.1.9

## 1.2.1

### Patch Changes

- Updated dependencies [94aa24c]
- Updated dependencies [e312efb]
- Updated dependencies [e312efb]
- Updated dependencies [640a599]
  - @scow/config@1.4.4
  - @scow/scheduler-adapter-protos@1.3.1
  - @scow/protos@1.0.10
  - @scow/lib-scheduler-adapter@1.1.8
  - @scow/rich-error-model@2.0.0

## 1.2.0

### Minor Changes

- 63d1873: 账户新增封锁阈值，租户新增默认账户默认阈值以

### Patch Changes

- Updated dependencies [02d6a18]
- Updated dependencies [d822db7]
  - @scow/config@1.4.3
  - @scow/protos@1.0.9
  - @scow/rich-error-model@2.0.0
  - @scow/lib-scheduler-adapter@1.1.7

## 1.1.5

### Patch Changes

- 443187e: 修复数据统计相关功能时区转换问题
- 850bbcd: lib-server @scow/protos 从 devDependencies 移动到 dependencies
- Updated dependencies [3242957]
  - @scow/config@1.4.2
  - @scow/protos@1.0.8
  - @scow/rich-error-model@2.0.0
  - @scow/lib-scheduler-adapter@1.1.6

## 1.1.4

### Patch Changes

- Updated dependencies [afc3350]
- Updated dependencies [8d417ba]
- Updated dependencies [68447f7]
  - @scow/config@1.4.1

## 1.1.3

### Patch Changes

- Updated dependencies [d1c2e74]
- Updated dependencies [abb7e84]
  - @scow/config@1.4.0

## 1.1.2

### Patch Changes

- Updated dependencies [ec06733f9f]
  - @scow/config@1.3.0

## 1.1.1

### Patch Changes

- Updated dependencies [cad49a87d8]
  - @scow/config@1.2.1

## 1.1.0

### Minor Changes

- 5d2b75ccec: 增加用户指定系统语言功能，可以指定系统唯一语言不再进行语言切换，也可以指定进入 SCOW 时的默认初始语言

### Patch Changes

- Updated dependencies [a3d2f44af6]
- Updated dependencies [5d2b75ccec]
- Updated dependencies [f577d9d1e4]
  - @scow/config@1.2.0

## 1.0.1

### Patch Changes

- ccbde14304: 实现 SCOW 门户系统与管理系统的页面国际化功能

## 1.0.0

### Major Changes

- 11f94f716: 发布 1.0

## 0.2.0

### Minor Changes

- 7bd2578c4: SCOW API 增加静态 token 认证方法
