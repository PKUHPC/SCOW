---
"@scow/docs": patch
"@scow/cli": patch
---

补充集群配置中 `hpc.enabled` 的说明：该配置未显式配置时默认为 `true`；
纯 AI 集群（如 k8s 集群）应显式配置为 `false`，避免管理系统对该集群调用 HPC 相关逻辑；
同时承载 HPC 和 AI 业务的超智算集群可同时开启 `hpc.enabled` 和 `ai.enabled`。
