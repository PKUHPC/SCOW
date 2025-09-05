## loginDesktop Type

`object` ([Details](definition-properties-logindesktop.md))

# loginDesktop Properties

| Property                    | Type      | Required | Nullable       | Defined by                                                                                                                                  |
| :-------------------------- | :-------- | :------- | :------------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| [enabled](#enabled)         | `boolean` | Required | cannot be null | [Untitled schema](definition-properties-logindesktop-properties-enabled.md "undefined#/properties/loginDesktop/properties/enabled")         |
| [wms](#wms)                 | `array`   | Required | cannot be null | [Untitled schema](definition-properties-logindesktop-properties-wms.md "undefined#/properties/loginDesktop/properties/wms")                 |
| [maxDesktops](#maxdesktops) | `integer` | Required | cannot be null | [Untitled schema](definition-properties-logindesktop-properties-maxdesktops.md "undefined#/properties/loginDesktop/properties/maxDesktops") |

## enabled

是否启动登录节点上的桌面功能

`enabled`

*   is required

*   Type: `boolean`

*   cannot be null

*   defined in: [Untitled schema](definition-properties-logindesktop-properties-enabled.md "undefined#/properties/loginDesktop/properties/enabled")

### enabled Type

`boolean`

### enabled Default Value

The default value is:

```json
true
```

## wms



`wms`

*   is required

*   Type: `object[]` ([Details](definition-properties-logindesktop-properties-wms-items.md))

*   cannot be null

*   defined in: [Untitled schema](definition-properties-logindesktop-properties-wms.md "undefined#/properties/loginDesktop/properties/wms")

### wms Type

`object[]` ([Details](definition-properties-logindesktop-properties-wms-items.md))

### wms Default Value

The default value is:

```json
[
  {
    "name": "xfce",
    "wm": "xfce"
  }
]
```

## maxDesktops

最多创建多少个桌面

`maxDesktops`

*   is required

*   Type: `integer`

*   cannot be null

*   defined in: [Untitled schema](definition-properties-logindesktop-properties-maxdesktops.md "undefined#/properties/loginDesktop/properties/maxDesktops")

### maxDesktops Type

`integer`

### maxDesktops Default Value

The default value is:

```json
3
```