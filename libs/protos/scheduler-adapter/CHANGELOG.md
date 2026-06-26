# @scow/scheduler-adapter-protos

## 1.6.1

### Patch Changes

- 013d085: 在创建开发机作业接口 CreateDevHost 中增加环境变量 env_variables 请求参数
- 9713fca: 1. GetJobsRequest 的 job_types 语义修改为：如果为空，返回 HPC 作业；如果有值，返回 AI 作业。如果适配器不支持对应作业类型，GetJobs 返回 UNIMPLEMENTED； 2. SubmitJob 的语义修改为：如果`extra_options[0]`为`app`或者`train`，则为提交 AI 作业了；其他情况为 HPC 作业
- 1db2326: 在 submitJob 接口中增加训练作业可选的 tensorboard_proxy_path_prefix 参数，表示训练作业中 TensorBoard 运行时 URL 路径前缀

## 1.6.0

### Minor Changes

- e4fc0d7: 新增 scheduler adapter 的本地 proto 定义，覆盖 account、app、config、job、node、user、version 等服务接口。

  同时将 generate 脚本改为直接基于仓库内 `./protos` 生成代码，便于与仓库内适配器实现保持同步迭代。

### Patch Changes

- 00d1161: 删除开源许可声明，统一执行 lint format

## 1.5.5

### Patch Changes

- 148099e: 重构 hpc 提交作业

## 1.5.4

### Patch Changes

- 344b2da: ai 进入容器从调用 k8sAPI 切换为调用适配器和集群删除 k8s 配置

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
