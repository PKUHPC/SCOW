---
sidebar_label: '多集群管理'
title: 多集群管理
slug: /multi_cluster
sidebar_position: 1
---

SCOW多集群部署架构如下图所示：

![img](multi-cluster.png)

:::tip

SCOW主要服务包括portal、mis、auth、gateway、db、audit、cli，支持多HPC集群管理，支持多种调度器(Slurm/CraneSched/K8S)。待接入的HPC集群需满足如下条件：

1. 所有集群都必须使用同一个LDAP；

1. 每个HPC集群NFS路径需相同，例如用户Home目录都为`/data/home`，软件安装目录都为`/data/software`。

SCOW多集群管理设置：

1. 在每个集群管理节点上启动一个适配器服务；
1. 每个集群有一个集群配置文件，即在`config/clusters`目录下每个集群有一个配置文件；
1. 支持每个集群独立的交互式应用配置，也支持所有集群使用全局交互式应用配置。

:::

SCOW接入多集群部署，与接入一个集群的区别主要在于：

(1) 每个slurm集群有一个集群配置文件，即在`config/clusters`目录下每个集群有一个配置文件，如下所示：

```Bash
# 集群显示名称
displayName: hpc01

#登录节点配置
loginNodes:
  - name: hpc01_login01
    address: hpc01_login01
    scowd:
      port: 9999

#适配器url配置
adapterUrl: "192.168.188.102:8999"
```

:::tip

每个集群配置文件请按照该集群的实际情况修改配置。

:::

(2) 各集群独立的交互式应用配置文件位于`config/clusters/{clusterID}/apps`目录下。也可以使用全局交互式应用配置，目录为`config/apps`(独立的优先级高于全局的)。
