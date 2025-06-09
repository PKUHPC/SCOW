# @scow/scowd-protos

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
