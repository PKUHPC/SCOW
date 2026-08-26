# **slurm适配器安装部署文档**


## **1 Slurm适配器生成二进制文件（直接下载、自己编译两种方式）**
### **1.1 准备一台能连网的服务器或者虚拟机，在准备的服务器或虚拟机上安装go语言、配置go相关环境变量**

```bash
# 下载go语言安装包，安装go
cd download/
wget https://golang.google.cn/dl/go1.25.0.linux-amd64.tar.gz
tar -C /usr/local -xzf go1.25.0.linux-amd64.tar.gz

# 在/etc/profile中设置环境变量
export GOROOT=/usr/local/go
export GOPATH=/usr/local/gopath
export PATH=$PATH:/$GOROOT/bin:$GOPATH/bin

# source环境变量
source /etc/profile

# 验证
go version

# 设置代理
go env -w GOPROXY=https://goproxy.cn,direct

# 开启go mod管理
go env -w GO111MODULE=on
```

### **1.2. 在准备好的服务器或虚拟机上拉取Slurm适配器代码**
```bash
[root@manage01]# cd /root    # 将slurm适配器代码放在root目录下
[root@manage01]# git clone https://github.com/PKUHPC/scow-adapters.git  #克隆代码
```


### **1.3 编译项目**
#### **1.3.1 编译通用版项目**
```bash
# 在代码根目录下执行make build生成二进制文件(scow-slurm-adapter)
[root@manage01 scow-adapters]# make build-slurm 
- Building scow-slurm-adapter with ...
    - Binaries are in ./
[root@manage01 scow-adapters]# ls
buf.genCrane.yaml  buf.gen.yaml  cmd  config  docs  gen  go.mod  go.sum  hack  Makefile  pkg  README.md  scow-slurm-adapter  test
```
#### **1.3.2 编译带过期功能的项目**
```bash
# 在Makefile中修改程序过期的时间
vim Makefile
...
EXPIRE_TIME ?= 2025-03-20T09:48:00+08:00       # 如程序在2025年3月20日9点48分过期，EXPIRE_TIME配置为2025-03-20T09:48:00+08:00 
...


# 在代码根目录下执行make build-slurm-expire生成二进制文件(scow-slurm-adapter)
[root@manage01 private-scow-slurm-adapter]# make build-slurm-expire
- Building scow-slurm-adapter with ...
    - Binaries are in ./
[root@manage01 scow-slurm-adapter]# ls
buf.gen.yaml  config  docs gen  go.mod  go.sum  main.go  Makefile  README.md  scow-slurm-adapter  tests  utils
```


## **2 配置、部署Slurm适配器**
### **2.1 将服务器上生成的可执行程序或者直接下载的二进制文件以及代码目录中的config目录拷贝至slurm管理节点的部署目录中**
```bash
# 将自己编译生成的二进制文件或者直接下载的二进制文件以及代码目录中config目录拷贝至需要部署适配器的slurm管理节点上的部署目录中
scp -r scow-slurm-adapter config  slurm_mn:/adapter     
# slurm_mn 为需要部署适配器的slurm管理节点、/adapter目录slurm管理节点的部署目录
```

### **2.2 修改config目录下的config.yaml配置信息**
```bash
# 在slurm管理节点的部署目录/adapter中修改config目录下配置文件config.yaml的配置项
vim config/config.yaml
log:
  level: "info"                                           # 日志级别，支持info、debug、trace级别
  enableStdout: true                                       # 是否同时输出到标准输出

# slurm 数据库配置
mysql:
  host: 127.0.0.1                                         # slurmdbd服务所在服务器的ip
  port: 3306                                              # slurmdbd服务节点上数据库服务的端口
  user: root                                              # 访问slurmdbd节点数据库服务的用户名
  dbname: slurm_acct_db                                   # 指定slurm数据库的库名
  password: 81SLURM@@rabGTjN7                             # 访问slurmdbd节点数据库的密码
  clustername: cluster                                    # 指定slurm集群的名字
  databaseencode: latin1                                  # 指定数据库客户端编码

# 服务端口设置
service:
  addr: 0.0.0.0:8972                                      # 指定slurm适配器服务启动地址（地址和端口可根据需要修改）

# slurm 默认Qos设置
slurm:
  defaultqos: normal
  slurmpath: /usr                                  # 若slurm是自定义安装路径则需要在此进行路径的配置，如自定义路径为/usr/local/bin/sinfo，此时该值为/usr/local

# module profile文件路径
modulepath:
  path: /lustre/software/module/5.2.0/init/profile.sh

# 计算分区描述
partitiondesc:
  - name: compute      # 这个是计算分区名
    desc: "这是普通的cpu计算分区"  # 这是描述

ssl:
  enabled: false # 是否启用 SSL，默认为 false
  caCertPath: /adapter/certs/ca.crt # CA根证书路径, 相对适配器 config 的同级 certs目录。
  adapterCertPath: /adapter/certs/adapter.crt # CA签名的 adapter 证书路径， 相对适配器 config 的同级 certs 目录。
  adapterPrivateKeyPath: /adapter/certs/adapter.key # CA签名的 adapter 私钥路径， 相对适配器 config 的同级 certs目录。
```
**注意：如果slurmdbd服务不在需要部署的slurm管理节点上，在config.yaml配置文件中指定数据库配置后，还需要在slurmdbd服务所在节点为访问数据库服务的用户授权（只读权限select）。**

### **2.3 启动slurm适配器**
```bash
# slurm适配器二进制文件和config目录需在同一目录（部署目录）下
[root@slurm_mn]# ls /adapter
config scow-slurm-adapter

# 给二进制添加执行权限
# 在slurm管理节点上启动服务
[root@slurm_mn]# chmod +x /adapter/scow-slurm-adapter

# 在slurm管理节点上启动服务
[root@slurm_mn]# cd /adapter && cp config/adapter.service /lib/systemd/system/adapter.service
[root@slurm_mn]# systemctl start adapter
[root@slurm_mn]# systemctl enable adapter
```


## **运维Slurm适配器**
### **3.1 查看Slurm适配器进程**
```bash
# 在Slurm适配器部署服务器上运行下面命令
ps aux | grep [s]cow-slurm-adapter # 如果有输出则Slurm适配器进程存活、无输出则Slurm适配器终止
```

### **3.2 查看日志信息**
```bash
# 默认日志文件位于部署目录的 logs/server.log，分析日志信息
less /adapter/logs/server.log
```

## **4 更新Slurm适配器**
### **4.1 更新代码自己编译生成最新的Slurm适配器二进制文件**
* 更新代码
  ```bash
  # 在2.1节中Slurm适配器代码目录中执行git pull 拉取最新代码
  [root@manage01 scow-adapters]# git pull  #拉取最新代码
  ```
* slurm 管理节点上停止Slurm适配器进程
  ```bash
  # slurm 管理节点上执行以下命令, 停止Slurm 适配器进程
  systemctl stop adapter
  ```
* 在slurm管理节点上启动Slurm适配器服务
  ```bash
  [root@manage01]# systemctl start adapter
  ```
