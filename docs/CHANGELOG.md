# @scow/docs

## 1.4.3

### Patch Changes

- 7c96613: 修改更名后的链接地址和文档描述

## 1.4.2

### Patch Changes

- eec12d8: UI 扩展增加导航栏链接自动刷新功能
- acb1992: UI 扩展页面支持修改标题
- 15a7bdd: UI 扩展返回的导航项允许指定 navs[].hideIfNotActive 属性

## 1.4.1

### Patch Changes

- 5159efd: UI 扩展导航栏链接修改 href 为 path，行为和导航项的 path 保持一致
- f14bf6c: UI 扩展增加导航栏链接自定义

## 1.4.0

### Minor Changes

- b8d1270: 在管理系统和门户系统中增加依赖于管理系统的集群停用功能
  **注意：停用后集群将不可用，集群所有数据不再更新。再启用后请手动同步平台数据！**

### Patch Changes

- 7285809: 添加 SCOW 部署与运维指引文档
- 383a8bd: 添加 web shell 文件上传功能

## 1.3.3

### Patch Changes

- 94aa24c: 支持同时配置多个 UI 扩展。UI 扩展的实现有破坏性变更，请参考文档。
- a737493: jupyter 启动命令参数 PasswordIdentityProvider.hashed_password 改为 ServerApp.password
- e312efb: ai 增加 vnc 功能，以 shell 方式进入容器功能和提交作业的优化
- 640a599: 支持填写多个 hook 地址

## 1.3.2

### Patch Changes

- abda3b2: 修改用户模型文档中账户状态及用户在账户中的状态描述的文字错误
- d822db7: ai 系统新增支持 k8s 集群的 containerd 运行时
- 7b9e0b6: 去掉 node-cron 表达式前秒的限制

## 1.3.1

### Patch Changes

- 2f7590a: 优化 AI 配置介绍的文档中部分格式与文字
- 48844dc: Web Shell 支持跳转到文件编辑页面

## 1.3.0

### Minor Changes

- d1c2e74: UI 扩展

### Patch Changes

- 2e69338: SCOW CLI 初始化配置文件分为简化版本和全版本

## 1.2.0

### Minor Changes

- ec06733f9f: 门户仪表盘删除之前的配置标题和文字，增加平台队列状态展示

### Patch Changes

- f03e821342: vagrant 部署方式优化,文档网站修改

## 1.1.2

### Patch Changes

- 969457662f: 修复 scow 存在的 web 安全漏洞

## 1.1.1

### Patch Changes

- 22441e3515: 添加管理员使用技巧博客，增加传输节点基础环境说明

## 1.1.0

### Minor Changes

- b7f01512eb: 实现了跨集群传输模块
- b33a2bd6bc: 在 ui.yaml 下的 footer 增加 hostnameMap，其作用与 hostnameTextMap 一致，根据不同 hostname 展示不同的 footer 文本

### Patch Changes

- 5a9bda6f4a: 对提交作业和应用的作业名，创建用户时的姓名、创建租户时租户名、充值时的类型、备注输入做长度控制，避免用户输入过长
- 01c54f2cbf: 将使用文档从文档网站移出
- d8a50f63ab: 登录界面 UI 新增根据不同域名展示不同内容
- 01c54f2cbf: 修改文档网站架构图和说明
- 95341b2a91: 在 README 中添加 SCOW 技术交流群二维码
- 75abd18806: 添加 v0.4.0 到 v1.0.0 升级说明文档
- ccbde14304: 实现 SCOW 门户系统与管理系统的页面国际化功能
- 24308f7d68: 修复 mis、portal 错误的文档，修复 cli 中 navLinks 错误的配置示例
- d8a50f63ab: 登录界面新增根据域名显示不同的背景颜色和背景图片
- f3537808a9: 修改 README 中二维码图片的相对路径地址

## 1.0.0

### Major Changes

- 11f94f716: 发布 1.0

### Minor Changes

- ee89b11b9: 新增审计系统服务，记录门户系统及管理系统操作日志及展示

### Patch Changes

- ae114aaec: 增加 SCOW API 中 audit-server 部分文档
- 3446787cf: relion、rstudio 和 vscode 等交互式应用示例文档更新

## 0.7.0

### Minor Changes

- 113e1e4ea: 在 auth 中添加了一个新的 capability 叫 checkPassword，用于检验密码。原先的修改密码 changePassword 不再需要旧密码
- b96e5c4b2: 支持在导航栏右侧的用户下拉菜单中增加自定义链接

### Patch Changes

- 31dc79055: 增加是否打开新的页面配置项，默认为 false,所有导航点击时不打开新的页面；修改一级导航 url 配置项为可选，没有配置时 则默认跳转次级第一个导航的 url
- 6f278a7b9: 门户系统桌面页面新增桌面信息，包括桌面名，桌面类型，创建时间。
- cb9b8708d: 修改自定义 favicon 文档中的错误信息
- bc7e40ca0: 修改文档网站架构图和说明
- defb92de7: 修改 vagrant 项目 faq 和多集群管理配置
- 72875e722: 新增 auth 登录界面可配置项
- 1407743ad: 增加提交作业的命令框中的提示语句可配置
- eabb00659: 修改 vagrant 集群说明，计费项未设置警告说明
- 9f70e2121: 门户系统去除默认集群选择功能，新增集群选择排序以及记录上次选择集群功能
- b2a52c546: 全新 SCOW 登录界面
- 01f244950: 增加用户密码正则配置的文档

## 0.6.0

### Minor Changes

- 5b7f0e88f: 重构 scow，对接调度器适配器接口
- 5c3c63657: 实现登录节点桌面功能以及 TurboVNC 的安装路径在每个集群中单独配置

### Patch Changes

- b6a02e4ae: 补充 vagrant 初始化部署的文档
- 6b6f08ac7: 修正文档部分交互式应用配置更新内的关联链接错误
- 1840515c3: 暴露 gateway 的环境变量 extra，可增加 nginx 的 server 配置
- e97eb22fd: 集群配置登录节点新增节点展示名
- 7a9973aa0: 修改 HTTP API 定义方式，去除生成 api-routes-schemas.json 步骤

## 0.5.0

### Minor Changes

- 548bce714: 支持 CLI 插件

### Patch Changes

- 0d9e3c051: 添加以下交互式应用示例配置：baltamatica、emacs、igv、jupyterlab、octave、rstudio、xfce
- 0f64e5404: 获取桌面和应用列表时，不再解析节点域名到 IP
- 4bfd80986: 认证系统增加管理用户账户关系相关 API
- 81895f4be: mis.yaml 和 portal.yaml 中支持增加导航链接

## 0.4.0

### Minor Changes

- 901ecdb7e: 支持使用外部页面创建用户

### Patch Changes

- f76b41a66: 增加通过 api-v{API 版本号}的 tag 获取某具体 SCOW API 的 proto 文件的方式
- b796fca16: 文档中配置部分提及`check-config` CLI 命令

## 0.3.0

### Minor Changes

- c2a8ab7a5: 删除认证系统验证用户姓名的 API，通过认证系统获取用户姓名和管理系统数据库实现
- bb9d9bb8b: 认证系统 GET /user API 增加返回用户姓名和邮箱
- 47b99ad80: CLI 使用 pino logger
- 215ac2fc7: 认证系统 GET /validateToken 改为 GET /public/validateToken
- 6d08aa823: 文档网站支持本地搜索
- 7bd2578c4: SCOW API 增加静态 token 认证方法
- ef8b7eee0: 增加 SCOW Hook
- 88899d41f: 提交任务增加默认输出文件
- 1562ebbd2: 提交作业时增加 GPU 选项

### Patch Changes

- c4138d75a: 丰富 scow-cli 文档，增加下载参考命令
- 943195451: 认证系统支持测试用户功能
- 9cb6822e6: 集群和应用配置文件可放在子文件夹中
- 42b4cd123: cli 支持设置 HTTP 代理
- 02b5f6e22: 用户自定义表单默认选择第一项
- 5411d4d64: cli 增加 check-config 命令，可检查 SCOW 配置文件格式
- cb90eb64b: 门户支持配置代理网关节点
- f52067437: 修复 cli 更新 release 版本

## 0.2.0

### Minor Changes

- 9a1d3b81b: 认证系统新建用户和组时支持删除预添加的属性
- 8145061ba: 增加 scow-cli
- d4b0cde25: 创建 web 类交互式应用时由前端传入 base path，将节点名解析为 IP 地址的工作由 portal-server 完成
- 22a5bc3c2: 支持 shell 中跳转文件系统

### Patch Changes

- 9a9159505: 增加集群网络连接要求
- 883521f26: 修复当部署的端口号非 80 时，回调地址出错的问题
- 06cd94230: 刷新 slurm 封锁状态和同步作业信息状态功能放到平台调试中

## 0.1.0

### Minor Changes

- dc9852988: 修改 ldap.searchBase 为必填
- 84fcc4bf3: 增加配置日志输出选项功能
- c2a1dff41: 自定义 footer 和 portal 的 dashboard 文本支持 HTML 标签
- 5e4f6ac58: 支持动态设置 base path
- a9b64169c: 更新 LOGO、favicon、仪表盘图片的自定义方式
- 401a21ebe: 限制登录系统可回调域名和增加相关配置

### Patch Changes

- 6814c3427: 交互式应用的自定义表单可以配置提示信息等
- 3eacac0db: 添加刷新 slurm 封锁状态文档
