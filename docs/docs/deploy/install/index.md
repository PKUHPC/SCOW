---
sidebar_position: 1
title: 安装
description: 如何在已有超算集群上部署SCOW系统
---

# 安装

本节介绍如何在已有的超算集群上部署SCOW系统。您可参考本文档在生产环境中部署SCOW。

## 一.  前提条件

1. **slurm集群准备完毕**
   - 版本为`21.08.4`及以上
   - 已经部署slurm的[Accounting](https://slurm.schedmd.com/accounting.html#database-configuration)功能
   - 部署slurm集群可参考[slurm集群部署实践](/docs/hpccluster)
2. **slurm集群各节点实现了LDAP认证**，提供两个基于CentOS7的脚本用来快速搭建和配置LDAP，修改两个文件开头部分的相关配置（`Start Configuratin Part`和`End Configuration Part`之间的变量），运行即可：
   - [provider.sh](https://github.com/PKUHPC/private-scow/blob/master/dev/ldap/provider.sh): 用于配置LDAP服务器
   - [client.sh](https://github.com/PKUHPC/private-scow/blob/master/dev/ldap/client.sh): 用于配置LDAP客户端(slurm集群所有节点都需要执行)
3. **slurm集群挂载了并行文件系统**，例如lustre、gpfs等，提供[NFS的搭建](/docs/hpccluster/nfs)供参考；
4. 登录节点和计算节点安装TurboVNC，版本3.0以上，[官方安装教程](https://turbovnc.org/Downloads/YUM)；
5. 登录节点安装桌面，例如Xfce、KDE、MATE等。



## 二.  部署流程

### 1. 准备SCOW部署节点

我们推荐将SCOW部署在一个**单独**的节点上。下文称部署这些组件的节点为**服务节点**，要求如下：

- 最小配置：8C16G，推荐配置(生产级)：16C32G；
- 与slurm集群各节点网络可达，或者至少与slurm集群登录节点和管理节点网络可达([代理网关方案](/docs/deploy/config/portal/proxy-gateway))。

- **服务节点**可以免密以root用户SSH登录到slurm集群各个**登录节点**，并且**服务节点**的`~/.ssh`目录下有登录所需要的`id_rsa.pub`和`id_rsa`文件
  - 运行所有部署的命令用户不需要为root，但是此用户的`~/.ssh`下的密钥对需可以以root用户登录登录节点
- **服务节点/代理网关节点**可以SSH连接到所有**计算节点**，并且**计算节点**和**登录节点**的所有用户共享同样的`SSH authorized_keys`配置文件

:::caution

因为[这个issue](https://github.com/mscdex/ssh2/issues/989)，如果您的登录节点和计算节点的所使用的OpenSSH的版本高于**8.2**（大多比CentOS 7新的操作系统默认的版本均高于此），那么即使您能在SCOW节点上通过`ssh`命令连接到登录和计算节点上，SCOW可能也无法通过SSH连接到这些节点上。如果您遇到了这个问题，您需要在您的各个节点的`/etc/ssh/sshd_config`文件中增加以下内容，并重启`sshd`服务。

```bash
PubkeyAcceptedKeyTypes=+ssh-rsa
```

这是因为OpenSSH从8.2版本开始默认取消了对`ssh-rsa`公钥签名算法的支持（[OpenSSH 8.2 Release Note](https://www.openssh.com/txt/release-8.2)）。当前系统仅支持使用`ssh-rsa`类型的公钥对进行SSH登录，在后续我们会增加对使用更新算法（例如`ed25519`）的公私钥对的默认支持。

 另外，Rocky Linux 9.3 或 RHEL 9 中，需调整加密策略到 `LEGACY` 以支持加密算法（如 `ssh-rsa`）。

```
sudo update-crypto-policies --set LEGACY
```

:::

为了简化部署，系统组件以docker镜像的形式分发。服务节点应该安装好

- `docker`（[安装docker的官方文档](https://docs.docker.com/engine/install/)）
- `docker compose`（[安装docker compose的官方文档](https://docs.docker.com/compose/install/)）。

### 2. 编译和部署适配器

针对不同种类的调度器，需要在集群上部署对应的适配器。适配器是在SCOW和底层调度器之间的中间层，向SCOW提供一组[接口](https://github.com/PKUHPC/scow-scheduler-adapter-interface)，SCOW通过这组接口调用适配器功能。理论上，只要适配器实现了接口所定义的功能，SCOW就能方便地部署在对应集群上。

适配器本质上是一个gRPC服务器，我们已经实现了部分调度器对应的适配器，可以参考下列文档部署适配器

- [slurm](https://github.com/PKUHPC/scow-slurm-adapter/blob/master/docs/deploy.md)

:::tip

- 适配器运行依赖本机glibc版本，强烈建议在与运行环境(slurm管理节点)一致的环境中下载源码[自行编译](https://github.com/PKUHPC/scow-slurm-adapter/blob/master/docs/deploy.md#12-下载代码编译生成二进制文件自己编译生成二进制文件)。
- 适配器将会暴露一个端口来提供服务，SCOW将通过`ip地址+端口号`访问适配器，调用接口。请记录下适配器的地址信息，用于后续部署。

:::

### 3. 安装和配置SCOW

####  3.1 下载scow-cli

`scow-cli`是我们官方维护的SCOW部署和运维工具，能够帮助您快速部署、管理和维护SCOW集群。

参考[scow-cli](./scow-cli.md)下载`scow-cli`，并将其存放到一个你用于存放SCOW配置文件的目录下。

```bash
# scow目录将会用于存在SCOW相关的配置文件
mkdir scow
cd scow

# 将下载的scow-cli移动到scow目录下
cp /path/to/scow-cli ./
chmod +x scow-cli
```

#### 3.2 配置文件

运行以下命令生成示例配置文件：

```bash
# 生成安装配置文件./install.yaml和示例配置文件目录./config
./cli init
```

主要配置文件及说明(根据以下顺序配置系统)：

| 顺序 | 配置文件        | 功能说明                                           | 是否必须 | 配置DEMO                                                     | 备注                                       |
| ---- | --------------- | -------------------------------------------------- | -------- | ------------------------------------------------------------ | ------------------------------------------ |
| 1    | install.yaml    | 安装文件                                           | 必须     | [install.yaml](https://github.com/PKUHPC/private-scow/blob/master/apps/cli/assets/init/install.yaml) | 按照集群需求修改对应参数                   |
| 2    | `{集群ID}`.yaml | [集群配置文件](/docs/deploy/config/cluster-config) | 必须     | [`{集群ID}`.yaml](https://github.com/PKUHPC/private-scow/blob/master/apps/cli/assets/init/config/clusters/hpc01.yaml) | 支持多集群，一个集群一个配置文件           |
| 3    | auth.yaml       | [认证系统](../config/auth/intro.md)                | 必须     | [auth.yaml](https://github.com/PKUHPC/private-scow/blob/master/apps/cli/assets/init/config/auth.yml) | 所有集群同一个认证系统                     |
| 4    | mis.yaml        | [管理系统](../config/mis/intro.md)                 | 可选     | [mis.yaml](https://github.com/PKUHPC/private-scow/blob/master/apps/cli/assets/init/config/mis.yaml) |                                            |
| 5    | portal.yaml     | [门户系统](../config/portal/intro.md)              | 可选     | [portal.yaml](https://github.com/PKUHPC/private-scow/blob/master/apps/cli/assets/init/config/portal.yaml) | 若登录节点不是安装的xfce，需要对应进行修改 |
| 6    | audit.yaml      | [审计系统](../config/audit/intro.md)               | 可选     | [audit.yaml](https://github.com/PKUHPC/private-scow/blob/master/apps/cli/assets/init/config/audit.yaml) |                                            |

####  3.3 其他配置(可选)

- [交互式应用](/docs/deploy/config/portal/apps/intro)
- [为交互式应用配置图标](/docs/deploy/config/portal/apps/configure-app-logo)
- [多集群交互式应用配置](/docs/deploy/config/portal/apps/configure-cluster-apps)
- [自定义logo](/docs/deploy/config/portal/customization/dashboard)
- [跨集群文件传输功能](/docs/deploy/config/portal/transfer-cross-clusters)
- [代理网关节点](/docs/deploy/config/portal/proxy-gateway)
- [集群监控配置](/docs/deploy/config/mis/cluster-monitor)
- [自定义前端主题](/docs/deploy/config/customization/webui)
- [自定义用户密码规则](/docs/deploy/config/customization/password-pattern)
- [国际化](/docs/deploy/config/customization/custom-config-i18n)

配置完成后，运行以下命令启动系统。

```bash
./cli compose up -d
```

当修改了配置文件后，运行以下命令重启系统

```bash
./cli compose restart
```
