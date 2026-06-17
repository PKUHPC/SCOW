---
sidebar_position: 6
title: MindX 5.0.X 新增队列
---

# MindX 5.0.X 新增队列

参考：[MindX DL 集群调度安装指导](https://www.hiascend.com/document/detail/zh/mindcluster/70rc1/clustersched/dlug/dlug_installation_013.html)。

## 节点打标签

根据 NPU 卡的类型，给 Kubernetes 节点打上标签。

| 节点类型 | 产品类型 | 标签 |
| --- | --- | --- |
| 管理节点 | - | `masterselector=dls-master-node` |
| 计算节点 | Atlas 800 训练服务器（NPU 满配） | `node-role.kubernetes.io/worker=worker`<br />`workerselector=dls-worker-node`<br />`host-arch=huawei-arm` 或 `host-arch=huawei-x86`<br />`accelerator=huawei-Ascend910`<br />`accelerator-type=module`<br />（可选）`nodeDEnable=on` |
| 计算节点 | Atlas 800 训练服务器（NPU 半配） | `node-role.kubernetes.io/worker=worker`<br />`workerselector=dls-worker-node`<br />`host-arch=huawei-arm` 或 `host-arch=huawei-x86`<br />`accelerator=huawei-Ascend910`<br />`accelerator-type=half`<br />（可选）`nodeDEnable=on` |
| 计算节点 | Atlas 800T A2 训练服务器或 Atlas 900 A2 PoD 集群基础单元 | `node-role.kubernetes.io/worker=worker`<br />`workerselector=dls-worker-node`<br />`host-arch=huawei-arm`<br />`accelerator=huawei-Ascend910`<br />`accelerator-type=module-{xxx}b-8`<br />（可选）`nodeDEnable=on` |
| 计算节点 | Atlas 900 A3 SuperPoD 超节点<br />Atlas 9000 A3 SuperPoD 集群算力系统<br />Atlas 800T A3 超节点服务器 | `node-role.kubernetes.io/worker=worker`<br />`workerselector=dls-worker-node`<br />`host-arch=huawei-arm` 或 `host-arch=huawei-x86`<br />`accelerator=huawei-Ascend910`<br />（可选）`nodeDEnable=on` |
| 计算节点 | A200T A3 Box8 超节点服务器<br />Atlas 800I A3 超节点服务器 | `node-role.kubernetes.io/worker=worker`<br />`workerselector=dls-worker-node`<br />`host-arch=huawei-x86` 或 `host-arch=huawei-arm`<br />`accelerator=huawei-Ascend910`<br />`accelerator-type=module-a3-16`<br />（可选）`nodeDEnable=on` |
| 计算节点 | Atlas 800I A2 推理服务器 | `node-role.kubernetes.io/worker=worker`<br />`workerselector=dls-worker-node`<br />`host-arch=huawei-arm`<br />`accelerator=huawei-Ascend910`<br />`accelerator-type=module-{xxx}b-8`<br />`server-usage=infer`<br />（可选）`nodeDEnable=on` |
| 计算节点 | A200I A2 Box 异构组件 | `node-role.kubernetes.io/worker=worker`<br />`workerselector=dls-worker-node`<br />`host-arch=huawei-x86`<br />`accelerator=huawei-Ascend910`<br />`accelerator-type=module-{xxx}b-8`<br />`server-usage=infer`<br />（可选）`nodeDEnable=on` |
| 计算节点 | Atlas 200T A2 Box16 异构子框 | `node-role.kubernetes.io/worker=worker`<br />`workerselector=dls-worker-node`<br />`host-arch=huawei-x86`<br />`accelerator=huawei-Ascend910`<br />`accelerator-type=module-{xxx}b-16`<br />（可选）`nodeDEnable=on` |
| 计算节点 | 训练服务器（插 Atlas 300T 训练卡） | `node-role.kubernetes.io/worker=worker`<br />`workerselector=dls-worker-node`<br />`host-arch=huawei-arm` 或 `host-arch=huawei-x86`<br />`accelerator=huawei-Ascend910`<br />`accelerator-type=card`<br />（可选）`nodeDEnable=on` |
| 计算节点 | 推理服务器（插 Atlas 300I 推理卡） | `node-role.kubernetes.io/worker=worker`<br />`workerselector=dls-worker-node`<br />`host-arch=huawei-arm` 或 `host-arch=huawei-x86`<br />`accelerator=huawei-Ascend310`<br />（可选）`nodeDEnable=on` |
| 计算节点 | Atlas 推理系列产品（除 Atlas 200I SoC A1 核心板） | `node-role.kubernetes.io/worker=worker`<br />`workerselector=dls-worker-node`<br />`host-arch=huawei-arm` 或 `host-arch=huawei-x86`<br />`accelerator=huawei-Ascend310P`<br />（可选）`nodeDEnable=on` |
| 计算节点 | Atlas 200I SoC A1 核心板 | `node-role.kubernetes.io/worker=worker`<br />`workerselector=dls-worker-node`<br />`host-arch=huawei-arm` 或 `host-arch=huawei-x86`<br />`accelerator=huawei-Ascend310P`<br />`servertype=soc`<br />（可选）`nodeDEnable=on` |

```Bash
kubectl label node ${nodeName} key=value
```

例如，Atlas 800 训练服务器（NPU 满配）可以参考以下命令。将 `${nodeName}` 替换为节点名，将 `${queueName}` 替换为队列名。

```Bash
kubectl label node ${nodeName} \
  node-role.kubernetes.io/worker=worker \
  workerselector=dls-worker-node \
  host-arch=huawei-arm \
  accelerator=huawei-Ascend910 \
  accelerator-type=module \
  queue-${queueName}=true
```

如果节点为 x86 架构，将 `host-arch=huawei-arm` 修改为 `host-arch=huawei-x86`。

## 修改 Volcano 调度配置

通过 YAML 创建完 Volcano 队列后，需要修改 scheduler configmap 配置文件，在调度时进行标签筛选。

```Bash
kubectl edit cm -n volcano-system volcano-scheduler-configmap
```

`accelerator` 需要新增资源类型。将 `${resourceName}` 替换为具体资源名，资源名可通过以下命令查看。

```Bash
kubectl describe node ${nodeName}
```

在 `configurations` 的 `arguments` 中添加队列名。将 `${queueName}` 替换为队列名。

```json
"accelerator": "${resourceName}|...",
"queue-${queueName}": "true"
```

如果节点标签新增的 `accelerator-type` 值不在已有配置中，也需要添加具体的 value。

```json
"accelerator-type": "${value}"
```

配置示例：

```yaml
configurations:
  - name: selector
    arguments: {
      "accelerator": "huawei-Ascend910|huawei.com|nvidia-tesla-v100|nvidia-tesla-p40",
      "queue-ascend910": "true",
      "accelerator-type": "card|module|half|module-910b-16|module-910b-8|card-910b-2|card-910b-infer",
      "servertype": "soc"
    }
```

## 重启 Volcano 调度服务

执行以下命令重启 Volcano scheduler deployment。

```Bash
kubectl rollout restart deployment -n volcano-system volcano-scheduler
```

查看 pod 是否重启成功。

```Bash
kubectl get pod -n volcano-system
```

## 提交任务验证

提交任务，验证新增队列的标签筛选和调度配置是否生效。
