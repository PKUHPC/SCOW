# **Crane适配器开发手册**


## **1 Crane适配器开发环境要求**

### **1.1 安装go语言、配置go相关环境变量**

```bash
# 下载go语言安装包，安装go(本文以1.22版本为例)
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

### **1.2 安装buf**
```bash
# 执行下面命令完成安装
GO111MODULE=on GOBIN=/usr/local/bin go install github.com/bufbuild/buf/cmd/buf@v1.61.0
```

## **2 修改并编译Crane适配器**

### **2.1 proto没更新的情况**
适配器接口代码均在pkg/services目录下，有接口修改需求时修改对应代码即可
```bash
# ls pkg/services/
account  app  config  job  user  version
```
修改后编译
```bash
make build-crane
```

### **2.2 proto有更新的情况**
适配器接口及接口的Request及Response均由上下游proto定义好，若上下游proto有更新，适配器也必须重新生成proto代码并修改对应的接口
```bash
# 生成上游scow的proto代码
[root@manage01 scow-adapters]# make protos

# 执行完上面的命令后会在当前目录下生成gen目录和相关的proto文件
[root@manage01 scow-adapters]# ls gen/go
account_grpc.pb.go  account.pb.go  app_grpc.pb.go  app.pb.go  config_grpc.pb.go  config.pb.go  job_grpc.pb.go  job.pb.go  user_grpc.pb.go  user.pb.go  version_grpc.pb.go  version.pb.go
```
```bash
# 生成下游crane的proto代码
[root@manage01 scow-slurm-adapter]# make cranesched

# 执行完上面的命令后会在当前目录下生成gen目录和相关的proto文件
[root@manage01 scow-adapters]# ls gen/crane/
Crane_grpc.pb.go  Crane.pb.go  CraneSubprocess.pb.go  Plugin_grpc.pb.go  Plugin.pb.go  PublicDefs.pb.go
```
修改接口代码
```bash
# ls pkg/services/
account  app  config  job  user  version
```
修改后编译
```bash
make build-crane-ai
```