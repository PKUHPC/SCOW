---
sidebar_position: 2
title: 集群配置文件
---

# 集群配置文件

对于每个需要进行部署的集群，需要在`config/clusters`目录下创建一个`{集群ID}/config.yml`（或`{集群ID}.yml`）文件，并编写集群的信息。当您的集群信息修改后，您需要同时手动修改对应的集群配置文件。

```yaml title="config/clusters/hpc01/config.yml"
# 此文件为hpc01.yml，对应的集群ID为hpc01

# 集群显示名称
displayName: hpc01Name

# 集群选择时排序的优先级，数字越小优先级越高，默认优先级最低
priority: 0

# 调度器适配器地址(ip地址:端口号)
adapterUrl: localhost:8972

loginNodes:
    # 登录节点展示名称
  - name: login01
    # 各个登录节点的IP或者域名，不能重复
    # 如果设置的是域名，请确认此节点的/etc/hosts中包含了域名到IP的解析信息
    # 如果部署了多集群，需保证多集群下登录节点的IP或者域名也不能重复
    address: 192.168.88.102
  - name: login02
    address: 192.168.88.103

# 登录节点桌面功能
loginDesktop:
  # 是否启用桌面功能
  enabled: true

  # vnc 桌面
  wms:
    # 桌面名和对应的wm值。见文档
    - name: Xfce
      wm: xfce

  # 单个登录节点最多启动多少个 vnc 桌面。不限制 shadowDesk 的数量。
  maxDesktops: 3

  # 将创建的 vnc 登录节点桌面信息保存到什么位置。相对于用户的家目录
  desktopsDir: scow/desktops

  # 配置ShadowDesk远程控制工具，如果开启，有所参数必填。
  # shadowDesk:
    # 是否配置有ShadowDesk远程控制工具
    # enabled: false

    # 代理服务器的地址和端口(根据实际部署更改)
    # proxyServer: ""

    # shadowDesk 桌面。
    # wms: ["xfce"]

    # api对接请求头参数(根据实际部署更改)
    # appId: ""

    # api入参加签的秘钥(根据实际部署更改)
    # appSecret: ""

# TurboVNC的安装路径
turboVNCPath: /opt/TurboVNC

# 跨集群传输模块，可选功能
crossClusterFileTransfer:
  # 不启用跨集群传输功能可以设置为false
  enabled: true
  # 传输节点的地址(ip地址:端口号)
  transferNode: localhost:22222

# 集群在HPC或是否启用，默认为true
hpc:
  enabled: true
  # 普通作业个性化配置，可选
  # job:
  #   # 最长运行时间，可选，不填写表示不限制运行时间
  #   # 单位：小时。超过此时间则不能成功提交普通作业
  #   maxRunningTimeHours: 24
  # 交互式应用个性化配置，可选
  # app:
  #   # 最长运行时间，可选，不填写表示不限制运行时间
  #   # 单位：小时。超过此时间则不能成功提交交互式应用
  #   maxRunningTimeHours: 24

# 集群在AI或是否启用，默认为false
ai:
  enabled: false

# # 可选，默认不开启
# storage:
#   # 必填，bool 类型
#   enabled: true
#   # 必填，字符串数组，代表当前需要被管理的文件系统挂载点
#   # 当前 SCOW 仅支持一个挂载点
#   paths: ["/data"]
#   # 可选，默认未开启副本备份
#   # 文件系统若有冗余备份数据时开启该配置
#   replicaExist: true

# 集群描述信息，可选
description: 集群描述
```

其中，`hpc.job.maxRunningTimeHours` 用于限制 HPC 普通作业的最长运行时间，`hpc.app.maxRunningTimeHours` 用于限制 HPC 交互式应用的最长运行时间；两者都以小时为单位，不配置时表示不限制。

## 注意
集群配置里的登录节点桌面功能和TurboVNC的安装路径配置为该集群特有，如不需要特殊配置该集群的这些功能，可在[门户系统](./portal/intro.md)进行统一配置；若在集群下配置以上功能，在该集群内将会覆盖门户系统下的配置。
集群配置里的登录节点的IP或者域名必须唯一。如果部署了单集群多登录节点或者多集群，需保证所有登录节点的IP或者域名不能重复。
