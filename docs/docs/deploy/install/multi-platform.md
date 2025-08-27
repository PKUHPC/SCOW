---
title: 多架构支持
sidebar_position: 4
description: SCOW对各类系统和架构的支持
---

# 多架构支持

SCOW系统支持以下运行环境的镜像。您只需在支持的机器上安装对应版本的docker，就可以拉取或者构建符合你当前机器架构的镜像。

- `linux/amd64`
- `linux/arm64`

## `scow-cli`

`scow-cli`同样支持上述运行环境。请在下载时选择您部署所在的机器的操作系统和架构下载。

## 编译支持多架构的镜像

直接运行`docker build`构建出来的镜像为只支持您编译时机器的架构的镜像。要想编译出同时支持以上所有架构的镜像，请参考以下步骤：

1. 根据docker官方的[`Multi-platform images`文档](https://docs.docker.com/build/building/multi-platform/)，创建并使用支持多平台编译的builder

```bash
docker buildx create --name mybuilder --driver docker-container --bootstrap --use
```

2. 通过这个builder构建镜像

```bash
# 
docker buildx build -f docker/Dockerfile.scow -t scow --platform=linux/arm64,linux/cmd64 .
```

