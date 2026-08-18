---
sidebar_position: 1
title: 配置审计系统
---

# 配置审计系统

本节介绍如何配置审计系统。

## 修改安装配置文件

修改安装配置文件

```yaml title="install.yaml"
# 审计系统始终部署；此处仅覆盖默认部署参数
audit:

  # dbPassword为审计系统数据库密码
  # 在系统第一次启动前可自由设置，使用此密码可以以root身份登录数据库
  # 一旦数据库启动后即不可修改
  # 必须长于8个字符，并同时包括字母、数字和符号
  dbPassword: "must!chang3this"
```

## 编写后端服务配置

在`config/audit.yaml`文件中，根据备注修改所需要的配置

```yaml title="config/audit.yaml"

# 审计服务的url，默认不修改
url: audit-server:5000
# 审计系统数据库的信息。可以不修改
db:
  host: audit-db
  port: 3306
  user: root
  password: mysqlrootpassword
  dbName: scow_audit
```

## 启动服务

运行`./cli compose up -d`启动审计服务。
