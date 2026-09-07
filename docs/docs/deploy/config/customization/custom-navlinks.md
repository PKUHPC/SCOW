---
sidebar_position: 4
title: 自定义导航链接
---

# 自定义导航链接

您可以增加门户和管理系统的导航链接，点击这些链接会跳转到您指定的URL。

SCOW会直接使用配置的链接地址，不会在页面URL中附加用户登录令牌。如外部系统需要识别当前用户，应使用独立的安全认证集成，不要通过URL查询参数传递SCOW bearer token。

## 门户系统中的配置

在门户系统中，您可以在`config/portal.yaml`文件中，根据备注修改所需要的配置。

```yaml title="config/portal.yaml"
# 新增导航链接相关配置
navLinks:
  # 链接名称
  - text: ""
    # 链接地址，一级导航链接地址为可选填，二级导航链接地址为必填
    url: ""
    # 是否打开新的页面，可选填，默认值为false
    # openInNewPage: true
    # 图标路径，可选填
    iconPath: ""
    # 二级导航,可选填
    children:
      # 二级导航相关配置，与一级导航相同，但是url为必填配置，同时不允许再设置children
      - text: ""
        url: ""
        iconPath: ""
```

## 管理系统中的配置

在管理系统中，您可以在`config/mis.yaml`文件中，根据备注修改所需要的配置。

```yaml title="config/mis.yaml"
# 新增导航链接相关配置
navLinks:
  # 链接名称
  - text: ""
    # 链接地址，一级导航链接地址为可选填，二级导航链接地址为必填
    url: ""
    # 是否打开新的页面，可选填，默认值为false
    # openInNewPage: true
    # 图标路径，可选填
    iconPath: ""
    # 可以看到这个链接的用户,可选填
    # 用户类型： user, accountUser, accountAdmin, accountOwner, tenantFinance, tenantAdmin, platformAdmin, platformFinance
    allowedRoles: []
    # 二级导航,可选填
    children:
      # 二级导航相关配置，与一级导航相同，但是url为必填配置，同时不允许再设置children
      - text: ""
        url: ""
        openInNewPage:
        iconPath: ""
        allowedRoles: []
```

## 配置示例

### 门户系统自定义导航链接配置示例

```yaml title="config/portal.yaml"
navLinks:
  - text: "一级导航1"
    iconPath: "/desktop.jpg"
    children:
      - text: "二级导航1"
        url: "https://hahahaha1.1.com"
        iconPath: "/PKU_seal.svg"
      - text: "二级导航2"
        url: "https://hahahaha1.2.com"
      - text: "二级导航3"
        url: "https://hahahaha1.3.com"
        iconPath: "/earth.png"
  - text: "一级导航2"
    url: "https://hahahaha2.com"
    children: []
    iconPath: "/earth.svg"
  - text: "一级导航3"
    url: "https://hahahaha3.com"
    openInNewPage: true
    iconPath: "/icon-test.png"
    children: []
```

门户系统用户可以阅览到的导航链接如下,绿色框线中的图标为系统默认导航链接图标。

![门户系统自定义导航链接配置示例](images/portal-custom-nav-links.png)

### 管理系统自定义导航链接配置示例

```yaml title="config/mis.yaml"
navLinks:
  - text: "一级导航1"
    iconPath: "/icon-test.png"
    children:
      - text: "二级导航1"
        url: "https://hahahaha1.1.com"
        iconPath: "/earth.svg"
        allowedRoles: [tenantFinance]
      - text: "二级导航2"
        url: "https://hahahaha1.2.com"
        allowedRoles: [tenantAdmin, platformAdmin]
  - text: "一级导航2"
    url: "https://hahahaha2.com"
    iconPath: "/earth.png"
  - text: "一级导航3"
    url: "https://hahahaha3.com"
    allowedRoles: [user]
```

当前登录用户的用户角色为`accountOwner`，`tenantAdmin`，`platformAdmin`时,他可以阅览到的导航链接如下,绿色框线中的图标为系统默认导航链接图标。

![管理系统自定义导航链接配置示例](images/mis-custom-nav-links.png)

## 配置解释

| 属性                       | 类型                 | 应用系统           | 是否必填    | 解释                                                                                     |
| ------------------------- | -------------------- | ------------------ | ---------- | ---------------------------------------------------------------------------------------- |
| `navLinks`                | /                    | /                 |/           |/                                                                                          |
| `text`                    | 字符串                | `portal`，`mis`    | 是         | 链接名称，SCOW导航栏上显示的名称                                                            |
| `url`                     | 字符串                | `portal`，`mis`    |  在二级导航中为必填    | 链接地址，自定义导航链接地址，一级导航链接地址为可选填，二级导航链接地址为必填。如没有配置一级导航的链接地址，点击该导航栏时将自动跳转至次级导航栏的第一项导航的链接地址。  |
| `openInNewPage`           | 布尔类型               | `portal`，`mis`    | 否         | 可以选填。如不设置，默认值为`false`，不打开新的页面。如果设置为`true`，则会在新的页面打开该导航链接。  |
| `iconPath`                     | 字符串           | `portal`，`mis`    | 否         | 图标路径，用户上传到[公共文件](./public-files.md)下的自定义导航链接图标路径。可选填，如未填写则显示系统默认导航链接图标。  |
| `allowedRoles`            |  用户角色字符串列表    | `mis`             |否           | 管理系统指定可以看到该导航链接的角色列表，用户角色类型包括  `user`, `accountUser`, `accountAdmin`, `accountOwner`, `tenantFinance`, `tenantAdmin`, `platformAdmin`, `platformFinance` （用户角色详解请看下方角色配置说明）。如果没有指定，则不再限定用户角色，即所有用户都可以看到该导航链接。  |
| `children`                |  导航内容的列表    | `portal`，`mis`   | 否          | 二级导航列表，内容包括该系统下一级导航的所有内容，除`url`以外，内容类型以及是否必填与一级导航内容完全相同，但是不允许再继续设置chilidren，不允许继续添加三级导航。如果没有指定，则没有可以显示的二级导航链接。    |

:::note

关于导航链接地址`url`的配置，与`HTML`标签的默认行为一致，以`http://`开头的`url`会自动被识别为外部路径。点击该导航栏时，会按照与`url`中填写的完全一致的路径进行跳转。

如果`url`中配置的链接地址是以`/`开头，或者没有以`http://`开头，则会被系统识别为内部路径。这时点击该导航栏跳转时，将根据已配置的[自定义相对路径](./basepath.md)自动添加相对路径前缀。

示例：

```yaml title="config/portal.yaml"
  navLinks:
  - text: "导航测试"
    children:
      - text: "子导航1"
        url: "http://www.navtest1.com"
      - text: "子导航2"
        url: "www.navtest2.com"
      - text: "子导航3"
        url: "/www.navtest3.com"
```

假设我们的系统部署在`https://scowtest.com`下,管理员配置的相对路径为`/scow`。

那么按照上述自定义导航配置示例，点击`导航测试`时，会按照次级导航的第一个链接`http://www.navtest1.com`进行跳转。与点击`子导航1`的跳转动作一致。

点击`子导航2`时，`url`会被识别为内部路径，将会拼接相对路径前缀和`/`，按照`https://scowtest.com/scow/www.navtest2.com`进行跳转。

点击`子导航3`时，`url`同样会被识别为内部路径，将会拼接相对路径前缀，按照`https://scowtest.com/scow/www.navtest3.com`进行跳转。

:::

### 自定义图标配置说明

系统支持自定义导航链接的灵活图标配置。

您可以通过把存放在和`install.yml`同级的`public`目录下图片文件的路径添加到`iconPath`来进行自定义图标配置。公共文件路径的使用详见[公共文件](./public-files.md)。

您所添加的图片文件后缀应为常用图片文件`.svg`，`.png`或者`.jpg`等。

如您将图片`icon.svg`上传到公共文件`public`目录下,则您在配置时需填写`iconPath:"/icon.svg"`。

`iconPath`可以选填，如不填写，则将统一显示系统默认导航链接图标。

### 角色配置说明

在管理系统中进行配置自定义导航链接功能时，您可以通过在`allowedRoles`属性中添加角色字符串来自由配置能够看到该导航链接的角色。
在当前的SCOW系统中，我们支持以下角色：

| 角色名称            | 解释                          |
| ------------------ | ----------------------------- |
| `user`             | 未加入账户的普通用户 |
| `accountUser`     | 在所有账户中均为普通用户      |
| `accountAdmin`     | 在某个账户中为账户管理员      |
| `accountOwner`     | 在某个账户中为账户主管理员     |
| `tenantAdmin`      | 在租户中的角色：租户管理员      |
| `tenantFinance`    | 在租户中的角色：租户财务人员    |
| `platformAdmin`    | 在平台中的角色：平台管理员      |
| `platformFinance`  | 在平台中的角色：平台财务人员     |

:::tip

如果您想更加详细的了解系统用户模型，请参考[用户模型](../../../info/mis/business/users.md)。

:::
