---
sidebar_position: 2
title: 配置Web类应用
---

# 配置Web类应用

## 前提条件

请确保计算节点可以拉取或者已经存在配置中应用的镜像。

## 配置示例

下面以使用[coder/code-server](https://github.com/coder/code-server)启动VSCode的配置为例来讲解如何配置一个服务器类应用。

创建`config/ai/apps`目录，在里面创建`vscode/config.yml`或`vscode.yml`文件，其内容如下：

```yaml title="config/ai/apps/vscode/config.yml"
# 这个应用的ID
id: vscode

# 这个应用的名字
name: VSCode

# 指定应用类型为web
type: web

image:
  # 镜像名称
  name: codercom/code-server
  # 镜像版本
  tag: 4.20.0

# Web应用的配置
web:

  # 指定反向代理类型
  proxyType: relative

  # 准备脚本
  beforeScript: |
    export PASSWORD=$(get_password 12)

 # 指明运行任务的脚本中的启动命令，用户在创建应用页面可以在脚本中替换该命令
  startCommand:
    code-server
  # 运行任务的脚本。可以使用准备脚本定义的变量
  script: |
    PASSWORD=$PASSWORD code-server -vvv --bind-addr 0.0.0.0:$PORT --auth password

  # 如何连接应用
  connect:
    method: POST
    path: /login
    formData:
      password: "{{ PASSWORD }}"

```

增加了此文件后，刷新即可。

## 配置解释

### `proxyType`

[参考门户系统](../../portal/apps/configure-web-app.md#proxytype)

### `image`

可选参数，若不配置，则不显示默认镜像，用户可通过本地和远程镜像提交应用；若配置了，那么该镜像可被作为默认镜像来启动应用。`name`和`tag`分别指定镜像的名称和版本。如果本地没有该镜像，将会尝试从镜像仓库拉取。

### `logoPath`
  
[参考门户系统](../../portal/apps/configure-app-logo.md)

### `appComment`

[参考门户系统](../../portal/apps/configure-app-comment.md)


### `beforeScript`，`startCommand` 和`script`

`beforeScript`部分为准备脚本。这个脚本用来准备运行任务的环境。

为了保护软件不被未授权用户访问，我们推荐在程序启动的时候，生成一个密码，并应用使用密码方式进行加密，每次使用应用时均需要输入此密码。若您生成了密码，**必须**在`beforeScript`中将此密码export为`PASSWORD`变量。

`connect`的`formData`项需要使用的变量也需要在此处export。

准备脚本中的`export`的变量可以在`script`中使用。

`script`部分为如何启动这个应用的脚本。

`startCommand` 需要指明`scipt`中启动应用的命令，可供用户在使用自定义镜像时指定启动的命令，在默认情况下为`code-server`

`beforeScript`和`script`中可以使用以下辅助函数：

| 函数名         | 作用                            | 参数           | 返回值                  |
| -------------- | ------------------------------- | -------------- | ----------------------- |
| `get_password` | 生成一个包含A-Za-z0-9的随机密码 | `$1`: 密码长度 | 密码                    |

还可以使用以下变量。

| 变量名            | 值                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| `PROXY_BASE_PATH` | 这个应用在被访问时，其URL中位于**计算节点IP**之前的内容，不以`/`结尾。对SCOW AI来说，为`${SCOW AI的base path}/api/proxy/${集群ID}/${此应用的proxyType}`， 如果[自定义属性](../../portal/apps/configure-attributes.md)中出现了同名的变量，该值将会被覆盖。 |
| `PORT` | 这个应用启动时容器内的端口|
| `HOST` | 这个应用启动时容器映射的主机名|
| `SVCPORT` | 这个应用启动后，SCOW AI 节点可通过`HOST`:`SVCPORT`访问该应用|

这些脚本会被提交给调度系统，并最终运行后在计算节点上启动应用。

### `attributes`

考虑到扩展性和其他特殊的用法，不对type为`select`的attribute值处理：转义空格、特殊字符（比如引号、$符号、&符号等），管理员配置attribute值时要注意这一点。
其他的要求[参考门户系统](../../portal/apps/configure-attributes.md)。

## 特殊配置

### VSCode

对于VSCode应用让用户选择`使用镜像内置VSCode`或者`使用平台提供的VSCode版本`

1. 使用镜像内VSCode：即直接使用镜像内自带的VSCode
2. 使用平台VSCode：
   1. 管理员提前在ai公共挂载目录（这个也得先在ai的配置文件中配好）准备好提供给用户选择的vscode的各个版本文件
   2. 在VSCode应用配置文件中增加属性 PATH ，并配置版本值注意要在最后加上`$PATH`，版本对应的ai公共挂载目录值
   3. 内置VSCode 的value直接配置为`$PATH`即可

参考配置实例

```yaml
attributes:
  - type: select
    name: PATH
    label: 选择来源或版本
    required: true  
    placeholder: 选择内置VSCode或平台提供的VSCode的版本 
    select:
      - value: $PATH
        label: 镜像内VSCode (请填写启动命令, 使用默认镜像无需填写)
      - value: /nfs/public/vscode/code-server-4.96.1-linux-amd64/bin:$PATH
        label: version 4.96.1 (请不要填写启动命令)
      - value: /nfs/public/vscode/code-server-4.96.2-linux-amd64/bin:$PATH
        label: version 4.96.2 (请不要填写启动命令)
```
