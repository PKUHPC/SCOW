---
title: SCOWD 子进程资源限制
sidebar_position: 2
---

# SCOWD 子进程资源限制

SCOWD 可通过 `systemd-run` 创建 scope，使用 cgroup 限制用户子进程的 CPU 和内存。安装与完整配置见 [SCOWD 介绍及配置](configuration.md)。

## 生效范围

SCOWD 按用户创建并复用子进程。限制作用于该子进程所在的 scope，包括留在同一 cgroup 中的后代进程；同一用户的请求共享这份额度。它不限制 SCOWD 主进程，也不提供跨节点配额或调度器作业资源管理。

当前仅支持 CPU 和内存限制，没有磁盘 I/O、网络带宽限制或运行中动态调整能力。

## 配置

修改 **SCOWD 可执行文件所在目录** 下的 `configs/scowd.yaml`，合并以下配置：

```yaml
childProcess:
  resourceLimits:
    enabled: true
    cpuCores: 2
    memoryMB: 1024
```

| 配置项 | 默认值 | 当前行为 |
| --- | --- | --- |
| `enabled` | `false` | 为 `true` 时尝试通过 systemd 应用限制 |
| `cpuCores` | `0` | 整数，大于 0 时设置 `CPUQuota=核数 × 100%`；例如 2 对应 `200%`，不绑定特定 CPU 核心 |
| `memoryMB` | `0` | 整数，大于 0 时设置内存上限；例如 1024 转为 systemd 的 `1024M`（1 GiB） |

`cpuCores` 或 `memoryMB` 小于等于 0 时，不设置对应限制；仍可能受上级 cgroup 的限制。禁用时将 `enabled` 设为 `false`。

配置按文件修改时间重新加载，资源限制只在**新建子进程**时应用。已有子进程继续使用启动时的设置，需在其退出并重新创建后验证新配置。修改或禁用配置不会立即调整已有 scope。

## 启动与回退行为

1. 未启用限制，或构造子进程命令时读取配置失败：使用普通 exec 启动，不设置上述资源限制。配置文件无法访问时可能复用已有缓存；主进程首次启动读取配置失败则退出。
2. 启用限制：检查 `systemd-run` 是否存在及 `--version` 输出。检查失败则记录 `falling back to standard exec`，改用普通启动。
3. 检查通过：使用 `systemd-run --scope --collect` 启动子进程。程序在 SCOWD 主进程的执行环境中运行 `systemctl --user is-active default.target`，成功时增加 `--user`，否则使用系统级 scope。此检查不代表目标用户已建立登录会话。
4. 内存参数依据 `systemctl --version` 选择：版本至少为 230 时使用 `MemoryMax`，更旧版本或版本检测失败时使用 `MemoryLimit`。这只是内存参数选择，不保证其他参数与旧版本兼容。

子进程启动后自行切换到目标用户的 UID、GID 和附加组，`systemd-run` 命令不传 `--uid/--gid`。

**可用性检查不会实际创建 scope。** 即使检查通过，仍可能因 bus 连接、权限或参数兼容性问题启动失败；实际启动失败或随后退出时，当前实现不会自动改用 exec 重试。因此，不能仅凭配置或版本检查判断限制已生效。

## 部署验证与排查

在部署节点、SCOWD 服务对应的执行身份和环境中检查：

```bash
systemctl --version
systemd-run --version
systemctl --user is-active default.target
```

启用配置后，通过 SCOW 发起一次需要用户子进程处理的请求，确认新子进程启动成功，再检查：

- **启动日志**：有无 `falling back to standard exec`，选择了用户会话还是系统会话，CPU 和内存参数是否符合预期。`Setting CPU limit` / `Setting memory limit` 在命令构造阶段输出，不能作为生效证明。
- **实际 cgroup**：找到 `scowd --child <用户>` 的 PID，查看其 cgroup 路径，并找到对应 scope：

  ```bash
  # 将 12345 替换为实际子进程 PID
  child_pid=12345
  cat "/proc/$child_pid/cgroup"
  ```

- **scope 属性**：用实际 scope 名称替换下例，核对 CPU 配额与内存上限。若使用用户级 scope，应在对应用户管理器的环境中给 `systemctl` 加 `--user`。

  ```bash
  systemctl show run-xxxx.scope \
    -p ControlGroup -p CPUQuotaPerSecUSec -p MemoryMax -p MemoryLimit
  ```

  示例配置通常对应 `CPUQuotaPerSecUSec=2s` 和内存上限 `1073741824` 字节。以当前 systemd 支持的属性及实际 cgroup 为准；cgroup v2 可进一步核对该路径下的 `cpu.max` 和 `memory.max`。

- **实际负载**：在测试环境确认 CPU 限流与内存上限行为。内存达到上限可能触发 cgroup OOM，应结合内核日志和 cgroup 事件判断，不能仅凭退出码认定 OOM。

若出现 bus 连接或权限错误，检查 SCOWD 服务环境、所选 systemd 管理器及创建 scope 的权限；若限制与预期不符，先确认检查的是配置更新后新建的子进程，且没有回退到普通启动。

## 实现位置

以下路径均相对于 `apps/scowd/`：

| 文件 | 职责 |
| --- | --- |
| `internal/config/config.go` | 配置字段及加载缓存 |
| `internal/process/parent/starter.go` | 启动方式选择与回退 |
| `internal/process/parent/systemd.go` | scope 参数、版本和会话检查 |
| `internal/process/parent/manager.go` | 按用户复用与回收子进程 |
| `internal/process/child/child.go` | 子进程身份切换 |
