---
sidebar_position: 1
title: 配置调度器适配器
---

# 配置调度器适配器

SCOW 通过调度器适配器与集群底层调度器交互。每个集群的适配器地址仍在
`config/clusters/{集群ID}.yaml` 的 `adapterUrl` 中配置。本节介绍所有适配器调用共用的超时时间配置。

## 配置适配器调用超时时间

在 `install.yaml` 的顶层 `adapter` 配置中设置 `timeoutSeconds`，单位为秒，必须是大于等于 1 的整数：

```yaml title="install.yaml"
# 可选配置，不配置时使用默认值 60 秒
adapter:
  # 适配器 unary gRPC 调用的默认超时时间，单位秒
  timeoutSeconds: 180
```

如果未配置 `adapter.timeoutSeconds`，默认超时时间为 60 秒，与现有版本保持一致。

该配置应用于 Portal、MIS、AI、Quantum 和 Resource 服务发起的适配器调用，也应用于
`scow-cli check-clusters` 的适配器连通性检查。调用中显式指定的 gRPC deadline 仍会优先使用调用自身的值。

修改配置后，请重新生成 compose 配置并重启服务：

```bash
./cli compose restart
```
