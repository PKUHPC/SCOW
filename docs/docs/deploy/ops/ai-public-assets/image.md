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

例如：

```bash
mkdir -p /root/migratesh
cd /root/migratesh
```

将 [ai-public-image-migration.sh](/scripts/ai-public-image-migration.sh) 保存为：

```text
/root/migratesh/ai-public-image-migration.sh
```

### 2. 语法检查

```bash
bash -n /root/migratesh/ai-public-image-migration.sh
```

### 3. 准备数据库变量

默认按“通过 Docker 包装脚本调用数据库容器内 `mysql`”执行，因此这里推荐先使用数据库容器内部可访问的地址：

```bash
export MYSQL_HOST=127.0.0.1
export MYSQL_PORT=3306
export MYSQL_USER=root
export MYSQL_PASSWORD='请替换为真实密码'
export MYSQL_DATABASE=scow_ai
```

### 4. 准备 Harbor 变量

先明确 3 类含义：

- `HARBOR_API_PROTOCOL`
  - Harbor Core API 的协议
  - 脚本用它访问 `/api/v2.0/projects`、创建项目、复制 artifact
- `HARBOR_API_URL`
  - Harbor Core API 的地址，不带协议
  - 例如 `k8s-master:3000`
- `HARBOR_REGISTRY_URL`
  - 镜像仓库地址，不带协议
  - 脚本用它生成新平台镜像记录的 `path`
  - 例如 `k8s-master:3000` 或 `10.129.227.64:80`

基础共享配置：

- `HARBOR_PROTOCOL`
- `HARBOR_URL`

脚本默认会把 `HARBOR_PROTOCOL`、`HARBOR_URL` 同时用于 Harbor API 和 registry。若当前环境里 API 地址与 registry 地址不同，再显式设置 `HARBOR_API_*` / `HARBOR_REGISTRY_URL` 做细分覆盖。

大多数环境里，Harbor API 地址和 registry 地址其实是同一套，此时直接设置一套即可。

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

若你的部署中 Harbor API 地址和 registry 地址不同，再显式拆开写，例如：

```bash
export HARBOR_PROTOCOL=http
export HARBOR_URL=k8s-master:3000
export HARBOR_API_PROTOCOL=http
export HARBOR_API_URL=k8s-master:3000
export HARBOR_REGISTRY_URL=10.129.227.64:80
export HARBOR_USER=admin
export HARBOR_PASSWORD='请替换为真实密码'
```

变量含义总结：

- `HARBOR_API_PROTOCOL` + `HARBOR_API_URL` 用于访问 Harbor Core API，例如 `http://k8s-master:3000/api/v2.0/...`
- `HARBOR_REGISTRY_URL` 用于生成镜像 `path` 和 Harbor 仓库地址，例如 `k8s-master:3000/admin_public_asset/image1:tagxxx`
- `HARBOR_PROTOCOL` / `HARBOR_URL` 是默认共享配置；若 API 地址与 registry 地址不同，应优先显式设置 `HARBOR_API_URL` 和 `HARBOR_REGISTRY_URL`

### 5. 连通性检查

#### 数据库
默认执行方式如下。假设 AI 数据库容器名为 `scow-ai-db-1`：

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

- 上面脚本中的 `scow-ai-db-1` 只是示例，必须替换为目标环境中的实际 AI 数据库容器名

确认当前 `mysql` 命令已指向这个包装脚本：

```bash
which mysql
```

期望输出类似：

```text
/root/migratesh/bin/mysql
```

通过这个包装脚本执行时，`MYSQL_HOST` 和 `MYSQL_PORT` 应保持为数据库容器内部可访问的值，通常为：

```bash
export MYSQL_HOST=127.0.0.1
export MYSQL_PORT=3306
```

如果宿主机本身已安装 `mysql` 客户端，也可以直接执行：

```bash
MYSQL_PWD="$MYSQL_PASSWORD" mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "$MYSQL_DATABASE" -e "select 1;"
```

#### Harbor API

```bash
curl -u "$HARBOR_USER:$HARBOR_PASSWORD" -v "$HARBOR_API_PROTOCOL://$HARBOR_API_URL/api/v2.0/projects"
```

### 6. 执行 dry-run

```bash
DRY_RUN=1 bash /root/migratesh/ai-public-image-migration.sh
```

查看结果：

```bash
column -t /tmp/ai-public-image-migration.success.tsv
column -t /tmp/ai-public-image-migration.failures.tsv
```

### 7. 正式执行

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
