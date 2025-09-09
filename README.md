# <img src="apps/portal-web/assets/icons/192.png" height="30px" /> SCOW - Super Computing On Web

![Docs](https://github.com/PKUHPC/private-scow/actions/workflows/docs.yaml/badge.svg)
![Build](https://github.com/PKUHPC/private-scow/actions/workflows/test-build-publish.yaml/badge.svg)
[![codecov](https://codecov.io/gh/PKUHPC/private-scow/branch/master/graph/badge.svg?token=S9JCB2DXML)](https://codecov.io/gh/PKUHPC/private-scow)

[English README](./README.en.md)

## 介绍

SCOW是一个面向超算使用员和管理员的、基于Web的超算门户(portal)和管理系统(MIS)。

**超算门户**使超算用户仅通过一个现代浏览器就可以访问并使用各种超算资源，提供基于Web的以下功能：

- Shell
- 作业管理
- 文件管理
- 交互式作业（从浏览器中使用桌面、GUI等程序）

**超算管理系统**提供了一个超算运营模式以及相应的功能，帮助超算用户和管理员完成超算集群的日常管理工作，包括以下功能：

- 用户账户管理
- 计费收费
- 费用限制

## 演示集群

我们提供一个完整的使用SCOW管理的slurm超算集群供大家试用，请访问 https://hpc.pku.edu.cn/demo/scow 。

用户名和密码信息：

| 用户类型   | 用户名       | 密码         |
| ---------- | ------------ | ------------ |
| 普通用户   | `demo_user`  | `demo_user`  |
| 管理员用户 | `demo_admin` | `demo_admin` |

访问[文档](https://pkuhpc.github.io/SCOW/docs/info#%E4%BD%93%E9%AA%8C%E7%8E%AF%E5%A2%83)以了解更多关于这个演示集群的信息。

## 特点

- 提供现代化的UI以及功能丰富、友好的用户体验
- 使用现代化技术栈
- 易于部署、维护、自定义和扩展
- 支持一平台管理多个集群

## 文档

关于项目的更多信息，包括如何部署SCOW，请参考[文档](https://pkuhpc.github.io/SCOW)。

## 贡献

请参考[贡献指南](https://pkuhpc.github.io/SCOW/docs/contribution)来了解如何参与SCOW的开发。

## 授权协议

SCOW 使用 [木兰宽松许可证, 第2版](http://license.coscl.org.cn/MulanPSL2) 开源协议。

## 欢迎扫码加入SCOW技术交流群

![SCOW技术交流群二维码](docs/static/img/scow_qrcode.png)
