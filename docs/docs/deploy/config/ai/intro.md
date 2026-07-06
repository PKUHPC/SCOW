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
# 集群在HPC中是否启用，默认为true。
# 纯 AI 集群（如 k8s 集群）请显式配置为 false，避免管理系统对该集群调用 HPC 相关逻辑。
hpc:
  enabled: false

# 集群在AI中是否启用，默认为false
ai:
  enabled: true

  # 选配：AI 应用作业个性化配置
  # app:
  #   # 最长运行时间，可选，不填写表示不限制运行时间
  #   # 单位：小时。超过此时间则不能成功提交 AI 应用作业
  #   maxRunningTimeHours: 24

  # 选配：AI 训练作业个性化配置
  # train:
  #   # 最长运行时间，可选，不填写表示不限制运行时间
  #   # 单位：小时。超过此时间则不能成功提交 AI 训练作业
  #   maxRunningTimeHours: 24

  # 选配：AI 推理作业个性化配置
  # infer:
  #   # 最长运行时间，可选，不填写表示不限制运行时间
  #   # 单位：小时。超过此时间则不能成功提交 AI 推理作业
  #   maxRunningTimeHours: 24

  # 开发机相关配置，可选，详细说明见开发机文档
  # devHost:
  #   # 最长运行时间，可选，不填写表示不限制运行时间
  #   # 单位：小时。超过此时间则不能成功创建开发机
  #   maxRunningTimeHours: 24

  # 选配：分享数据资产的文件夹所在的目录
  # 计算共享目录顶层路径：
  #  1) 优先使用集群级 `sharedTopDir` 配置；
  #  2) 未配置时按用户家目录回退到“上上级目录”（如 `/nfs/home/user` -> `/nfs`）；
  #  3) 若上上级退化为根目录 `/`，则回退为上级目录，避免共享目录挂到根路径。
  # 共享目录的路径是在共享目录顶层路径里的.shared文件夹中（比如`${sharedTopDir}/.shared`,`/nfs/.shared`）
  # 配置后，不可修改
  # sharedTopDir: "/nfs"
```

:::tip

`hpc.enabled` 未配置时默认为 `true`。如果该集群是纯 AI 集群（如 k8s 集群），请显式配置 `hpc.enabled: false`；如果同一个超智算集群同时承载 HPC 和 AI 业务，可以同时配置 `hpc.enabled: true` 和 `ai.enabled: true`。

:::

其中，`ai.app.maxRunningTimeHours`、`ai.train.maxRunningTimeHours`、`ai.infer.maxRunningTimeHours` 用于分别限制 AI 应用、训练、推理作业的最长运行时间；不配置时表示不限制。`ai.devHost.maxRunningTimeHours` 用于限制开发机最长运行时间，详细配置方式请参见[开发机功能介绍和配置](./devhost.md)。

在智算平台，为了方便平台管理员管理和发布所有平台级别的公共数据，我们提供了公共数据资产功能，下设4个子菜单：数据集、镜像、算法、模型。

当集群在AI中启用时**必填**公共数据资产的存放目录路径，配置后需在集群中创建该目录（权限要求 `root:root 755`），可手动创建，或执行 `./cli create-configured-cluster-paths` 辅助创建（需以 root 免密 SSH 到登录节点）。该路径配置之后请勿随意修改，否则已有的公共数据资产将无法正常使用。
```yaml title="config/clusters/{K8S集群的ID}.yml"
ai:
  # 其他配置省略
  clusterPublicPath: "/nfs/.public"
```

此外我们支持了不同容器运行时，并提供了进入运行中的 k8s 作业容器的进行 shell 操作的功能。

```yaml title="config/clusters/{K8S集群的ID}.yml"
# 其他配置省略
# ...
k8s:
  # runtime: docker
  # 默认为 containerd
  runtime: containerd
```

请在部署了 **K8S** 集群的集群配置文件中确认以下内容：

在`config/clusters/{K8S集群的ID}.yml`中，修改配置(使用 **K8S适配器** 的ip地址和端口号)

```yaml title="config/clusters/{K8S集群的ID}.yml"
# 其他配置省略
# ...
adapterUrl: localhost:8972

# 选配公共的挂载目录，优先级比ai/config.yaml中高
publicMountPoints:
  - /nfs/public

# 选配推理的配置，优先级比ai/config.yaml中高
inferConfig:
  # 选配，是否开启推理功能,默认开启
  enabled: true
  # 推理服务代理地址，可选配置，不配置时用scow节点地址转发
  proxyHost: www.example.com

# 选填作业监控配置：注意grafana的 11.3.0 版本不支持单个面板的数据持续刷新, 11.2.2 版本的可以
jobMonitor:
  # 必填grafana模版中的 dashboardId 和 dashboardName
  dashboardId: P17D2FB9C9DA87D76
  dashboardName: p17d2fb9c9da87d76
  # 选填作业监控中要展示的panelId,有默认值(值如下所示)，每个字段对应一个面板 ID, 由grafana的规则决定
  panelIds:
    gpu: 4
    gpuMemory: 10
    cpu: 24
    memory: 26
    network: 46
```

### AI 用户信息映射功能

支持在集群的 AI 配置中自定义配置**用户信息映射功能**，开启后，SCOW 在提交应用、训练、推理和开发机作业时，会同时传递 CSI 挂载策略参数及用户映射信息。

如需启用 AI 作业用户信息映射功能，需要同时满足以下条件：

1. 集群配置中已开启 `scowd.enabled`，并且 scowd 支持 `GetUserIdentityInfo` 接口。
2. K8S 调度器适配器支持接收 `userIdmapInfo` 参数。
3. 在集群配置文件的 `ai.idmap` 中开启该功能，并选择与集群 CSI 挂载方式匹配的 `mode`。

`ai.idmap.mode` 可选值说明如下：

| 值 | 说明 |
| --- | --- |
| `notSet` | 未指定挂载策略。默认值，通常用于保持兼容或由适配器自行决定。 |
| `plain` | 不启用 idmap，仅作为回退模式传递用户 uid/gid。 |
| `idmap` | 使用 Linux kernel idmap 挂载模式。SCOW 会传递 uid/gid，适配器按该模式使用所需字段。 |
| `bindfs` | 使用 bindfs 挂载模式。SCOW 会传递 uid/gid，适配器按该模式使用所需字段。 |

```yaml title="config/clusters/{K8S集群的ID}.yml"
# 其他配置省略
# ...
scowd:
  enabled: true

ai:
  enabled: true

  # 选配：是否开启 AI 作业用户 ID 映射功能，默认关闭。
  # 开启后，SCOW 在提交应用、训练、推理和开发机作业时，会通过 scowd 获取当前登录用户的 uid/gid，
  # 并将 uid/gid 和这里配置的 mode 传给 K8S 调度器适配器，由适配器按不同模式处理挂载策略。
  idmap:
    enabled: false
    #   # 可选值：notSet、plain、idmap、bindfs。未配置时默认为 notSet。
    mode: notSet
```


### 修改安装配置文件

修改安装配置文件：

```yaml title="install.yaml"
# 其他配置省略
# ...
# 确保 AI 系统会部署
ai:
  # 是否启用AI系统。默认为true，设置为false时nginx不渲染AI系统相关路由
  # enabled: true
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

# 选配公共的挂载目录，优先使用集群配置文件中的
# publicMountPoints:
  # - /nfs/public

# 选配推理的配置，优先使用集群配置文件中的
inferConfig:
  # 选配，是否开启推理功能,默认开启
  # enabled: true
  # 推理服务代理地址，可选配置，不配置时用scow节点地址转发
  # proxyHost: www.example.com

# 选配：清理harbor中不存在的镜像
imageCleanup:
  # 选配，默认为开启
  enabled: true
  # 选配：默认为 0 * * * *
  cron: "0 * * * *"

# 选配数据资产相关配置
# asset:
#   userShare:
#     enabled: false
```

其中，`asset.userShare.enabled` 用于控制“用户分享数据资产”功能是否开放：

- `true`：允许普通用户继续分享自己的数据资产
- `false`：关闭用户分享入口和后端分享操作

管理员注意：

- 关闭该功能前，建议先完成“用户分享数据迁移为平台公共数据资产”的运维操作
- 将现有用户分享数据迁移到各集群的 `clusterPublicPath` 下
- 避免关闭后仍有历史用户分享数据停留在旧 `shared` 路径中

### 编写文件管理配置

在 `config/ai/config.yaml` 文件中，根据备注修改所需要的配置

```yaml
# 文件管理（可选）
file:
  # 文件预览功能（必填）
  preview:
    # 大小限制（必填）
    # 可接受的格式为nginx的client_max_body_size可接受的值，默认为 50m
    limitSize: "50m"
  # 文件编辑功能（必填）
  edit:
    # 文件编辑大小限制（必填）
    # 可接受的格式为nginx的client_max_body_size可接受的值，默认为 1m
    # 建议设置为较大值
    limitSize: "1m"
    # 不可编辑的文件后缀数组（可选）
    # 如果不填则按系统默认列表进行判断，当前系统默认列表请查看下一小节 “系统默认不可编辑文件后缀数组”
    nonEditableFilenamePostfixes: [".exe", ".ppt"]
```

#### 系统默认不可编辑文件后缀数组

```
[".7z", ".aiff", ".apk", ".app", ".avi", ".bat", ".bin", ".bmp", ".bz2", ".cmd", ".com", ".dat", ".dll", ".dmg", ".doc", ".docx", ".exe", ".flac", ".flv", ".gif", ".gz", ".img", ".iso", ".jpeg", ".jpg", ".mkv", ".mov", ".mp3", ".mp4", ".msi", ".odt", ".ott", ".pdf", ".png", ".ppt", ".pptx", ".psd", ".rar", ".tar", ".tgz", ".tiff", ".vcd", ".wav", ".wmv", ".xcf", ".xls", ".xlsx", ".zip"]
```

## 启动服务

运行 `./cli compose up -d` 启动 **AI 系统（beta）** 服务。
