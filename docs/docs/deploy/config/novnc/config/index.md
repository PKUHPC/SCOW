---
sidebar_position: 1
title: 配置 noVNC 客户端镜像
---

# 配置 noVNC

noVNC 是 SCOW 用于提供 VNC 桌面访问的客户端服务。当**门户系统（portal）或 AI 系统**启用时，SCOW 会自动启动 noVNC 服务。

## install.yaml 中的 novnc 配置

`install.yaml` 新增了顶层 `novnc` 配置，用于统一管理 noVNC 客户端镜像地址。

```yaml title="install.yaml"
novnc:
  # noVNC 客户端镜像地址（最高优先级）
  # portal 或 AI 系统启用时将使用此镜像启动 novnc 服务
  # 若此处配置了镜像，将忽略 portal.novncClientImage 中的配置
  novncClientImage: defaultImageUrl
```

## novncClientImage 镜像优先级

SCOW 按以下优先级确定最终使用的 noVNC 镜像：

1. `novnc.novncClientImage`（最高优先级，顶层 novnc 配置）
2. `portal.novncClientImage`（次优先级，portal 配置内）

:::tip
推荐统一在顶层 `novnc.novncClientImage` 处配置镜像，避免 `portal.novncClientImage` 与顶层配置产生歧义。
:::

## noVNC 服务的启动条件

noVNC 服务的启动与否由以下规则决定：

| 条件 | noVNC 是否启动 |
| ---- | -------------- |
| portal 启用 | 是 |
| AI 系统启用 | 是 |
| portal 和 AI 均禁用 | 否 |
