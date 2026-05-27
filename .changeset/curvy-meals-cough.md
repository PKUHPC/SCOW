---
"@scow/cli": patch
"@scow/docs": patch
---

为 AI 集群的公共数据资产目录增加配置校验、远端创建命令和初始化模板指引。

- `check-config` 现在会在启用 AI 时校验集群是否配置了 `ai.clusterPublicPath`
- 新增 `create-configured-cluster-paths` 命令，可通过登录节点检查并创建已配置的公共数据资产目录
- `cli init` 生成的集群配置模板增加了 `ai.clusterPublicPath` 示例和使用说明
