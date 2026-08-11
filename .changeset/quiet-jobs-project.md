---
"@scow/grpc-api": minor
"@scow/mis-server": patch
"@scow/lib-server": patch
---

新增支持按字段投影查询历史作业的 `GetJobsWithFields` RPC，并在获取历史作业提交时间时使用轻量查询。
