---
"@scow/portal-server": patch
"@scow/portal-web": patch
"@scow/ai": patch
---

删除高性能计算与人工智能系统中交互式应用 10s 自动刷新UI,
添加 ended_sessions.json 文件，存储已结束的交互式应用session信息，优化后台查询性能
