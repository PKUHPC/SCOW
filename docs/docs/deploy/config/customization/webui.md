---
sidebar_position: 2
title: 自定义前端项目主题
---

# 自定义网页UI元素

系统中支持自定义一些网页中的UI元素。支持自定义UI元素的组件有：

## 自定义favicon

favicon文件应取名为`favicon.ico`，放到`config/icons`下。

系统支持根据不同的来访域名显示不同的LOGO。将需要在某个域名下显示的LOGO文件放到`config/logo/{域名}`下即可。`config/logo`下的文件为对所有其他域名的LOGO图片。

## 自定义导航栏LOGO

LOGO图片的文件名应为`logo`，后缀应为`svg`, `png`或者`jpg`，如果多个后缀名的文件同时存在，则顺序为`svg`, `png`, `jpg`。

有的图片在暗色主题下显示背景不佳，系统支持单独设置在**暗色模式下显示的图片**。在暗色模式下显示的图片的文件名应该为`logo.dark`，后缀名规则和上述规则相同。如果不存在暗色模式下的图片，则系统将显示正常模式下的图片。

将LOGO图片放入`config/logo`下即可。

系统支持根据不同的来访域名显示不同的LOGO。将需要在某个域名下显示的LOGO文件放到`config/logo/{域名}`下即可。`config/logo`下的文件为对所有其他域名的LOGO图片。

系统将导航栏LOGO的高度限制为40px。

## 自定义主题色和footer文本

系统支持根据不同的域名显示不同的主题色以及footer文本。

请创建文件`config/ui.yaml`，并根据以下配置说明编写自己的配置

```yaml title="config/ui.yaml"
# footer部分的配置。可以不填，当不配置时会展示默认页脚。
# 对portal-web、mis-web和auth的dashboard页面有效
# 注意：此配置对 v1.8.4 之后版本生效。此前版本配置 defaultText: "" 时展示默认页脚。
footer:
    # 对所有域名生效的footer文本，当配置defaultText为""时隐藏页脚
    # 文本支持HTML的标签，将会被放在一个div中
    defaultText: ""
    # 对某特定来访域名生效的footer文本，可以不填
    hostnameMap: 
        # 从a.com的访问显示footer文本为a.com的文本
        a.com: a.com的文本

# 主题色配置。可以不填
# 对portal-web、mis-web以及可读取SCOW主题色的第三方系统有效
primaryColor:
    # 对所有域名生效的主题色。默认为#9B0000
    defaultColor: string
    # 对所有域名在暗色模式下生效的主题色。默认等于defaultColor，可以不填
    darkModeColor: string
    # 对某特定来访域名生效的主题色，可以不填
    hostnameMap: 
        # 从a.com的访问的主题色为#000000
        a.com: #000000
```


## 来访的域名

系统使用`host` HTTP header判断来访的域名。如果您发现您设定的针对某个域名的图片没有显示，请检查系统收到的请求的`host` header的值是否正确。



