---
"@scow/mis-server": patch
"@scow/mis-web": patch
"@scow/docs": patch
---

为适配不同调度系统对主机名大小写处理不一致的情况，节点迁移功能在跨集群状态比对时采用大小写不敏感匹配
