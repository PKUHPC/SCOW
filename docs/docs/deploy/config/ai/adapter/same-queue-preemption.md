---
sidebar_position: 4
title: 开启同队列任务抢占
---

# 开启同队列任务抢占

## 需求

```Plain Text
k8s 最低版本为 1.24，需要依赖于k8s的 priorityClass 的 preemptionPolicy 
只支持nvidia的卡，不支持ascend
```

## 修改配置

```YAML
# 修改volcano scheduler 的 configmap， 去掉enqueue，增加preempt，因为enqueue与preempt有冲突，导致抢占功能不生效
kubectl edit cm -n volcano-system volcano-scheduler-configmap 

# Source: volcano/templates/scheduler.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: volcano-scheduler-configmap
  namespace: volcano-system
data:
  volcano-scheduler.conf: |
    actions: "allocate,backfill,preempt"  
    tiers:
    - plugins:
      - name: priority
      - name: gang
        enablePreemptable: false
      - name: conformance
    - plugins:
      #- name: overcommit
      - name: drf
        enablePreemptable: false
      - name: deviceshare
        arguments:
          deviceshare.VGPUEnable: true
      - name: predicates
        #- name: proportion
      - name: nodeorder
      - name: binpack
  
# 执行kubectl 命令重启deploy 服务 
 kubectl rollout restart deployment -n volcano-system volcano-scheduler 
# 查看pod是否重启成功 
 kubectl get pod -n volcano-system    
```

## 重启适配器

```Bash
适配器代码会自动检测volcano scheduler 的 configmap内容，匹配到preempt 之后，
自动创建可抢占的priorityClass
# 查看优先级是否支持抢占 
# kubectl get priorityClass low -o yaml 
apiVersion: scheduling.k8s.io/v1
description: low priority job
kind: PriorityClass
metadata:
  creationTimestamp: "2025-12-18T07:30:49Z"
  generation: 1
  name: low
  resourceVersion: "86914894"
  uid: 3900474d-d860-4ee4-9215-67cf746ac887
preemptionPolicy: PreemptLowerPriority 
value: 200
```


