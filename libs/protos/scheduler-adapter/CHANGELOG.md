# @scow/scheduler-adapter-protos

## 1.5.3

### Patch Changes

- 597ac23: 刷新交互时应用密码优先通过适配器获取

## 1.5.2

### Patch Changes

- 963a2b8: 使用统一的适配器接口

## 1.5.1

### Patch Changes

- cb4c2e8: 修正 hpc 的 adapter-interface 版本

## 1.5.0

### Minor Changes

- b961d74: **节点迁移功能**需要**1.8.0 及以上版本**的接口
- a4d7ac3: **同步账户/用户信息功能**需要**1.9.0 及以上版本**的接口

## 1.4.1

### Patch Changes

- 56e0152: 更新 @grpc/grpc-js 到 1.12.2

## 1.4.0

### Minor Changes

- 6c6f8c6: **删除账户用户功能**需要**1.7.0 及以上版本**的接口

## 1.3.2

### Patch Changes

- 753a996: AI 增加多机多卡分布式训练和对华为 GPU 的特殊处理
- 66a96ba: 修复了门户系统中节点在不同集群中重复计数的问题

## 1.3.1

### Patch Changes

- e312efb: ai 增加 vnc 功能，以 shell 方式进入容器功能和提交作业的优化

## 1.3.0

### Minor Changes

- 26bd8e7: **文件系统直接提交脚本任务功能**需要**1.5.0 及以上版本**的接口

## 1.2.0

### Minor Changes

- ec06733f9f: 门户仪表盘删除之前的配置标题和文字，增加平台队列状态展示

## 1.1.0

### Minor Changes

- 135f2b1be3: 在门户系统的文件管理下，新增将文件直接作为作业文本提交调度器执行的功能，如果调度器 API 版本低于此接口版本报错

## 1.0.0

### Major Changes

- 11f94f716: 发布 1.0

## 0.2.0

### Minor Changes

- 5b7f0e88f: 重构 scow，对接调度器适配器接口
