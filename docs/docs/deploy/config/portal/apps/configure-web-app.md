---
sidebar_position: 2
title: 配置Web类应用
---

# 配置Web类应用

## 前提条件

请确保在需要运行应用的计算节点上安装有需要的软件包。

## 配置示例

下面以使用[coder/code-server](https://github.com/coder/code-server)启动VSCode的配置为例来讲解如何配置一个服务器类应用。

创建`config/apps`目录，在里面创建`vscode/config.yml`或`vscode.yml`文件，其内容如下：

```yaml title="config/apps/vscode/config.yml"
# 这个应用的ID
id: vscode

# 这个应用的名字
name: VSCode

# 指定应用类型为web
type: web

# 提交这个作业时所有分区都被认为是非GPU分区
# ignoreGpu: false

# Web应用的配置
web:

  # 指定反向代理类型
  proxyType: relative

  # 准备脚本
  beforeScript: |
    export PORT=$(get_port)
    export PASSWORD=$(get_password 12)

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


用户通过以下格式的URL访问Web类的交互式应用

> http[s]://`${域名或者IP}`/`${SCOW系统的base path}`/api/proxy/`${运行应用的集群ID}`/`${这个应用的proxyType}`/`${计算节点的IP或者主机名}`/`${应用所在的端口号}`/`${...应用所需要的path}`

对于web类型的应用，需要配置`proxyType`。不同的交互式应用使用了不同的nginx proxy方式，通过配置`proxyType`，可以允许应用携带不同类型的uri到后端计算节点。

`proxyType`可以配置为`relative`或者`absolute`，如果不配置默认是`relative`。

- 如果设置成`absolute`，会把完整URL请求路径反向代理到给定的主机和端口。比如访问以下地址：
  
  > https://hpc.pku.edu.cn/demo/scow/api/proxy/hpc01/absolute/192.168.220.133/7383/index.html

  以下URL请求将会被发送给计算节点`192.168.220.133`的`7383`端口。

  > /demo/scow/api/proxy/hpc01/absolute/192.168.220.133/7383/index.html
  
- 如果设置成`relative`，只使用URL请求路径的路径部分将请求反向代理到给定的主机和端口。比如访问以下地址：

  > https://hpc.pku.edu.cn/demo/scow/api/proxy/hpc01/relative/192.168.220.133/4253/index.html

  以下URL请求将会被发送给计算节点`192.168.220.133`的`4253`端口。

  > /index.html



### `beforeScript`和`script`

`beforeScript`部分为准备脚本。这个脚本用来准备运行任务的环境。

这个脚本要求必须export一个变量：

- `PORT`：程序将会运行在的端口

为了保护软件不被未授权用户访问，我们推荐在程序启动的时候，生成一个密码，并应用使用密码方式进行加密，每次使用应用时均需要输入此密码。若您生成了密码，**必须**在`beforeScript`中将此密码export为`PASSWORD`变量。

`connect`的`formData`项需要使用的变量也需要在此处export。

准备脚本中的`export`的变量可以在`script`中使用。

`script`部分为如何启动这个应用的脚本。

`beforeScript`和`script`中可以使用以下辅助函数：

| 函数名         | 作用                            | 参数           | 返回值                  |
| -------------- | ------------------------------- | -------------- | ----------------------- |
| `get_port`     | 获得一个可用的TCP端口           | 无             | 一个调用时可用的TCP端口 |
| `get_password` | 生成一个包含A-Za-z0-9的随机密码 | `$1`: 密码长度 | 密码                    |

还可以使用以下变量。如果[自定义属性](./configure-attributes.md)中出现了和这里同名的变量，这里的变量将会被覆盖。

| 变量名            | 值                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| `PROXY_BASE_PATH` | 这个应用在被访问时，其URL中位于**计算节点IP**之前的内容，不以`/`结尾。对SCOW来说，为`${SCOW的base path}/api/proxy/${集群ID}/${此应用的proxyType}` |


这些脚本，以及一些辅助的脚本将会被作为一个作业提交给调度系统，并最终在某个计算节点上运行。

### `connect`

`connect`部分定义如何连接到应用。系统将会给可以连接的应用创建一个用于连接应用的a标签。点击a标签之后，系统将会打开一个新标签页，打开新标签页时实际进行的动作将可以在这里自定义。

配置如下：

| 属性       | 类型                 | 是否必填 | 解释                                          |
| ---------- | -------------------- | -------- | --------------------------------------------- |
| `path`     | 字符串               | 是       | 新标签页所访问的相对路径                      |
| `method`   | "GET" 或者 "POST"    | 是       | 发起一个什么的HTTP请求                        |
| `query`    | 字符串到字符串的字典 | 否       | 连接时附带的query                             |
| `formData` | 字符串到字符串的字典 | 否       | 如果`method`是POST，这个请求将会带的form data |

`path`, `query`的值和`formData`的值部分可以使用`{{ PASSWORD }}`代替应用在`beforeScript`里export的密码。

此外，如果`formData`需要使用其他变量，可以在准备脚本`beforeScript`中export需要的变量，然后以`{{ 变量名 }}`的形式使用。

### `attributes`

如果需要指定应用版本，可以通过`attributes`配置项添加自定义HTML表单，具体配置示例请参考[attributes配置](./configure-attributes.md)。