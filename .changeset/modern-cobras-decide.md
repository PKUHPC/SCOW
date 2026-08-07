---
"@scow/grpc-api": patch
---

为作业相关 gRPC 响应补充租户名称字段。

- `common.JobInfo` 增加 `tenant_name`，用于已结束作业列表返回所属租户。
- `common.RunningJob` 增加 `tenant_name`，用于运行中作业列表返回所属租户。
- `server.QuantumJobInfo` 增加 `tenant_name`，用于量子作业列表返回所属租户。
