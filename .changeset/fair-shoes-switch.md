---
"@scow/scow-adapters": patch
---

修复：1. 创建的新分区无法授权；2. 解封用户会将封锁的账户误解封；3. 修改 slurm.conf 后 scontrol reconfigure，缓存中的分区未更新。
