# SCOWD 资源限制技术方案

## 概述

SCOWD (SCOW Daemon) 的资源限制方案是一个基于 systemd-run 的子进程资源管理系统，旨在为每个用户的子进程提供 CPU 和内存资源限制，确保系统资源的合理分配和使用。

## 技术架构

### 1. 核心组件

#### 1.1 子进程管理器 (ChildProcessManager)
- **位置**: `global/parent/manager.go`
- **功能**: 统一管理所有用户的子进程实例
- **特性**:
  - 线程安全的进程映射管理
  - 端口池管理，避免端口冲突
  - 自动清理空闲进程（默认10分钟超时）
  - 分批处理机制，避免长时间锁定

#### 1.2 子进程实例 (ChildProcess)
- **位置**: `global/parent/child_process.go`
- **功能**: 单个用户子进程的生命周期管理
- **特性**:
  - 进程状态跟踪和健康检查
  - 优雅关闭机制（SIGTERM → SIGKILL）
  - 资源自动回收

#### 1.3 进程启动器 (Starter)
- **位置**: `global/parent/starter.go`
- **功能**: 负责子进程的创建和启动
- **特性**:
  - 智能启动策略选择
  - 环境变量配置
  - 错误处理和诊断

#### 1.4 Systemd 集成 (Systemd)
- **位置**: `global/parent/systemd.go`
- **功能**: systemd-run 命令构建和管理
- **特性**:
  - 版本兼容性检测
  - 用户会话支持检查
  - 动态参数构建

#### 1.5 进程监控 (Monitor)
- **位置**: `global/parent/monitor.go`
- **功能**: 子进程运行状态监控
- **特性**:
  - 退出代码分析
  - 资源使用统计
  - 异常检测和报告

### 2. 配置系统

#### 2.1 配置结构
```yaml
childProcess:
  resourceLimits:
    enabled: true      # 是否启用资源限制
    cpuCores: 2        # CPU核数限制
    memoryMB: 1024     # 内存限制（MB）
```

#### 2.2 配置文件位置
- **路径**: `./configs/scowd.yaml`
- **加载**: 运行时动态读取
- **回退**: 配置读取失败时自动回退到无限制模式

## 技术实现

### 1. 资源限制实现

#### 1.1 Systemd-run 集成

**优势**:
- 利用 systemd 的 cgroup 机制进行资源限制
- 支持精确的 CPU 和内存控制
- 自动进程清理和资源回收
- 与系统资源管理器深度集成

**实现细节**:
```bash
systemd-run \
  --uid <用户ID> \
  --gid <组ID> \
  [--user]  # 根据用户会话支持情况动态添加
  --scope \
  --collect \
  --property=CPUQuota=<CPU百分比>% \
  --property=<内存参数>=<内存大小>M \
  --setenv=<环境变量> \
  -- <子进程命令>
```

#### 1.2 版本兼容性

**内存参数选择**:
- systemd >= 230: 使用 `MemoryMax`
- systemd < 230: 使用 `MemoryLimit`
- 自动检测版本并选择合适参数

**检测机制**:
```go
func getMemoryLimitParameter() string {
    // 1. 执行 systemctl --version
    // 2. 解析版本号
    // 3. 根据版本选择参数
    // 4. 错误时回退到 MemoryLimit
}
```

#### 1.3 用户会话支持

**检查条件**:
1. `XDG_RUNTIME_DIR` 环境变量存在
2. `systemctl --user is-active default.target` 执行成功

**会话选择逻辑**:
- 支持用户会话: 使用 `--user` 参数
- 不支持用户会话: 使用系统会话
- 自动记录选择结果到日志

### 2. 启动策略

#### 2.1 智能回退机制

```
配置启用资源限制?
├─ 是 → systemd-run可用?
│   ├─ 是 → 使用systemd-run启动
│   └─ 否 → 回退到标准exec启动
└─ 否 → 直接使用标准exec启动
```

#### 2.2 可用性测试

**测试步骤**:
1. 检查 `systemd-run` 命令是否存在
2. 执行 `systemd-run --version` 验证功能
3. 可选检查 `--user` 参数支持

**安全性考虑**:
- 避免执行可能影响系统的测试命令
- 使用轻量级检查方法
- 失败时提供详细错误信息

### 3. 进程生命周期管理

#### 3.1 启动流程

```
1. 端口获取 → 2. 用户认证 → 3. 目录创建 → 4. 密钥生成
     ↓
5. 命令构建 → 6. 环境配置 → 7. 进程启动 → 8. 监控启动
     ↓
9. 健康检查 → 10. 服务就绪
```

#### 3.2 监控机制

**健康检查**:
- HTTP 服务就绪检查
- 最小检查间隔限制（1秒）
- 自动重试机制

**状态监控**:
- 进程退出代码分析
- 资源使用统计
- 异常情况报告

#### 3.3 清理机制

**优雅关闭**:
1. 发送 SIGTERM 信号
2. 等待 5 秒
3. 发送 SIGKILL 信号
4. 等待 2 秒
5. 清理资源

**自动清理**:
- 空闲超时检查（10分钟）
- 分批处理避免系统负载
- 并发清理提高效率

### 4. 安全性设计

#### 4.1 权限控制
- 子进程以目标用户身份运行
- 严格的 UID/GID 设置
- 环境变量隔离

#### 4.2 资源隔离
- 基于 cgroup 的资源限制
- 独立的运行时目录
- 端口池管理避免冲突

#### 4.3 日志安全
- 敏感信息（公钥/私钥）使用 Debug 级别
- 详细的错误诊断信息
- 结构化日志记录

## 配置示例

### 1. 基础配置

```yaml
# scowd.yaml
childProcess:
  resourceLimits:
    enabled: true
    cpuCores: 2
    memoryMB: 1024
```

### 2. 高级配置

```yaml
childProcess:
  resourceLimits:
    enabled: true
    cpuCores: 4        # 4核CPU限制
    memoryMB: 2048     # 2GB内存限制
```

### 3. 禁用资源限制

```yaml
childProcess:
  resourceLimits:
    enabled: false
```

## 运维指南

### 1. 系统要求

**必需组件**:
- systemd (推荐 >= 230)
- systemd-run 命令
- 用户会话支持（可选）

**检查命令**:
```bash
# 检查systemd版本
systemctl --version

# 检查systemd-run可用性
systemd-run --version

# 检查用户会话支持
systemctl --user is-active default.target
```

### 2. 故障排查

#### 2.1 常见问题

**问题**: "Failed to create bus connection: Connection refused"
- **原因**: 用户会话不可用
- **解决**: 系统会自动回退到系统会话
- **检查**: 查看日志中的会话选择信息

**问题**: 资源限制不生效
- **检查**: 配置文件中 `enabled` 是否为 `true`
- **检查**: systemd-run 是否可用
- **检查**: 日志中的启动命令

#### 2.2 日志分析

**关键日志**:
```
# 启动方式选择
"Using systemd user session for user xxx"
"User session not available, using system session for user xxx"

# 资源限制设置
"Setting CPU limit: X cores (Y% quota)"
"Setting memory limit: XMB (using MemoryMax/MemoryLimit)"

# 回退机制
"systemd-run test failed, falling back to standard exec"
```

### 3. 性能调优

#### 3.1 资源配置建议

**CPU 配置**:
- 轻量级应用: 1-2 核
- 计算密集型: 2-4 核
- 根据系统总核数合理分配

**内存配置**:
- 基础应用: 512MB - 1GB
- 数据处理: 1GB - 4GB
- 预留系统内存，避免 OOM

#### 3.2 监控指标

**关键指标**:
- 子进程数量
- 资源使用率
- 启动成功率
- 异常退出率

## 扩展性设计

### 1. 新资源类型支持
- 磁盘 I/O 限制
- 网络带宽限制
- 文件描述符限制

### 2. 动态资源调整
- 运行时资源修改
- 基于负载的自动调整
- 资源配额管理

### 3. 集群支持
- 跨节点资源协调
- 分布式资源池
- 负载均衡

## 总结

SCOWD 资源限制方案通过 systemd-run 集成提供了强大而灵活的资源管理能力。该方案具有以下优势：

1. **可靠性**: 基于成熟的 systemd 技术栈
2. **兼容性**: 支持多版本 systemd，自动回退机制
3. **安全性**: 严格的权限控制和资源隔离
4. **可维护性**: 清晰的模块化设计和详细的日志记录
5. **扩展性**: 支持未来功能扩展和性能优化

该方案为 SCOW 系统提供了企业级的资源管理能力，确保多用户环境下的系统稳定性和资源公平性。
