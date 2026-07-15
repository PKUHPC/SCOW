---
"@scow/scheduler-adapter-protos": patch
---

为 scheduler adapter 的 CreateAccount 请求增加 authorized_partitions 和 account_blocked，用于分别显式传递账户/资源维度授权分区和账户封锁状态；为 AddUserToAccount 请求增加 usable_partitions，用于显式传递新增用户当前实际可使用分区。两个接口均支持 use_all_partitions 显式沿用全量分区语义。
