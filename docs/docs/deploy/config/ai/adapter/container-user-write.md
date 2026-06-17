---
sidebar_position: 3
title: 容器内写数据为普通用户
---

# 容器内写数据为普通用户

## 安装 idmap-csi

1. 登录 ccrepo。

   ```bash
   helm registry login ccrepo.pku.edu.cn
   ```

2. 下载 Chart 包。

   ```bash
   helm pull oci://ccrepo.pku.edu.cn/scow/idmap-csi-chart/idmap-csi --version 0.1.0 --untar
   ```

3. 编辑 `values.yaml`。

   ```bash
   vim idmap-csi/values.yaml
   ```

4. 修改以下内容。

   ```yaml
   # 填写 ccrepo 的账密信息，用于下载镜像
   ccrepo_credentials:
     username: ""
     password: ""

   csiDriver:
     # 可以使用的 hostPath
     # Pod 挂载的 hostPath 必须是这里某个目录或者其子目录
     mountHostPaths:
       # 填写 SCOW 集群的共享存储挂载路径
       - /nfs
   ```

5. 部署 `idmap-csi`。

   ```bash
   kubectl create ns idmap-csi
   helm install idmap-csi -n idmap-csi ./idmap-csi
   ```

6. 检查服务运行状态。

   ```bash
   kubectl get pods -n idmap-csi
   ```

   示例输出：

   ```text
   NAME                             READY   STATUS    RESTARTS   AGE
   csi-controller-7b899d954-wghh9   2/2     Running   0          13d
   csi-node-55zmp                   2/2     Running   0          13d
   csi-node-8959p                   2/2     Running   0          13d
   csi-node-lfkks                   2/2     Running   0          13d
   ```

## 修改 SCOW K8s 配置文件

1. 进入集群配置目录并编辑对应配置文件。

   ```bash
   cd ${SCOW}/config/clusters/
   vim dev-k8s.yaml
   ```

2. 修改以下配置。

   ```yaml
   ai:
     enabled: true
     devHost:
       vscodeInfo:
         binPath: "/data/public/vscode/code-server-4.96.2-linux-amd64/bin/code-server"
       # maxRunningTimeHours: 10
     clusterPublicPath: "/data/home/k8s/lyl/123"
     # sharedTopDir: "/data/home/k8s/share"
     idmap:
       # true 表示开启，false 或者不配置 idmap 表示关闭
       enabled: true
       # 可选值：notSet、plain、idmap、bindfs
       # 参考：https://github.com/PKUHPC/idmap-csi
       mode: bindfs
   ```

## 装载模式

### `plain`
``` 
无 idmap 的模式，作为回退模式。
```

### `idmap`
```
使用 Linux 5.12 新增的 idmap mount 挂载模式，将目标挂载到容器中。由于是内核实现，性能损失低，但无法指定 gid。

要求：
- Linux 内核版本大于或等于 5.12。
- 底层文件系统支持 idmap：
  - 已知支持：ext4。
  - 已知不支持：NFS、overlayfs。
  - 如果一个 Pod 挂载的目录是不支持的文件系统，则这个 Pod 无法启动。
``` 
### `bindfs`

使用 [bindfs](https://bindfs.org/docs/bindfs.1.html#sect3) 实现

```
实际行为是将 `uid` 指定的用户和组映射到 `root`：

- 实际文件的 owner 是 `uid` 指定的用户和组时，从挂载点看这个文件的 owner 是 `root:root`。
- 当 root 用户在挂载点内部创建文件时，创建的文件会被 `chown`/`chgrp` 到 `uid` 指定的用户和组。
- 当 root 用户在挂载点内部 `chown` 到 `root` 时，文件实际上会被 `chown` 到 `uid` 指定的用户。

问题：

- FUSE 实现，可能影响性能。
- 没有限制文件访问。也就是说，如果本来就有 root own 的文件，从挂载点可以修改这个文件，因为访问文件的用户就是 root。
``` 
