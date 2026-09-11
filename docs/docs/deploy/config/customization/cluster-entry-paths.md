---
sidebar_position: 14
title: 集群快捷路径配置
description: 在多存储系统下为集群文件管理器配置自定义快捷路径入口
---

# 集群快捷路径配置

SCOW 支持为每个集群的存储挂载点配置**快捷路径入口**，用户在门户文件管理器和 AI 文件管理器侧边栏及文件选择器中可以通过快捷入口一键跳转至常用目录，无需手动输入路径。

## 功能说明

配置快捷路径后，文件管理器左侧侧边栏将显示**SCOW家目录**和管理员预设的目录入口，快捷路径支持两类路径：

- **用户隔离目录**：路径模板中包含 `{{userId}}`，每个用户看到并访问各自独立的子目录（如 `/data/users/zhangsan`）
- **公共目录**：路径模板中不包含 `{{userId}}`，所有用户访问同一共享目录（如 `/data/public`）

## 部署前置要求

:::warning 管理员请注意
在配置快捷路径前，需在共享存储中预先完成以下目录准备工作：

1. **公共目录**：必须由管理员提前创建，并配置合适的权限（通常设为所有用户可读写或只读）。例如配置了 `{{mountPath}}/public`，则需确保 `/data/public` 目录已存在且权限正确。

2. **用户隔离目录的父级目录**：包含 `{{userId}}` 的路径，其父目录必须提前存在。例如配置了 `{{mountPath}}/users/{{userId}}`，则需确保 `/data/users/` 目录已存在（通常权限设为 `0755`）。用户个人子目录（如 `/data/users/zhangsan`）在用户首次通过 UI 点击该快捷入口时由系统自动以 `0700` 权限创建。

3. **AI 集群如没有配置快捷路径，不允许用户直接访问挂载点路径**：AI集群如果有特殊的用户访问目录的需求，除挂载点外，必须配置快捷路径。

4. **快捷路径与其他配置路径不冲突**：快捷路径与 AI 集群下分享数据资产的文件夹所在的目录`sharedTopDir`、公共数据资产目录`clusterPublicPath`、公共挂载点数组`publicMountPoints` 的配置不存在冲突。
:::

## 配置方式

快捷路径通过集群配置文件 `config/clusters/[clusterid].yaml` 中的 `entryPaths` 字段配置。`entryPaths` 也是集群与存储系统的挂载点绑定配置，快捷路径作为其可选子项。

```yaml title="config/clusters/[clusterid].yaml"
entryPaths:
  - storageId: "nfs1" # 必填，与 storage.yaml 中的 storageId 对应
    mountPath: "/data/nfs1" # 必填，当前存储在此集群上的实际挂载点路径

    # 可选，为文件管理器配置快捷路径入口列表
    paths:
      - displayName: "个人空间" # 用户隔离目录（含 {{userId}}）
        pathTemplate: "{{mountPath}}/users/{{userId}}"
      - displayName: "公共空间" # 公共目录（不含 {{userId}}）
        pathTemplate: "{{mountPath}}/public"

  - storageId: "gpfs1"
    mountPath: "/data/gpfs"
    paths:
      - displayName: "项目目录"
        pathTemplate: "{{mountPath}}/projects/{{userId}}"
```

## 路径模板占位符

`pathTemplate` 支持以下两个占位符，系统在渲染时自动替换：

| 占位符          | 替换内容                                            | 示例         |
| --------------- | --------------------------------------------------- | ------------ |
| `{{mountPath}}` | 当前存储在该集群下的挂载点，即 `mountPath` 字段的值 | `/data/nfs1` |
| `{{userId}}`    | 当前登录用户的用户 ID                               | `zhangsan`   |

**路径解析示例：** 若 `mountPath: "/data/nfs1"`，当前用户 ID 为 `zhangsan`，则：

| pathTemplate                        | 解析结果                       | 类型         |
| ----------------------------------- | ------------------------------ | ------------ |
| `{{mountPath}}/users/{{userId}}`    | `/data/nfs1/users/zhangsan`    | 用户隔离目录 |
| `{{mountPath}}/public`              | `/data/nfs1/public`            | 公共目录     |
| `{{mountPath}}/projects/{{userId}}` | `/data/nfs1/projects/zhangsan` | 用户隔离目录 |

:::caution 路径前缀注意事项
`pathTemplate` 解析后的路径前缀必须与 `mountPath` 保持一致，否则文件管理器将无法正确高亮当前所在位置对应的侧边栏条目。

**正确示例：**

```yaml
mountPath: "/data/nfs1"
pathTemplate: "{{mountPath}}/users/{{userId}}" # 解析后以 /data/nfs1 开头 ✓
```

**错误示例：**

```yaml
mountPath: "/data/nfs1"
pathTemplate: "/other/path/{{userId}}" # 解析后不以 /data/nfs1 开头 ✗
```

:::

## 用户隔离目录说明

包含 `{{userId}}` 的路径为用户隔离目录，每位用户只能看到并访问自己的专属子目录。

### 自动创建行为

用户首次点击包含 `{{userId}}` 的快捷入口时，若对应目录不存在，**会自动以 `0700` 权限创建该目录**（仅用户本人可读写执行）。

自动创建的前提是父级目录已存在，例如配置了 `{{mountPath}}/users/{{userId}}`，则 `/data/users/` 必须由管理员提前创建，否则自动创建失败，用户将被跳转至主目录。

**部署注意事项：**

- 用户隔离目录不包括系统现已定义的默认家目录，管理员注意目录配置不要重复。

## 公共目录说明

不包含 `{{userId}}` 的路径为公共目录，所有用户访问相同的路径。

**部署注意事项：**

- 公共目录**必须由管理员提前创建**，系统不会自动创建
- 根据使用场景设置合适的权限：
  - 只读共享（如公共数据集）：建议设置为 `0755(所有者可写，其他人只读)` 或 `0555（只读，所有人均不可写）`
  - 可写共享（如团队协作目录）：建议设置为 `0775（所有者和组成员可写，其他人只读）` 或 `1777（共享但防互删，内容对所有人可见）`
  - ** AI 集群配置的快捷路径的公共目录 ** 默认所有用户相当于具有 root 权限

## 显示名称国际化

`displayName` 支持直接写字符串，也支持多语言写法：

```yaml
paths:
  # 写法一：直接字符串，所有语言均显示此值
  - displayName: "个人空间"
    pathTemplate: "{{mountPath}}/users/{{userId}}"

  # 写法二：国际化对象，支持多语言
  - displayName:
      i18n:
        default: 个人备份空间 # 默认语言（必填）
        en: Private Archive
        zh_cn: 个人备份空间
    pathTemplate: "{{mountPath}}/archive/{{userId}}"
```

## 共享存储注意事项

在多集群环境中，同一套共享存储（如 NFS、GPFS、Lustre）往往会以相同或不同的挂载点同时挂载到多个集群。这种情况下配置快捷路径需要特别注意以下几点。

### 多集群共享同一存储时的路径隔离

当多个集群共享同一存储系统时，如果不同集群的 `pathTemplate` 解析后指向同一物理路径，不同集群的用户将访问同一目录，可能导致数据混淆或权限冲突。

**推荐做法：为每个集群使用独立的路径前缀。**

```yaml
# hpc01 集群配置
# config/clusters/hpc01.yaml
entryPaths:
  - storageId: "nfs1"
    mountPath: "/data/nfs1"
    paths:
      - displayName: "个人空间"
        pathTemplate: "{{mountPath}}/hpc01/{{userId}}"   # 带集群前缀

# hpc02 集群配置
# config/clusters/hpc02.yaml
entryPaths:
  - storageId: "nfs1"
    mountPath: "/data/nfs1"
    paths:
      - displayName: "个人空间"
        pathTemplate: "{{mountPath}}/hpc02/{{userId}}"   # 带不同的集群前缀
```

这样两个集群的用户各自使用 `/data/nfs1/hpc01/<userId>` 和 `/data/nfs1/hpc02/<userId>`，互不干扰。

如果业务上确实需要多个集群共享同一个用户目录（例如跨集群协作），则可以使用相同的路径，但需确保存储权限和文件锁机制支持并发访问。

### 同一存储不同挂载点

同一存储系统在不同集群上可能以不同的挂载点挂载，此时 `storageId` 相同但 `mountPath` 不同。配置时使用各集群实际的挂载点即可，`{{mountPath}}` 会自动替换为对应集群的挂载点：

```yaml
# hpc01：存储挂载在 /data
entryPaths:
  - storageId: "nfs1"
    mountPath: "/data"
    paths:
      - displayName: "个人空间"
        pathTemplate: "{{mountPath}}/users/{{userId}}"   # → /data/users/zhangsan

# hpc02：同一存储挂载在 /shared
entryPaths:
  - storageId: "nfs1"
    mountPath: "/shared"
    paths:
      - displayName: "个人空间"
        pathTemplate: "{{mountPath}}/users/{{userId}}"   # → /shared/users/zhangsan
```

:::caution
上例中 `/data/users/zhangsan` 和 `/shared/users/zhangsan` 在存储层是同一物理路径（不同挂载点指向同一存储），文件管理器无法感知这一点。管理员应明确这是否符合预期，避免无意间让两个集群的用户写入相同的目录。若希望隔离，同样应在路径模板中加入集群特有的前缀。
:::

## 配置校验规则

系统启动时会对 `entryPaths` 配置进行校验，以下情况会导致启动失败：

| 错误类型           | 说明                                                                              |
| ------------------ | --------------------------------------------------------------------------------- |
| `storageId` 重复   | 同一集群下 `entryPaths` 中 `storageId` 不能重复                                   |
| `mountPath` 重复   | 同一集群下 `entryPaths` 中 `mountPath` 不能完全相同                               |
| `storageId` 不存在 | `storageId` 必须在 `config/storage.yaml` 中已定义（当 storage.yaml 有内容时校验） |
| 非法占位符         | `pathTemplate` 中只允许 `{{mountPath}}` 和 `{{userId}}`，不支持其他占位符         |
| 格式错误           | 占位符必须使用双花括号 `{{name}}` 格式，单花括号 `{name}` 不被支持                |

## 与存储管理的关系

`entryPaths` 下的 `storageId` + `mountPath` 同时也是集群与存储系统的绑定关系配置，用于存储配额管理功能。即使不配置 `paths`（快捷入口），该绑定关系仍然有效，配额管理功能不受影响。

详见[存储管理配置](../mis/storage/storage_manager.md)。