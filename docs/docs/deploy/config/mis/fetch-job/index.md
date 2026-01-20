---
sidebar_position: 8
title: 从适配器同步作业配置
---

# 从适配器同步作业配置

在 `config/mis.yaml` 中通过 `fetchJobs` 配置作业获取与正在运行作业扣费的行为。

```yaml title="config/mis.yaml"
fetchJobs:
  # 从哪个时间点开始获取结束作业信息(ISO 8601)
  startDate: "2024-01-01T00:00:00Z"

  # 为防止一次获取过多作业占用过多内存，限制单次获取数量，默认 10000
  batchSize: 10000

  # 周期性获取结束作业
  periodicFetch:
    # 是否启用周期任务，默认 true
    enabled: true
    # 获取信息的 cron 表达式，默认每10分钟一次
    cron: "*/10 * * * *"

  # 拉取已结束作业时，结束时间基于当前scow节点时间向前的偏移量
  endTimeDelaySeconds: 5

  # 正在运行作业的最小扣费间隔（小时），默认 1 小时
  runningJobBillingMinDurationHours: 1
```

## 配置项说明

- `startDate`：仅在首次启动时生效，用于指定从哪个时间点开始同步已结束的作业信息。
- `batchSize`：单批获取结束作业的最大条数，过大可能导致内存占用升高。
- `periodicFetch.enabled`：是否启用定时任务自动获取结束作业。
- `periodicFetch.cron`：定时任务的 cron 表达式。
- `endTimeDelaySeconds`：拉取已结束作业时，结束时间基于当前scow节点时间向前的偏移量，默认 5 秒，作用是防止当前时间结束的作业还未被slurm或鹤思持久化到数据库。
- `runningJobBillingMinDurationHours`：对运行中作业的扣费间隔，下次扣费需与上次扣费间隔达到此时间，单位小时
