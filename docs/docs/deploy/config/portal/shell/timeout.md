---
sidebar_position: 1
title: 会话超时与回收
---

# Shell 会话超时与回收

Shell 会话保持连接的时长会受到以下因素影响：

- **Token 过期时间**：当登录 token 过期后，Shell 的 WebSocket 连接会被断开，需要重新登录后才能继续使用。
    - Token 过期时间可以在 `config/auth.yaml` 中配置 `tokenTimeoutSeconds` 字段（单位：秒）。
    - 默认值为 `3600`（1小时）。
    - 该配置表示 token 未被使用（即用户无操作）的失效时间。

- **Shell 空闲回收**：`scowd` 的 `scowd.yaml` 下的 `childProcess.shellIdleTimeoutMinutes` 配置决定了 Shell 会话空闲多久后会被回收（单位：分钟）。
    - 该配置仅对“使用过 shell 功能”的子进程生效。
    - 当配置值 `<= 0` 或未配置时使用默认值 `60` 分钟。
    - **注意**：Shell 会话的回收时间**至少**会大于该配置时间。只要用户一直在使用登录节点的其他功能（例如文件管理等），Shell 也会继续保持连接，不会被回收。
