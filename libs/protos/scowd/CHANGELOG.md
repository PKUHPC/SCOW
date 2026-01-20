# @scow/scowd-protos

## 0.3.4

### Patch Changes

- 3a16099: 升级 next 和相关依赖版本

## 0.3.3

### Patch Changes

- 4bd522e: connectToApp 接口新增 jobId 参数
- 64fb141: scow 接入 scowd 版跨集群文件传输

## 0.3.2

### Patch Changes

- 6f77b4e: 文件管理新增软链接处理，并增加不同文件类型的 icon

## 0.3.2

### Patch Changes

- 6f77b4e: 文件管理新增软链接处理，并增加不同文件类型的 icon

## 0.3.1

### Patch Changes

- 25d6396: 在 file.writeFile 下增加可选请求参数 append，表示写入时是否只在末尾加入而不创建或覆盖

## 0.3.0

### Minor Changes

- 5da1b58: 新增租户管理员存储管理功能

### Patch Changes

- eb1f439: 修复内存泄漏问题

## 0.2.7

### Patch Changes

- 083d57b: 增加了镜像部分接口，修改了文件的 ChangeMode 和 getFileMetaData

## 0.2.6

### Patch Changes

- 1363e71: 实现 SCOWD 的文件解压缩，并在 SCOWD 开启时文件管理下增加解压缩功能
- f9c0e7b: 将 sumbitJob 和 submitJobAsFile 接口中 ssh 相关替换为 scowd

## 0.2.5

### Patch Changes

- 6be7582: scowd 替换除跨集群文件传输外的 ssh 所有相关逻辑

## 0.2.4

### Patch Changes

- 916aebc: HPC 文件管理新增文件夹上传，在线压缩和压缩下载功能

## 0.2.3

### Patch Changes

- bb0b697: 交互式应用全面接入 scowd

## 0.2.2

### Patch Changes

- 721b227: 新增消息系统

## 0.2.1

### Patch Changes

- ac6805d: scowd 新增 app service 和 GetAppLastSubmission 接口
- abd69cb: 接入 scowd 文件分片上传

## 0.2.0

### Minor Changes

- 806f778: 增加 HPC 文件和桌面功能的 scowd 支持
