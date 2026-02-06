# @scow/lib-operation-log

## 2.2.12

### Patch Changes

- cf47ef2: 修复所有使用 grpc 项目的内存泄露问题
  - @scow/protos@1.0.37

## 2.2.11

### Patch Changes

- Updated dependencies [1154951]
  - @scow/protos@1.0.36

## 2.2.10

### Patch Changes

- c495538: 批量更新租户管理下已结束的作业价格，并增加操作日志
- Updated dependencies [a5eedd1]
  - @scow/protos@1.0.35

## 2.2.9

### Patch Changes

- @scow/protos@1.0.34

## 2.2.8

### Patch Changes

- @scow/protos@1.0.33

## 2.2.7

### Patch Changes

- @scow/protos@1.0.32

## 2.2.7

### Patch Changes

- @scow/protos@1.0.32

## 2.2.6

### Patch Changes

- f0f144d: 存储管理新增定时同步使用量和批量修改用户存储配额等功能
  - @scow/protos@1.0.31

## 2.2.5

### Patch Changes

- Updated dependencies [b645b74]
- Updated dependencies [b645b74]
  - @scow/protos@1.0.30

## 2.2.4

### Patch Changes

- f0ecf70: AI 新增申请开发机功能
  - @scow/protos@1.0.29

## 2.2.3

### Patch Changes

- Updated dependencies [58e7347]
  - @scow/protos@1.0.28

## 2.2.2

### Patch Changes

- @scow/protos@1.0.27

## 2.2.1

### Patch Changes

- ff956a2: 增加表单 tenant_default_app_removed_list, 增加租户默认授权应用的功能
  - @scow/protos@1.0.26

## 2.2.0

### Minor Changes

- 5da1b58: 新增租户管理员存储管理功能
- 778e6c7: 在管理系统增加对租户/账户授权交互式应用功能，在审计系统内增加授权/取消授权的日志
  并在 HPC 系统和 AI 系统实现仅展示可用应用

### Patch Changes

- b961d74: 增加节点迁移页面与功能
  - @scow/protos@1.0.25

## 2.1.18

### Patch Changes

- 7482019: 登录功能增强：一、支持在用户初次登录、密码重置后登录系统时的强制变更密码功能。二、当用户身份鉴别尝试失败次数达到设定的次数后（可自定义），对该用户进行锁定，并且只能由管理员恢复。
- Updated dependencies [59fb3b4]
- Updated dependencies [7482019]
  - @scow/protos@1.0.24

## 2.1.17

### Patch Changes

- de86c6e: 新增 HPC 交互式应用中对保留配置项的自定义配置功能，同时新增 HTML 表单的文件路径配置功能
  在 HPC 中新增加强版文件选择组件，包括文件解压缩功能
  修复 AI 中文件解压缩的错误提示及路径刷新等问题
- Updated dependencies [40b9478]
- Updated dependencies [67c32a5]
  - @scow/protos@1.0.23

## 2.1.16

### Patch Changes

- 916aebc: HPC 文件管理新增文件夹上传，在线压缩和压缩下载功能
  - @scow/protos@1.0.22

## 2.1.15

### Patch Changes

- 00b83a0: 增加推理功能
  - @scow/protos@1.0.21

## 2.1.14

### Patch Changes

- cd75359: 用户修改自身密码和邮箱增加操作日志
  - @scow/protos@1.0.20

## 2.1.13

### Patch Changes

- 46dfcf9: 增加导出已结束作业功能
  - @scow/protos@1.0.19

## 2.1.12

### Patch Changes

- b0a38e0: 用户表增加手机、组织和备注字段并允许平台和租户管理员修改用户信息
  - @scow/protos@1.0.18

## 2.1.11

### Patch Changes

- 56e0152: 更新 @grpc/grpc-js 到 1.12.2
- Updated dependencies [56e0152]
  - @scow/protos@1.0.17

## 2.1.10

### Patch Changes

- 6c6f8c6: 新增删除用户账户功能以及用户账户的删除状态带来的其他相关接口与测试文件完善
  - @scow/protos@1.0.16

## 2.1.9

### Patch Changes

- 721b227: 新增消息系统
  - @scow/protos@1.0.15

## 2.1.8

### Patch Changes

- abd69cb: 接入 scowd 文件分片上传
  - @scow/protos@1.0.14

## 2.1.7

### Patch Changes

- e9c8bfa: 增加 ai 的操作日志，涉及文件、镜像、数据集、算法、模型和作业应用'
  - @scow/protos@1.0.13

## 2.1.6

### Patch Changes

- @scow/protos@1.0.12

## 2.1.5

### Patch Changes

- @scow/protos@1.0.11

## 2.1.4

### Patch Changes

- @scow/protos@1.0.10

## 2.1.3

### Patch Changes

- 24db413: 操作日志增加自定义操作类型
  - @scow/protos@1.0.9

## 2.1.2

### Patch Changes

- @scow/protos@1.0.8

## 2.1.1

### Patch Changes

- @scow/protos@1.0.7

## 2.1.0

### Minor Changes

- 081fbcf: 管理系统新增用户列表，账户列表，消费记录，充值记录，操作记录的数据导出 csv 文件功能

### Patch Changes

- @scow/protos@1.0.6

## 2.0.5

### Patch Changes

- @scow/protos@1.0.5

## 2.0.4

### Patch Changes

- @scow/protos@1.0.4

## 2.0.3

### Patch Changes

- @scow/protos@1.0.3

## 2.0.2

### Patch Changes

- @scow/protos@1.0.2

## 2.0.1

### Patch Changes

- @scow/protos@1.0.1

## 2.0.0

### Major Changes

- 11f94f716: 发布 1.0

### Minor Changes

- ee89b11b9: 新增审计系统服务，记录门户系统及管理系统操作日志及展示

### Patch Changes

- 946b1782a: 修改作业时限操作日志内容展示修复及创建操作日志错误捕获 bug 修复
- a8034f395: 移除不必要的操作日志记录成功 log
- Updated dependencies [ee89b11b9]
- Updated dependencies [11f94f716]
  - @scow/protos@1.0.0
