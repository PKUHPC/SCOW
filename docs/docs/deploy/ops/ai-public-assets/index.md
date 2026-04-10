---
sidebar_position: 20
title: AI 公共数据资产迁移
---

# AI 公共数据资产迁移

本文档给出“用户分享数据迁移为平台公共资产”的最终执行草案。

适用范围：

- 数据集 `dataset / dataset_version`
- 算法 `algorithm / algorithm_version`
- 模型 `model / model_version`

不包含：

- 镜像

## 迁移目标

将当前通过“用户分享”方式公开的数据，迁移为“平台公共资产”语义：

- 原用户主记录保留
- 原用户已分享版本回写为未分享
- 新增一套平台公共资产主记录和版本记录
- 新平台记录使用 `is_platform_owned = 1`
- 新平台记录使用 `is_shared = 1`
- 新平台版本记录使用 `shared_status = 'SHARED'`
- 新平台版本记录的 `private_path` 与 `path` 都指向 `clusterPublicPath` 下的新公共路径

## 重要提示

- 运维执行前，必须确认当前无任何正在使用旧公共数据资产路径的作业。
- 建议先确保用户的数据资产分享权限已关闭（默认关闭）再执行迁移。
- 迁移脚本默认先 `DRY_RUN=1` 预演，再由运维显式改成 `DRY_RUN=0` 执行。
- 脚本按“单条失败继续，最后汇总失败项”设计。
- 脚本不会自动冻结用户编辑/删除；若迁移过程中检测到记录被并发修改，会跳过该条并记入失败清单。
- `dataset / algorithm / model` 主表没有数据库层唯一约束，脚本里的重名检查是唯一保障，不能依赖数据库自动拦截。
- 脚本通过本地 `cp/chown/chmod` 操作 `/.shared/...` 和 `clusterPublicPath/...`，因此必须在**本地可直接访问这两个目录的节点**执行；如果在 `pre-scow` 这类看不到 `/data/.shared` 的管理节点执行，会出现 `cp: cannot stat '/data/.shared/...'` 之类错误。

## 命名规则

新平台公共资产主记录名称按以下顺序尝试：

1. `原名称`
2. `原名称(用户ID)`
3. `原名称(用户ID-原记录ID)`
4. 若仍冲突，则继续按 `原名称(用户ID-原记录ID-1)`、`原名称(用户ID-原记录ID-2)`、`原名称(用户ID-原记录ID-3)` 依次递增，直到找到可用名称

名称冲突检查范围包括：

- 目标环境里已存在的 `is_platform_owned = 1` 记录
- 本次脚本已成功处理的记录

说明：

- 当前脚本的重名检查范围是全库所有 `is_platform_owned = 1` 的记录，不区分 `cluster_id`
- 因此如果不同集群下已有同名平台公共资产，也会触发后续的命名兜底规则

## 文件路径规则

新公共文件统一复制到：

```text
clusterPublicPath/Migration
```

若 `Migration` 根目录冲突且不希望复用，则改为：

```text
clusterPublicPath/Migration_YYYYMMDDHHmmss
```

单条版本的目标路径按旧 shared 路径平移生成，不按资产显示名重写目录。例如：

```text
原路径: /data/.shared/demo_admin/dataset/dataset1/1/dataset
目标路径: /data/.public/Migration/demo_admin/dataset/dataset1/1/dataset
```

这里直接从旧版本表 `path` 截取 `/.shared/` 之后的相对路径，不依赖反推 `sharedTopDir`。

## 权限策略

当前用户分享目录的权限语义来自两套实现：

- `sshFileDriver` 直接执行 `chmod -R 555`
- `scowdFileDriver` 通过 `changeMode(mode: "555", recursive: true)` 下发权限变更

因此本次迁移脚本采用以下口径：

- 默认递归执行 `chmod 555`
- `chown/chgrp` 不写死账号，统一对齐当前环境 `clusterPublicPath` 目录的 owner/group
- 若目标环境已有平台公共资产目录，建议执行前先人工 `ls -ld` 抽样确认 owner/group 是否与 `clusterPublicPath` 本身一致

## 多版本策略

对于存在多个版本的资产：

- 仅迁移 `shared_status = 'SHARED'` 的版本
- `UNSHARED / SHARING / UNSHARING` 版本不迁移到新平台记录
- 原用户记录保留全部版本
- 原已分享版本迁移成功后改回 `UNSHARED`，并将 `path` 回写为 `private_path`

## 执行方式

脚本文件位于：

- [ai-public-asset-migration.sh](/scripts/ai-public-asset-migration.sh)

建议执行顺序：

1. 打开脚本，先按环境填写数据库连接参数与 `CLUSTER_PUBLIC_PATH_MAP`
2. 保持 `DRY_RUN=1` 先执行一次，确认待迁移数量、命名结果和目标路径
3. 确认无误后改为 `DRY_RUN=0`
4. 执行完成后核对脚本输出的成功清单和失败清单

## 运维执行步骤

下面给出一套适合运维直接照做的最小执行流程。

### 1. 准备脚本

脚本必须在**本地能直接访问**共享目录和公共目录的节点执行。先检查：

```bash
ls -ld /data/.shared
ls -ld /data/.public
```

如果这里任何一个目录不存在，说明当前机器不是实际执行节点。此时不要继续执行，应切换到实际挂载 `/data/.shared` 和 `/data/.public` 的节点，例如 `k8s-master01`。

先在方便获取脚本的节点上准备脚本：

```bash
mkdir -p /root/migratesh
cd /root/migratesh
```

然后将 [ai-public-asset-migration.sh](/scripts/ai-public-asset-migration.sh) 保存为：

```text
/root/migratesh/ai-public-asset-migration.sh
```

如果该节点不是实际执行节点，还需要再把脚本复制到真正执行迁移的节点，例如：

```bash
scp /root/migratesh/ai-public-asset-migration.sh k8s-master01:/root/migratesh/
```

然后确认脚本存在：

```bash
ls -l /root/migratesh/ai-public-asset-migration.sh
```

### 2. 编辑 `CLUSTER_PUBLIC_PATH_MAP`

打开脚本：

```bash
vim /root/migratesh/ai-public-asset-migration.sh
```

按实际环境填写，例如：

```bash
declare -A CLUSTER_PUBLIC_PATH_MAP=(
  ["ai1"]="/data/.public"
)
```

如有多个 AI 集群，则继续补充：

```bash
declare -A CLUSTER_PUBLIC_PATH_MAP=(
  ["ai1"]="/data/.public"
  ["dev-k8s"]="/nfs/.public"
)
```

### 3. 确认数据库访问方式

先执行：

```bash
which mysql
```

然后二选一：

- 如果已经能找到 `mysql`，后续直接使用宿主机本地 `mysql`
- 如果找不到 `mysql`，后续才使用 Docker 包装脚本方案

如果数据库不在当前执行节点，而在另一台宿主机上，则应使用**数据库宿主机的实际 IP** 作为 `MYSQL_HOST`。可在数据库宿主机上执行：

```bash
hostname
hostname -I
ss -lntp | grep 7573
```

例如已确认数据库通过 `10.129.227.94:7573` 对外提供服务，则在执行节点上设置：

```bash
export MYSQL_HOST=10.129.227.94
export MYSQL_PORT=7573
export MYSQL_USER=root
export MYSQL_PASSWORD='请替换为真实密码'
export MYSQL_DATABASE=scow_ai
```

如果当前执行节点没有 `mysql`，并且数据库运行在 Docker 容器内，则使用容器内部地址：

```bash
export MYSQL_HOST=127.0.0.1
export MYSQL_PORT=3306
export MYSQL_USER=root
export MYSQL_PASSWORD='请替换为真实密码'
export MYSQL_DATABASE=scow_ai
```

### 4. 验证数据库连通性

如果 `which mysql` 有输出，直接执行：

```bash
MYSQL_PWD="$MYSQL_PASSWORD" mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "$MYSQL_DATABASE" -e "select 1;"
```

如果 `which mysql` 没有输出，再先验证数据库容器。例如数据库容器名为 `scow-ai-db-1`：

```bash
docker exec -e MYSQL_PWD="$MYSQL_PASSWORD" scow-ai-db-1 \
  mysql -h 127.0.0.1 -P 3306 -u "$MYSQL_USER" "$MYSQL_DATABASE" -e "select 1;"
```

确认容器方案可用后，再创建包装脚本：

```bash
mkdir -p /root/migratesh/bin
cat > /root/migratesh/bin/mysql <<'EOF'
#!/usr/bin/env bash
exec docker exec -i -e MYSQL_PWD="${MYSQL_PWD:-}" scow-ai-db-1 mysql "$@"
EOF
chmod +x /root/migratesh/bin/mysql
export PATH="/root/migratesh/bin:$PATH"
```

注意：

- `scow-ai-db-1` 只是示例，必须替换为实际数据库容器名
- 一旦确认本机已有可用 `mysql`，就不要再继续执行包装脚本方案

### 5. 语法检查和 dry-run

先做语法检查：

```bash
bash -n /root/migratesh/ai-public-asset-migration.sh
```

然后执行 dry-run：

```bash
DRY_RUN=1 bash /root/migratesh/ai-public-asset-migration.sh
```

dry-run 成功后，检查输出文件：

```bash
column -t /tmp/ai-public-asset-migration.success.tsv
column -t /tmp/ai-public-asset-migration.failures.tsv
```

重点确认：

- 目标名称是否符合预期
- `target_path` 是否落到 `clusterPublicPath/Migration/...`
- 失败清单是否为空

### 6. 正式执行

确认 dry-run 无误后，再正式执行：

```bash
DRY_RUN=0 bash /root/migratesh/ai-public-asset-migration.sh
```

建议同时保留一份终端日志：

```bash
DRY_RUN=0 bash /root/migratesh/ai-public-asset-migration.sh | tee /tmp/ai-public-asset-migration.run.log
```

### 7. 执行后检查

先看脚本输出结果：

```bash
column -t /tmp/ai-public-asset-migration.success.tsv
column -t /tmp/ai-public-asset-migration.failures.tsv
```

### 8. 结果判定

执行后至少要确认：

- 新平台主记录已生成，且 `is_platform_owned = 1`、`is_shared = 1`
- 原用户主记录仍存在，但已回写为 `is_shared = 0`
- 新平台版本已生成，且 `shared_status = 'SHARED'`
- 原用户已分享版本已改为 `UNSHARED`，且 `path = private_path`
- 新公共文件已落到 `clusterPublicPath/Migration/...`
- 失败清单为空，或失败项已经被运维明确接受并记录

## 脚本输出

脚本会输出：

- 成功清单：默认 `/tmp/ai-public-asset-migration.success.tsv`
- 失败清单：默认 `/tmp/ai-public-asset-migration.failures.tsv`

成功清单字段包括：

- 资产类型
- 原记录 ID
- 原名称
- 目标名称
- cluster_id
- 目标路径摘要

失败清单字段包括：

- 资产类型
- 原记录 ID
- 原名称
- owner
- cluster_id
- 失败阶段
- 错误信息

## 风险说明

- 若执行期间仍有作业使用旧 `/.shared/...` 路径，旧共享目录被清理后会导致作业失败。
- 若用户在迁移期间改名、删除或取消分享，脚本会在二次校验时跳过该条并记失败。
- 若脚本执行到数据库提交成功，但旧 shared 目录清理失败，数据库状态会先切换成功，旧目录需要后续人工清理。
- 这类条目会出现在失败清单中，且失败阶段通常为 `cleanup_old_shared_root`。
- 对于 `cleanup_old_shared_root` 失败的条目，数据库侧迁移通常已经完成；由于原记录已不再满足 `is_shared = 1 AND is_platform_owned = 0`，脚本下次重跑不会再次处理该条，运维应按失败清单只做旧 shared 目录的人工清理。
