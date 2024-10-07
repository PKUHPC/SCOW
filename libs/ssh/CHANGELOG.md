# @scow/lib-ssh

## 1.0.3

### Patch Changes

- 7c96613: 修改更名后的链接地址和文档描述

## 1.0.2

### Patch Changes

- 0275a9e: 修复系统初始化时因无法通过鉴权可用集群为空的问题

## 1.0.1

### Patch Changes

- f42488eb9e: 创建家目录时默认权限为 740
- a79aa109bb: sshConnect 时，提示语过长会使得连接失败，现在捕获了这个错误并提示用户

## 1.0.0

### Major Changes

- 11f94f716: 发布 1.0

## 0.4.0

### Minor Changes

- 5b7f0e88f: 重构 scow，对接调度器适配器接口

## 0.3.0

### Minor Changes

- 1562ebbd2: 提交作业时增加 GPU 选项

### Patch Changes

- 5c066e4a5: 配置 SCOW 免密认证时，如果用户的 authorized_keys 已存在，则将 SCOW 的公钥插入，而不覆盖已有的 authorized_keys 文件

## 0.2.0

### Minor Changes

- 86e0f5b2d: 整个系统打包为一个镜像

### Patch Changes

- 419184a93: 统一处理多个 sftp 操作命令报错
