---
sidebar_position: 2
title: 配置门户系统
---

# 配置门户系统

本节介绍如何配置门户系统。

## 修改安装配置文件

修改安装配置文件`install.yaml`

```yaml title="install.yaml"
# 确保门户系统会部署
portal:
  # 是否启用门户系统。默认为true，设置为false时nginx不渲染门户相关路由
  # enabled: true
  # 如果门户系统将会部署在系统的根目录下，设置BASE_PATH为/。默认为/
  basePath: /
  # 如果门户系统将会部署在系统的/portal下，设置BASE_PATH为/portal
  # basePath: /portal
```

:::tip

如果想自定义系统部署的相对路径，了解`PORTAL.BASE_PATH`的含义，请参考[自定义相对路径](../customization/basepath.md)。

:::

## 编写门户服务配置

在`config/portal.yaml`文件中，根据备注修改所需要的配置

```yaml title="config/portal.yaml"
# 是否启用作业管理功能
jobManagement: true

# 登录节点桌面功能
loginDesktop:
  # 是否启用桌面功能
  enabled: true

  # vnc 桌面
  wms: 
    # 桌面名和对应的wm值。见文档
    - name: Xfce
      wm: xfce

  # 单个登录节点最多启动多少个桌面。
  maxDesktops: 3

  # 将创建的 vnc 登录节点桌面信息保存到什么位置。相对于用户的家目录
  desktopsDir: scow/desktops

  # 配置ShadowDesk远程控制工具，如果开启，有所参数必填。
  # shadowDesk:
    # 是否配置有ShadowDesk远程控制工具
    # enabled: false

    # 代理服务器的地址和端口(根据实际部署更改)
    # proxyServer: ""

    # shadowDesk 桌面。
    # wms: ["xfce"]

    # api对接请求头参数(根据实际部署更改)
    # appId: ""

    # api入参加签的秘钥(根据实际部署更改)
    # appSecret: ""

# 是否启用交互式任务功能
apps: true

# 提交作业命令框中的提示语，可选配置
submitJobPromptText: "#此处参数设置的优先级高于页面其它地方，两者冲突时以此处为准"

# 是否启用终端功能
shell: true

# # 文件管理（可选）
# file:
#   # 文件预览功能（必填）
#   preview:
#     # 大小限制（必填）
#     # 可接受的格式为nginx的client_max_body_size可接受的值，默认为 50m
#     limitSize: "50m"
#   # 文件编辑功能（必填）
#   edit:
#     # 文件编辑大小限制（必填）
#     # 可接受的格式为nginx的client_max_body_size可接受的值，默认为 1m
#     # 建议设置为较大值
#     limitSize: "1m"
#     # 不可编辑的文件后缀（可选）
#     # 如果不填则按系统默认列表进行判断，当前系统默认列表请查看下一小节 “系统默认不可编辑文件后缀数组”
#     # nonEditableFilenamePostfixes: [".exe", ".ppt"]
#   # 文件提交功能（可选）
#   submit:
#     # 可运行脚本后缀数组（可选）
#     # 如果不填则按系统默认列表进行判断，当前系统默认列表请查看下一小节 “系统默认可运行脚本后缀数组”
#     executableFilenamePostfixes: [".sh"]

# 提交作业的默认工作目录。使用{{ name }}代替作业名称。相对于用户的家目录
# submitJobDefaultPwd: scow/jobs/{{ name }}

# 将保存的作业保存到什么位置。相对于用户家目录
# savedJobsDir: scow/savedJobs

# 将交互式任务的信息保存到什么位置。相对于用户的家目录
# appJobsDir: scow/appData

# TurboVNC的安装路径
# turboVNCPath: /opt/TurboVNC

# # 新增导航链接相关配置
# navLinks:
#   # 链接名
#   - text: "一级导航1"
#     # 链接地址，一级导航链接地址为可选填，二级导航链接地址为必填
#     url: ""
#     # 是否打开新的页面，可选填，默认值为false
#     # openInNewPage: true
#     # 自定义图标地址,可选填
#     # iconPath: ""
#     # 可以看到这个链接的用户,可选填
#     # 用户类型： user, accountUser, accountAdmin, accountOwner, tenantFinance, tenantAdmin, platformAdmin, platformFinance
#     allowedRoles: []
#     # 二级导航,可选填
#     children:
#       # 二级导航相关配置，与一级导航相同，但是url为必填配置，同时不允许再设置children
#       - text: "二级导航1"
#         url: "https://hahahaha1.1.com"
#         # openInNewPage: true
#         iconPath: ""
#         allowedRoles: [accountAdmin, accountOwner]
#       - text: "二级导航2"
#         url: "https://hahahaha1.2.com"
#         allowedRoles: [tenantAdmin, platformAdmin]
#   - text: "一级导航2"
#     url: "https://hahahaha2.com"


```
### 系统默认不可编辑文件后缀数组

```
[".7z", ".aiff", ".apk", ".app", ".avi", ".bat", ".bin", ".bmp", ".bz2", ".cmd", ".com", ".dat", ".dll", ".dmg", ".doc", ".docx", ".exe", ".flac", ".flv", ".gif", ".gz", ".img", ".iso", ".jpeg", ".jpg", ".mkv", ".mov", ".mp3", ".mp4", ".msi", ".odt", ".ott", ".pdf", ".png", ".ppt", ".pptx", ".psd", ".rar", ".tar", ".tgz", ".tiff", ".vcd", ".wav", ".wmv", ".xcf", ".xls", ".xlsx", ".zip"]
```

### 系统默认可运行脚本后缀数组

```
[".sh", ".bash", ".zsh", ".ksh", ".csh", ".tcsh", ".fish", ".py", ".pl", ".rb", ".run"]
```

## 更多配置

一些功能可能需要进一步的配置，请根据对应的文档完成。

- [登录节点桌面](./desktop.md)
- [跨集群传输](./transfer-cross-clusters.md)

## 启动服务

运行`./cli compose up -d`启动门户系统。