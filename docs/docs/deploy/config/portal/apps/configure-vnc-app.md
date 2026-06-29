---
sidebar_position: 3
title: 配置桌面类应用
---

# 配置桌面类应用 

## 前提条件

请确保在需要运行桌面类应用的机器上安装有：

- [TurboVNC](https://turbovnc.org/) 3.0版本及以上
- 您需要运行的桌面类应用

## 配置示例

下面以使用emacs为示例介绍如何配置桌面类应用。

创建`config/apps`目录，在里面创建`emacs/config.yml`或者`emacs.yml`文件，其内容如下：

```yaml title="config/apps/emacs/config.yml"
# 这个应用的ID
id: emacs

# 这个应用的名字
name: emacs

# 指定应用类型为vnc
type: vnc

# 提交这个作业时所有分区都被认为是非GPU分区
# ignoreGpu: false

# VNC应用的配置
vnc: 

  # 可以使用准备脚本来准备运行任务的环境
  # beforeScript:
  #   export VERSION=1.0
  
  # 此X Session的xstartup脚本
  xstartup: |
    emacs -mm

```

增加了此文件后，刷新即可。

## 配置解释

### beforeScript

`beforeScript`为准备脚本,如果有需要使用的变量，可以选择使用这个脚本用来准备运行任务的环境。

### xstartup

对于桌面类应用，系统提交一个计算任务。此任务将会在计算节点上启动一个TurboVNC实例，此TurboVNC实例将会以配置中的`xstartup`脚本作为其启动脚本。

所以对于桌面类应用而言，您只需要填写正确的xstartup脚本即可。

### `attributes`

如果需要指定应用版本，可以通过`attributes`配置项添加自定义HTML表单，具体配置示例请参考[attributes配置](./configure-attributes.md)。