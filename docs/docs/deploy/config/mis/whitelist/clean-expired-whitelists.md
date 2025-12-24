---
sidebar_position: 2
title: 清理过期白名单
description: 配置清理过期白名单的定时任务
---

# 清理过期白名单

系统会自动清理过期的白名单账户，默认在每天凌晨 0 点执行一次。

## 自定义配置周期

该配置主要用于开发和测试目的，生产环境建议保持默认设置。

您可以通过修改配置文件 `config/mis.yaml` 来修改定时任务的 cron 表达式。

```yaml title="config/mis.yaml"
# 清理过期白名单
cleanExpiredWhitelists:
  # 是否开启
  enabled: true
  # 周期的cron表达式
  cron: "0 0 * * *"
```

- **enabled**: 是否启用该定时任务，默认为 `true`。
- **cron**: Cron 表达式，默认为 `0 0 * * *` (每天凌晨 0 点)。

:::warning

修改此配置可能会影响系统的性能或业务逻辑，请谨慎操作。生产环境建议使用默认值。

:::
