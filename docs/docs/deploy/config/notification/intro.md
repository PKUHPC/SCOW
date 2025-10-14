---
sidebar_position: 1
title: 介绍及配置通知系统
---

# 介绍及配置通知系统

本节介绍如何配置 **通知系统**。

# 简介

消息系统在 SCOW v1.7.0 版本正式发布。目前主要实现了账户状态、余额变更，用户作业完成等类型的站内通知功能。并能够通过实现中间件完成对接诸如邮件、短信、公众号等方式的消息通知功能。

# 配置

## 配置开启消息系统

SCOW 配置开启消息系统首先需要在 `install.yaml` 文件中，添加如下配置

```YAML
notification:
  # 可选，默认为 /notification
  bashPath: /notif
```

在 SCOW v1 版本中的消息系统使用 UI 扩展的方式接入的 SCOW。所以需要在 `config/mis.yaml` 和/或 `config/portal.yaml` 和/或 `config/ai.yaml` 文件中添加 UI 扩展相关配置，具体如下：

```YAML
uiExtension:
  - # 消息系统UI扩展名称                                 
    name: notif
    # 消息系统的部署Url，此url需能被外网访问
    # /notif 部分需要与 install.yaml 文件中notification的 basePath 保持一致
    # 若在install.yaml中配置了最外层的basePath不为"/"，需要在此处的your-server-name1后也加上basePath
    url: http://your-server-name1/notif
```

配置消息系统本身启动，需要在 `config/common.yaml` 文件中添加如下配置：

```YAML
# 开启 SCOW API TOKEN 保证后端间交互安全
scowApi:
  auth:
    token: <秘密字符串，越长越好>

notification:
  # 是否开启消息系统
  # 非必填，默认为 false
  enabled: true
  # 消息系统名称，需与 ui 扩展名称保持一致
  # 非必填，默认为 notification
  name: notif
  # 消息系统部署的url，在内网能访问即可
  # 非必填，默认为 http://notification:3000
  # 若在install.yaml中配置了最外层的basePath不为"/"，需要在此处的your-server-name2后也加上basePath
  address: http://your-server-name2/notif
```

## 配置消息系统相关功能

在 SCOW v1 版本中消息系统有自身独立的数据库，并且有一些自身相关配置。需要在 `config` 目录下创建一个 `notification/config.yaml` 文件进行配置，内容如下：

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
  dbName: scow_notification

# 必填
scow:
  # 必填，管理系统 server 的地址，默认为 mis-server:5000
  misServerUrl: mis-server:5000

# 配置开启的通知方式
# 通知方式开启后可以配置用户是否接收对应通知方式的消息
noticeType:
  # 必填，站内消息
  siteMessage:
    # 必填，是否开启，默认为 true
    enabled: true
  # 以下三项为可选项，不填则为 false
  # 短信
  SMS:
    enabled: false
  # 邮件
  email:
    enabled: false
  # 公众号
  officialAccount:
    enabled: false

# 可选，消息中间件配置，用于对接除站内消息之外的通知方式
messageBridge：
  # 中间件地址
  address: http://message-bridage:3000

# 必填，定时删除过期消息相关配置
deleteExpiredMessages:
  # 必填，定时删除的执行周期，为 cron 表达式
  # 默认为 "0 3 * * *"，每天凌晨 3 点执行一次
  cron: "0 3 * * *"
```
