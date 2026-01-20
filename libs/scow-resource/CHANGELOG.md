# @scow/lib-scow-resource

## 0.2.19

### Patch Changes

- Updated dependencies [0cb903e]
- Updated dependencies [36880eb]
  - @scow/config@1.12.1

## 0.2.18

### Patch Changes

- 3a16099: 升级 next 和相关依赖版本
- Updated dependencies [3a16099]
  - @scow/scow-resource-protos@0.3.1

## 0.2.17

### Patch Changes

- Updated dependencies [5b29d63]
- Updated dependencies [7b07e05]
- Updated dependencies [e5ff94c]
- Updated dependencies [ce6fc46]
  - @scow/config@1.12.0

## 0.2.16

### Patch Changes

- Updated dependencies [6f77b4e]
  - @scow/config@1.11.2

## 0.2.16

### Patch Changes

- Updated dependencies [6f77b4e]
  - @scow/config@1.11.2

## 0.2.15

### Patch Changes

- Updated dependencies [6752734]
- Updated dependencies [f0f144d]
- Updated dependencies [b326570]
- Updated dependencies [d556202]
  - @scow/config@1.11.1

## 0.2.14

### Patch Changes

- Updated dependencies [477db31]
- Updated dependencies [bf8afc6]
  - @scow/config@1.11.0

## 0.2.13

### Patch Changes

- Updated dependencies [50f3902]
- Updated dependencies [f0ecf70]
- Updated dependencies [cc28b1b]
  - @scow/config@1.10.0

## 0.2.12

### Patch Changes

- 45117e6: 在 AI,HPC 提交作业和交互式应用时增加用户账户，账户集群分区的鉴权
- Updated dependencies [a5f0e1d]
- Updated dependencies [2ea2e6a]
- Updated dependencies [58e7347]
- Updated dependencies [45117e6]
- Updated dependencies [9edf6f9]
- Updated dependencies [60709f3]
- Updated dependencies [e92c889]
- Updated dependencies [3ed0aa1]
  - @scow/config@1.9.0
  - @scow/scow-resource-protos@0.3.0

## 0.2.11

### Patch Changes

- Updated dependencies [579f164]
  - @scow/config@1.8.2

## 0.2.10

### Patch Changes

- Updated dependencies [562d068]
- Updated dependencies [e6cf7d0]
  - @scow/config@1.8.1

## 0.2.9

### Patch Changes

- 1874b38: 更新 next 14.2.4 至 14.2.30
- 0d36f92: 解封没有授权分区/队列的账户时删除调用 blockAccount 接口逻辑
  增加 AI 授权队列功能，在 AI 仪表盘、作业等页面增加获取授权队列逻辑
- Updated dependencies [778e6c7]
- Updated dependencies [b961d74]
- Updated dependencies [5da1b58]
- Updated dependencies [a4d7ac3]
  - @scow/config@1.8.0

## 0.2.8

### Patch Changes

- Updated dependencies [238a828]
  - @scow/config@1.7.2

## 0.2.7

### Patch Changes

- Updated dependencies [10b1fa2]
- Updated dependencies [0904fad]
  - @scow/config@1.7.1

## 0.2.6

### Patch Changes

- 28acbf5: 修复部分基于 Promise.allSettled 的报错处理或日志不全等问题
- Updated dependencies [80bee99]
- Updated dependencies [de86c6e]
  - @scow/config@1.7.0

## 0.2.5

### Patch Changes

- @scow/config@1.6.4

## 0.2.4

### Patch Changes

- bfad31b: 为资源管理系统、通知系统、管理系统、门户系统服务与服务之间的调用增加 token 校验,
  ** 注意，此 commit 之后，如配置资源管理系统或者通知系统，则需要配置 SCOW API Token **
- Updated dependencies [afaec8b]
  - @scow/config@1.6.3

## 0.2.3

### Patch Changes

- Updated dependencies [c641401]
- Updated dependencies [ca98dac]
  - @scow/config@1.6.2

## 0.2.2

### Patch Changes

- 56e0152: 更新 @grpc/grpc-js 到 1.12.2
- Updated dependencies [aeac587]
- Updated dependencies [1a531ed]
- Updated dependencies [56e0152]
  - @scow/config@1.6.1
  - @scow/scow-resource-protos@0.2.1

## 0.2.1

### Patch Changes

- Updated dependencies [bec8a37]
- Updated dependencies [a7e7585]
- Updated dependencies [6c6f8c6]
- Updated dependencies [701ebc7]
- Updated dependencies [aa94edc]
  - @scow/config@1.6.0

## 0.2.0

### Minor Changes

- 9895952: 新增资源管理系统，增加对租户/账户的集群，分区授权和取消授权的功能

### Patch Changes

- Updated dependencies [721b227]
- Updated dependencies [9895952]
  - @scow/config@1.5.3
  - @scow/scow-resource-protos@0.2.0
