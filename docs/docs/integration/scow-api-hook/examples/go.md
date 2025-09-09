---
sidebar_position: 2
title: Go
---

# Go示例

示例项目：https://github.com/PKUHPC/scow-go-demo

## 准备环境

您需要：

- 安装好Go语言开发工具链（[Go语言官网](https://go.dev/)）
- 安装Buf CLI（[官网文档](https://buf.build/docs/installation/)）
- 有一个Go项目

您可以通过`go mod init`命令，初始化一个Go项目，假设模块名为`github.com/PKUHPC/scow-go-demo`
  
```bash
go mod init github.com/PKUHPC/scow-go-demo
```

## 使用Buf获取Proto文件并生成代码

创建`buf.gen.yaml`文件，内容如下：

```yaml title="buf.gen.yaml"
version: v1
managed:
  enabled: true
  go_package_prefix:
    # 项目模块名+生成路径（plugins中out）
    default: github.com/PKUHPC/scow-go-demo/gen/go
    except:
        - buf.build/googleapis/googleapis
plugins:
  - plugin: buf.build/protocolbuffers/go
    out: gen/go
    opt: paths=source_relative
  - plugin: buf.build/grpc/go
    out: gen/go
    opt: paths=source_relative,require_unimplemented_servers=false

```

指定需要使用的SCOW的版本，生成代码

```bash
# 通过#后的参数确认SCOW和SCOW API版本，可输入
#    SCOW API的版本号（tag=api-v0.3.0）（推荐，从v0.3.0版本开始可用）
#    SCOW的分支（branch=master）
#    SCOW Tag号（tag=v0.4.0）
# 不写默认使用SCOW的master分支版本
buf generate --template buf.gen.yaml https://github.com/PKUHPC/private-scow.git#subdir=protos,branch=api-v0.3.0
```

## 使用SCOW API

编写Go代码使用调用SCOW API的代码

```go title="api.go"
package main

import (
	"context"
	"log"

	"github.com/PKUHPC/scow-go-demo/gen/go/server"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func main() {
  // 假设mis-server在192.168.88.100:7571上监听
	conn, err := grpc.Dial("192.168.88.100:7571", grpc.WithTransportCredentials(insecure.NewCredentials()))

  if err != nil {
    panic(err)
  }

  // 生成AccountServiceClient
	client := server.NewAccountServiceClient(conn)

  // 调用`GetAccounts` RPC，获取所有账户
	resp, err := client.GetAccounts(context.Background(), &server.GetAccountsRequest{})

	if err != nil {
		panic(err)
	}

	log.Printf("Account list: %v", resp)
}
```

下载依赖并运行

```bash
go mod tidy
go run api.go
```

## 实现并注册SCOW Hook

创建一个`hook.go`文件，实现HookServiceServer (protos/hook/hook.proto)

```go title="hook.go"
package main

import (
	"context"
	"log"
	"net"

	"github.com/PKUHPC/scow-go-demo/gen/go/hook"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/encoding/protojson"
)

type MyHookServer struct{}

func (s *MyHookServer) OnEvent(ctx context.Context, req *hook.OnEventRequest) (*hook.OnEventResponse, error) {

	log.Printf("Received event: %+v", protojson.Format(req))

	return &hook.OnEventResponse{}, nil
}

func main() {

	addr := "0.0.0.0:5000"

	lis, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}
	var opts []grpc.ServerOption
	grpcServer := grpc.NewServer(opts...)

	server := MyHookServer{}

	hook.RegisterHookServiceServer(grpcServer, &server)
	log.Printf("Listening at %s", addr)

	grpcServer.Serve(lis)
}

```

下载依赖并运行

```bash
go mod tidy
go run hook.go
```

修改`config/common.yaml`文件，配置Hook Server的地址

```yaml title="config/common.yaml"
scowHook:
  url: localhost:5000
```

重启SCOW。当SCOW有相关事件发生时，SCOW会调用Hook Server。



