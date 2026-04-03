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
  basePath: /notif
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
  # 必填，需根据 install.yaml 中配置的 scow base path 和 notification 的 base path 进行修改
  address: http://notification:3000/{scow base path}/{notification base path}
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

# 可选，Alertmanager Webhook 集成配置
# 配置后，通知系统可接收 Alertmanager 推送的告警并转发给指定用户
alertmanager:
  # 是否启用，默认为 true，设为 false 可临时关闭集成而保留配置
  enabled: true
  # 告警 ID 到接收者的映射配置
  # alertIds 对应 Prometheus 告警规则中的 alertname 标签值，支持多个告警共享同一接收者配置
  receiverMappings:
    - alertIds:
        - "HighCPU"
        - "HighMemory"
      # 直接指定接收用户的 ID 列表（可选）
      users:
        - "user1"
      # 按 SCOW 角色指定接收者，运行时自动查询对应用户（可选）
      # 可选值：PLATFORM_ADMIN、PLATFORM_FINANCE、TENANT_ADMIN、TENANT_FINANCE、ACCOUNT_ADMIN、ACCOUNT_OWNER
      roles:
        - "PLATFORM_ADMIN"
    - alertIds:
        - "DiskFull"
      roles:
        - "PLATFORM_ADMIN"
        - "TENANT_ADMIN"
```

## 对接 Alertmanager 告警通知

通知系统支持接收 Alertmanager 的 Webhook 推送，并将告警转发为站内通知发送给指定用户。

### 工作原理

1. Alertmanager 触发告警后，通过 Webhook 将告警数据推送到通知系统
2. 通知系统根据告警的 `alertname` 标签，在 `receiverMappings` 中查找对应配置
3. 将告警内容构建为站内通知，发送给配置的目标用户

### 配置 Alertmanager

在 Alertmanager 的 `config.yaml` 中添加 Webhook receiver：

```yaml
receivers:
  - name: 'scow-notification'
    webhook_configs:
      - url: 'http://<scow ip>/<notif base path>/api/notification.MessageService/ReceiveMonitorAlert'
        http_config:
          # 对应 config/common.yaml 中 scowApi.auth.token 的值
          authorization:
            credentials: '<scowApi.auth.token>'
        send_resolved: true

route:
  receiver: 'scow-notification'
  group_by: ['alertname']
```

notif base path 为 `install.yaml` 文件中填写的消息系统 `basePath`

### 配置 Prometheus 告警规则

通知标题固定显示为"监控告警"，告警规则的 `annotations` 中可通过以下约定字段提供双语通知正文：

| annotations 字段 | 说明 |
|---|---|
| `description` | 英文正文（可选） |
| `description_zh` | 中文正文（可选，缺省时使用 `description`） |

正文中可使用以下模板占位符，系统在发送前自动替换为真实值：

| 占位符 | 说明 | 示例值 |
|---|---|---|
| `{starts_at}` | 告警触发时间（UTC） | `2025-03-27 06:00:00 UTC` |
| `{ends_at}` | 告警恢复时间（UTC），仍在触发时为空字符串 | `2025-03-27 06:05:00 UTC` |

示例：

```yaml
groups:
  - name: system
    rules:
      - alert: HighCPU
        expr: node_cpu_utilization > 0.9
        annotations:
          description: "CPU usage is {{ $value | humanizePercentage }} on {{ $labels.instance }} (since {starts_at})"
          description_zh: "节点 {{ $labels.instance }} 的 CPU 使用率为 {{ $value | humanizePercentage }}（触发时间：{starts_at}）"
```

### 接收者角色说明

`roles` 字段支持以下 SCOW 角色值，系统在运行时自动查询对应用户：

| 角色值 | 说明 |
|---|---|
| `PLATFORM_ADMIN` | 平台管理员 |
| `PLATFORM_FINANCE` | 平台财务 |
| `TENANT_ADMIN` | 租户管理员（所有租户） |
| `TENANT_FINANCE` | 租户财务（所有租户） |
| `ACCOUNT_ADMIN` | 账户管理员（所有账户） |
| `ACCOUNT_OWNER` | 账户拥有者（所有账户） |

`users` 与 `roles` 可同时配置，系统会合并去重后统一推送。
