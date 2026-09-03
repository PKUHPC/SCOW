---
"@scow/config": minor
"@scow/cli": patch
"@scow/portal-server": patch
"@scow/mis-server": patch
"@scow/ai": patch
"@scow/quantum": patch
"@scow/resource": patch
"@scow/docs": patch
---

新增全局 `adapter.timeoutSeconds` 配置，用于调整调度器适配器调用的默认超时时间，未配置时默认为 60 秒。
