# @scow/meta-server

## 1.11.6

### Patch Changes

- 9bc9514: 将管理、审计、资源管理和消息系统调整为始终启用的基础系统，系统级启停字段不再生效，删除相关运行时开关；移除 `allowAppAuthorization` 配置项，应用授权功能调整为始终启用；并要求配置至少 32 个字符的 SCOW API token。`scow-cli init` 现在会自动生成安全随机的 API token，并在覆盖初始化时安全保留符合长度要求的已有 token。
- Updated dependencies [025d6b1]
- Updated dependencies [7e0b13e]
- Updated dependencies [3cbaa69]
- Updated dependencies [9bc9514]
- Updated dependencies [9bc9514]
- Updated dependencies [d3b7488]
- Updated dependencies [3cbaa69]
  - @scow/config@2.0.0
  - @scow/utils@1.1.6

## 1.11.5

### Patch Changes

- Updated dependencies [afdf408]
- Updated dependencies [c2f0c1c]
  - @scow/config@1.16.2
  - @scow/utils@1.1.5

## 1.11.4

### Patch Changes

- Updated dependencies [3567ac0]
  - @scow/config@1.16.1

## 1.11.3

### Patch Changes

- d7e28d9: feat(scowctl): 添加 macos-arm64 构建
- Updated dependencies [59348c8]
- Updated dependencies [68309f0]
  - @scow/config@1.16.0

## 1.11.2

### Patch Changes

- 439e7ed: 添加 scowctl 用户命令行工具 和 meta-server 提供部署元信息以及统一 API 文档。 修改了的文档：API: docs/docs/integration/scow-api-hook/api/api ； scowctl: docs/docs/info/scowctl
- Updated dependencies [87682ee]
- Updated dependencies [46c4f2c]
- Updated dependencies [439e7ed]
- Updated dependencies [00d1161]
- Updated dependencies [96ede62]
- Updated dependencies [839c754]
  - @scow/config@1.15.0
  - @scow/lib-config@1.0.9
  - @scow/utils@1.1.4
