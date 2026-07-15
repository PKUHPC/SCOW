---
"@scow/scow-adapters": patch
"@scow/mis-server": patch
"@scow/resource": patch
---

基于 scheduler adapter 的 partitionStrategy 优化创建账户和添加用户到账户流程：MIS 在资源管理开启时传递当前可开放分区，适配器在创建时直接收敛分区可用状态，减少创建后再封锁的窗口期，并修复空授权分区、账户封锁和后续重新授权场景下的状态一致性。
