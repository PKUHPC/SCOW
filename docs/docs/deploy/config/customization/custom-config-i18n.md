---
sidebar_position: 10
title: 自定义可配置项的国际化文本
---

# 自定义可配置项的国际化文本

在SCOW的页面国际化功能中，系统支持管理员自定义配置各配置文件中的文本显示为国际化显示。
当用户切换系统语言时，如果配置文件中的文本已经被自定义配置为国际化类型的文本，那么相应的配置文本也可以随着系统语言的切换而变换。
目前SCOW默认支持的国际化语言暂为简体中文与英文。

## 配置示例

系统兼容上一版本的文本配置的**string类型**，同时支持可以随着语言切换而变换的**i18n国际化类型**。
下方是在`auth.yaml`中配置首页标题信息文本的国际化配置示例。

```yaml title="config/auth.yaml"

slogan:

  # 默认文本，类型要求为string，如配置为此字符串类型的文本，那么切换语言时不随着语言的切换而变换
  # title: "开源算力中心门户和管理平台"
  
  # 默认文本，国际化I18n类型
  title:
    i18n：
      # 默认显示文本，如果是i18n类型则必填，类型要求为string
      # 如果没有配置系统可支持的对应文本，如没有配置下方的en或zh_cn，则切换相应的语言时展示default中配置的文本信息
      default: "开源算力中心门户和管理平台"
      # 英文文本，可选填，类型要求为string。切换语言为英文时显示配置的英文文本信息
      en: "Open-source Compute Center Portal and Management Platform"
      # 简体中文文本，可选填，类型要求为string。切换语言为简体中文时显示配置的简体中文文本信息
      zh_cn: "开源算力中心门户和管理平台"

```

如果管理员按上述配置示例中的i18n类型配置了auth系统的标题信息。那么当用户进入SCOW的登录页面时，语言为简体中文时用户可以看到的标题显示为：
![登录页面中文标题](images/auth-title-zhcn.png)
当用户进入系统后通过右上角语言切换器切换当前显示语言为英文时，用户可以看到的标题显示为：
![登录页面英文标题](images/auth-title-en.png)

## 支持国际化文本切换的配置项

随着SCOW性能的优化与功能的增加，在未来我们可能会增加更多的可自定义国际化文本配置的配置项。
当前SCOW已经支持的可配置国际化类型的文本包含以下配置文件中的文本。

| 配置文件              | 可以配置国际化文本类型的配置项                              |
| -------------------- | --------------------------------------------------------- |
| `common.yaml`        | `passwordPattern：`**errorMessage**                       |
| `auth.yaml`          | `slogan`：**title**                                       |
| `auth.yaml`          | `slogan：`**texts**                                       |
| `clusterTexts.yaml`  | `default：`**clusterComment**                             |
| `clusterTexts.yaml`  | `default：extra:` **title**                               |
| `clusterTexts.yaml`  | `default：extra:` **comment**                             |
| `clusterTexts.yaml`  | `tenant_1:` **clusterComment**                            |
| `mis.yaml`           | `accountNamePattern:` **errorMessage**                    |
| `mis.yaml`           | `createUser：userIdPattern:` **errorMessage**             |
| `portal.yaml`        | **submitJobPromptText**                                   |
| `{cluster}.yaml`     | **displayName**                                           |
| `{cluster}.yaml`     | `loginNodes:` **name**                                    |
| `{cluster}.yaml`     | **description**                                           |
| `{app}.yaml`         | `attributes:` **label**                                    |
| `{app}.yaml`         | `attributes:` **placeholder**                              |
| `{app}.yaml`         | `attributes: select:`  **label**                           |
| `{app}.yaml`         | `attributes: select:`  **placeholder**                     |
| `{app}.yaml`         | **appComment**                     |
