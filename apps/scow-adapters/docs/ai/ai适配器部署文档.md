# **AI适配器安装部署文档**


## **1 AI适配器安装部署环境要求**

### **1.1 准备一台能连外网的服务器或虚拟机用来编译生成二进制文件**

### **1.2 在准备的服务器或虚拟机安装go语言、配置go相关环境变量**

```bash
# 下载go语言安装包，安装go(本文以1.23.3版本为例)
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

## **2 编译AI适配器项目**

### **2.1 在准备好的服务器或虚拟机上拉取AI适配器代码**
```bash
cd /root    # 将ai适配器代码放在root目录下
git clone https://github.com/PKUHPC/scow-adapters.git  #克隆代码
```

### **2.2 编译项目**
#### **2.2.1 编译通用版项目**
```bash
# 在代码根目录下执行make build-ai生成二进制文件(scow-ai-adapter)
[root@ai01 scow-adapters]# make build
- Building scow-ai-adapter with ...
    - Binaries are in ./
[root@ai01 scow-adapters]# ls
buf.gen.yaml  cmd  config  docs  gen  go.mod  go.sum  Makefile  pkg  README.md  scow-ai-adapter  tests
```
#### **2.2.2 编译带过期功能的项目**
```bash
# 在Makefile中修改程序过期的时间
vim Makefile
...
EXPIRE_TIME ?= 2025-03-20T09:48:00+08:00       # 如程序在2025年3月20日9点48分过期，EXPIRE_TIME配置为2025-03-20T09:48:00+08:00 
...


# 在代码根目录下执行make build-expire生成二进制文件(scow-ai-adapter)
[root@ai01 scow-adapters]# make build-ai-expire 
- Building scow-ai-adapter with ...
    - Binaries are in ./
[root@ai01 scow-adapters]# ls
buf.gen.yaml  cmd  config  docs  gen  go.mod  go.sum  Makefile  pkg  README.md  scow-ai-adapter  tests
```

## **3 部署AI适配器（将服务器上生成的二进制文件拷贝至 AI管理节点）**
### **3.1 将服务器上生成的执行程序及代码中的config目录拷贝至AI管理节点的部署目录中**
```bash
# 将服务器或虚拟机上生成的二进制文件及代码中的config目录拷贝至需要部署适配器的AI管理节点上
scp -r scow-ai-adapter config ai_mn:/adapter     
# ai_mn 为需要部署适配器的ai管理节点、/adapter目录为部署目录
```

### **3.2 修改config目录下的config.yaml配置信息**
```bash

# 在slurm管理节点的部署目录/adapter中修改config目录下配置文件config.yaml的配置项
vim config/config.yaml
log:
  level: "info"                # 日志级别，支持info、debug、trace级别
  enableStdout: true            # 是否同时输出到标准输出
  # filePath: "/adapter/logs/server.log"  # 不填时默认使用部署目录下 logs/server.log

dbconfig:
  host: 127.0.0.1              # 数据库服务器地址
  port: 3306                   # 数据库端口
  dbname: ai_db                # 数据库库名
  username: root               # 连接数据库用户
  password: 81SLURM@@rabGTjN7  # 数据库密码

ldapconfig:
  ldapurl: "ldap://192.168.99.11:389"      # ldap服务端地址
  bindmanagerdn: "cn=Manager,ou=hpc,o=pku" # 管理员dn
  bindmanagerpasswd: "admin"               # 管理员密码
  binduserdn: "ou=People,ou=hpc,o=pku"     # 用户dn

adapterport: 8972              # 自定义适配器端口
clusterName: dev-k8s           # 集群名字
kubeconfig: /root/.kube/config # k8s集群配置文件路径
promethuesAddr: http://10.129.227.66:32001 # promethues 访问地址
# tensorboard 镜像地址,可选配置
tensorboardImage: crpi-u0hdpwcobdb87rnx.cn-beijing.personal.cr.aliyuncs.com/qsx/tensorboard:latest

ssl:
  enabled: false # 是否启用 SSL，默认为 false
  caCertPath: /adapter/certs/ca.crt # CA根证书路径, 相对适配器 config 的同级 certs目录。
  adapterCertPath: /adapter/certs/adapter.crt # CA签名的 adapter 证书路径， 相对适配器 config 的同级 certs 目录。
  adapterPrivateKeyPath: /adapter/certs/adapter.key # CA签名的 adapter 私钥路径， 相对适配器 config 的同级 certs目录。

dns:  # k8s 中Pod的DNS策略设置
  enabled: false  # 是否给pod配置自有DNS，默认为 false
  nameServers: #自有DNS的地址, 如果policy配置为true，pod使用改地址作为dns解析地址
    - 162.105.129.88
    
accelerator:  # 加速卡资源类型白名单
  - nvidia.com/gpu
  - volcano.sh/vgpu-number
  - huawei.com/Ascend910

vgpu:  # gpu 虚拟化
  enabled: false  # 是否开启虚拟化
  cores: 800  # gpu总core
  memory: 196608 # gpu 显存
  number: 40     # gpu 数量    
```

### **3.3 启动AI适配器**
```bash
# 在AI管理节点上启动服务
cd /adapter && cp config/adapter.service /lib/systemd/system/adapter.service

systemctl start adapter

systemctl enable adapter
```

### **3.4 修改分区配置信息并创建分区**
```bash
# 在slurm管理节点的部署目录/adapter中修改config目录下配置文件config.yaml的配置项
# 若集群中还有其他卡的节点，按照同样的格式追加信息即可
vim config/partition.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: partition-info
data:
  cpu: |                               # 没有GPU卡的节点，且节点的配置为 8核 30G内存的节点可以归到这组
    cpu: 8
    memory: 30Gi
    nodes: "k8s-master" # 若该分区有多个节点，配置成这样"node1, node2, node3"或"node[1-3]"
    cpu_model: "Intel(R) Xeon(R) Gold 6132 CPU @ 2.60GHz" # cpu 型号
  nvidia: |                            # nvidia GPU卡的节点，且节点的配置为 1卡 8核 30G内存的节点可以归到这组
    card-type: nvidia.com/gpu:1
    cpu: 8
    memory: 30Gi
    nodes: "k8s-node[01-02]"
    # 加速卡描述，驱动和cuda信息，用逗号分隔
    accelerator_descriptions: "driver version  470.239.06, cuda version 11.4"
    vram_mb: 11441  # 加速卡显存大小
    gpu_model: "Tesla K80" #加速卡型号
    cpu_model: "Intel(R) Xeon(R) Gold 6132 CPU @ 2.60GHz" # cpu 型号
    max_accelerators_per_pod: 8 # 单pod最大加速卡卡数
    
# 创建configmap
kubectl apply -f config/partition.yaml
# 查看queue及节点的label
kubectl get queue
NAME      AGE
cpu       45m
nvidia    45m
kubectl get node --show-labels
NAME         STATUS   ROLES           AGE   VERSION    LABELS
k8s-master   Ready    control-plane   42d   v1.28.10   ... queue-cpu=true
k8s-node01   Ready    <none>          42d   v1.28.10   ... queue-nvidia=true
k8s-node02   Ready    <none>          42d   v1.28.10   ... queue-nvidia=true
```
## 4 部署promethues
  [部署地址](https://jgf29kqp7z.feishu.cn/wiki/KBAiw6qrMiS5J3k1QbPcXkCknzx)

## 5 开启虚拟化
``` bash
# volcano 版本大于1.9，k8s大于1.26 
# 参考文档   https://project-hami.io/zh/docs/installation/how-to-use-volcano-vgpu/
插件的DS服务需要新增nodeSelector参数，筛选特定节点作为gpu虚拟化节点
# 适配器config文件新增 
vgpu:  # gpu 虚拟化
  enabled: false  # 是否开启虚拟化，true为开启
  cores: 800  # gpu总core
  memory: 196608 # gpu 显存
  number: 40     # gpu 数量 
#      
```
##### 虚拟化队列的配置，资源类型为 volcano.sh/vgpu-number
```yaml 
apiVersion: scheduling.volcano.sh/v1beta1
kind: Queue
metadata:
  name: vgpu
spec:
  capability:
    cpu: "90"
    memory: "517679940Ki"
    volcano.sh/vgpu-number: "40"
  deserved:
    cpu: "90"
    memory: "517679940Ki"
    volcano.sh/vgpu-number: "40"
  reclaimable: true
  weight: 1
```

## 6 容器内写数据为普通用户 
[参考文档](https://jgf29kqp7z.feishu.cn/wiki/C5Emw6rofiW8cnk2jwAc8rPfnPb)
