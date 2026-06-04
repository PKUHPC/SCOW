---
sidebar_position: 6
title: scowctl
description: 使用 scowctl 登录 SCOW 并调用 HTTP API
---

# scowctl

`scowctl` 是 SCOW 的用户侧命令行工具，用于在终端中登录 SCOW，并根据 SCOW 暴露的 OpenAPI 定义调用各系统的 HTTP API。

## 下载

已部署的 SCOW 实例会提供与该实例配套的 `scowctl` 下载地址。默认路径如下：

```text
https://scow.example.com/meta/scowctl
https://scow.example.com/meta/scowctl/bin/scowctl-x64
https://scow.example.com/meta/scowctl/bin/scowctl-arm64
https://scow.example.com/meta/scowctl/bin/scowctl-macos-arm64
https://scow.example.com/meta/scowctl/bin/scowctl-windows-x64.exe
```

如果 SCOW 配置了 `basePath`，需要在路径前加上对应前缀。例如 `basePath` 为 `/scow` 时：

```text
https://scow.example.com/scow/meta/scowctl
https://scow.example.com/scow/meta/scowctl/bin/scowctl-x64
https://scow.example.com/scow/meta/scowctl/bin/scowctl-arm64
https://scow.example.com/scow/meta/scowctl/bin/scowctl-macos-arm64
https://scow.example.com/scow/meta/scowctl/bin/scowctl-windows-x64.exe
```

Linux 和 macOS 用户可以使用已部署实例提供的 shell 安装脚本：

```bash
curl https://scow.example.com/meta/scowctl/install.sh | sh
```

Windows 用户可以在 PowerShell 中使用安装脚本：

```powershell
iwr https://scow.example.com/meta/scowctl/install.ps1 -UseB | iex
```

也可以访问该实例的 `/meta/openapi` 页面，在 OpenAPI 文档描述中查看当前实例提供的 `scowctl` 下载地址。

## 登录

使用 `login` 命令登录一个 SCOW 站点：

```bash
scowctl login https://scow.example.com
```

如果地址没有写 scheme，`scowctl` 会默认使用 `http`：

```bash
scowctl login scow.example.com
```

登录时，`scowctl` 会启动一个本地 HTTP 回调服务并打开浏览器进入 SCOW 登录页面。登录完成后，SCOW 会把 token 传回 `scowctl`，`scowctl` 会验证 token 并打印当前登录用户的用户名。

登录成功后，`scowctl` 会保存当前 profile 的登录信息，并从 meta-server 的统一入口缓存该 SCOW 站点的 OpenAPI 定义。

如需查看 OpenAPI 获取过程中的详细信息，可以添加 `--verbose`：

```bash
scowctl login https://scow.example.com --verbose
```

如果站点配置了静态秘密字符串认证，可以在登录时同时指定静态秘密字符串和后续调用 API 使用的用户 ID：

```bash
scowctl login https://scow.example.com --auth-secret <静态秘密字符串> --auth-user <用户ID>
```

`--auth-secret` 和 `--auth-user` 必须同时提供或同时不提供。提供后，`scowctl login` 不会打开浏览器登录页面，而是使用静态秘密字符串和用户 ID 请求 meta-server 的 OpenAPI 来验证认证是否可用。验证通过后，`scowctl` 调用 API 和刷新 OpenAPI 缓存时，会将静态秘密字符串传入 `x-scow-api-auth-token`，并将用户 ID 传入 `x-scow-user-id`。

## API 调用

登录后，可以使用 `api` 命令调用 SCOW HTTP API：

```bash
scowctl api GET /api/jobs
```

如果 API 路径带有系统前缀，调用时也需要写完整前缀，例如：

```bash
scowctl api GET /ai/api/authInfo
```

API 参数使用 `key=value` 形式传入：

```bash
scowctl api GET /api/jobs cluster=default
```

`scowctl` 会根据缓存的 OpenAPI 定义识别 path、query、header 和 body 参数，并自动带上登录 token。

## 查看可用 API

使用 `api list` 查看当前缓存中所有可用 API：

```bash
scowctl api list
```

在交互式终端中，输出会通过 pager 展示，支持翻页和搜索。非交互式环境会直接输出。也可以显式关闭 pager：

```bash
scowctl api list --no-pager
```

查看某个 API 可填写的参数：

```bash
scowctl api help GET /api/jobs
```

## 刷新 API 定义

如果 SCOW 站点升级或启用的系统发生变化，可以刷新本地 OpenAPI 缓存：

```bash
scowctl api refresh
```

查看刷新过程中的 meta-server 获取细节：

```bash
scowctl api refresh --verbose
```

## 本地文件

`scowctl` 会把登录信息和 OpenAPI 缓存写入用户配置目录下的 `scowctl` 子目录。Linux 下通常是：

```text
~/.config/scowctl/config.json
~/.config/scowctl/openapi/default/meta.json
```

其中 `config.json` 保存当前 profile、SCOW base URL、token、用户名、静态认证信息以及 OpenAPI 缓存路径；OpenAPI 缓存按 profile 分目录保存。
