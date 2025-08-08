---
sidebar_position: 1
title: 配置量子系统
---
# 配置量子系统

本节介绍如何配置 **量子系统**。

## 前期准备

要部署量子系统，您需要

- 具有量子云平台（例如 [腾讯量子云](https://quantum.tencent.com/cloud/)）的账号以及其token
- 同时部署HPC门户和管理系统
- HPC门户中有一个集群已配置好Jupyter交互式应用，且
  - 这个jupyter所运行的环境中安装有[tensorcircuit](https://github.com/backend-quantum-lab/tensorcircuit)
  - 交互式应用的`QBODY_BASE_URL`环境变量设置为`{SCOW系统的URL}/{量子系统的子路径}/api/tc/$SCOW_ACCOUNT_NAME`，并在`beforeScript`中将`SCOW_ACCOUNT_NAME`变量设置为当前适配器中表达账户名的值（在slurm中为`$SLURM_JOB_ACCOUNT`）
  
  
请参考[配置交互式应用](/deploy/config/portal/apps/configure-web-app.md)以及[`Jupyter Notebook`](/deploy/config/portal/apps/apps/jupyter/index.md)配置jupyter交互式应用。

## 配置文件

### 修改安装配置文件

修改安装配置文件，启动量子系统。

```yaml title="install.yaml"
quantum: 
  # 量子系统的子路径，默认为/quantum，一般无需修改
  basePath: /quantum
  qobody: 
    # 代理服务的镜像地址。默认使用ccimage上的镜像
    image: 
    # 您的量子云平台账号的token
    token: 
```

### 编写量子服务配置

在`config/quantum/config.yaml`文件中，修改所需要的配置

```yaml title="config/quantum/config.yaml"
# 量子系统数据库的信息。可以不修改
db:
  host: db
  port: 3306
  user: root
  dbName: scow_quantum
  
# 后端代理接口配置，指向代理服务的监听地址
backend:
  apiBase: http://qobody:8088

# 带有量子计算库的jupyter配置
jupyter:
  cluster: "hpc01" #带有量子计算库的jupyter的交互式应用所在的集群ID
  appId: "jupyter-tensorcircuit" #带量子计算库的jupyter的交互式应用的appId

# 默认推荐的量子计算设备
device:
  recommend: ["t59", "t40", "t13"]

# 量子作业默认遵循的比特秒计价
billing:
  defaultBitSecondPrice: 0.35
```

## 启动服务

运行 `./cli compose up -d` 启动 **量子系统** 服务。您将可以在整个SCOW系统的量子系统的子路径（默认为`/quantum`）目录下访问到量子系统。


