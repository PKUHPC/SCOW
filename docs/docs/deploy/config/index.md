---
sidebar_position: 1
title: 配置简介
---

# 配置简介

SCOW使用配置文件进行系统的配置。

SCOW的配置文件均使用`yaml`或者`JSON`格式，存放于`config`目录下。

项目在启动时将会检查配置文件是否符合格式，如果配置文件有错，则系统会直接报错。

您也可以使用[scow-cli](../install/scow-cli.md)的`check-config`子命令，在不运行系统的情况下检查配置文件格式。

```
> ./cli check-config 

ERROR: Error reading config file config/clusters/hpc01.yaml: data/slurm/loginNodes/0 must be string
WARN: mis.yaml userIdPattern is deprecated and will be removed in a future version. Use createUser.userIdPattern instead
```

## 数据库大小写规则

SCOW 默认部署使用 MySQL 8 数据库镜像。运行在 Linux 容器中且未自定义 MySQL 启动参数时，MySQL 的 [`lower_case_table_names`](https://dev.mysql.com/doc/refman/8.0/en/server-system-variables.html#sysvar_lower_case_table_names) 按官方默认值为 `0`，因此数据库名、表名等标识符区分大小写。该变量需要在 MySQL 初始化前配置，不能在已有数据目录初始化后再改为不同值。

SCOW 数据库表默认使用 `utf8mb4` 字符集，未显式指定大小写敏感的排序规则。按 MySQL 8 默认排序规则，`utf8mb4` 的默认 collation 为 [`utf8mb4_0900_ai_ci`](https://dev.mysql.com/doc/refman/8.0/en/charset-mysql.html)，其中 [`_ci`](https://dev.mysql.com/doc/refman/8.0/en/charset-collation-names.html) 表示比较大小写不敏感。

大小写不敏感只影响字符串比较、排序和唯一性判断，不会自动转换或丢失字段值的原始大小写。例如数据库中保存为 `UserA` 时，读取和展示仍是 `UserA`；但使用 `usera` 查询时通常也会匹配到它，存在唯一约束时 `UserA` 与 `usera` 会被视为同一个值。因此用户 ID、账户名、租户名、集群 ID 等业务标识不应依赖仅大小写不同来区分，建议统一使用小写命名。
