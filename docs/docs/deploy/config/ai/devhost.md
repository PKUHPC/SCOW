# 开发机功能介绍和配置

## 功能介绍

开发机（Dev Host）是 SCOW AI 系统提供的云端开发环境功能，允许用户在 Kubernetes 集群中创建和管理个人开发环境。开发机提供了两种主要的开发工具：

### VSCode 开发环境

开发机集成了 Visual Studio Code 服务器版本，为用户提供完整的代码编辑和开发体验：

### JupyterLab 开发环境

JupyterLab 为数据科学和机器学习开发提供了强大的交互式开发环境：

## 配置说明

开发机功能通过 `config/clusters` 目录下的集群配置文件中对 `devHost` 配置项进行配置。

### 配置结构

```yaml
ai:
  enabled: true
  # 开发机相关配置，可选
  devHost:
    # 是否开启，默认为 false，可选
    enabled: false
    # vscode 相关配置，必填
    vscodeInfo:
      # vscode 二进制路径
      binPath: "/nfs/public/vscode/code-server-4.96.2-linux-amd64/bin/code-server"
    # 最大运行时间，可选，不填写表示不限制运行时间
    maxRunningTimeHours: 10
```

### 配置项详解

#### vscodeInfo

VSCode 开发环境的配置信息：

- **binPath** (必填)
  - 类型：字符串
  - 描述：VSCode 服务器二进制文件的路径
  - 示例：`"/usr/local/bin/code-server"`
  - **注意**：确保该路径指向的 VSCode 服务器二进制文件在容器镜像中存在且可执行，一般填写为公共挂载目录下的 vscode 二进制文件路径

#### maxRunningTimeHours

- 类型：数字（可选）
- 描述：开发机最大运行时间，单位为小时
- 作用：超过此时间则不能成功创建开发机
- 默认：不填写表示不限制运行时间
- 示例：`24` 表示最大运行 24 小时
- **注意**：合理设置此值可以避免资源浪费，建议根据实际使用需求设置
