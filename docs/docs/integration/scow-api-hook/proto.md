---
sidebar_position: 1
title: SCOW Protobuf文件
---

# SCOW Protobuf文件

SCOW API和Hook的数据结构和服务都通过[Protocol Buffer](https://protobuf.dev/)格式统一定义并分发。要想使用SCOW API和Hook，您需要首先获取proto文件，通过proto文件生成您对应的语言的代码，然后才能进行开发。

## 获取Proto文件

我们将SCOW API和Hook的proto文件放到了代码仓库中，您可以直接从代码仓库中获取。代码仓库中`protos`目录下则为proto文件：[master分支protos目录链接](%REPO_FILE_URL%/protos)

proto文件分为`common`, `portal`, `server`, `audit`和`hook`。其中，

- `common`中定义了公用的数据结构
- `portal`定义了门户系统的SCOW API。`portal-server`门户系统后端实现了`portal`中定义的服务，您可以通过`portal`下的文件与`portal-server`交互
- `server`定义了管理系统的SCOW API。`mis-server`管理系统后端实现了`server`中定义的服务，您可以通过`server`下的文件与`mis-server`交互
- `audit`定义了审计系统的SCOW API。`audit-server`审计系统系统后端实现了`audit`中定义的服务，您可以通过`audit`下的文件与`audit-server`交互
- `hook`定义了SCOW Hook的事件和服务。`portal-server`和`mis-server`将会通过`hook`下的文件与您配置的SCOW Hook服务器交互

除了直接从代码仓库中获取，我们更推荐使用工具获取Protobuf文件。您可以通过以下方式获取到SCOW的Protobuf文件

### 1. 使用Buf获取和生成代码（推荐）

[Buf](https://buf.build/docs/tutorials/getting-started-with-buf-cli/)是一个管理gRPC API和proto文件的一站式工具，可完成获取文件、生成代码等常见功能。我们推荐通过使用Buf直接从GitHub上获取代码并生成您的语言的模板的代码的工作。

```bash
# 使用本地buf.gen.yaml生成模板，使用v0.3.0版本的SCOW API(v0.3.0开始可以通过此方式，推荐)
buf generate --template buf.gen.yaml https://github.com/PKUHPC/private-scow.git#subdir=protos,branch=api-v0.3.0

# 使用本地buf.gen.yaml生成模板，使用SCOW仓库的master分支的代码对应的SCOW API
buf generate --template buf.gen.yaml https://github.com/PKUHPC/private-scow.git#subdir=protos,branch=master
```

详细的示例请参考：

- [Go](./examples/go.md#使用buf获取proto文件并生成代码)

## API版本控制

API的版本通过`@scow/grpc-api`包的版本进行定义。SCOW gRPC API版本控制原则：

- 不影响API的修改，例如lint文件：提高PATCH号
- 修改了API，但是兼容当前的API：提高MINOR号
- 不兼容已有的配置文件，提高MAJOR版本

当前，我们并不保证新版本SCOW对老版本API的兼容性。SCOW每次发布版本时，会同时公布此版本支持的SCOW API的版本号。