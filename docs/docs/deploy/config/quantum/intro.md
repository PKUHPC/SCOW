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
  - 这个jupyter所运行的环境中安装有量子库
  - 交互式应用配置了`QBODY_BASE_URL`和`SCOW_ACCOUNT_NAME`环境变量
  
### 量子jupyter交互式应用配置
1.下载tensorcircuit-0.12.0+qobody-py3-none-any.whl文件

2.配置conda环境
```bash
#找个计算/登录节点，加载存储中的conda环境
__conda_setup="$('/data/software/anaconda/bin/conda' 'shell.bash' 'hook')"
eval "$__conda_setup"
#配置conda源
vim ~/.condarc

channels:
  - conda-forge
  - defaults

default_channels:
  - https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/main
  - https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/r
  - https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/msys2

custom_channels:
  conda-forge: https://mirrors.tuna.tsinghua.edu.cn/anaconda/cloud/
  bioconda: https://mirrors.tuna.tsinghua.edu.cn/anaconda/cloud/bioconda
  msys2: https://mirrors.tuna.tsinghua.edu.cn/anaconda/cloud/msys2
#创建conda环境
conda create -n test1 python=3.10 -y
conda activate test1
conda install mamba
#安装 cirq，tensorcircuit SDK，jupyter
mamba install cirq==1.1
pip install ./tensorcircuit-0.12.0+qobody-py3-none-any.whl[cloud]
mamba install jupyter
```
3.创建交互式应用配置文件`jupyter-tensorcircuit.yml`
```yaml title="jupyter-tensorcircuit.yaml"
# 这个应用的ID
id: jupyter-tensorcircuit

# 这个应用的名字
name: jupyter-tensorcircuit

logoPath: /apps/Jupyter.svg
# 指定应用类型为web
type: web
# Web应用的配置
web:
  # 准备脚本
  beforeScript: |
    export PORT=$(get_port)
    export PASSWORD=$(get_password 12)
    export SALT=123
    export PASSWORD_SHA1="$(echo -n "${PASSWORD}${SALT}" | openssl dgst -sha1 | awk '{print $NF}')"
    export CONFIG_FILE="${PWD}/config.py"
    export SLURM_COMPUTE_NODE_IP=$(hostname)
    export JUPYTER_RUNTIME_DIR=${PWD}/.jupyter_runtime
    export SCOW_ACCOUNT_NAME=$SLURM_JOB_ACCOUNT
  # 运行任务的脚本。可以使用准备脚本定义的
  script: |
    __conda_setup="$('/data/software/anaconda/bin/conda' 'shell.bash' 'hook' 2> /dev/null)"
    if [ $? -eq 0 ]; then
        eval "$__conda_setup"
    else
        if [ -f "/data/software/anaconda/etc/profile.d/conda.sh" ]; then
            . "/data/software/anaconda/etc/profile.d/conda.sh"
        else
            export PATH="/data/software/anaconda/bin:$PATH"
        fi
    fi
    if [[ "" == "${textCondaName}" ]]; then
      textCondaName="test1"
    fi
    eval "conda activate ${textCondaName}"
    # unset __conda_setup
    (
    umask 077
    cat > "${CONFIG_FILE}" << EOL
    c.NotebookApp.ip = '0.0.0.0'
    c.NotebookApp.port = ${PORT}
    c.NotebookApp.port_retries = 0
    c.NotebookApp.password = u'sha1:${SALT}:${PASSWORD_SHA1}'
    c.NotebookApp.open_browser = False
    c.NotebookApp.base_url = "${PROXY_BASE_PATH}/${SLURM_COMPUTE_NODE_IP}/${PORT}/"
    c.NotebookApp.allow_origin = '*'
    c.NotebookApp.disable_check_xsrf = True
    EOL
    )
    cd ~ 
    QOBODY_BASE_URL="http://10.129.227.58/quantum/api/tc/$SCOW_ACCOUNT_NAME/" jupyter-lab --config=${CONFIG_FILE} --notebook-dir=$HOME
   
  proxyType: absolute
  # 如何连接应用
  connect:
    method: POST
    path: /login
    formData:
      password: "{{ PASSWORD }}"

attributes:
  - type: text
    name: sbatchOptions
    label: 其他sbatch参数
    required: false
    placeholder: "比如：--gres gpu:1 --time 10"
  - type: select
    name: textCondaName
    label: conda环境名称
    select:
      - value: test1 
        label: tensorcircuit
```
交互式应用的`QBODY_BASE_URL`环境变量设置为`{SCOW系统的URL}/{量子系统的子路径}/api/tc/$SCOW_ACCOUNT_NAME`，并在`beforeScript`中将`SCOW_ACCOUNT_NAME`变量设置为当前适配器中表达账户名的值（在slurm中为`$SLURM_JOB_ACCOUNT`）。其余配置请参考[配置交互式应用](/deploy/config/portal/apps/configure-web-app.md)以及[`Jupyter Notebook`](/deploy/config/portal/apps/apps/jupyter/index.md)配置jupyter交互式应用。

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
  recommend: ["t57", "t40", "t12"]

# 量子作业默认遵循的比特秒计价
billing:
  defaultBitSecondPrice: 0.35

# 对量子作业计费时，计费费用的付款类型，请和管理系统的quantumJobChargeType保持一致
# taskChargeType: "量子作业费用" 

# 设备布局旋转角度
# offsetDegree:
#  default: 0
#   t57: -45
#   t12: -135
```

## 启动服务

运行 `./cli compose up -d` 启动 **量子系统** 服务。您将可以在整个SCOW系统的量子系统的子路径（默认为`/quantum`）目录下访问到量子系统。


