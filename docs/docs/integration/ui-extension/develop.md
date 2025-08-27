---
sidebar_position: 2
title: 开发UI扩展
---

# 开发UI扩展

要使用UI扩展，您首先需要开发并构建一个从外界可以访问的网站（称为**扩展站**）。您可以使用任何技术开发、维护和部署此网站，只需要满足您的用户可以通过直接公网访问即可。

## 上下文参数

SCOW会在访问扩展页和调用某些配置接口时，将以下参数作为查询字符串（querystring）加入访问的URL，UI扩展可以通过这些参数获取当前SCOW系统的信息。具体哪些页面/API会传递这些参数会在具体章节里提到。

| 参数            | 取值                  | 解释                                                          |
| --------------- | --------------------- | ------------------------------------------------------------- |
| `scowDark`      | `"true" \| "false"`   | 当前SCOW是否以黑暗主题显示                                    |
| `scowUserToken` | `string \| undefined` | 当前SCOW的登录用户的token。可通过SCOW认证系统接口查询登录用户 |
| `scowLangId`    | `string`              | 当前SCOW显示所使用的语言ID                                    |

## 扩展页

UI扩展的功能应实现为标准的网页。当访问SCOW的扩展路径时，SCOW将会在外层显示SCOW的基础导航结构，并在页面主要部分使用一个`<iframe>`组件将扩展页的内容显示出来。[上下文参数](#上下文参数)中的参数也将会传递给`<iframe>`。

若只设置了一个UI扩展，当用户访问SCOW部署路径的`/extensions/*`的路径时，`<iframe>`将会显示UI扩展`/extensions/*`下的内容。

若设置了多个UI扩展，当用户访问SCOW部署路径的`/extensions/{name}/*`的路径时，`<iframe>`将会显示`{name}`部分对应的UI扩展的`/extensions/*`下的内容。

例如，假设SCOW部署于`https://myscow.com/scow`，您的扩展站1部署于`https://myscowext1.com/ext1`，扩展站2部署于`https://myscowext2.com/ext2`。

- 若用户在配置中使用单个UI扩展配置语法时，当用户访问`https://myscow/scow/extensions/parent/child?test=123`时，SCOW将会显示一个iframe，其URL为`https://myscowext1.com/ext1/extensions/parent/child?test=123&scowDark={当前SCOW是否以黑暗模式显示}&scowUserToken={用户token}&scowLangId={当前SCOW显示语言ID}`。
- 若用户在配置中使用多个UI扩展配置语法，但是只配置了扩展站1时，起名称为`extname1`，当用户访问`https://myscow/scow/extensions/extname1/parent/child?test=123`时，SCOW将会显示一个iframe，其URL为`https://myscowext1.com/ext1/extensions/parent/child?test=123&scowDark={当前SCOW是否以黑暗模式显示}&scowUserToken={用户token}&scowLangId={当前SCOW显示语言ID}`。
- 若用户在配置中使用多个UI扩展配置语法，配置了扩展站1和2，名称分别为`extname1`和`extname2`，当用户访问`https://myscow/scow/extensions/extname1/parent/child?test=123`时，SCOW将会显示一个iframe，其URL为`https://myscowext1.com/ext1/extensions/parent/child?test=123&scowDark={当前SCOW是否以黑暗模式显示}&scowUserToken={用户token}&scowLangId={当前SCOW显示语言ID}`。

## 配置接口

除此之外，UI扩展站需要实现以下的配置接口。SCOW会在需要的使用调用以下接口获取响应配置。所有配置接口以`/api`开头。

#### 获取清单：GET /api/manifests

获取UI扩展配置清单。SCOW通过此接口获取您的UI扩展的一些配置参数。

对于此接口，您需要返回如下类型的JSON内容：

| JSON属性路径                                | 类型           | 是否必须 | 解释                                                   |
| ------------------------------------------- | -------------- | -------- | ------------------------------------------------------ |
| `portal`                                    | 对象           | 否       | 关于门户系统的配置                                     |
| `portal.rewriteNavigations`                 | 布尔值         | 否       | 是否重写门户系统的导航项。默认为`false`                |
| `portal.navbarLinks`                        | 布尔值或者对象 | 否       | 是否在门户系统中增加导航栏右侧的链接。默认为`false`    |
| `portal.navbarLinks.enabled`                | 布尔值         | 否       | 是否在管理系统中增加导航栏右侧的链接。默认为`false`    |
| `portal.navbarLinks.autoRefresh`            | 对象           | 否       | 是否定时自动刷新导航栏右侧的链接。不设置为不定时刷新。 |
| `portal.navbarLinks.autoRefresh.enabled`    | 布尔值         | 否       | 是否定时自动刷新导航栏右侧的链接。默认为`false`        |
| `portal.navbarLinks.autoRefresh.intervalMs` | 数字           | 否       | 定时刷新导航栏右侧的链接的间隔，单位`ms`               |

将路径中的`portal`改为`mis`即设置管理系统的配置，门户系统和管理系统的配置完全一致。

例如，您可以返回如下类型的JSON，表示在门户系统中重写导航项并增加导航栏右侧的链接，在管理系统中不重写管理系统的导航项，增加导航栏右侧的链接，并且开启自动刷新，每5s自动刷新一次。

```json
{
  "portal": {
    "rewriteNavigations": true,
    "navbarLinks": true
  },
  "mis": {
    "rewriteNavigations": false,
    "navbarLinks": {
      "enabled": true,
      "autoRefresh": {
        "enabled": true,
        "intervalMs": 5000,
      }
    }
  }
}
```

### 重写导航项：POST /api/\{portal,mis\}/rewriteNavigations



重写门户(portal)或者管理系统(mis)的导航项。若您在`GET /api/manifests`中返回的`{portal/mis}.rewriteNavigations`为`true`，则必须实现对应的接口。

SCOW将会在body中传入默认情况下SCOW将会显示的导航项。下表为传入的JSON参数的属性。除此表之外，[上下文参数](#上下文参数)同样也会被作为查询字符串传入。

| JSON属性路径             | 类型                                   | 是否必须 | 解释                                                                                           |
| ------------------------ | -------------------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| `navs`                   | 对象数组                               | 是       | 导航项                                                                                         |
| `navs[].path`            | 字符串                                 | 是       | 此导航项的路径。此路径不包括base path。若当前浏览器的pathname以此开头，则此导航项将会高亮      |
| `navs[].clickToPath`     | 字符串                                 | 否       | 点击此导航项将会导航至的路径。如果不填，则使用`path`属性                                       |
| `navs[].text`            | 字符串                                 | 是       | 导航项的文本                                                                                   |
| `navs[].openInNewPage`   | 布尔值                                 | 是       | 此导航项的页面是否在新窗口中打开                                                               |
| `navs[].hideIfNotActive` | 布尔值                                 | 否       | 如果设置为`true`，那么这个导航项以及它的子项只会当当前`path`处于这个导航项的`path`下才会出现。 |
| `navs[].children`        | 对象数组，类型与`navs`数组的每一项相同 | 否       | 此导航项的子项。                                                                               |

您需要返回以下类型的JSON，表示重写后的导航项。您可以重写系统默认导航项的属性。

| JSON属性路径             | 类型                                   | 是否必须 | 解释                                                                                                                                                                                       |
| ------------------------ | -------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `navs`                   | 对象数组                               | 是       | 导航项                                                                                                                                                                                     |
| `navs[].path`            | 字符串                                 | 是       | 此导航项的路径，请参考表格下**关于返回的路径的说明**。                                                                                                                                   |
| `navs[].clickToPath`     | 字符串                                 | 否       | 点击此导航项将会导航至的路径，规则同上。如果不填，则使用`path`属性                                                                                                                         |
| `navs[].text`            | 字符串                                 | 是       | 导航项的文本                                                                                                                                                                               |
| `navs[].icon`            | 对象                                   | 否       | 导航项的图标信息。如果不填，将显示默认导航项中具有相同的path的导航项的图标。如果不存在具有相同path的导航项，将显示[Ant Design Icon](https://ant.design/components/icon-cn)的`LinkOutlined` |
| `navs[].icon.src`        | 图标URL                                | 是       | 导航项的图标地址。必须是完整的、可公开访问的URL                                                                                                                                            |
| `navs[].icon.alt`        | 文本                                   | 否       | 导航项的图标alt属性。可不填                                                                                                                                                                |
| `navs[].openInNewPage`   | 布尔值                                 | 否       | 此导航项的页面是否在新窗口中打开，默认`false`                                                                                                                                              |
| `navs[].hideIfNotActive` | 布尔值                                 | 否       | 如果设置为`true`，那么这个导航项以及它的子项只会当当前`path`处于这个导航项的`path`下才会出现。                                                                                             |
| `navs[].children`        | 对象数组，类型与`navs`数组的每一项相同 | 否       | 此导航项的子项。                                                                                                                                                                           |

#### 关于返回的路径的说明

- 如果
  - 返回的路径和传入参数的某项的`path`或者`clickToPath`相同，或者
  - 此路径是一个有效的URL
    - 检查方法：使用`new URL(输入)`，若不抛出异常则为有效的URL
- 则
  - 这个路径将会保留原状，直接写入为`<a>`标签的`href`属性
- 否则
  - 此路径为相当于扩展UI的`/extensions`下的路径，即
    - 当系统采用单个UI扩展配置语法时，对应的导航项的路径为：`{SCOW URL}/extensions/{path}` 
    - 当系统采用多个个UI扩展配置语法时，对应的导航项的路径为：`{SCOW URL}/extensions/{name}/{path}` 
- 若当前浏览器的pathname以此开头，则此导航项将会高亮

#### 多个UI扩展

如果配置了多个UI扩展，那么SCOW将会按照配置中的顺序依次调用每个需要重写导航项的UI扩展的此接口，并将上一个UI扩展的输出作为下一个UI扩展的输入，并将最终结果作为SCOW的导航项。

### 增加导航栏链接：POST /api/\{portal,mis\}/navbarLinks

:::note

在1.6.2版本中可用。

:::

在门户(portal)或者管理系统(mis)导航栏右侧上部显示其他链接。若您在`GET /api/manifests`中返回的`{portal/mis}.navbarLinks`为`true`，则必须实现对应的接口。

SCOW在调用接口时，会将[上下文参数](#上下文参数)作为查询字符串传入。

您需要返回以下类型的JSON，表示需要增加的导航栏的链接。

| JSON属性路径                  | 类型     | 是否必须 | 解释                                                                                                       |
| ----------------------------- | -------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| `navbarLinks`                 | 对象数组 | 是       | 导航项                                                                                                     |
| `navbarLinks[].path`          | 字符串   | 是       | 此导航项的路径，请参考下文**关于返回的路径的说明**                                                       |
| `navbarLinks[].text`          | 字符串   | 是       | 导航项的文本                                                                                               |
| `navbarLinks[].icon`          | 对象     | 否       | 导航项的图标信息。如果不填，将显示[Ant Design Icon](https://ant.design/components/icon-cn)的`LinkOutlined` |
| `navbarLinks[].icon.src`      | 图标URL  | 是       | 导航项的图标地址。必须是完整的、可公开访问的URL                                                            |
| `navbarLinks[].icon.alt`      | 文本     | 否       | 导航项的图标alt属性。可不填                                                                                |
| `navbarLinks[].openInNewPage` | 布尔值   | 否       | 此导航项的页面是否在新窗口中打开，默认`true`                                                               |
| `navbarLinks[].priority`      | 数字     | 是       | 此链接的优先级。默认为0.                                                                                   |

#### 关于返回的路径的说明

- 如果返回的路径是一个有效的URL
  - 检查方法：使用`new URL(输入)`，若不抛出异常则为有效的URL
- 则
  - 这个路径将会保留原状，直接写入为`<a>`标签的`href`属性
- 否则
  - 此路径为相当于扩展UI的`/extensions`下的路径，即
    - 当系统采用单个UI扩展配置语法时，对应的导航项的路径为：`{SCOW URL}/extensions/{path}` 
    - 当系统采用多个个UI扩展配置语法时，对应的导航项的路径为：`{SCOW URL}/extensions/{name}/{path}` 

#### 多个UI扩展

如果配置了多个UI扩展，那么SCOW将会按照配置中的顺序依次调用每个需要增加导航栏链接的UI扩展的此接口，并将获得的所有链接按以下规则**从左到右**排列：

- 优先级(`priority`)属性从大到小
- 当优先级相同时，依照获取此链接的顺序，也即
  - 返回链接的UI扩展在配置中的顺序从前往后
  - 同一个UI扩展返回的链接在响应中的列表的顺序从前往后

#### 其他注意事项

- 当右上角导航栏链接数量**大于等于5个**，或者屏幕宽度小于**768px**时，所有导航栏链接将会仅显示图标。
- 如果您开启了导航栏链接自动刷新功能，并希望每次都重新加载图标，请确保每次返回的图标的链接要有变化，否则浏览器缓存将不会重新刷新图标。

## 扩展消息

UI扩展可以通过**消息**（`postMessage()`, [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)）与SCOW交互。下列为SCOW支持的所有类型的消息以及使用场景介绍。

### `scow.extensionPageHeightChanged`: 控制扩展页面的高度

您的扩展页面将会通过一个`iframe`组件嵌入到SCOW的页面中。由于浏览器的限制，SCOW无法自动根据您网页的高度调整SCOW页面承载您的页面的高度，在默认情况下，您的页面在SCOW中会出现滚动条，影响用户体验。

为了解决这个问题，您需要在您的页面高度变化时，将您的页面的高度报告给SCOW。

具体来说，当SCOW接手到由`iframe`发出的如下格式的消息时，SCOW将会修改`iframe`组件的高度为`payload.height`的值，单位为px。

```json
{
  "type": "scow.extensionPageHeightChanged",
  "payload": {
    "height": 20, // 您的页面高度，单位为px
  }
}
```

如果您的扩展页面为React实现，您可以在您页面的根布局中增加以下代码。此代码使用[ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver)监控`html`组件的高度，并在`html`组件高度变化的时候，给父组件发送消息。

```tsx
const useReportHeightToScow = () => {

  useEffect(()=>{
    // postIframeMessage();
    const sendMessage = (height: number) => {
      window.parent?.postMessage({
        type: "scow.extensionPageHeightChanged",  // 发送信息的类型，不允许更改
        payload: {
          height: height
        }
      }, '*')
    }

    const observer = new ResizeObserver((entries) => {

      const e = entries[0];
      sendMessage(e.contentRect.height);
    });

    const htmlElement = document.querySelector("html")!;

    sendMessage(htmlElement.getBoundingClientRect().height);

    observer.observe(htmlElement);

    return () => {
      observer.disconnect();
    }

  }, []);
}

export const RootLayout = () => {
  // 使用此Hook
  useReportHeightToScow();

  // ...
}
```

您可以参考此PR[PKUHPC/scow-ui-extension-demo#2](https://github.com/PKUHPC/scow-ui-extension-demo/pull/2)实现。

### `scow.extensionPageTitleChanged`: 修改扩展页面标题

您可以向SCOW发送以下格式的消息以修改扩展页面的标题。最终标题为`${payload.title} - scow`

```json
{
  "type": "scow.extensionPageTitleChanged",
  "payload": {
    "title": "新的标题"
  }
}
```

UI扩展实现参考： https://github.com/PKUHPC/scow-ui-extension-demo/commit/cf20685085889422818055513b238d31b815dc79

### `scow.logout`: 通知用户登出

当token过期时，您可以向SCOW发送以下格式的消息，使用户登出。

```json
{
  "type": "scow.logout",
  "payload": {}
}
```
## 其他注意事项

- UI扩展示例项目：[PKUHPC/scow-ui-extension-demo](https://github.com/PKUHPC/scow-ui-extension-demo)
- 如果您的扩展站和SCOW部署地址非同源，请注意使得您的扩展站的所有路径均支持CORS访问。
    - Next.js项目可以参考[示例项目中的`src/middleware.ts`](https://github.com/PKUHPC/scow-ui-extension-demo/blob/main/src/middleware.ts)
