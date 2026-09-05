# @scow/utils

## 1.1.6

### Patch Changes

- d3b7488: 优化 HPC 作业管理页面，支持按账户、状态、作业 ID、作业名及提交/结束时间筛选，并统一未结束作业与历史作业入口。新增通用日期时间范围选择组件，并替换 MIS 和 Portal 中的时间筛选框组件。
- 3cbaa69: 支持为 Portal 交互式应用文件路径属性配置仅文件或仅目录，并可按完整文件扩展名过滤和校验文件

## 1.1.5

### Patch Changes

- c2f0c1c: 为 hpc 的工作目录和 ai 的工作目录、挂载点、镜像地址增加后端校验

## 1.1.4

### Patch Changes

- 00d1161: 删除开源许可声明，统一执行 lint format
- 839c754: 修复 tsconfig rootDir 配置导致构建产物路径错误

## 1.1.3

### Patch Changes

- a91add6: 交互式应用表单项新增支持配置动态下拉框

## 1.1.2

### Patch Changes

- 36880eb: 新增多个系统语言

## 1.1.1

### Patch Changes

- a9e9011: 修复获取 scowdClient 时拼接地址的错误

## 1.1.0

### Minor Changes

- 135f2b1be3: 在门户系统的文件管理下，新增将文件直接作为作业文本提交调度器执行的功能，如果调度器 API 版本低于此接口版本报错

## 1.0.0

### Major Changes

- 11f94f716: 发布 1.0

## 0.1.2

### Patch Changes

- bdc990a0c: 系统启动时，各个容器在日志中打印版本信息

## 0.1.1

### Patch Changes

- c24e21662: publish .d.ts files
