# **Crane适配器安装部署文档**


## **1 Crane适配器安装部署环境要求**

### **1.1 准备一台能连外网的服务器或虚拟机用来编译生成二进制文件**
### **1.2 在准备的服务器或虚拟机安装go语言、配置go相关环境变量**

```bash
# 下载go语言安装包，安装go(本文以1.22版本为例)
cd download/
wget https://golang.google.cn/dl/go1.22.0.linux-amd64.tar.gz
tar -C /usr/local -xzf go1.22.0.linux-amd64.tar.gz

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

## **2 编译Crane适配器项目**

### **2.1 在准备好的服务器或虚拟机上拉取Crane适配器代码**
```bash
cd /root    # 将crane适配器代码放在root目录下
git clone https://github.com/PKUHPC/scow-adapters.git  #克隆代码
```

### **2.2 编译项目**
```bash
# 在代码根目录下执行make build-crane 生成二进制文件(scow-crane-adapter)
[root@crane01 scow-adapters]# make build-crane 
- Building scow-crane-adapter with ...
    - Binaries are in ./
[root@crane01 scow-adapters]# ls
Makefile  README.md  buf.gen.yaml  buf.genCrane.yaml  cmd  config.yaml  docs  gen  go.mod  go.sum  pkg  protos  scow-crane-adapter  logs  tests
```

## **3 部署Crane适配器（将服务器上生成的二进制文件拷贝至 Crane管理节点）**
### **3.1 将服务器上生成的执行程序拷贝至Crane管理节点的部署目录中**
```bash
# 将服务器或虚拟机上生成的二进制文件拷贝至需要部署适配器的Crane管理节点上
scp -f scow-crane-adapter config.yaml adapter.service crane_mn:/adapter     
# crane_mn 为需要部署适配器的crane管理节点、/adapter目录为部署目录
```

### **3.2 启动Crane适配器**
```bash
# 在Crane管理节点上启动服务
cd /adapter && cp adapter.service /lib/systemd/system/adapter.service

systemctl start adapter

systemctl enable adapter
```
