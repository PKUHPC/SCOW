---
sidebar_position: 1
title: 通过API调用SCOW
---

# 通过API调用SCOW

AI、量子、门户前端（portal-web）、管理前端（mis-web）、消息系统（notification）和资源管理系统（resource）均提供HTTP OpenAPI，所有API均位于`/api`下。各系统部署路径的`/api/openapi.json`下存在一份[OpenAPI](https://www.openapis.org/)的定义文件。您可以通过访问这个URL来获取系统中所有可用的API。

## OpenAPI路径

默认配置下，整个系统的`basePath`为`/`。各系统OpenAPI UI和`openapi.json`路径如下：

| 系统 | 默认部署路径 | OpenAPI UI路径 | `openapi.json`路径 |
| ---- | ------------ | -------------- | ------------------ |
| 门户系统（portal-web） | `/` | `/openapi` | `/api/openapi.json` |
| 管理系统（mis-web） | `/mis` | `/mis/openapi` | `/mis/api/openapi.json` |
| AI系统（ai） | `/ai` | `/ai/openapi` | `/ai/api/openapi.json` |
| 量子系统（quantum） | `/quantum` | 暂无 | `/quantum/api/openapi.json` |
| 消息系统（notification） | `/notification` | `/notification/openapi` | `/notification/api/openapi.json` |
| 资源管理系统（resource） | `/resource` | `/resource/openapi` | `/resource/api/openapi.json` |

如果修改了`install.yaml`中的`basePath`或各系统的`basePath`，请将上表中的默认部署路径替换为实际部署路径。例如整个系统`basePath`为`/scow`、管理系统`basePath`为`/mis`时，管理系统的OpenAPI UI路径为`/scow/mis/openapi`，`openapi.json`路径为`/scow/mis/api/openapi.json`。

# API认证

要调用这些HTTP API，您需要一个认证token。当前仅支持[静态秘密字符串认证](#静态秘密字符串认证)。请参考文档配置静态秘密字符串认证，然后在调用API时，传入以下`header`

- `x-scow-api-auth-token`：`静态秘密字符串` 或者 SCOW认证系统产生的token
- `x-scow-user-id`：如果`x-scow-api-auth-token`是静态秘密字符串，则必须将调用API的用户ID传入此header；否则无需传递此header

实际上您还可以将SCOW认证系统产生的token传入`x-scow-api-auth-token`以避免使用权限过大的静态秘密字符串。此方案的编程用法正在完善中。

## 静态秘密字符串认证

您可以配置服务器使用静态秘密字符串认证。要通过HTTP API访问量子、AI、门户前端（portal-web）或管理前端（mis-web）系统，必须打开静态秘密字符串认证。

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

# 通过gRPC API调用门户和管理系统

门户和管理系统还可以使用gRPC调用。要使用gRPC访问SCOW API，您需要

1. [获取SCOW Protobuf文件](../proto.md)并生成相关代码
2. 编写程序，调用gRPC API与SCOW的后端部分组件`mis-server`, `portal-server`, `audit-server`交互

示例项目：

- [Go](../examples/go.md#使用scow-api)

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

## gRPC API认证

默认情况下，管理和门户系统`mis-server`和`portal-server`的gRPC调用并不认证请求，任何用户都可以直接调用`mis-server`和`portal-server`的API。

在不认证的情况下，如果您在映射端口时直接输入端口号（如`7571`不是`127.0.0.1:7571`），由于在同一个集群中各个节点的网络是互通的，则在同一个集群中的其他作业可能可以直接访问SCOW的gRPC后端，进而直接操作SCOW系统的数据，造成安全隐患。所以我们建议：

- 不将SCOW服务节点用作集群的登录节点或者计算节点
- 在映射端口时输入`127.0.0.1:7571`，使映射出的端口只能在SCOW服务节点上使用
- 给SCOW服务节点设置好防火墙，防止集群内部的服务访问到SCOW服务

您也可以配置[静态秘密字符串认证](#静态秘密字符串认证)。当打开了认证后，任何没有通过认证的请求将会收到`UNAUTHENTICATED`响应。
