---
sidebar_position: 2
title: scowd 配置迁移
---

# scowd 配置迁移

所有集群现均依赖 scowd 提供文件、作业、应用、Shell 和桌面等能力，集群不能再通过 `scowd.enabled` 关闭 scowd。

## 修改集群配置

删除 `config/clusters/*.yaml` 中的集群级 `scowd.enabled`，并将每个登录节点配置为对象，为其补充 scowd 监听端口：

```yaml title="config/clusters/hpc01.yaml"
displayName: hpc01
adapterUrl: 192.168.1.10:8999

loginNodes:
  - name: login01
    address: 192.168.1.11
    scowd:
      port: 9999
```

旧的 `scowd.enabled` 字段会被忽略，建议删除以免产生误解。旧的字符串登录节点格式不再支持，例如：

```yaml
loginNodes:
  - login01
```

必须将其改为前述对象格式。每个集群必须至少配置一个登录节点，并为每个节点配置
`loginNodes[].scowd.port`。端口必须是 `1` 到 `65535` 之间的整数，缺少登录节点、端口缺失或端口无效时，
配置检查都会直接报错。

## TLS 配置

`install.yaml` 中的 `scowd.ssl.enabled` 仍然有效，只控制 SCOW 服务连接 scowd 时是否使用 TLS，不是系统级启停开关。

## 检查配置

修改完成后，在启动服务前运行：

```bash
./cli check-config
./cli check-clusters
```

`check-clusters` 会检查所有集群登录节点的 scowd 健康状态。scowd 不可用时会输出实际的连接或健康检查错误。
