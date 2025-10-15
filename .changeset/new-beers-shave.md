---
"@scow/mis-server": patch
"@scow/resource": patch
"@scow/ai": patch
"@scow/docs": patch
---

修复当系统正在运行同步任务时退出后，再次启动系统后无法执行账户用户相关操作的问题;
在 AccountUserSyncRecord 实体中增加 sync_status 索引
