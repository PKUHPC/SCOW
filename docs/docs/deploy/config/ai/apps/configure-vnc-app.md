---
sidebar_position: 3
title: 配置桌面类应用
---


## 前提条件

镜像要求：
- 安装有VNC（TigerVNC or TurboVNC）
- 安装对应的应用
- 相应的脚本启动VNC服务以及桌面应用
- 确保vnc连接的密码保存在`~/.vnc/passwd`文件中，应用在连接时，会给每次连接生成一个新的密码，生成的位置为`~/.vnc/passwd`。

请确保计算节点可以拉取或者已经存在配置中应用的镜像。


## 配置示例

下面以使用pycharm为示例介绍如何配置桌面类应用。

创建config/ai/apps目录，在里面创建pycharm/config.yml或vscode.yml文件，其内容如下：

```yaml title="config/ai/apps/pycharm/config.yml"
# 这个应用的ID
id: pycharm

# 这个应用的名字
name: pycharm

# 这个应用的图标文件在公共文件下的路径
logoPath: /test.svg

type: vnc
image:
  # 镜像名称
  name: 10.129.227.64/test/admin/pycharm
  # 镜像版本
  tag: v1.1

# VNC应用的配置
vnc:
  # 此X Session的xstartup脚本
  xstartup: |
    /dockerstartup/vnc_startup.sh pycharm

```

增加了此文件后，刷新即可。

## 配置解释

### `logoPath`
  
[参考门户系统](../../portal/apps/configure-app-logo.md)

### `image`

可选参数，若不配置，则不显示默认镜像，用户可通过本地和远程镜像提交应用；若配置了，那么该镜像可被作为默认镜像来启动应用。`name`和`tag`分别指定镜像的名称和版本。如果本地没有该镜像，将会尝试从镜像仓库拉取。

### `beforeScript`

[参考门户系统](../../portal/apps/configure-vnc-app.md#beforescript)

### `xstartup`

此处应该填写启动镜像时，vnc服务启动时的xstartup脚本，脚本中应该包含启动桌面应用的命令。
