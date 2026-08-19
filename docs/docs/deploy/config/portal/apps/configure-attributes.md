---
sidebar_position: 4
title: 配置HTML表单
---

# 配置HTML表单

Web和VNC类应用都可以通过`attributes`配置项，修改创建应用的HTML表单，允许管理员定义用户创建交互式应用时的表单选项，让用户能够指定应用的版本等信息。

用户提交的内容会作为运行应用的计算节点的环境变量生效，web类应用可以在`script`项使用，VNC类应用可以在`xstartup`使用这些变量。

如果用户需要输入其他sbatch参数，可以在此项中配置，具体示例请参考[其他sbatch参数配置](#配置其他sbatch参数)。。

## 配置示例

### web类应用配置HTML表单示例

以[coder/code-server](https://github.com/coder/code-server)启动VSCode为例，为web类应用自定义HTML表单的配置文件如下：

```yaml title="config/apps/vscode.yml"
# 这个应用的ID
id: vscode

# 这个应用的名字
name: VSCode

# 指定应用类型为web
type: web

# Web应用的配置
web:

  # 指定反向代理类型
  proxyType: relative

  # 准备脚本
  beforeScript: |
    export PORT=$(get_port)
    export PASSWORD=$(get_password 12)

  # 运行任务的脚本。使用了用户在自定义表单中选择的选项
  script: |
    module load ${selectVersion}
    PASSWORD=$PASSWORD code-server -vvv --bind-addr 0.0.0.0:$PORT --auth password

  # 如何连接应用
  connect:
    method: POST
    path: /login
    formData:
      password: "{{ PASSWORD }}"

# 配置HTML表单，用户可以指定code-server版本      
attributes:
  - type: select
    name: selectVersion
    label: 选择版本
    required: true  # 用户必须选择一个版本
    placeholder: 选择code-server的版本  # 提示信息
    select:
      - value: code-server/4.8.0
        label: version 4.8.0
      - value: code-server/4.9.0
        label: version 4.9.0
```

如果用户选择的是`version 4.8.0`选项，`xstartup`中`module load ${selectVersion}`实际执行的是`module load code-server/4.8.0`。

### VNC类应用配置HTML表单示例

以Emacs为例，桌面类应用自定义HTML表单的配置文件如下：

```yaml title="config/apps/emacs.yml"
# 这个应用的ID
id: emacs

# 这个应用的名字
name: emacs

# 指定应用类型为vnc
type: vnc

# VNC应用的配置
vnc: 

  # 可以使用准备脚本来准备运行任务的环境
  # beforeScript:
  #   export VERSION=1.0
  
  # 此X Session的xstartup脚本。使用了用户在自定义表单中选择的选项
  xstartup: |
    module load ${selectVersion}
    emacs -mm

# 配置HTML表单，用户可以指定Emacs版本      
attributes:
  - type: select
    name: selectVersion
    label: 选择版本
    required: true  # 用户必须选择一个版本
    placeholder: 选择code-server的版本  # 提示信息
    select:
      - value: emacs/27.1
        label: Emacs 27.1 released
      - value: emacs/28.1
        label: Emacs 28.1 released

```

如果用户选择的是`Emacs 28.1 released`选项，`xstartup`中`module load ${selectVersion}`实际执行的是`module load emacs/28.1`。

## 配置解释

配置`attributes`可以加载多个HTML表单，每一条可用配置项如下：

| 属性         | 类型                           | 是否必填 | 解释                                                                        |
|------------|------------------------------|------|---------------------------------------------------------------------------|
| `type`     | `number`, `text`, `select`, `file`, `commandSelect` 或者 `password` | 是    | 在HTML表单元素中输入的内容的类型                                                        |
| `name`     | 字符串                          | 是    | HTML表单的name属性，在编程中使用，并且会作为计算节点环境变量名，可以在Web应用的`script`或者VNC应用的`xstartup`使用 |
| `label`    | 字符串 或 [i18n国际化类型](../../customization/custom-config-i18n.md)                          | 是    | HTML表单的label属性，输入框左侧显示的标签                                                 |
| `required` | 布尔类型                         | 否    | 如果设置为`true`，用户必须填写此项，如果为`false`，用户可以不填，默认为`true`。                        |
| `defaultValue` | 字符串或者数字               | 否    | 表单的默认值，`number`类型的默认值必须设置为数字。对于`select`类型的表单，如果没有配置`defaultValue`，则默认值为第一项                      |
| `placeholder`   | 字符串                        | 否    | 描述输入字段预期值的提示信息，提示用户此处的输入                                                  |
| `select`   | 选项的列表                        | 否    | 如果`type`是`select`，必须配置此项，指明具体的选项，具体配置办法见`select`示例                        |                      |
| `commandSelect` | 对象 | 否 | 如果`type`是`commandSelect`，必须配置此项。包含`script`属性，值为可执行脚本，该脚本的标准输出将被解析为下拉选项。 |
| `fixedValue`   | 固定值对象                   | 否    | 包含固定值的值`value`和是否在页面中隐藏`hidden`的配置。如果配置此项，则将覆盖`defaultValue`和`placeholder`的配置，表单元素值将为固定值。详细说明参见[配置fixedValue](#配置fixedvalue的html表单)。                     |                      |
| `file` | 文件输入配置 | 否 | 仅用于`type: file`，可限制用户只能选择文件或目录，并可在文件模式下限制扩展名。 |

### 配置输入类型为文本的HTML表单

配置一个输入内容是文本类型的表单，需要指定`type`为`text`, 示例如下：

```yaml
attributes:
  - type: text
    name: version
    label: 版本
```

如果用户输入了`v3.4.5`，计算节点的环境变量`version=v3.4.5`可以在应用启动时被读取。

配置一个不是必填项的表单，并且配置默认值：

```yaml
attributes:
  - type: text
    name: version
    label: 版本
    required: false
    defaultValue: v3.4.0
```

### 配置输入类型为数字的HTML表单

配置一个输入内容是数字类型的表单，需要指定`type`为`number`, 此时用户仅能输入数字，示例如下：

```yaml
attributes:
  - type: number
    name: size
    label: 数量
```

如果用户输入了345，计算节点的环境变量`size=345`可以在应用启动时被读取。

配置一个不是必填项的表单，并且配置默认值：
```yaml
attributes:
  - type: number
    name: size
    label: 数量
    required: false
    defaultValue: 123
```

### 配置输入为下拉选择器的HTML表单

配置一个输入内容是下拉选择器的表单，需要指定`type`为`select`,并且配置`select`项。`select`项需要配置`value`和`label`，作为用户可以选择的选项。
考虑到扩展性和其他特殊的用法，不对type为`select`的attribute值处理：转义空格、特殊字符（比如引号、$符号、&符号等），管理员配置attribute值时要注意这一点。

| 属性       | 类型                           | 是否必填 | 解释                             |
|----------|------------------------------|------|--------------------------------|
| `value`   | 字符串 | 是    | HTML表单选项的value属性，在编程中使用，并且会作为计算节点环境变量的值             |
| `label`   | 字符串 或 [i18n国际化类型](../../customization/custom-config-i18n.md)                          | 是    | HTML表单的label属性，选项中展示给用户的文本     |

示例如下：

```yaml
attributes:
  - type: select
    name: selectVersion
    label: 选择版本
    required: true
    select:
      - value: version10
        label: v10
      - value: version11
        label: v11
      - value: version12
        label: 
          i18n:
            default: v12
            zh_cn: 版本12
```

如果用户选择v11选项，计算节点的环境变量 `selectVersion=version11` 可以在应用启动时被读取。

### 配置动态下拉选择器的HTML表单

配置一个动态下拉选择器的表单，需要指定`type`为`commandSelect`, 并且配置`commandSelect`项。`commandSelect`项需要配置`script`，作为获取选项的脚本。

脚本的标准输出应该是一个 JSON 数组，每个元素包含 `label` 和 `value` 属性。`label` 可以是字符串或 i18n 对象。

示例如下：

```yaml
attributes:
  - type: commandSelect
    name: dynamicVersion
    label: 动态选择版本
    required: true
    commandSelect:
      script: |
        # 这是一个示例脚本，实际使用时可以是任何可执行命令
        # 输出必须是合法的 JSON 字符串
        echo '[{"label": "v1.0", "value": "1.0"}, {"label": {"i18n": {"default": "v2.0", "zh_cn": "版本2.0"}}, "value": "2.0"}]'
```

如果用户选择了 v1.0，计算节点的环境变量 `dynamicVersion=1.0` 可以在应用启动时被读取。

### 配置输入类型为文件/文件夹的HTML表单

配置一个输入内容是文件/文件夹的HTML表单，需要指定`type`为`file`，示例如下：

```yaml
attributes:
  - type: file
    name: fileDir
    label: 附加文件路径
    required: false
    defaultValue: /user/test/script.sh
```

上述配置为一个不必填的，默认值为`/user/test/script.sh`的文件类型的HTML表单配置示例。

如果配置了文件或文件夹的HTML表单类型，用户可以在页面通过文件选择器选择或填写来选择需要的文件的路径，但需注意需要填写的值为`绝对路径`。

如果用户输入了`/user/test/new-script.sh`，且用户具有该绝对路径的读权限，那么计算节点的环境变量`fileDir=/user/test/new-script.sh`可以在应用启动时被读取。

`file.selectionType`可以设置为`file`或`directory`。未配置`file`时，文件和目录均可选择。

仅允许选择目录：

```yaml
attributes:
  - type: file
    name: workingDirectory
    label: 工作目录
    file:
      selectionType: directory
```

仅允许选择文件，可通过`extensions`限制文件扩展名：

```yaml
attributes:
  - type: file
    name: scriptPath
    label: 启动脚本
    placeholder: 请选择 .sh 或 .tar.gz 文件
    file:
      selectionType: file
      extensions:
        - ".sh"
        - ".tar.gz"
```

`extensions`为可选配置；不配置时允许选择任意扩展名的文件。配置时必须是非空数组，且只能用于
`selectionType: file`。每项必须包含开头的`.`，匹配时仅忽略
ASCII 英文字母大小写，并支持`.tar.gz`等复合扩展名。配置扩展名后，文件选择器继续展示目录以供导航，
文件列表仅展示符合扩展名的文件, 建议当有限制extensions时增加placeholder提示。创建应用时服务端会再次校验实际路径类型和扩展名。

### 配置输入类型为密码的HTML表单

配置一个输入内容为密码类型的表单，需要指定`type`为`password`。密码输入框中的内容会被隐藏（显示为掩码），适用于需要用户输入敏感信息的场景，示例如下：

```yaml
attributes:
  - type: password
    name: userPassword
    label: 密码
    required: true
    placeholder: 请输入密码
```

如果用户输入了`my-secret`，计算节点的环境变量`userPassword=my-secret`可以在应用启动时被读取。

### 配置其他sbatch参数

`name`需要设置为`sbatchOptions`，指定`type`为`text`, 示例如下：

```yaml
attributes:
  - type: text
    name: sbatchOptions
    label: 其他sbatch参数
    required: false
    placeholder: "比如：--gpus gres:2 --time 10"
```

### 配置fixedValue的HTML表单

对`type`为`text`，`number`或`file`的HTML表单配置固定值，如果配置为固定值，则在页面中不可再修改。如果同时配置了`defaultValue`及`placeholder`等配置，则不再生效，只对配置项中的`fixedValue`的配置生效。

#### fixedValue配置解释

| 属性       | 类型                           | 是否必填  | 解释                                                                                                             |
|-----------|--------------------------------|----------|------------------------------------------------------------------------------------------------------------------|
| `value`   | 字符串         | 是    | 必须填写，且值不能为空字符串。HTML表单的`value`属性，在编程中使用，并且会作为计算节点环境变量的值。如果`type`为`number`时只能填入数字，如果`type`为`file`时需要填入绝对路径。    |
| `hidden`  | 布尔值         | 否    | 是否在页面中隐藏该HTML表单配置。如不配置默认为`false`，在页面中展示为固定值，值为上述`value`。如果配置为`true`，则只会使用`value`的值，但是页面中不再展示。   |
