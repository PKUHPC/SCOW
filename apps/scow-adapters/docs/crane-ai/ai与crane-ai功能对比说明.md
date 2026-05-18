# AI 适配器与 crane-ai 适配器功能对比说明

## 1. 目的

本文以 `pkg/ai` 作为基准，梳理 SCOW AI 适配器的全量功能，并对 `pkg/crane-ai` 的实现情况进行逐项对比，形成一份清晰的功能对照表，便于后续补齐 `crane-ai` 的能力。

## 2. 总体结论

从代码实现看，`pkg/ai` 不只是一个 SCOW 到底层调度器的接口适配层，它还承担了较完整的控制面职责，包括：

- 服务接口实现
- K8s/Volcano 资源编排
- 本地数据库持久化
- Pod/Event/Job 状态同步
- Queue 与节点标签控制
- 作业超时清理
- GPU quota 排队与自动重提
- TensorBoard 等训练配套能力

相比之下，`pkg/crane-ai` 已经覆盖了 SCOW 使用中的大部分核心前台接口，但整体仍偏向“业务接口适配器”，尚未对齐 `pkg/ai` 在控制面和后台支撑层面的完整能力。

可以概括为：

- `crane-ai` 已具备核心服务能力，可用于基础账户、作业、应用访问和集群信息查询。
- `crane-ai` 在节点管理、Pod 级观测、状态持久化、控制器、配额排队、TensorBoard、多框架训练支持等方面仍有明显缺口。
- `crane-ai` 也存在少量 `AI` 适配器没有的额外功能，例如 `RunCommandOnJobNodes`。

## 3. 功能对照表

### 3.1 服务接口能力

| 功能域 | AI 适配器 | crane-ai | 结论 | 说明 |
|---|---|---|---|---|
| AccountService 基础账户管理 | 已支持 | 已支持 | 已支持 | 两边都实现了账户创建、删除、封禁、账户详情查询、账户与用户关系查询等能力 |
| UserService 用户与账户关系管理 | 已支持 | 已支持 | 已支持 | 两边都实现了用户加账户、移除、封禁、解封、查询、删除 |
| ConfigService 集群与分区查询 | 已支持 | 已支持 | 已支持 | 两边都实现了分区、节点、集群信息和可选功能查询 |
| AppService 应用连接信息 | 已支持 | 已支持 | 已支持 | 两边都支持应用连接信息查询 |
| VersionService | 已支持 | 已支持 | 已支持 | 两边都支持版本查询 |
| JobService SubmitJob | 已支持 | 已支持 | 已支持 | 两边都支持提交普通作业 |
| JobService SubmitInferJob | 已支持 | 已支持 | 已支持 | 两边都支持提交推理作业 |
| JobService CreateDevHost | 已支持 | 已支持 | 已支持 | 两边都支持创建开发主机 |
| JobService GetJobs / GetJobById | 已支持 | 已支持 | 基本支持 | 两边都支持作业列表与详情查询，但返回细节不完全一致 |
| JobService CancelJob / ChangeJobTimeLimit / QueryJobTimeLimit | 已支持 | 已支持 | 已支持 | 两边都已实现 |
| JobService StreamJobShell | 已支持 | 已支持 | 已支持 | 两边都支持交互式 shell |
| JobService GetPodLogs | 已支持 | 缺失 | 缺失 | `crane-ai` 未实现 Pod 日志查询 |
| JobService GetPodMonitorInfo | 已支持 | 缺失 | 缺失 | `crane-ai` 未实现 Pod 监控信息查询 |
| NodeService 节点管理 | 已支持 | 缺失 | 缺失 | `AI` 支持节点加入/移出集群，`crane-ai` 未注册该服务 |
| SubmitScriptAsJob | 不支持 | 不支持 | 一致缺失 | 这项在 `AI` 中本身也是 `NOT_SUPPORT` |

### 3.2 后台控制面与状态管理能力

| 功能域 | AI 适配器 | crane-ai | 结论 | 说明 |
|---|---|---|---|---|
| 本地数据库模型与迁移 | 已支持 | 缺失 | 缺失 | `AI` 维护 user/account/partition/assoc/job/pod/event 等表，`crane-ai` 无等价模块 |
| 作业、Pod、Event 状态落库 | 已支持 | 缺失 | 缺失 | `AI` 会把运行态、事件、原因等持久化；`crane-ai` 主要依赖 Crane 实时查询 |
| Informer 事件同步 | 已支持 | 缺失 | 缺失 | `AI` 有 Pod/Event/VcJob/Deployment/Queue informer；`crane-ai` 无对应机制 |
| Queue/节点标签控制器 | 已支持 | 缺失 | 缺失 | `AI` 可根据配置自动维护 Volcano Queue 和节点标签 |
| DevHost ConfigMap 检查 | 已支持 | 缺失 | 缺失 | `AI` 启动后会周期检查 devhost 相关 ConfigMap |
| PriorityClass 初始化 | 已支持 | 缺失 | 缺失 | `AI` 启动时会初始化优先级类 |
| 作业超时恢复与自动删除 | 已支持 | 缺失 | 缺失 | `AI` 有 timer 管理器，可恢复和清理超时作业 |
| GPU quota 排队与自动重提 | 已支持 | 缺失 | 缺失 | `AI` 支持队列状态 `QUEUED`、持久化提交信息并在资源满足后自动重提 |
| 集群指标采集 | 已支持 | 已支持 | 已支持 | 两边都实现了 Prometheus 指标采集，但底层数据来源不同 |

### 3.3 作业编排与训练推理能力

| 功能域 | AI 适配器 | crane-ai | 结论 | 说明 |
|---|---|---|---|---|
| 应用作业编排 | 已支持 | 已支持 | 已支持 | 两边都支持应用类作业 |
| 推理作业编排 | 已支持 | 已支持 | 已支持 | 两边都支持推理作业 |
| DevHost 编排 | 已支持 | 已支持 | 已支持 | 两边都支持开发主机 |
| 多机训练 | 已支持 | 部分支持 | 部分支持 | `crane-ai` 已有脚本化多机训练逻辑，但整体能力模型不如 `AI` 完整 |
| 多训练框架支持 | 已支持 | 部分支持 | 部分支持 | `AI` 支持 PyTorch、MindSpore、MPI、TensorFlow；`crane-ai` 当前代码明确写有“目前只支持 pytorch” |
| TensorBoard | 已支持 | 缺失 | 缺失 | `AI` 可创建 TensorBoard 资源并在作业详情中返回访问信息；`crane-ai` 未见等价实现 |
| RDMA / Secret / Service / ConfigMap 等资源编排 | 已支持 | 部分支持 | 部分支持 | `AI` 在 K8s/Volcano 资源层做得更完整，`crane-ai` 更偏容器任务构造 |

### 3.4 crane-ai 的额外功能

| 功能域 | AI 适配器 | crane-ai | 结论 | 说明 |
|---|---|---|---|---|
| RunCommandOnJobNodes | 缺失 | 已支持 | 额外功能 | `crane-ai` 支持在作业节点上执行命令 |
| 代理恢复与周期清理 | 无明显等价实现 | 已支持 | 额外功能 | `crane-ai` 启动时恢复代理，并提供周期清理逻辑 |

## 4. 差异归类总结

### 4.1 已支持

`crane-ai` 已覆盖以下核心能力：

- 账户管理
- 用户与账户关系管理
- 集群与分区配置查询
- 应用连接信息查询
- 作业提交、查询、取消、改时限、查时限
- 开发主机创建
- 推理作业提交
- 交互式 shell
- 基础监控采集

### 4.2 部分支持

`crane-ai` 已有实现，但与 `AI` 适配器相比仍未完全对齐：

- 多机训练
- 多训练框架支持
- K8s/资源编排深度

### 4.3 缺失

相对 `AI` 全量功能，`crane-ai` 当前缺失的重点能力包括：

- NodeService 节点加入/移出集群
- Pod 日志查询
- Pod 监控信息查询
- 本地数据库持久化
- Pod/Event/Job 状态同步与事件落库
- Informer 机制
- Queue/节点标签控制器
- DevHost ConfigMap 自动检查
- PriorityClass 初始化
- 作业超时恢复与自动删除
- GPU quota 排队与自动重提
- TensorBoard 完整能力

### 4.4 额外功能

`crane-ai` 当前有两项 `AI` 适配器中没有明显对应实现的能力：

- `RunCommandOnJobNodes`
- 代理恢复与周期清理

## 5. 最终结论

如果以 `pkg/ai` 作为“AI 适配器全量功能”基准，那么 `pkg/crane-ai` 当前状态可以定义为：

- 前台核心接口基本具备
- 控制面后台能力明显不足
- 训练配套能力未完全对齐
- 具备少量自身额外能力

因此，`crane-ai` 目前还不能视为与 `AI` 适配器“功能等价”，更准确的判断应是：

`crane-ai` 已经实现了一个可用的 SCOW AI 业务适配层，但尚未补齐 `AI` 适配器在状态管理、控制器、配额调度、训练配套和节点管理等方面的完整能力。

## 6. 建议的补齐优先级

如果后续需要让 `crane-ai` 尽量向 `AI` 适配器靠齐，建议按如下优先级推进：

### 6.1 必须补

- NodeService
- GetPodLogs
- GetPodMonitorInfo
- GPU quota 排队与自动重提
- TensorBoard 能力

### 6.2 建议补

- 本地状态持久化
- 作业/Pod/Event 状态同步
- 超时恢复与自动删除
- Queue/节点标签控制器

### 6.3 可选补

- 多训练框架完全对齐
- DevHost ConfigMap 检查
- PriorityClass 初始化

