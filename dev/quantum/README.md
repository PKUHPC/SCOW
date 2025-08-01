# 量子jupyter应用测试

复制`.env`为`.env.local`，然后将量子云平台的token写为`.env.local`的`QOST_TOKEN`变量的值

本目录下的`Dockerfile`会构建一个容器镜像，这个容器镜像中构建了一个名字为`tensorcircuit`的conda环境。

这个容器镜像中的环境的量子平台API地址已经在容器构建的时候被修改为`http://host.docker.internal:3000/api/tc/`，即`apps/quantum`运行的时候地址。

运行`docker compose up`以启动容器，查看log中的给出的URL访问jupyter。若无法访问，可以尝试将127.0.0.1修改为localhost。

`notebook`目录下有一些示例的notebook，可以手动在容器里测试。`notebook`目录无法映射到容器中。

整个调用流程：

jupyter -> apps/quantum -> qobody -> 云平台
