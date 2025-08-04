---
sidebar_position: 3
title: 配置 AI 适配器（beta）
---

# 配置 AI 适配器（beta）

本节介绍如何配置 **AI 适配器（beta）**。


## AI集群账户资源限制

有账户创建的作业申请大量的卡但是作业运行实际不需要这么多卡，会造成资源的浪费以及其他账户无法使用卡的情况。
造成这种现象的原因是目前系统缺少对“账户Gpu使用上限”的控制，因此需要新增「账户Gpu配额」能力，并在作业提交、排队、恢复阶段进行配额检查。

### 配置

```yaml title="config.yaml"
quota:
  gpu: 2
```

config.yaml中quota部分为gpu配额相关参数，gpu值默认为0，表示创建的账户默认没有配额限制。当修改为具体的数字比如改为2，表示创建的账户只有2块gpu卡配额，超过后提交的作业会排队。

### 设置

该功能更新前已有的账户默认是不限制gpu配额的。若想限制，可以使用命令行工具更新账户配额命令行使用教程：

```shell
# 使用./scow-ai-adapter show命令查看当前账号的配额
$ ./scow-ai-adapter show
+------------------+----------+
| 账户名           | GPU 配额 |
+------------------+----------+
| aitest           |        1 |
| a_05151733a      |        1 |
| a_admin          |        1 |
| a_admin1         |        0 |
| a_admin2         |        1 |
| a_delone         |        0 |
| a_lsj_test       |        0 |
| a_lylzh          |        1 |
| a_sun            |        0 |
| a_sunai          |        0 |
| a_sunx           |        2 |
| a_testpartitions |        0 |
| a_yj             |        0 |
| demo_admin1      |        0 |
| job_account      |        0 |
| temp             |        0 |
+------------------+----------+

# 使用./scow-ai-adapter update -a temp -q 1命令修改账号的配额
$ ./scow-ai-adapter update -a temp -q 1
[2025-07-22 16:25:54] [info] [update.go:31 scow-ai-adapter/cmd/app.init.func3] account temp GPU quota has been updated to 1

$ ./scow-ai-adapter show -a temp
+--------+----------+
| 账户名 | GPU 配额 |
+--------+----------+
| temp   |        1 |
+--------+----------+

# 使用./scow-ai-adapter update -a a_yj,a_sun -q 1命令批量修改账号的配额
$ ./scow-ai-adapter update -a a_yj,a_sun -q 1
[2025-07-22 16:27:48] [info] [update.go:31 scow-ai-adapter/cmd/app.init.func3] account a_yj,a_sun GPU quota has been updated to 1

$ ./scow-ai-adapter show -a a_yj,a_sun
+--------+----------+
| 账户名 | GPU 配额 |
+--------+----------+
| a_yj   |        1 |
| a_sun  |        1 |
+--------+----------+
```

