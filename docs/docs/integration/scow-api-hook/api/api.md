---
sidebar_position: 1
title: 通过API调用SCOW
---

# 通过API调用SCOW

SCOW支持使用API调用。由于历史原因，访问不同的组件需要使用不同的方法。

| 访问系统         | API类型 | API定义  | API认证                          | 如何调用API？ |
| ---------------- | ------- | -------- | -------------------------------- | ------------- |
| 门户、管理、审计 | gRPC    | protobuf | 不带有认证，或静态秘密字符串认证 | 通过gRPC      |
| 量子、AI         | HTTP    | OpenAPI  | SCOW认证系统产生的token或静态秘密字符串认证   | 通过HTTP      |

# 通过SCOW API调用门户和管理系统

门户和管理系统应使用gRPC访问portal-server和mis-server来调用。

要使用SCOW API，您需要

1. [获取SCOW Protobuf文件](../proto.md)并生成相关代码
2. 编写程序，调用gRPC API与SCOW的后端部分组件`mis-server`, `portal-server`, `audit-server`交互

## 打开后端服务网络接口

部署好的系统的管理、门户和审计系统后端服务容器`mis-server`, `portal-server`, `audit-server`位于docker compose创建的网络中，从外界无法直接访问`mis-server`, `portal-server`和`audit-server`服务。

要想访问这些服务，您需要通过`install.yaml`将主机上的端口映射到`mis-server`, `portal-server`和`audit-server`服务的5000端口中。配置完成后，您可以从部署SCOW的机器上通过定义的IP和端口与对应的服务交互。

```yaml title=install.yaml

portal:
  portMappings:
    # portal-server的5000端口映射到127.0.0.1:7572
    portalServer: "127.0.0.1:7572"
mis:
  portMappings:
    # mis-server的5000端口映射到127.0.0.1:7571
    misServer: "127.0.0.1:7571"
audit:
  portMappings:
    # audit-server的5000端口映射到127.0.0.1:7573
    auditServer: "127.0.0.1:7573"
```

## 调用带有`user_token`参数的门户、管理系统API

有些管理系统API需要访问AI和量子系统。这些API需要传入`user_token`参数。要想调用这些API，您必须打开[静态秘密字符串认证](#静态秘密字符串认证)，在调用API时

- 将**静态秘密字符串**传入`user_token`参数
- 将**调用AI和量子系统时的用户ID**传入`x-scow-user-id` metadata

## 实际项目示例

- [Go](../examples/go.md#使用scow-api)

# 通过HTTP调用AI、量子系统

AI和量子系统使用传统的HTTP API设计，所有API均位于于`/api`下。AI和量子系统的部署路径的`/api/openapi.json`下存在一份[OpenAPI](https://www.openapis.org/)的定义文件。您可以通过访问这个文件来获取系统中所有可用的API。

要调用一个量子或者API系统API，您必须打开[静态秘密字符串认证](#静态秘密字符串认证)，然后在调用API时，传入以下`header`

- `x-scow-api-auth-token`：`静态秘密字符串` 或者 SCOW认证系统产生的token
- `x-scow-user-id`：如果`x-scow-api-auith-token`是静态秘密字符串，则必须将调用API的用户ID传入此header；否则无需传递此header

# API认证

## 管理、门户、审计系统说明

默认情况下，管理和门户系统`mis-server`和`portal-server`的gRPC调用并不认证请求，任何用户都可以直接调用`mis-server`和`portal-server`的API。

在不认证的情况下，如果您在映射端口时直接输入端口号（如`7571`不是`127.0.0.1:7571`），由于在同一个集群中各个节点的网络是互通的，则在同一个集群中的其他作业可能可以直接访问SCOW的gRPC后端，进而直接操作SCOW系统的数据，造成安全隐患。所以我们建议：

- 不将SCOW服务节点用作集群的登录节点或者计算节点
- 在映射端口时输入`127.0.0.1:7571`，使映射出的端口只能在SCOW服务节点上使用
- 给SCOW服务节点设置好防火墙，防止集群内部的服务访问到SCOW服务

您也可以配置[静态秘密字符串认证](#静态秘密字符串认证)。当打开了认证后，任何没有通过认证的请求将会收到`UNAUTHENTICATED`响应。

## 静态秘密字符串认证

您可以配置服务器使用静态秘密字符串认证。要访问量子或者AI系统，必须打开静态秘密字符串认证。

在`config/common.yaml`中增加以下配置：

```yaml title="config/common.yaml"
scowApi:
  auth:
    token: <秘密字符串，越长越好>
```

当配置好后，任何到gRPC服务器的请求都必须带有`authorization` header，其内容为`Bearer <秘密字符串>`。

门户系统和管理系统前端发送到服务器的请求将会自动带有这个header，无需单独配置。

:::caution

任何带有这个秘密字符串的用户可以以系统中的任意用户访问系统中的任何API。请确保秘密字符串强度足够，并定期更换秘密字符串。

:::