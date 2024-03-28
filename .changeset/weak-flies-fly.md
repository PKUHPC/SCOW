---
"@scow/mis-server": patch
"@scow/mis-web": patch
"@scow/lib-web": patch
---

修改 UserAccount 实体中原 status 字段名为 blocked_in_cluster ,表示在集群中是否为封锁状态
增加字段 state ,允许写入的值为 "NORMAL" ,  "BLOCKED_BY_ADMIN" 的枚举值
页面增加用户在账户下的 限额 的状态的显示
