---
sidebar_position: 2
title: 容器化部署
---

# 容器化部署

## 下载适配器chart文件

```Bash
vim /etc/hosts # 添加域名解析 
  162.105.120.171 ccrepo.pku.edu.cn
```

浏览器访问 [ccrepo AI 适配器 Chart tags](https://ccrepo.pku.edu.cn/#browse/browse:scow:v2%2Fscow-ai-adapter-chart%2Ftags)，查看当前 AI 适配器 charts 版本。

```Bash
# 登录ccrepo
 helm registry login ccrepo.pku.edu.cn   
# 下载并解压，--version 指定版本
 helm pull oci://ccrepo.pku.edu.cn/scow/scow-ai-adapter-chart --version 0.1.0 --untar
```

## Values 参数详情

```YAML
#创建namespace
namespace:
  create: true
  name: scow-ai-adapter

serviceAccount:
  create: true
  name: scow-ai-adapter-sa
  imagePullSecrets:
    - ccrepo-registry

rbac:
  create: true
  # cluster-admin 集群管理员角色
  clusterRoleName: cluster-admin
  clusterRoleBindingName: scow-ai-adapter-sa-cluster-admin

image:
  # ai适配器的镜像地址及tag版本
  repository: ccrepo.pku.edu.cn/scow/scow-ai-adapter
  tag: master
  # deploy 拉取镜像的方式，测试环境建议always，正式环境推荐IfNotPresent
  pullPolicy: Always

# 对应deploy的command 
command:
  - /bin/sh
  - -c
# 对应deploy的args  
args:
  - /adapter/scow-adapter

# deploy的副本数，目前有定时器，推荐是1
replicaCount: 1
# deploy就绪及存活的检测端口
containerPort: 8972

# deploy的资源申请及限制
resources:
  requests:
    cpu: "1"
    memory: "2Gi"
  limits:
    cpu: "4"
    memory: "8Gi"

# deploy 存活及就绪探针检测
probes:
  liveness:
    enabled: true
    initialDelaySeconds: 2
    periodSeconds: 10
  readiness:
    enabled: true
    initialDelaySeconds: 2
    periodSeconds: 10

# 是否挂载 hostPath（模版挂了宿主机的 /etc/hosts和/etc/localtime ）
hostPathMounts:
  enabled: true
  logPath: /data/logs                          # 宿主机日志目录，优先填写共享存储路径
  containerLogFile: /adapter/logs/server.log   # 容器内日志文件路径
  queuedJobsPath: /data/queued-jobs            # 排队作业请求持久化目录，优先填写共享存储路径
  
# ai适配器的service配置 
service:
  type: NodePort
  port: 8972
  targetPort: 8972
  nodePort: 30072
  name: scow-ai-adapter-port
  
# 适配器监控service 配置  
monitor: 
  port: 8973
  targetPort: 8973
  nodePort: 30073
  name: scow-ai-adapter-monitor-port

# 适配器的服务配置信息，以configmap的方式管理
configMap:
  name: scow-ai-adapter-config
  # 适配器的 config.yaml 做成“结构化 values 渲染成 YAML”
  config:
    log:
      level: "info"

    dbconfig:
      host: 127.0.0.1
      port: 3306
      dbname: ai_db
      username: root
      password: "*****"

    adapterport: 8972
    clusterName: dev-k8s
    prometheusAddr: http://******
    tensorboardImage: "crpi-u0hdpwcobdb87rnx.cn-beijing.personal.cr.aliyuncs.com/qsx/tensorboard:latest"

    ssl:
      enabled: false
      caCertPath: /adapter/certs/ca.crt
      adapterCertPath: /adapter/certs/adapter.crt
      adapterPrivateKeyPath: /adapter/certs/adapter.key

    dns:
      enabled: false
      nameServers:
      - 162.105.129.88

    accelerator:
      - nvidia.com/gpu
      - volcano.sh/vgpu-number
      - huawei.com/Ascend910

    vgpu:
      enabled: true
      cores: 800
      memory: 196608
      number: 40

    quota:
      gpu: 0

  # partition-info 配置 
  partitionInfo: 
    cpu: | # 队列名
      # 每个节点可分配的cpu数量
      cpu: 7 
      # 每个节点可分配的内存大小
      memory: 14Gi
      # 队列对应的节点
      nodes: "k8s-master" 
      # cpu 型号
      cpu_model: "Intel(R) Xeon(R) Gold 6132 CPU @ 2.60GHz"
    nvidia: | 
      card-type: nvidia.com/gpu:1
      cpu: 6
      memory: 28Gi
      nodes: "k8s-node[01-02]"
      # 加速卡描述，驱动和cuda信息，用逗号分隔
      accelerator_descriptions: "driver version  470.239.06, cuda version 11.4"
      # cpu 型号
      cpu_model: "Intel(R) Xeon(R) Gold 6132 CPU @ 2.60GHz"
      # 显存大小
      vram_mb: 11441
      # 加速卡型号
      gpu_model: "Tesla K80"
      # 单pod最大加速卡卡数
      max_accelerators_per_pod: 1

registrySecret:
  create: true
  name: ccrepo-registry
  server: ccrepo.pku.edu.cn
  # ccrepo仓库的登录认证，用于拉取镜像地址
  username: "****"  
  password: "****"
   

```

## helm安装适配器服务

```Bash
 cd scow-ai-adapter-chart
# 修改values
 vim values.yaml
# 部署    
 cd ../ && helm install scow-ai-adapter ./scow-ai-adapter-chart 
# 查看 部署详情
 helm list 
# 查看部署的应用
 kubectl get all -n scow-ai-adapter
# 查看pod 运行详情
 kubectl get pods -n scow-ai-adapter
```

## 更新镜像版本

```Bash
# 更新镜像地址，image.tag 指定镜像版本
 helm upgrade  scow-ai-adapter ./scow-ai-adapter-chart/ --set image.tag=** --set rolloutTrigger=$(date +%s)
```

## 查看适配器日志

```Bash
# 实时查看日志 
 kubectl logs -f -n scow-ai-adapter scow-ai-adapter-**
# 另外可在values中配置的logPath中查看 
```
