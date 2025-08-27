## Untitled object in undefined Type

`object` ([Details](definition.md))

# Untitled object in undefined Properties

| Property                                            | Type     | Required | Nullable       | Defined by                                                                                                          |
| :-------------------------------------------------- | :------- | :------- | :------------- | :------------------------------------------------------------------------------------------------------------------ |
| [db](#db)                                           | `object` | Required | cannot be null | [Untitled schema](definition-properties-db.md "undefined#/properties/db")                                           |
| [authUrl](#authurl)                                 | `string` | Required | cannot be null | [Untitled schema](definition-properties-authurl.md "undefined#/properties/authUrl")                                 |
| [portalUrl](#portalurl)                             | `string` | Optional | cannot be null | [Untitled schema](definition-properties-portalurl.md "undefined#/properties/portalUrl")                             |
| [predefinedChargingTypes](#predefinedchargingtypes) | `array`  | Required | cannot be null | [Untitled schema](definition-properties-predefinedchargingtypes.md "undefined#/properties/predefinedChargingTypes") |
| [accountNamePattern](#accountnamepattern)           | `object` | Optional | cannot be null | [Untitled schema](definition-properties-accountnamepattern.md "undefined#/properties/accountNamePattern")           |
| [fetchJobs](#fetchjobs)                             | `object` | Required | cannot be null | [Untitled schema](definition-properties-fetchjobs.md "undefined#/properties/fetchJobs")                             |
| [jobChargeType](#jobchargetype)                     | `string` | Required | cannot be null | [Untitled schema](definition-properties-jobchargetype.md "undefined#/properties/jobChargeType")                     |
| [changeJobPriceType](#changejobpricetype)           | `string` | Required | cannot be null | [Untitled schema](definition-properties-changejobpricetype.md "undefined#/properties/changeJobPriceType")           |
| [quantumJobChargeType](#quantumjobchargetype)       | `string` | Required | cannot be null | [Untitled schema](definition-properties-quantumjobchargetype.md "undefined#/properties/quantumJobChargeType")       |
| [jobChargeComment](#jobchargecomment)               | `string` | Required | cannot be null | [Untitled schema](definition-properties-jobchargecomment.md "undefined#/properties/jobChargeComment")               |

## db



`db`

*   is required

*   Type: `object` ([Details](definition-properties-db.md))

*   cannot be null

*   defined in: [Untitled schema](definition-properties-db.md "undefined#/properties/db")

### db Type

`object` ([Details](definition-properties-db.md))

## authUrl

认证服务的地址。一定要加协议(http\://)

`authUrl`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [Untitled schema](definition-properties-authurl.md "undefined#/properties/authUrl")

### authUrl Type

`string`

### authUrl Default Value

The default value is:

```json
"http://auth:5000"
```

## portalUrl

如果部署了门户系统，设置门户系统的部署URL或者pathname

`portalUrl`

*   is optional

*   Type: `string`

*   cannot be null

*   defined in: [Untitled schema](definition-properties-portalurl.md "undefined#/properties/portalUrl")

### portalUrl Type

`string`

## predefinedChargingTypes

预定义的充值类型

`predefinedChargingTypes`

*   is required

*   Type: `string[]`

*   cannot be null

*   defined in: [Untitled schema](definition-properties-predefinedchargingtypes.md "undefined#/properties/predefinedChargingTypes")

### predefinedChargingTypes Type

`string[]`

### predefinedChargingTypes Default Value

The default value is:

```json
[]
```

## accountNamePattern



`accountNamePattern`

*   is optional

*   Type: `object` ([Details](definition-properties-accountnamepattern.md))

*   cannot be null

*   defined in: [Untitled schema](definition-properties-accountnamepattern.md "undefined#/properties/accountNamePattern")

### accountNamePattern Type

`object` ([Details](definition-properties-accountnamepattern.md))

## fetchJobs



`fetchJobs`

*   is required

*   Type: `object` ([Details](definition-properties-fetchjobs.md))

*   cannot be null

*   defined in: [Untitled schema](definition-properties-fetchjobs.md "undefined#/properties/fetchJobs")

### fetchJobs Type

`object` ([Details](definition-properties-fetchjobs.md))

## jobChargeType

对作业计费时，计费费用的付款类型

`jobChargeType`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [Untitled schema](definition-properties-jobchargetype.md "undefined#/properties/jobChargeType")

### jobChargeType Type

`string`

### jobChargeType Default Value

The default value is:

```json
"作业费用"
```

## changeJobPriceType

修改作业费用时所使用的付款/充值类型

`changeJobPriceType`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [Untitled schema](definition-properties-changejobpricetype.md "undefined#/properties/changeJobPriceType")

### changeJobPriceType Type

`string`

### changeJobPriceType Default Value

The default value is:

```json
"作业费用更改"
```

## quantumJobChargeType

对量子作业计费时，计费费用的付款类型

`quantumJobChargeType`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [Untitled schema](definition-properties-quantumjobchargetype.md "undefined#/properties/quantumJobChargeType")

### quantumJobChargeType Type

`string`

### quantumJobChargeType Default Value

The default value is:

```json
"量子作业费用"
```

## jobChargeComment

给作业扣费时，扣费项的备注。可以使用\{price\}使用作业信息中的字段。字段参考src/entities/JobInfo

`jobChargeComment`

*   is required

*   Type: `string`

*   cannot be null

*   defined in: [Untitled schema](definition-properties-jobchargecomment.md "undefined#/properties/jobChargeComment")

### jobChargeComment Type

`string`

### jobChargeComment Default Value

The default value is:

```json
"集群: {cluster}，作业ID：{idJob}"
```
