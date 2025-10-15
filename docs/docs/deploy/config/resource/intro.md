---
sidebar_position: 1
title: 介绍及配置资源管理系统
---

# 介绍及配置资源管理系统

本节介绍如何配置 **资源管理系统**。

# 简介

资源管理系统在 SCOW v1.7.0 版本正式发布。目前主要实现了平台管理员为租户授权集群、分区；租户管理员为账户授权集群、分区以及租户管理员设置创建账户时默认集群及默认分区的功能。

# 配置

## 配置开启资源管理系统

SCOW 配置开启资源管理系统首先需要在 `install.yaml` 文件中，添加如下配置

```YAML
resource:
  bashPath: /resource
```

在 SCOW v1 版本中的资源管理使用 UI 扩展的方式接入的 SCOW。所以需要在 `config/mis.yaml` 文件中添加 UI 扩展相关配置，具体如下：

```YAML
uiExtension:
  - # 资源管理系统UI扩展名称                                 
    name: resource
    # 资源管理系统的部署Url，此url需能被外网访问
    # /resource 部分需要与 install.yaml 文件中resource的 basePath 保持一致
    # 若在install.yaml中配置了最外层的basePath不为"/"，需要在此处的your-domain后也加上basePath
    url: http://your-domain/resource
```

配置资源管理系统是否启动，需要在 `config/common.yaml` 文件中添加如下配置：

```YAML

# 是否开启资源管理系统
scowResource:
  # 非必填，默认为 false
  enabled: true
  # 资源管理系统部署的url，在内网能访问即可
  # 非必填，默认为 http://resource:3000/resource
  # 若在install.yaml中配置了最外层的basePath不为"/"，需要在此处的your-server-name后也加上basePath
  address: http://your-server-name/resource

# 开启 SCOW API TOKEN 保证后端间交互安全
# 若开启资源管理系统服务则必须配置
scowApi:
  auth:
    token: <秘密字符串，越长越好>

```

## 配置资源管理系统相关功能

### 数据库配置
在 SCOW v1 版本中资源管理系统有自身独立的数据库，并且有一些自身相关配置。需要在 `config` 目录下创建一个 `resource/config.yaml` 文件进行配置，内容如下：

```YAML
# 数据库相关配置, 必填
db:
  # 必填，数据库地址，默认为 db （docker compose 服务名）
  host: db
  # 必填，数据库端口号
  port: 3306
  # 必填，连入数据库的用户
  user: root
  # 必填，连入数据库的用户密码
  password: must!chang3this
  # 必填，数据库名
  dbName: scow_resource

# 必填
scow:
  # 必填，管理系统 server 的地址，默认为 mis-server:5000
  misServerUrl: mis-server:5000

log:
  level: debug
  pretty: false  
```

### 关于数据库初始化

在 SCOW v1 版本中考虑到管理员初始授权集群与分区特殊需求，资源管理系统不会自动实现数据初始化。为避免出现租户、账户无授权数据的情况，系统部署初期，需要管理员提前手动导入租户、账户授权数据。