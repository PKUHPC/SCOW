---
sidebar_position: 1
title: 基础系统配置迁移
---

# 基础系统配置迁移

管理系统、审计系统、资源管理系统和消息系统已调整为 SCOW 的基础系统，升级后始终部署，不能再通过系统级 `enabled` 字段关闭。

## 修改安装配置

删除 `install.yaml` 中的 `mis.enabled`。`mis`、`audit`、`resource` 和 `notification` 配置块只用于覆盖部署参数；不需要自定义时可以使用空对象或省略配置块。

```yaml title="install.yaml"
mis:
  basePath: /mis
  dbPassword: must!chang3this

audit:
  dbPassword: must!chang3this

resource:
  basePath: /resource

notification:
  basePath: /notification
```

旧的 `mis.enabled` 字段仍可被配置解析器读取，但会被忽略，不能用于关闭管理系统。建议删除该字段，避免配置含义不明确。

## 修改公共配置

删除 `config/common.yaml` 中的 `scowResource.enabled` 和 `notification.enabled`，并配置非空的服务地址和至少 32 个字符的 SCOW API 认证 token。

```yaml title="config/common.yaml"
scowApi:
  auth:
    token: <至少 32 个字符的不可预测字符串>

scowResource:
  address: http://resource:3000/resource

notification:
  name: notification
  address: http://notification:3000/notification
```

旧的 `scowResource.enabled` 和 `notification.enabled` 字段会被忽略。`scowApi.auth.token` 至少需要 32 个字符，且不能使用默认占位值 `must-change-this-scow-api-token`；`scowResource.address`、`notification.name` 和 `notification.address` 不能是空字符串。

当前版本的 `scow-cli init` 会在生成配置时自动创建 `scowApi.auth.token`。覆盖初始化时，仅保留至少 32 个字符且不是默认占位值的已有 token，否则会生成新 token。升级已有部署时不会自动改写现有配置，仍需确认该字段符合上述要求并且不可预测。

`install.yaml` 中的 `resource.basePath`、`notification.basePath` 与 `config/common.yaml` 中的服务地址不会自动同步。自定义部署路径时，需要同时修改对应地址。

## 补齐系统配置文件

升级前确认以下配置文件存在：

- `config/mis.yaml`
- `config/audit.yaml`
- `config/resource/config.yaml`
- `config/notification/config.yaml`

可以参考当前版本 `scow-cli init` 生成的配置模板补齐缺失文件。

## 检查配置

修改完成后，在启动服务前运行：

```bash
./cli check-config
```

如果缺少配置文件，或上述必填连接配置为空，命令会输出对应的配置文件或字段路径。
