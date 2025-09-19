---
"@scow/mis-server": patch
"@scow/resource": patch
---

修复导入用户时新建账户默认授权集群和分区没有写入，
修改导入用户时需要写入禁用授权应用的账户对象列表为全新未创建过的账户
