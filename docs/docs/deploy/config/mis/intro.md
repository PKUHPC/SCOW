---
sidebar_position: 1
title: 配置管理系统
---

# 配置管理系统

本节介绍如何配置管理系统。

## 管理系统同步作业信息

服务器会定期地从**调度器适配器**中获取已完成的作业信息，并根据规则对租户和账户进行扣费操作。详细计费规则请参考[计费收费](../../../info/mis/business/billing.mdx)。

## 修改安装配置文件

修改安装配置文件

```yaml title="install.yaml"
# 确保管理系统会部署
mis:
  # 如果管理系统部署在`/mis`路径下，设置"MIS.BASE_PATH"为 "/mis"。默认为"/"
  basePath: "/mis"
  # 如果将会部署在域名的根目录下，设置"MIS.BASE_PATH"为 "/"
  basePath: "/"

  # dbPassword为管理系统数据库密码
  # 在系统第一次启动前可自由设置，使用此密码可以以root身份登录数据库
  # 一旦数据库启动后即不可修改
  # 必须长于8个字符，并同时包括字母、数字和符号
  dbPassword: "must!chang3this"
```

:::tip

如果想自定义系统部署的相对路径，或者了解`MIS.BASE_PATH`的含义，请参考[自定义相对路径](../customization/basepath.md)。

:::

## 部署调度器适配器

根据调度器种类的不同，需要在集群上部署对应的调度器适配器

- slurm

## 更新集群配置文件

根据集群所使用的调度器的不同，参考对应文档更新`config/clusters/{集群ID}.yml`文件：

- [slurm](./schedulers/slurm.md)

## 编写后端服务配置

在`config/mis.yaml`文件中，根据备注修改所需要的配置

```yaml title="config/mis.yaml"
# 管理系统数据库的信息。可以不修改
db:
  host: db
  port: 3306
  user: root
  password: mysqlrootpassword
  dbName: scow

# 获取作业相关配置
fetchJobs:
  # 从哪个时间点开始获取作业
  # (日期格式ISO 8601,且需在末尾添加时区，推荐使用协调世界时(UTC))
  # startDate: "2000-01-01T00:00:00Z"

  # 限制一次获取的作业数量
  # batchSize: 1000

  # 周期性获取数据
  periodicFetch:
    # 是否开启
    enabled: true
    # 周期的cron表达式
    cron: "*/10 * * * *"

# 周期性同步scow与调度器(如slurm)账户用户封锁状态的配置
periodicSyncUserAccountBlockStatus:
  # 是否开启
  enabled: true
  # 周期的cron表达式
  cron: "0 4 * * *"

# 预定义的充值类型
predefinedChargingTypes:
  - 测试

# 创建账户时，账户名的规则。不设置就没有限制
accountNamePattern:
  # 正则表达式
  regex: "^[a-z][a-z0-9_]{2,19}$"

  # 出错时的消息，对应上面的正则表达式
  # 此文本支持国际化
  errorMessage: "要求输入长度为3-20位，由小写字母、数字、下划线组成，且以小写字母开头的字符串"

createUser:
  # 允许用户创建用户。默认为true
  enabled: true

  # 使用SCOW内置的创建用户功能。默认为builtin
  type: builtin

  # 内置创建用户功能配置
  builtin:
    # 创建用户时，用户ID的规则。不设置就没有限制，部署了AI用户ID不允许有下划线_
    userIdPattern:
      # 正则表达式
      regex: "^[a-z][a-z0-9]{2,19}$"
      # 出错时的消息
      errorMessage: "要求输入长度为3-20位，由小写字母、数字组成，且以小写字母开头的字符串"
      # errorMessage:
      #   i18n:
      #     default: "要求输入长度为3-20位，小写字母、数字、下划线组成的字符串，且以小写字母开头"
      #     en: "It is required to enter a string of 3-20 characters in length, consisting of lowercase letters, numbers,   and underscores, and starting with a lowercase letter."
      #     zh_cn: "要求输入长度为3-20位，由小写字母、数字、下划线组成，且以小写字母开头的字符串"

# 删除用户相关配置
deleteUser:

  # 是否允许用户从SCOW中删除用户，默认为false
  enabled: false

  # 删除标识
  nameMarker: "(已删除)"

# 删除账户相关配置
deleteAccount:

  # 是否允许用户从SCOW中删除账户，默认为false
  enabled: false

# 节点迁移功能
nodeMigration:

  # 是否开启节点迁移功能，默认为false
  enabled: false

   # 可以相互迁移的集群组, 组内各集群之间部分节点根据实际情况具有相互迁移可能性，如果enabled为true必须填写
  migratableClusterGroups:
    - group: ["linux", "ai01"]
    - group: ["linux", "ai02", "crane01"]

# 选配是否允许用户和账户管理员修改作业时限，默认为true
allowUserChangeJobTimeLimit: true

# # 新增导航链接相关配置
# navLinks:
#   # 链接名
#   - text: "一级导航1"
#     # 链接地址，一级导航链接地址为可选填，二级导航链接地址为必填
#     url: ""
#     # 是否打开新的页面，可选填，默认值为false
#     # openInNewPage: true
#     # 自定义图标地址,可选填
#     # iconPath: ""
#     # 可以看到这个链接的用户,可选填
#     # 用户类型： user, accountUser, accountAdmin, accountOwner, tenantFinance, tenantAdmin, platformAdmin, platformFinance
#     allowedRoles: []
#     # 二级导航,可选填
#     children:
#       # 二级导航相关配置，与一级导航相同，但是url为必填配置，同时不允许再设置children
#       - text: "二级导航1"
#         url: "https://hahahaha1.1.com"
#         # openInNewPage: true
#         iconPath: ""
#         allowedRoles: [accountAdmin, accountOwner]
#       - text: "二级导航2"
#         url: "https://hahahaha1.2.com"
#         allowedRoles: [tenantAdmin, platformAdmin]
#   - text: "一级导航2"
#     url: "https://hahahaha2.com"

# 文件导出数据数量限制
maxExportCount: 100000000

# 文件导出数据数量限制
maxExportCount: 100000000

# 登录节点root权限相关配置
# rootShell:
  # 是否允许平台管理员以root身份登录登录节点，默认不允许
  # enabled: true

```

## 启动服务

运行`./cli compose up -d`启动管理系统。

## 系统初始化

查看[系统初始化](./init/index.md)文档初始化系统信息。