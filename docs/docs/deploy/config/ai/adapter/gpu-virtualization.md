---
sidebar_position: 5
title: GPU 开启及关闭虚拟化
---

# GPU 开启及关闭虚拟化

参考：[HAMi Volcano vGPU 使用文档](https://project-hami.io/zh/docs/installation/how-to-use-volcano-vgpu)

## 修改 containerd 的配置

```Bash
[plugins."io.containerd.grpc.v1.cri".containerd]
      default_runtime_name = "nvidia"
      snapshotter = "overlayfs"

      [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.nvidia]
          privileged_without_host_devices = false
          runtime_engine = ""
          runtime_root = ""
          runtime_type = "io.containerd.runc.v2"
        [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.nvidia.options]
            BinaryName = "/usr/bin/nvidia-container-runtime"
            SystemdCgroup = true
# 设置 nvidia-container-runtime 作为默认的低级运行时 
# 重启containerd 服务 
 systemctl daemon-reload && systemctl restart containerd           
```

## 安装 vgpu-device-plugin 

[volcano-vgpu-device-plugin.yml](https://raw.githubusercontent.com/Project-HAMi/volcano-vgpu-device-plugin/refs/heads/main/volcano-vgpu-device-plugin.yml)

```yaml
wget https://raw.githubusercontent.com/Project-HAMi/volcano-vgpu-device-plugin/refs/heads/main/volcano-vgpu-device-plugin.yml 

# 指定节点进行虚拟化 
vim volcano-vgpu-device-plugin.yml  # 给ds服务增加nodeSelector
   ...
   template:
    metadata:
      # This annotation is deprecated. Kept here for backward compatibility
      # See https://kubernetes.io/docs/tasks/administer-cluster/guaranteed-scheduling-critical-addon-pods/
      annotations:
        scheduler.alpha.kubernetes.io/critical-pod: ""
      labels:
        name: volcano-device-plugin
   spec:
      nodeSelector:    # 标签的key和value可以自定义
        "vgpu": "true"
        ...
# 给节点打标签
 kubectl label node vgpu=true  
 kubectl apply -f volcano-vgpu-device-plugin.yml 
```

## 修改 volcano 的 scheduler configmap 配置

```Bash
 kubectl edit cm -n volcano-system volcano-scheduler-configmap 
# 增加 
 - name: deviceshare
   arguments:
     deviceshare.VGPUEnable: true
# 执行kubectl 命令重启deploy 服务 
 kubectl rollout restart deployment -n volcano-system volcano-scheduler 
# 查看pod是否重启成功 
 kubectl get pod -n volcano-system        
```

## 查看插件是否上报资源信息

```Bash
kubectl describe node ${nodeName} 
在可分配资源里面查看到一下资源类型即可
Allocatable:
  volcano.sh/vgpu-cores:   800
  volcano.sh/vgpu-memory:  196608
  volcano.sh/vgpu-number:  80
```

## 创建 vcjob 验证调度功能

```yaml
apiVersion: batch.volcano.sh/v1alpha1
kind: Job
metadata:
  name: lm-mpi-job
spec:
  minAvailable: 1
  schedulerName: volcano
  tasks:
    - replicas: 1
      name: mpimaster
      policies:
        - event: TaskCompleted
          action: CompleteJob
      template:
        spec:
          containers:
            - command:
                - /bin/sh
                - -c
                - |
                   mkdir -p /var/run/sshd; /usr/sbin/sshd;
                   sleep 36000
              image:  crpi-u0hdpwcobdb87rnx.cn-beijing.personal.cr.aliyuncs.com/qsx/pytorch-ddp-test:v1
              name: mpimaster
              workingDir: /home
              resources:
                limits:
                  volcano.sh/vgpu-number: 1 # 1个GPU
                  volcano.sh/vgpu-memory: 3000 # 3000MB显存
                  volcano.sh/vgpu-cores: 20   # 占用20%的util
          restartPolicy: OnFailure
# kubectl apply -f demo.yaml           
```

## 取消节点虚拟化

```Bash
# 某个节点取消，给节点取消标签即可  
 kubectl label node $nodeName ${key}-
# 所以节点都取消，可直接删除device plugin  
 kubectl delete ds -n kube-system volcano-device-plugin
```

## 如何同时存在 nvidia-device-plugin 和 volcano-device-plugin

```YAML
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: nvidia-device-plugin-daemonset
  namespace: kube-system
spec:
  selector:
    matchLabels:
      name: nvidia-device-plugin-ds
  updateStrategy:
    type: RollingUpdate
  template:
    metadata:
      labels:
        name: nvidia-device-plugin-ds
    spec:
      nodeSelector:        # 增加nodeselector 筛选
        "nvidia.com/gpu": "true"
      tolerations:
      - key: nvidia.com/gpu
        operator: Exists
        effect: NoSchedule
      # Mark this pod as a critical add-on; when enabled, the critical add-on
      # scheduler reserves resources for critical add-on pods so that they can
      # be rescheduled after a failure.
      # See https://kubernetes.io/docs/tasks/administer-cluster/guaranteed-scheduling-critical-addon-pods/
      priorityClassName: "system-node-critical"
      containers:
      - image: app-store-images.pku.edu.cn/nvidia/k8s-device-plugin:v0.15.0
        name: nvidia-device-plugin-ctr
        env:
          - name: FAIL_ON_INIT_ERROR
            value: "false"
        securityContext:
          allowPrivilegeEscalation: false
          capabilities:
            drop: ["ALL"]
        volumeMounts:
        - name: device-plugin
          mountPath: /var/lib/kubelet/device-plugins
      volumes:
      - name: device-plugin
        hostPath:
          path: /var/lib/kubelet/device-plugins
```

```Bash
# 给节点打标签
 kubectl label node $nodeName nvidia.com/gpu=true
```
