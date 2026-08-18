---
sidebar_position: 2
title: scow-cli
description: 使用scow-cli管理SCOW集群
---

scow-cli是SCOW集群安装、配置和管理工具，您可以使用scow-cli高效管理您的集群。

# 下载

请通过以下方法下载scow-cli，并将下载的文件解压，将里面的可执行文件存放到您将会存放SCOW配置文件的目录下。

- [GitHub Release](https://github.com/PKUHPC/private-scow/releases): SCOW每次发布新的版本时，将会将此版本的`scow-cli`上传到Release中

想获取最新的scow-cli版本？您可以从GitHub Actions的[`Test, Build and Publish Projects` workflow](https://github.com/PKUHPC/private-scow/actions/workflows/test-build-publish.yaml)中下载到上传到Archive的`scow-cli`。

- 参考命令

```bash
# 如果没有wget，可以先install
yum install wget

# 下载对应的release版本。修改latest、cli-x64可下载指定版本cli
# 修改latest为v0.4.0即可下载0.4.0版本的cli，如 https://github.com/PKUHPC/private-scow/releases/download/v0.4.0/cli-x64
# 可修改cli-x64为cli-arm64下载arm64版本，如 https://github.com/PKUHPC/private-scow/releases/download/v0.4.0/cli-arm64
wget https://github.com/PKUHPC/private-scow/releases/download/latest/cli-x64

# 重命名
mv cli-x64 cli

#修改文件权限
chmod +x cli
```

# 配置

scow-cli使用运行目录下的`install.yaml`作为配置来管理集群，但您可以通过`-c`命令行选项指定`install.yaml`的路径。

# 全局选项

| 选项 | 别名 | 说明 | 默认值 |
| --- | --- | --- | --- |
| `--configPath` | `-c` | install.yaml配置文件路径 | `./install.yaml` |

# 命令列表

## compose

执行任意docker compose命令。每次运行时，CLI会在当前目录下创建一个临时的`docker-compose-{时间戳}.yml`文件，运行结束后自动删除，以保证docker compose配置的内容为最新。

```bash
# 启动集群
./cli compose up -d

# 关闭集群
./cli compose down

# 更新镜像
./cli compose pull

# 跟随查看所有日志
./cli compose logs -f
```

## generate

根据`install.yaml`生成docker-compose配置文件。

| 选项 | 别名 | 说明 | 默认值 |
| --- | --- | --- | --- |
| `--outputPath` | `-o` | 输出路径 | `./docker-compose.yml` |
| `--format` | `-f` | 输出格式，可选`yaml`或`json` | `yaml` |

```bash
./cli generate -o docker-compose.yml
```

## init

将示例配置文件提取到指定目录。

生成配置时，CLI 会自动为 `config/common.yaml`（完整配置为 `common.yml`）中的 `scowApi.auth.token` 写入安全随机值。重复执行并确认覆盖时会保留已有的非空 token，不会自动轮换。

| 选项 | 别名 | 说明 | 默认值 |
| --- | --- | --- | --- |
| `--outputPath` | `-o` | 输出路径 | `.` |
| `--full` | `-f` | 提取全版本配置文件 | `false` |

```bash
# 提取最简版本的示例配置文件到当前目录
./cli init

# 提取全版本的示例配置文件到当前目录
./cli init -f
```

## view-install

查看当前`install.yaml`的解析内容。

| 选项 | 别名 | 说明 | 默认值 |
| --- | --- | --- | --- |
| `--format` | `-f` | 输出格式，可选`yaml`或`json` | `yaml` |

```bash
./cli view-install
./cli view-install -f json
```

## check-config

检查`config`目录下的SCOW配置文件格式是否正确。

| 选项 | 说明 | 默认值 |
| --- | --- | --- |
| `--scowConfigPath` | SCOW配置文件目录路径 | `./config` |
| `--continueOnError` | 遇到错误时是否继续检查 | `false` |

```bash
./cli check-config
./cli check-config --scowConfigPath /path/to/config --continueOnError
```

## check-clusters

检查所有已配置集群的scowd和适配器的连通性。

| 选项 | 说明 | 默认值 |
| --- | --- | --- |
| `--scowConfigPath` | SCOW配置文件目录路径 | `./config` |
| `--continueOnError` | 遇到错误时是否继续检查 | `false` |

```bash
./cli check-clusters
```

## create-configured-cluster-paths

当集群配置中指定的目录路径不存在时，通过SSH在登录节点上自动创建这些目录。

前提条件：`install.yaml`中`ai.enabled`为`true`（即AI模块已启用），且集群配置中对应集群的`ai.enabled`也为`true`。

当前会处理以下目录：

- `ai.clusterPublicPath` — AI模块的集群公共数据资产目录路径（在集群配置文件`config/clusters/<clusterId>.yaml`中配置）

命令会依次检查每个集群的登录节点，若路径不存在则交互式询问是否创建（以`root`权限执行`mkdir -p`，权限设置为`755`）。

| 选项 | 说明 | 默认值 |
| --- | --- | --- |
| `--scowConfigPath` | SCOW配置文件目录路径 | `./config` |

```bash
./cli create-configured-cluster-paths
```

## db

进入管理系统（MIS）的MySQL数据库交互终端。

```bash
./cli db
```

## audit-db

进入审计系统的MySQL数据库交互终端。

```bash
./cli audit-db
```

## ai-db

进入AI系统的MySQL数据库交互终端。

```bash
./cli ai-db
```

## migrate

从旧版`scow-deployment`迁移配置到`install.yaml`。

| 选项 | 说明 | 默认值 |
| --- | --- | --- |
| `--configPyPath` | scow-deployment的config.py文件路径 | `./config.py` |

```bash
./cli migrate
./cli migrate --configPyPath /path/to/config.py
```

# 从scow-deployment迁移

从scow-deployment迁移到scow-cli是非常容易的。

首先，请先下载scow-cli到您的scow-deployment文件夹中，确保`config.py`存在于目录中，然后运行

```bash
./cli migrate
```

此命令将会读取当前目录中`config.py`中的配置，并生成对应的`install.yaml`。

之后，您就可以使用scow-cli来管理您的集群了。

## 常见命令的对照

| 使用             | `scow-deployment`      | `scow-cli`              |
| ---------------- | ---------------------- | ----------------------- |
| 启动系统         | `./compose.sh up -d`   | `./cli compose up -d`   |
| 停止系统         | `./compose.sh down`    | `./cli compose down`    |
| 跟随查看所有日志 | `./compose.sh logs -f` | `./cli compose logs -f` |
| 更新镜像         | `./compose.sh pull`    | `./cli compose pull`    |
| 进入数据库       | `./db.sh`              | `./cli db`              |

# 更新`scow-cli`

`scow-cli`可以自我更新。

```bash
# 更新到PR 535对应的最新的版本
./cli update --pr 535

# 将test分支的最新cli下载到./cli-test
./cli update --pr 535 -o ./cli-test

# 更新到test分支的最新cli版本
./cli update --branch test

# 更新至最新版本的scow-cli
./cli update

# 更新cli至v0.4.0版本
./cli update --release v0.4.0

# 下载v0.4.0版本的scow-cli并保存到./cli-test
./cli update --release v0.4.0 -o ./cli-test
```

使用`--pr`或者`--branch`选项需要您创建一个有`workflow`权限的GitHub Token ( https://github.com/settings/tokens/new )，并将这个token放到cli目录下的`.env`文件

```env title=".env"
# .env
GITHUB_TOKEN={token}
```

# 代理

CLI需要访问网络的功能（例如更新scow-cli）可以设置HTTP代理。您可以通过设置`HTTPS_PROXY`, `https_proxy`, `HTTP_PROXY`, `http_proxy`环境变量来设置代理。如果多个环境变量同时存在，则使用优先级为上面列出来的顺序。

```bash
# 环境变量也可以写入.env中
export HTTPS_PROXY=http://localhost:1080
./cli update
```

# 打印调试日志

```bash
LOG_LEVEL="debug" ./cli
```
