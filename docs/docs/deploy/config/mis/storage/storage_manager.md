---
sidebar_position: 1
title: storage_manager
description: 开启集群存储管理的配置
---

# 配置开启集群存储管理

## 修改 SCOW 集群配置文件

集群存储管理功能按集群维度进行开启，需要在 `config/clusters` 的集群配置文件下增加如下配置

```yaml
# 可选，默认不开启
storage:
  # 必填，bool 类型
  enabled: true
  # 必填，字符串数组，代表当前需要被管理的文件系统挂载点
  # 当前 SCOW 仅支持一个挂载点
  paths: ["/data"]

```
## 修改 SCOWD 配置文件

须在 SCOWD `config` 配置目录下新增 `file.yaml` 文件，并添加如下内容

```yaml
mounts:
    # 文件系统挂载点
  - path: "/data"
    # 文件系统类型
    fs_type: "nfs"
    # 文件系统版本号
    version: "4.2"
```

当前 SCOWD 已支持的 `fs_type` 为 nfs 3.0+、OceanStor Pacific（华为存储） 8.2.1+。
