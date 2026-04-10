---
sidebar_position: 21
title: AI 公共镜像迁移
---

# AI 公共镜像迁移

本文档给出“用户分享镜像迁移为平台公共镜像”的执行草案。

适用范围：

- 镜像 `image`

不包含：

- 数据集
- 算法
- 模型

## 迁移目标

将当前通过“用户分享”方式公开的镜像，迁移为“平台公共镜像”语义：

- 原用户镜像记录保留
- 原用户镜像记录回写为 `is_shared = 0`
- 新增一条平台公共镜像记录
- 新平台镜像记录使用：
  - `is_platform_owned = 1`
  - `status = 'CREATED'`
  - `is_shared = 1`
- 新平台镜像 `path` 指向 Harbor 平台项目 `admin_public_asset`

## 重要提示

- 镜像迁移不走 `clusterPublicPath/Migration` 文件复制。
- 镜像迁移依赖 Harbor API，运维执行机必须能访问 Harbor API。
- 脚本默认 `DRY_RUN=1`，只预演不改库、不调用 Harbor 复制。
- 脚本按“单条失败继续，最后汇总失败项”设计。
- 脚本会先插入一条平台临时记录，再调用 Harbor 复制；Harbor 失败时，临时记录会回写为 `FAILURE`。

## 迁移规则

### Harbor 项目规则

- 源项目：`u_<owner>`
- 目标项目：`admin_public_asset`

### 命名规则

平台公共镜像名称按以下顺序尝试：

1. `原名称`
2. `原名称_用户ID`
3. `原名称_用户ID_原记录ID`
4. 若仍冲突，则继续按 `原名称_用户ID_原记录ID_1`、`原名称_用户ID_原记录ID_2`、`原名称_用户ID_原记录ID_3` 递增，直到找到可用名称

说明：

- 镜像冲突维度是平台范围内的 `(name, tag)` 组合
- `tag` 保持原值不变，只对 `name` 做兜底
- 目标镜像仓库名必须兼容 Harbor / OCI repository 规则，只允许小写字母、数字、`_`、`-`、`.`，且不能以符号开头或结尾
- 若原名称或用户 ID 中包含不兼容字符，脚本会先做小写化和字符归一化，再参与兜底命名
- 真实 Harbor tag 为 `tag + tagPostfix`

### 字段保留规则

新平台镜像记录保留或复用以下字段：

- `owner`：保留原用户 ID
- `source`：保留原值
- `tag`：保留原值
- `tagPostfix`：保留原值
- `description`
- `clusterId`
- `sourcePath`
- `types`
- `inferServicePort`
- `startCommand`

## 执行顺序

单条镜像的推荐顺序如下：

1. 校验原用户镜像满足：
   - `is_shared = 1`
   - `is_platform_owned = 0`
   - `status = 'CREATED'`
   - `path` 非空字符串
   - `tag_postfix` 非空字符串
2. 选择目标平台镜像名称
3. 插入一条平台临时记录：
   - `is_platform_owned = 1`
   - `status = 'CREATING'`
   - `is_shared = 0`
4. 调用 Harbor API 将 artifact 从 `u_<owner>` 复制到 `admin_public_asset`
5. Harbor 成功后，收口数据库：
   - 新平台记录改成 `status = 'CREATED'`、`is_shared = 1`
   - 原用户记录改成 `is_shared = 0`

## 失败处理

### Harbor 复制失败

- 平台临时记录保留，并回写为 `FAILURE`
- 原用户镜像记录保持原状
- 失败清单中记录 Harbor 失败原因

### Harbor 已复制成功，但数据库收口失败

- 原用户记录保持原状
- 平台临时记录应尽量回写为 `FAILURE`
- `admin_public_asset` 中可能留下孤立 artifact，需要人工清理

### 重跑说明

- 若上一轮已留下 `FAILURE` 的平台临时记录，重跑前应先人工识别或清理这些记录
- 否则它们会继续占用平台侧 `(name, tag)` 冲突检查结果

## 执行方式

脚本文件位于：

- [ai-public-image-migration.sh](/scripts/ai-public-image-migration.sh)

建议执行顺序：

1. 打开脚本，按环境填写 MySQL 与 Harbor 参数
2. 保持 `DRY_RUN=1` 执行一次，确认待迁移数量、目标名称和目标 Harbor 地址
3. 确认无误后改为 `DRY_RUN=0`
4. 执行完成后核对成功清单和失败清单

## 运维执行步骤

### 1. 准备脚本

先在方便获取脚本的节点上准备脚本，例如：

```bash
mkdir -p /root/migratesh
cd /root/migratesh
```

将 [ai-public-image-migration.sh](/scripts/ai-public-image-migration.sh) 保存为：

```text
/root/migratesh/ai-public-image-migration.sh
```

如果该节点不是实际执行节点，还需要再把脚本复制到真正执行迁移的节点，例如：

```bash
scp /root/migratesh/ai-public-image-migration.sh k8s-master01:/root/migratesh/
```

然后确认脚本文件存在：

```bash
ls -l /root/migratesh/ai-public-image-migration.sh
```

### 2. 确认数据库访问方式

先执行：

```bash
which mysql
```

然后二选一：

- 如果已经能找到 `mysql`，后续直接使用宿主机本地 `mysql`
- 如果找不到 `mysql`，后续才使用 Docker 包装脚本方案

如果实际执行节点与数据库宿主机不是同一台机器，或者当前节点无法直接解析数据库宿主机名，请参考[数据资产迁移文档](./)中“运维执行步骤”关于如何通过 `hostname -I` / `ss -lntp` 获取新的 `MYSQL_HOST` 的说明。

如果数据库需通过另一台宿主机 IP 访问，例如 `10.129.227.94:7573`，则设置：

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

### 3. 准备 Harbor 变量

先区分 3 类变量：

- `HARBOR_API_PROTOCOL` / `HARBOR_API_URL`
  - 用于访问 Harbor Core API
  - 例如 `http://k8s-master:3000/api/v2.0/...`
- `HARBOR_REGISTRY_URL`
  - 用于生成镜像 `path`
  - 例如 `k8s-master:3000` 或 `10.129.227.64:80`
- `HARBOR_PROTOCOL` / `HARBOR_URL`
  - 默认共享配置
  - 若不显式拆分，脚本会同时把它们用于 Harbor API 和 registry

大多数环境里，Harbor API 地址和 registry 地址其实是同一套，此时直接设置一套即可：

```bash
export HARBOR_PROTOCOL=http
export HARBOR_URL=k8s-master:3000
export HARBOR_USER=admin
export HARBOR_PASSWORD='请替换为真实密码'
```

这等价于：

```bash
export HARBOR_API_PROTOCOL=http
export HARBOR_API_URL=k8s-master:3000
export HARBOR_REGISTRY_URL=k8s-master:3000
```

如果 Harbor API 地址和 registry 地址不同，再显式拆开写，例如：

```bash
export HARBOR_PROTOCOL=http
export HARBOR_URL=k8s-master:3000
export HARBOR_API_PROTOCOL=http
export HARBOR_API_URL=k8s-master:3000
export HARBOR_REGISTRY_URL=10.129.227.64:80
export HARBOR_USER=admin
export HARBOR_PASSWORD='请替换为真实密码'
```

### 4. 连通性检查

#### 数据库

如果 `which mysql` 有输出，直接执行：

```bash
MYSQL_PWD="$MYSQL_PASSWORD" mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "$MYSQL_DATABASE" -e "select 1;"
```

如果 `which mysql` 没有输出，再先验证数据库容器。例如数据库容器名为 `scow-ai-db-1`：

```bash
docker exec -e MYSQL_PWD="$MYSQL_PASSWORD" scow-ai-db-1 \
  mysql -h 127.0.0.1 -P 3306 -u "$MYSQL_USER" "$MYSQL_DATABASE" -e "select 1;"
```

若输出 `1`，说明数据库本身可连通。

然后在执行机上临时创建一个 `mysql` 包装脚本，让迁移脚本仍然按原样调用 `mysql`：

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

#### Harbor API

```bash
curl -u "$HARBOR_USER:$HARBOR_PASSWORD" -v "$HARBOR_API_PROTOCOL://$HARBOR_API_URL/api/v2.0/projects"
```

### 5. 语法检查和 dry-run

先做语法检查：

```bash
bash -n /root/migratesh/ai-public-image-migration.sh
```

然后执行 dry-run：

```bash
DRY_RUN=1 bash /root/migratesh/ai-public-image-migration.sh
```

查看结果：

```bash
column -t /tmp/ai-public-image-migration.success.tsv
column -t /tmp/ai-public-image-migration.failures.tsv
```

### 6. 正式执行

```bash
DRY_RUN=0 bash /root/migratesh/ai-public-image-migration.sh
```

## 脚本输出

成功清单默认位置：

```text
/tmp/ai-public-image-migration.success.tsv
```

字段：

- `asset_type`
- `source_id`
- `source_name`
- `source_tag`
- `target_name`
- `target_tag`
- `cluster_id`
- `target_path`
- `temp_record_id`

失败清单默认位置：

```text
/tmp/ai-public-image-migration.failures.tsv
```

字段：

- `asset_type`
- `source_id`
- `source_name`
- `source_tag`
- `owner`
- `cluster_id`
- `stage`
- `message`
- `temp_record_id`

## 结果判定

执行后至少核对：

1. 原用户镜像记录仍存在，且已回写为 `is_shared = 0`
2. 新平台镜像记录存在，且为：
   - `is_platform_owned = 1`
   - `status = 'CREATED'`
   - `is_shared = 1`
3. 新平台镜像 `path` 指向：
   - `${HARBOR_REGISTRY_URL}/admin_public_asset/<target_name>:<tag+tagPostfix>`
4. Harbor 中已存在对应 artifact
5. 若失败清单中存在 `db_finalize` 阶段失败项，需要人工检查 Harbor 孤立 artifact
