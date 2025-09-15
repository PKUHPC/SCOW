---
sidebar_position: 1
title: 存储管理
description: 配置开启集群存储管理
---

# 配置开启集群存储管理

## 修改 SCOW 集群配置文件

集群存储管理功能按集群维度进行开启，需要在 `config/clusters` 的集群配置文件下增加如下配置

```yaml title=config/clusters/[clusterid].yaml
# 可选，默认不开启
storage:
  # 必填，bool 类型
  enabled: true
  # 必填，字符串数组，代表当前需要被管理的文件系统挂载点
  # 当前 SCOW 仅支持一个挂载点
  paths: ["/data"]
  # 可选，默认未开启副本备份
  # 文件系统若有冗余备份数据时开启该配置
  replicaExist: true
```
## 修改 SCOWD 配置文件

须在 SCOWD `config` 配置目录下新增 `file.yaml` 文件，并添加如下内容

```yaml title=config/file.yaml
# mounts 在 file.yaml 结构最外层
mounts:
    # 文件系统挂载点
  - path: "/data"
    # 文件系统类型
    fs_type: "nfs"
    # 文件系统版本号
    version: "4.2"
```

当前 SCOWD 已明确支持的 `fs_type` 为 NFS 3.0+、Lustre 2.0+、 GPFS 4.0+、GPFS 5.0+ 和 OceanStor Pacific（华为存储） 8.2.1+。

### 各文件系统配置示例
#### NFS

目前 NFS 支持 3.0 以上版本
```yaml title=config/file.yaml
mounts:
    # 文件系统挂载点
  - path: "/data"
    # 文件系统类型
    fs_type: "nfs"
    # 文件系统版本号
    version: "3.0"
```

#### Lustre

目前 Lustre 支持 2.0 以上版本

```yaml title=config/file.yaml
mounts:
  - path: "/mnt/lfs"
    fs_type: "lfs"
    version: "2.0"
```
#### GPFS

目前 GPFS 支持 4.0 以上版本

```yaml title=config/file.yaml
mounts:
  - path: "/mnt/gpfs"
    fs_type: "gpfs"
    version: "4.0"
    params:
      # gpfs 文件系统名称，可能与 path 不一致
      filesystem: share
```

#### OceanStor Pacific（华为存储）

目前 OceanStor Pacific（华为存储）支持 8.2.1 版本

```yaml title=config/file.yaml
mounts:
  - path: "/mnt/huawei"
    fs_type: "OceanStor Pacific"
    version: "8.2.1"
    params:
      # 挂载的目录的所属命名空间 ID
      namespace_id: 123
      # 管理员用户名
      username: admin
      # 管理员密码
      password: password
      # 存储访问 url
      base_url: http://127.0.0.1:1234
```

