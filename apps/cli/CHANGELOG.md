# @scow/cli

## 1.6.4

### Patch Changes

- 35f3b60: 增加新的 install.yaml 配置`sshDir`and`extraEnvs`
- 9ddad3b: cli update 命令切换 repo 名称和 cli 名称
- 7c96613: 修改更名后的链接地址和文档描述
- Updated dependencies [7c96613]
  - @scow/lib-config@1.0.2
  - @scow/config@1.5.3

## 1.6.3

### Patch Changes

- Updated dependencies [83df60b]
  - @scow/config@1.5.2

## 1.6.2

### Patch Changes

- Updated dependencies [0275a9e]
- Updated dependencies [753a996]
- Updated dependencies [1a096de]
- Updated dependencies [0eb668d]
  - @scow/config@1.5.1

## 1.6.1

## 1.6.0

### Minor Changes

- 806f778: 增加 HPC 文件和桌面功能的 scowd 支持
- b8d1270: 在管理系统和门户系统中增加依赖于管理系统的集群停用功能
  **注意：停用后集群将不可用，集群所有数据不再更新。再启用后请手动同步平台数据！**

### Patch Changes

- 5f14ce8: 修复更新 octokit 依赖后导致 cli 命令执行失败的问题
- Updated dependencies [b8d1270]
- Updated dependencies [806f778]
  - @scow/config@1.5.0

## 1.5.2

### Patch Changes

- Updated dependencies [d080a8b]
  - @scow/config@1.4.5

## 1.5.1

### Patch Changes

- e312efb: AI 模块支持创建 vnc 类型应用
- e312efb: ai 增加 vnc 功能，以 shell 方式进入容器功能和提交作业的优化
- Updated dependencies [94aa24c]
- Updated dependencies [e312efb]
- Updated dependencies [e312efb]
- Updated dependencies [640a599]
  - @scow/config@1.4.4

## 1.5.0

### Patch Changes

- 4a32bd7: 兼容旧版本自定义认证系统配置
- 7b9e0b6: 去掉 node-cron 表达式前秒的限制
- Updated dependencies [02d6a18]
- Updated dependencies [d822db7]
  - @scow/config@1.4.3

## 1.4.3

### Patch Changes

- Updated dependencies [3242957]
  - @scow/config@1.4.2

## 1.4.2

## 1.4.1

### Patch Changes

- 8d417ba: 增加配置项控制普通用户是否可以修改作业时限
- Updated dependencies [afc3350]
- Updated dependencies [8d417ba]
- Updated dependencies [68447f7]
  - @scow/lib-config@1.0.1
  - @scow/config@1.4.1

## 1.4.0

### Minor Changes

- cb055c4: 门户仪表盘新增快捷入口，可以新增、删除、拖拽排序快捷方式
- 9059919: 添加外部自定义认证系统
- abb7e84: 管理系统新增集群监控功能

### Patch Changes

- 2e69338: SCOW CLI 初始化配置文件分为简化版本和全版本
- b342df5: 修复 cli 由于 @sinclair/typebox 更新导致的编译问题
- Updated dependencies [d1c2e74]
- Updated dependencies [abb7e84]
  - @scow/config@1.4.0

## 1.3.0

### Minor Changes

- 2302a4639e: install.yaml 文件增加 mis.nodeOptions 参数，可传递给所有 node 服务参数，如“--max-old-space-size=8192”

### Patch Changes

- Updated dependencies [ec06733f9f]
  - @scow/config@1.3.0

## 1.2.3

### Patch Changes

- cad49a87d8: 修复 callbackUrl 固定为 http 的问题
- Updated dependencies [cad49a87d8]
  - @scow/config@1.2.1

## 1.2.2

### Patch Changes

- 969457662f: 修复 scow 存在的 web 安全漏洞

## 1.2.1

## 1.2.0

### Minor Changes

- 5d2b75ccec: 在 common.yml 中增加可选配置项 systemLanguage，指定的语言必须为系统当前合法语言["zh_cn", "en"]的枚举值，允许用户指定系统唯一语言不再进行语言切换，或允许用户指定进入 SCOW 时的默认语言
- f577d9d1e4: 门户系统文件管理新增文件编辑功能

### Patch Changes

- Updated dependencies [a3d2f44af6]
- Updated dependencies [5d2b75ccec]
- Updated dependencies [f577d9d1e4]
  - @scow/config@1.2.0

## 1.1.0

### Minor Changes

- b33a2bd6bc: 在 ui.yaml 下的 footer 增加 hostnameMap，其作用与 hostnameTextMap 一致，根据不同 hostname 展示不同的 footer 文本

### Patch Changes

- 5a9bda6f4a: 修改了示例配置文件，新的示例配置文件中默认配置了账户和用户的 ID 的格式，皆改为： 3-20 位数字、小写字母、下划线，以小写字母开头
- 24308f7d68: 修复 mis、portal 错误的文档，修复 cli 中 navLinks 错误的配置示例
- Updated dependencies [b33a2bd6bc]
- Updated dependencies [b7f01512eb]
- Updated dependencies [5bb922fe99]
- Updated dependencies [ccbde14304]
- Updated dependencies [50d34d6ae3]
- Updated dependencies [29e4b1880a]
- Updated dependencies [8fc4c21f07]
  - @scow/config@1.1.0

## 1.0.0

### Major Changes

- 11f94f716: 发布 1.0

### Minor Changes

- ee89b11b9: 新增审计系统服务，记录门户系统及管理系统操作日志及展示

### Patch Changes

- Updated dependencies [ee89b11b9]
- Updated dependencies [cb1e3500d]
- Updated dependencies [11f94f716]
  - @scow/config@1.0.0
  - @scow/lib-config@1.0.0

## 0.9.0

### Patch Changes

- 785a14bf5: 修复 auth logo 在修改系统相对路径后无法显示的问题
- Updated dependencies [67911fd92]
- Updated dependencies [b96e5c4b2]
- Updated dependencies [31dc79055]
- Updated dependencies [9f70e2121]
- Updated dependencies [6f278a7b9]
- Updated dependencies [1407743ad]
- Updated dependencies [f3dd67ecb]
  - @scow/config@0.5.0

## 0.8.1

## 0.8.0

### Minor Changes

- 5b7f0e88f: 重构 scow，对接调度器适配器接口
- f76716b00: cli 中移除用户可配置镜像地址，统一为：mirrors.pku.edu.cn/pkuhpc-icode/scow

### Patch Changes

- 1840515c3: 暴露 gateway 的环境变量 extra，可增加 nginx 的 server 配置
- e97eb22fd: 集群配置登录节点新增节点展示名
- 7a9973aa0: 修改 HTTP API 定义方式，去除生成 api-routes-schemas.json 步骤
- Updated dependencies [5b7f0e88f]
- Updated dependencies [62083044e]
- Updated dependencies [5c3c63657]
- Updated dependencies [e97eb22fd]
  - @scow/config@0.4.0

## 0.7.0

### Minor Changes

- 548bce714: 支持 CLI 插件

### Patch Changes

- bba446a18: 支持公共文件配置
- 4125d2ca0: 修复 CLI 初始化时，public/README.md 中文档不正确
- 81895f4be: mis.yaml 和 portal.yaml 中支持增加导航链接
- Updated dependencies [0f64e5404]
- Updated dependencies [81895f4be]
  - @scow/config@0.3.1

## 0.6.0

### Minor Changes

- 901ecdb7e: 支持使用外部页面创建用户

### Patch Changes

- Updated dependencies [901ecdb7e]
- Updated dependencies [d2c8e765e]
- Updated dependencies [ce077930a]
  - @scow/config@0.3.0
  - @scow/lib-config@0.2.2

## 0.5.0

### Minor Changes

- 47b99ad80: CLI 使用 pino logger
- 1562ebbd2: 提交作业时增加 GPU 选项

### Patch Changes

- 9a2ddbdd9: 当配置了 fluentd 日志，在执行 compose 命令或者生成 compose 配置时创建 log 目录并修改权限
- 943195451: 认证系统支持测试用户功能
- 7c4c857f5: 修改 init 出错
- 42b4cd123: cli 支持设置 HTTP 代理
- 695e5d590: install.yaml 支持配置网关服务器超时时间
- bbdf9390d: 修复系统 base path 和门户 base path 均为/时，管理系统不显示到门户的链接
- 1abd64a75: CLI 自定义认证系统环境变量配置允许字典形式
- 5411d4d64: cli 增加 check-config 命令，可检查 SCOW 配置文件格式
- cb90eb64b: 门户支持配置代理网关节点
- 8b10d20f1: 初始化时增加 fluent 配置文件
- f52067437: 修复 cli 更新 release 版本
- Updated dependencies [7bd2578c4]
- Updated dependencies [ef8b7eee0]
- Updated dependencies [9cb6822e6]
- Updated dependencies [74d718ba1]
- Updated dependencies [d6e06e841]
- Updated dependencies [cb90eb64b]
  - @scow/config@0.2.0
  - @scow/lib-config@0.2.1

## 0.4.0

### Minor Changes

- 8145061ba: 增加 scow-cli

### Patch Changes

- Updated dependencies [8145061ba]
  - @scow/lib-config@0.2.0
