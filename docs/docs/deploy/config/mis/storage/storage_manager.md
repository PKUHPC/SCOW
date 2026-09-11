---
sidebar_position: 1
title: 存储管理配置
description: 集群存储管理相关配置
---

# 存储管理配置

## 开启集群存储管理

SCOW 支持多存储后端，存储系统与集群解耦，通过两个配置文件共同管理：

- `config/storage.yaml`：全局存储系统定义（存储 ID、文件系统类型、配额管理开关等）
- `config/clusters/[clusterid].yaml`：集群侧挂载映射（将存储 ID 与集群内挂载点绑定）

### 新增全局存储配置文件

在 `config` 目录下新增 `storage.yaml` 文件，配置系统中所有存储系统的基本信息：

```yaml title=config/storage.yaml
storages:
  - storageId: "nfs1" # 存储系统的唯一标识符
    displayName: "共享存储1" # 可选，展示名称，支持国际化，默认使用 storageId
    quotaEnabled: false # 是否开启配额管理，默认 false
    replicaExist: false # 文件系统是否存在冗余备份副本 默认false
    fs:
      type: "nfs" # 文件系统类型，枚举值见下方说明
      nfs:
        version: "4.2" # 文件系统版本号，仅支持一至三段数字，如 4、4.2 或 4.2.0

  - storageId: "gpfs1"
    displayName: "GPFS 存储"
    quotaEnabled: true
    replicaExist: false
    fs:
      type: "gpfs"
      gpfs:
        version: "5.0"
        filesystem: "gpfs_share" # GPFS 文件系统名称，可能与挂载路径不一致
```

文件系统的 `version` 必须使用引号配置为字符串，支持一至三段由点分隔的数字，例如 `"4"`、`"4.2"` 或 `"4.2.0"`。不支持四段及以上版本（如 `"1.2.3.4"`），也不支持带 `v` 前缀等非纯数字格式。

`fs.type` 支持的枚举值及最低版本要求：

| `fs.type`          | 文件系统                      | 最低版本 |
| ------------------ | ----------------------------- | -------- |
| `nfs`              | NFS                           | 3.0      |
| `lfs`              | Lustre                        | 2.0      |
| `gpfs`             | GPFS                          | 4.0      |
| `oceanStorPacific` | OceanStor Pacific（华为存储） | 8.2.1    |

#### 各文件系统配置示例

##### NFS

```yaml title=config/storage.yaml
storages:
  - storageId: "nfs1"
    displayName: "NFS 存储"
    quotaEnabled: true
    replicaExist: false
    fs:
      type: "nfs"
      nfs:
        version: "4.2"
```

##### Lustre

```yaml title=config/storage.yaml
storages:
  - storageId: "lfs1"
    displayName: "Lustre 存储"
    quotaEnabled: true
    replicaExist: false
    fs:
      type: "lfs"
      lfs:
        version: "2.14"
```

##### GPFS

```yaml title=config/storage.yaml
storages:
  - storageId: "gpfs1"
    displayName: "GPFS 存储"
    quotaEnabled: true
    replicaExist: false
    fs:
      type: "gpfs"
      gpfs:
        version: "5.0"
        # GPFS 文件系统名称，可能与挂载路径不一致
        filesystem: "gpfs_share"
```

##### OceanStor Pacific（华为存储）

```yaml title=config/storage.yaml
storages:
  - storageId: "huawei1"
    displayName: "华为存储"
    quotaEnabled: true
    replicaExist: true
    fs:
      type: "oceanStorPacific"
      oceanStorPacific:
        version: "8.2.1"
        # 挂载目录所属命名空间 ID
        namespaceId: "123"
        # 管理员用户名
        username: admin
        # 管理员密码
        password: password
        # 存储访问 URL
        baseUrl: "http://127.0.0.1:1234"
```

### 修改集群配置文件

在 `config/clusters/[clusterid].yaml` 中添加 `entryPaths` 字段，将存储系统与集群挂载点绑定：

```yaml title=config/clusters/[clusterid].yaml
entryPaths:
  # 必填。启用存储管理时，必须与 storage.yaml 中的 storageId 对应
  - storageId: "nfs1"
    # 必填，当前存储系统在此集群上的挂载点（一个存储系统在同一集群下仅支持一个挂载点）
    mountPath: "/data/nfs1"

  - storageId: "gpfs1"
    mountPath: "/data/gpfs"
```

:::note
同一集群下 `storageId` 和 `mountPath` 均不能重复。

当已配置 `config/storage.yaml` 且 `storages` 非空时，`entryPaths` 中的每个 `storageId` 必须已在 `storage.yaml` 中定义，否则配置校验会失败，相关服务无法启动。

如果未配置 `storage.yaml`，`entryPaths` 可用于文件管理快捷路径和挂载点描述，但存储配额管理功能不可用。
:::

如需为文件管理器配置快捷路径入口（支持路径模板和国际化显示名称），请参考[集群快捷路径自定义](../../customization/cluster-entry-paths.md)。

### SCOWD 实现存储配额管理

SCOWD 在登录节点上通过 `root` 权限设置和查看用户的存储配额。登录节点一般可能是文件系统的客户端而非服务端，所以需要开启客户端设置用户配额的权限。

## 配置存储使用量同步

修改管理系统配置文件 `mis.yaml` 添加如下配置。存储使用量同步默认每小时整点执行一次。

```yaml title=config/mis.yaml
# 可选
periodicSyncStorageData:
  # 默认开启
  enabled: true
  # 默认每小时整点执行一次，如果按照使用量计费，其频率不能低于每天一次
  cron: "0 * * * *"
```

## 账户存储配额管理

SCOW 支持对账户进行独立的存储配额限制。开启后，租户管理员可以为每个账户单独设置存储配额上限，也可以设置租户级别的默认配额。

### 功能概述

- 每个账户对应一个 Linux 文件系统用户组，账户成员的存储使用量统一计入该组配额
- 启用后，系统会将账户成员迁移至专属账户组，并在存储后端为该组设置配额
- 该功能为**不可逆操作**，一旦启用，无法回退到启用前的状态

### 前提条件

开启账户存储配额功能需满足以下条件：

1. **存储配置已开启配额管理**：`storage.yaml` 中对应存储的 `quotaEnabled` 必须为 `true`
2. **没有同时属于多个账户的用户**：若存在某用户同时是多个账户的成员，则无法启用（该用户只能属于一个账户组）
3. **没有用户存在多余用户组**：若某用户除自身用户组和账户对应的组外还属于其他组，则无法启用

### 启用账户存储配额

平台管理员可在平台管理的**账户存储配额**页面点击**启用**按钮，发起启用流程后，将用户的主组从个人用户组切换为账户对应的组，同时将所有用户的家目录以及所有存储下的个人目录文件所属组修改为账户对应的组。

:::note
**启用账户存储配额为不可逆操作**，确认后无法撤销。请在确认前仔细核实集群存储环境已完成相应配置。
:::

## 存储计费相关配置

SCOW 支持对用户、账户使用存储进行计费。

### 功能概述
- 支持按使用量或按配额计费
- 新增平台管理和租户管理下的存储计费功能
- 系统会按照配置的时间点统计并扣除前一天的存储费用

### 前提条件
- 采用使用量计费时，periodicSyncStorageData中的cron频率每天至少一次

### 启用
存储计费功能默认关闭，如果需要对存储使用进行计费，修改管理系统配置文件 `mis.yaml` 添加如下配置。

```yaml title=config/mis.yaml
storageBilling:
  # 是否启用存储计费功能，默认 false
  enabled: false

  # 存储计费时间点 cron 表达式，默认每天凌晨 2 点执行
  # 只能修改前面两个参数，默认计昨天的存储费用
  cron: "0 2 * * *"

  # 存储费用的扣费类型名称（写入 ChargeRecord.type）
  chargeType: "存储费用"

  # 账户封锁/欠费或用户被封锁时是否继续计费，如果冲突，以 chargeWhenBlocked 优先
  # true：继续计费（按使用量时按实际使用量，按配额时因配额已清除而停止）
  # false：停止计费
  chargeWhenBlocked: false
```
