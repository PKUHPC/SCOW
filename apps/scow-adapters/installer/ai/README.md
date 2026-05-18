## 容器化部署

### 1 修改values.yaml 配置文件

```yaml
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
  tag: pr-140
  # deploy 拉取镜像的方式，测试环境建议always，正式环境推荐IfNotPresent
  pullPolicy: Always

# 对应deploy的command 
command:
  - /bin/sh
  - -c
# 对应deploy的args  
args:
  - /adapter/scow-ai-adapter

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
  logPath: /data/server.log  # 用于适配器日志映射到宿主机，优先填写共享存储路径
  
# ai适配器的service配置 
service:
  type: NodePort
  port: 8972
  targetPort: 8972
  nodePort: 30072
  name: scow-ai-adapter-port

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
      password: "81SLURM@@rabGTjN7"

    adapterport: 8972
    clusterName: dev-k8s
    prometheusAddr: http://10.129.227.66:32001
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
      vram_mb: "11441"
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

### 2 推送charts文件到ccrepo 仓库
```shell
# 打包tgz，--version 指定版本号
  helm package scow-ai-adapter-chart --version 0.1.0 
# 登录ccrepo
  helm registry login ccrepo.pku.edu.cn
# 推送tgz文件到仓库
  helm push scow-ai-adapter-chart-0.1.0.tgz  oci://ccrepo.pku.edu.cn/scow/
```
### 3 使用helm 部署 
```shell
 # 登录ccrepo 
  helm registry login ccrepo.pku.edu.cn 
 # 下载并安装，--version 指定版本
  helm pull oci://ccrepo.pku.edu.cn/scow/scow-ai-adapter-chart --version 0.1.0 --untar
  cd scow-ai-adapter-chart 
  vim values.yaml   # 修改values 
  cd ../ && helm install scow-ai-adapter ./scow-ai-adapter-chart # 部署
 # 查看 部署详情
  helm list 
 # 查看部署的应用
  kubectl get all -n scow-ai-adapter
 # 更新镜像地址，image.tag 指定镜像版本
  helm upgrade  scow-ai-adapter ./scow-ai-adapter-chart/ --set image.tag=**
 # 查看日志 
  kubectl logs -f -n scow-ai-adapter scow-ai-adapter-**
```

