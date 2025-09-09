---
sidebar_position: 1
title: 配置 AI 系统（beta）
---

# 配置 AI 系统（beta）

本节介绍如何配置 **AI 系统（beta）**。

# Beta期间配置

SCOW AI当前处于Beta状态，其代码将会和SCOW主线共存，但是SCOW AI的版本发布周期将是独立的，不和SCOW本身同步。

您可以在GitHub的Release中找到格式为`ai-beta.{数字}`的Release，这些Release以及对应的Tag均为SCOW AI的Beta发布版本。快速到所有`ai-beta.` Release的链接[点击此处](https://github.com/PKUHPC/private-scow/releases?q=ai-beta.&expanded=true)。

要使用SCOW AI的具体的版本，您需要修改`install.yml`的`imageTag`为一个具体的`ai-beta.{数字}`的tag，例如：

```yaml title="install.yaml"
# 指定使用Beta 1版本
imageTag: ai-beta.1  
```

您同样可以使用`master`来跟踪SCOW主线以及其包括的SCOW AI的最新功能。

## 前期准备

### K8S 集群

**AI 系统（beta）** 需要用户在使用时提前部署 K8S 的集群环境。

当前 **AI 系统（beta）** 为试用版本，我们目前已经支持 `docker` 和 `containerd` 两种容器运行时的 k8s集群中使用 AI 系统。 若集群为`containerd` 运行时，需要在集群的节点上安装 [nerdctl](https://github.com/containerd/nerdctl)

当前试用版本中 K8S 部署的主要版本信息如下：

| **安装内容**  | **版本信息** |
| ------------- | ------------ |
| kubernetes    | v1.19.13     |
| Docker Engine | 19.03.12     |

### K8S 调度服务

**AI 系统（beta）** 同样通过 **SCOW调度器适配器** 来实现对 K8S 集群的调度服务。

同时为了满足提交 AI 作业、训练 AI 作业的功能，需要使用第三方调度插件 [Kueue](https://kueue.sigs.k8s.io/docs/)、 配置 **Cluster Queue** 的队列信息来协调和处理作业任务。

- **K8S 调度器适配器**

  我们仍然使用 [SCOW调度器适配器](https://pkuhpc.github.io/SCOW/blog/scow-scheduler-adapter) 来实现 K8S 集群的调度服务。

  当前版本中，我们提供了调度器适配器的适用版本的二进制文件 [scow-ai-adapter-amd64](https://mirrors.pku.edu.cn/scow/releases/)，欢迎下载进行试用。

  K8S 调度器适配器的配置请参照[此链接](https://github.com/PKUHPC/scow-ai-adapter-config)。

- **第三方调度插件 Kueue**

  **Kueue** 是一个用于 **Kubernetes** 的作业排队系统。它旨在管理和优化批处理作业和其他非实时工作负载的执行。 Kueue 的安装下载参照[此链接](https://kueue.sigs.k8s.io/docs/installation/)。

- **配置 Cluster Queue**

  Cluster Queue 允许基于不同的策略和需求对作业进行分组管理。

  Cluster Queue 的配置与实际部署的 **K8S集群** 情况紧密相关，推荐您按照 [Cluster Queue 介绍](https://kueue.sigs.k8s.io/docs/concepts/cluster_queue/) 和实际部署集群的详细情况进行配置。

### Harbor

当前 **AI 系统（beta）** 版本中，为了实现镜像的保存、上传、分享、复制、删除等功能，需要您已部署可访问的 [Harbor](https://goharbor.io/) 镜像仓库。同时需要您已在 **Harbor** 上创建了用于镜像管理的项目，并在 [AI 服务配置文件](#编写-ai-服务配置)中配置该项目名称。

我们在测试版本中支持通过 **http 协议** 实现的 **Harbor API V2.0** 版本接口的访问，为了您能流畅体验试用镜像功能，推荐您部署支持该版本接口的 Harbor 镜像仓库。

我们在试用版的测试环境中试用的 Harbor 版本信息为 `版本v2.7.4-8693b25a`。

### 并行文件存储服务

当前 **AI 系统（beta）** 版本中需要您已经提前安装部署了并行文件存储服务。

### LDAP

当前 **AI 系统（beta）** 版本中我们仍然延续 **SCOW** 系统的认证系统服务，采用基于 [LDAP](../../config/auth/ldap.md) 认证系统进行用户认证。

在 K8S 集群中仍然需要像 **SCOW** 系统的 `hpc集群` 一样，在管理节点安装 `LDAP服务端` ，在所有节点安装 `LDAP客户端` 。


## 配置文件

### 集群配置文件

在当前 **AI 系统（beta）** 的试用版本中，我们支持了配置不同集群使用不同的服务（AI 或 HPC），需要在`config/clusters/{K8S集群的ID}.yml`中，添加如下内容

```yaml title="config/clusters/{K8S集群的ID}.yml"
# 其他配置省略
# ...
# 集群在HPC或是否启用，默认为true
hpc:
  enabled: true

# 集群在AI或是否启用，默认为false
ai:
  enabled: false
```

此外我们支持了不同容器运行时，并提供了进入运行中的 k8s 作业容器的进行 shell 操作的功能。

为了能够在 Kubernetes 集群中通过 kubectl 进入到所有命名空间的容器中执行命令（例如 /bin/sh），需要提供一份 kubeconfig 配置文件。该配置文件的 current context 中的用户需要使用 ClusterRole 创建并具备一定的权限，这些权限包括对 pods/exec 的 create 操作，以及对 pods 的 get 和 list 操作。创建完成后，需要将 kubeconfig 文件放置到 SCOW 部署目录中的 config 目录下，然后在`config/clusters/{K8S集群的ID}.yml`中，添加如下内容

```yaml title="config/clusters/{K8S集群的ID}.yml"
# 其他配置省略
# ...
k8s:
  # runtime: docker
  # 默认为 containerd
  runtime: containerd
  # kubeconfig 相关配置
  kubeconfig:
    # 相对于 SCOW 部署目录下 config 目录的路径
    path: /kube/xxx
```

请在部署了 **K8S** 集群的集群配置文件中确认以下内容：

在`config/clusters/{K8S集群的ID}.yml`中，修改配置(使用 **K8S适配器** 的ip地址和端口号)

```yaml title="config/clusters/{K8S集群的ID}.yml"
# 其他配置省略
# ...
adapterUrl: localhost:8972
```

### 修改安装配置文件

修改安装配置文件：

```yaml title="install.yaml"
# 其他配置省略
# ...
# 确保 AI 系统会部署
ai:
  # dbPassword 为 AI 系统数据库密码
  # 在系统第一次启动前可自由设置，使用此密码可以以 root 身份登录数据库
  # 一旦数据库启动后即不可修改
  # 必须长于 8 个字符，并同时包括字母、数字和符号
  dbPassword: "must!chang3this"
```

### 编写 AI 服务配置

在`config/ai/config.yaml`文件中，根据备注修改所需要的配置

```yaml title="config/ai/config.yaml"
# AI 系统服务的 url，默认不修改
url: ai:5000
# AI 系统数据库的信息。可以不修改
db:
  host: ai-db
  port: 3306
  user: root
  password: must!chang3this
  dbName: scow_ai
  debug: true
# AI 系统镜像保存 Harbor 仓库配置
harborConfig:
  # Harbor 仓库地址
  url: 10.0.0.xxx
  # Harbor 仓库中用于当前系统镜像管理的已存在的项目名称
  project: projectName
  # Harbor 仓库可登录用户的用户名
  # (建议使用上述项目的项目管理员以上权限人员，需具有 API 2.0 接口访问权限)
  user: user
  # Harbor 仓库可登录用户的登录密码
  password: password

# 选配公共的挂载目录
# publicMountPoints:
  # - /nfs/public

# 选配作业最大运行时间
# maxJobRunningTimeHours: 24
```

## 启动服务

运行 `./cli compose up -d` 启动 **AI 系统（beta）** 服务。
