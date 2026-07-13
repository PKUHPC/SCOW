---
"@scow/mis-server": patch
---

从账户中移除用户时，所有适配器返回的 Error 都是NOT_FOUND，scow 删除该条关系、移出用户时不自动封锁用户
