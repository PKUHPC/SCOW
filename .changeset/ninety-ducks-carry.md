---
"@scow/config": minor
---

** 删除 ai/config.yaml下的 maxRunningTimeHours 配置 **
在集群下为各自不同的作业类别增加独立的作业最长运行时间配置

在集群 hpc 配置下增加 job.maxRunningTimeHours, app.maxRunningTimeHours
配置说明参考 docs/deploy/config/cluster-config.md 中集群下的 hpc 配置说明
在集群 ai 配置下增加 app.maxRunningTimeHours, train.maxRunningTimeHours, infer.maxRunningTimeHours
配置说明参考 docs/deploy/config/ai/intro.md 中集群下的 ai 配置说明

