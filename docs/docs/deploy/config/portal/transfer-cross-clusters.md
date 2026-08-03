---
sidebar_position: 4
title: 跨集群文件传输功能（可选）
---
# 跨集群文件传输功能（可选）

## 1. 为每个集群添加传输节点

### 网络区分

通常情况下，同属一个集群的所有节点，均在同一个子网下，我们称之为**集群内网**。例如：登录节点访问计算结点便是通过集群内网。

不同集群之间的节点，互相通常是访问不到的，除非接入到更大的网络之中，我们称之为**集群间可达网**。

任何机器都可以通过网络访问到的地址，为公网地址，我们称之为**互联网公网**。

网络范围排序：互联网公网 > 集群间可达网 > 集群内网

### 配置

1. 在跨集群传输功能的配置中，每个集群需要有一个专门用来做文件传输的节点TransferNode，该TransferNode要求具有**集群间可达网**的地址，也就是说接入SCOW系统的所有集群的传输节点之间彼此是可以访问的。传输节点TransferNode和登录节点LoginNode可以是同一个节点。

2. 传输节点能够访问文件系统，且挂载目录路径和登录节点访问文件系统的路径相同。出于安全性的考虑，传输节点最好不具备访问作业权限（例如，设置与slurm管理节点网络不通）

3. 准备好传输节点后，需要将其接入到scow集群中。接下来需要修改集群配置文件`config/clusters/xxx.yaml`，在yaml文件末尾添加crossClusterFileTransfer模块，添加enabled和transferNode属性。如果enabled为true表示开启该功能需要配置transferNode，为false表示不开启该功能无需配置transferNode。transferNode配置格式为ip:port，如果不配置port默认为22端口。

```yaml title="config/clusters/hpc01.yaml"
displayName: hpc01Name
adapterUrl: 0.0.0.0:6000
loginNodes:
  - name: loginNode01
    address: localhost:22222
crossClusterFileTransfer:
  enabled: true
  transferNode: login01:8999
```
:::tip

传输节点如果是一个新节点，则该节点需要与集群有一致的用户，即配置与该集群相同的认证系统(LDAP)，挂载相同的共享目录。

:::

## 2. 建立scow节点到每个传输节点的root用户免密

在scow节点运行以下命令
  
```bash
# 执行以下命令，连续回车，输入密码后设置免密成功
ssh-copy-id root@[TransferNodeIP]
```

## 3. 在每个传输节点上安装scow-sync传输软件

scow-sync传输软件目前只支持从源码构建。

1. 拉取scow-sync代码。首先需要以root身份登录到传输节点，然后拉取scow-sync的仓库https://github.com/PKUHPC/scow-sync.git。通常将scow-sync安装在/data/software目录下。

```bash
# 以root身份登录传输节点
ssh root@[TransferNodeIP] -p [TransferNodePort]
# 拉取scow-sync到/data/software目录
cd /data/software
git clone https://github.com/PKUHPC/scow-sync.git
```

2. 安装python依赖库。在传输节点上按照scow-sync的requirements.txt文件安装好对应版本的依赖库。

```txt
python >= 3.6.0
paramiko >= 3.0.0
psutil >= 5.9.4
subprocess
concurrent
```

3. 设置python解释器的路径。

  + 如果用户使用的python解释器的路径为`/usr/bin/python3`，则可以直接执行`sudo bash install.sh`，该脚本会在全局安装scow-sync相关的命令。

  + 如果用户使用自定义的python解释器的路径，需要修改scow-sync代码中的`scow_sync/config.py`配置文件的`SHEBANG_PATH`为python解释器的路径，再执行`sudo bash install.sh update`更新scow-sync各个脚本的SheBang，最后再执行`sudo bash install.sh`安装scow-sync。

4. 输入以下命令观察是否安装成功。

```bash
[root@login01 ~]# scow-sync-start -h
usage: scow-sync-start [-h] [-a ADDRESS] [-u USER] [-s SOURCE]
                       [-d DESTINATION] [-m MAX_DEPTH] [-p PORT]
                       [-k SSHKEY_PATH] [-c]

argsparser for starting transferring files

optional arguments:
  -h, --help            show this help message and exit
  -a ADDRESS, --address ADDRESS
                        address of the server
  -u USER, --user USER  username for logging in
  -s SOURCE, --source SOURCE
                        path of the source file or directory
  -d DESTINATION, --destination DESTINATION
                        path of the destination directory
  -m MAX_DEPTH, --max-depth MAX_DEPTH
                        max parallel depth of the directory
  -p PORT, --port PORT  ssh port of the server
  -k SSHKEY_PATH, --sshkey-path SSHKEY_PATH
                        path of the private key
  -c, --check           check whether the key in scow-sync-ssh is right
  
[root@login01 ~]# scow-sync-query
[]
[root@login01 ~]# scow-sync-terminate -h
usage: scow-sync-terminate [-h] [-a ADDRESS] [-u USER] [-s SOURCE]

argsparser for terminating transferring files

optional arguments:
  -h, --help            show this help message and exit
  -a ADDRESS, --address ADDRESS
                        address of the server
  -u USER, --user USER  username for logging in to the server
  -s SOURCE, --source SOURCE
                        path to the source file or directory
```

## 4. 可选：自定义scow-sync的日志路径

配置scow-sync的输出路径为可选操作，默认的输出路径为`~/scow/.scow-sync`。

修改scow-sync代码中的`scow_sync/config.py`的`SCOWSYNC_PATH`、`LOG_PATH`和`ERROR_PATH`，以下为默认配置:

```python
SCOWSYNC_PATH = os.path.expanduser('~/scow/.scow-sync')  # scow-sync传输文件进度保存目录
LOG_PATH = os.path.join(SCOWSYNC_PATH, 'scow-sync.log')  # scow-sync打印日志目录
ERROR_PATH = os.path.join(SCOWSYNC_PATH, 'scow-sync.err') # scow-sync错误日志目录
```

SCOWSYNC_PATH的路径必须为以~开头的用户路径，从而实现用户信息的隔离。
