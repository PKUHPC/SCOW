---
sidebar_position: 8
title: 自定义可查询的消费类型
---

# 自定义可查询的消费类型

当管理员或财务人员在管理系统下查询消费列表时，系统支持按消费类型进行查询结果过滤。
当前管理系统下默认消费类型包括SCOW已配置的`jobChargeType`, `changeJobPriceType`, `quantumJobChargeType`及附加类型"其他"。

![管理系统默认可查询的消费类型示例](images/charge_types1.png)

如果您所部署的SCOW实现了[通过代码自定义收费规则](./custom-amount-strategies.md)或接入第三方使用了SCOW扣费系统的服务，那么可能您所使用的SCOW包含上述以外的消费类型。
这种情况管理员可以通过在`config/mis.yaml`下增加管理系统可选配置`customChargeTypes`来自定义可查询的消费类型。

配置：

```yaml title="config/mis.yaml"

# 自定义可查询的消费类型，可选填
# 填写格式为字符串列表
customChargeTypes: ["月租", "存储费"]

```

当管理员在config/mis.yaml下增加上述配置后，在消费列表中可查询的消费类型如下。
![管理系统自定义可查询的消费类型示例](images/charge_types2.png)
