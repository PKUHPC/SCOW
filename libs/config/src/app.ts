import { GetConfigFn, getDirConfig } from "@scow/lib-config";
import { Static, Type } from "@sinclair/typebox";
import { isAbsolute } from "path";
import { DEFAULT_CONFIG_BASE_PATH } from "src/constants";
import { createI18nStringSchema } from "src/i18n";


export const AppConnectPropsSchema = Type.Object({
  method: Type.Enum({ GET: "GET", POST: "POST" }, { description: "连接所使用的HTTP方法" }),
  path: Type.String({ description: "启动的相对路径" }),
  query: Type.Optional(Type.Record(Type.String(), Type.String(), { description: "query参数" })),
  formData: Type.Optional(
    Type.Record(Type.String(), Type.String(), { description: "设置为POST时，需要以form data形式提交的数据" })),
}, { description: "如何连接应用" });

export type AppConnectPropsSchema = Static<typeof AppConnectPropsSchema>;

export enum AppType {
  web = "web",
  vnc = "vnc",
  shadowDesk = "shadowDesk",
}

export enum ReservedAppAttributeName {
  appJobName = "appJobName",
  account = "account",
  partition = "partition",
  qos = "qos",
  nodeCount = "nodeCount",
  coreCount = "coreCount",
  gpuCount = "gpuCount",
  maxTime = "maxTime",
}

export enum AttributeType {
  number = "number",
  text = "text",
  select = "select",
  file = "file",
  commandSelect = "commandSelect",
  password = "password",
}

export const WebAppConfigSchema = Type.Object({
  proxyType:
    Type.Enum(
      { relative: "relative", absolute: "absolute" },
      { description: "proxy 类型", default: "relative" },
    ),
  beforeScript: Type.String({ description: "启动应用之前的准备命令。具体参考文档" }),
  script: Type.String({ description: "启动应用的命令。可以使用beforeScript中定义的变量" }),
  connect: AppConnectPropsSchema,
});

export const ShadowDeskConfigSchema = Type.Object({
  proxyServer: Type.String({ description: "代理服务器的地址和端口，例如 '10.129.227.58:8765'" }),
  beforeScript: Type.String({ description: "启动应用之前的准备命令。具体参考文档" }),
  script: Type.String({ description: "启动应用的命令。可以使用beforeScript中定义的变量" }),
  connect: AppConnectPropsSchema,
});

export type WebAppConfigSchema = Static<typeof WebAppConfigSchema>;
export type ShadowDeskAppConfigSchema = Static<typeof ShadowDeskConfigSchema>;

export const VncAppConfigSchema = Type.Object({
  beforeScript: Type.Optional(Type.String({ description: "启动应用之前的准备命令。具体参考文档" })),

  xstartup: Type.String({ description: "启动此app的xstartup脚本" }),
});

export type VncAppConfigSchema = Static<typeof VncAppConfigSchema>;

export const SlurmConfigSchema = Type.Object({
  options: Type.Array(
    Type.String({ description: "sbatch选项" }),
    { description:"运行slurm脚本时可添加的选项" },
  ),
});

export type SlurmConfigSchema = Static<typeof SlurmConfigSchema>;

export const FixedValueSchema = Type.Object({
  value: Type.Union([Type.String(), Type.Number()], { description: "表单项的固定值，如果配置则不允许修改" }),
  hidden: Type.Optional(Type.Boolean({ description: "是否在页面隐藏，默认不隐藏" })),
});
export type FixedValueSchema = Static<typeof FixedValueSchema>;

export const CommandSelectConfigSchema = Type.Object({
  script: Type.String({ description: "用于获取选项的脚本" }),
});
export type CommandSelectConfigSchema = Static<typeof CommandSelectConfigSchema>;

export const ReservedConfigSchema = Type.Union([
  Type.Object({
    type: Type.Literal("fixedValue"),
    ...FixedValueSchema.properties,
  }, { description: "为系统保留字段配置固定值形式" }),
  Type.Object({
    type: Type.Literal("select"),
    defaultValue: Type.Optional(Type.Union([Type.String(), Type.Number()])),
    select: Type.Array(
      Type.Object({
        value: Type.Union([Type.String(), Type.Number()], { description: "表单选项key，编程中使用" }),
        label: Type.Optional(createI18nStringSchema({ description: "表单选项展示给用户的文本" })),
        requireGpu: Type.Optional(Type.Boolean({ description: "表单选项是否只在分区为gpu时展示" })),
      }), { description:"表单选项" },
    ),
  }, { description: "为系统保留字段配置选项形式" }),
  Type.Object({
    type: Type.Literal("commandSelect"),
    commandSelect: CommandSelectConfigSchema,
  }, { description: "为系统保留字段配置动态选项形式" }),
  // 如果有其他类型保留值配置，继续补充
]);
export type ReservedConfigSchema = Static<typeof ReservedConfigSchema>;

export const AppConfigSchema = Type.Object({
  name: Type.String({ description: "App名" }),

  logoPath: Type.Optional(Type.String({ description: "App应用图标的图片源路径" })),
  type: Type.Enum(AppType, { description: "应用类型" }),
  slurm: Type.Optional(SlurmConfigSchema),
  web: Type.Optional(WebAppConfigSchema),
  vnc: Type.Optional(VncAppConfigSchema),
  shadowDesk: Type.Optional(ShadowDeskConfigSchema),
  attributes: Type.Optional(Type.Array(
    Type.Object({
      type:  Type.Enum(AttributeType, { description: "表单类型" }),
      label: createI18nStringSchema({ description: "表单标签" }),
      name: Type.String({ description: "表单字段名" }),
      required: Type.Boolean({ description: "是必填项", default: true }),
      defaultValue: Type.Optional(Type.Union([Type.String(), Type.Number()])),
      placeholder: Type.Optional(createI18nStringSchema({ description: "输入提示信息" })),
      select: Type.Optional(
        Type.Array(
          Type.Object({
            value: Type.String({ description: "表单选项key，编程中使用" }),
            label: createI18nStringSchema({ description: "表单选项展示给用户的文本" }),
            requireGpu: Type.Optional(Type.Boolean({ description: "表单选项是否只在分区为gpu时展示" })),
          }), { description:"表单选项" },
        ),
      ),
      commandSelect: Type.Optional(CommandSelectConfigSchema),
      fixedValue: Type.Optional(FixedValueSchema),
    }),
  )),
  appComment: Type.Optional(createI18nStringSchema({ description: "应用说明文字" })),
  reservedAppAttributes: Type.Optional(Type.Array(
    Type.Object({
      name: Type.Enum(ReservedAppAttributeName,
        { description: "系统保留APP表单字段名, 包括作业名，账户，集群，分区，Qos, 节点数，CPU卡数，GPU卡数，最长运行时间(分钟)" }),
      config: ReservedConfigSchema,
    }), { description: "为系统保留APP表单字段配置固定值或固定选项，可选择是否在页面隐藏，同一个字段名重复配置会进行覆盖" },
  )),
});

export type ReservedAppAttributeItem = NonNullable<AppConfigSchema["reservedAppAttributes"]>[number];

export type AppConfigSchema = Static<typeof AppConfigSchema>;

export const APP_CONFIG_BASE_PATH = "apps";

export const getAppConfigs: GetConfigFn<Record<string, AppConfigSchema>> = (baseConfigPath, logger) => {

  const appsConfig = getDirConfig(
    AppConfigSchema,
    APP_CONFIG_BASE_PATH,
    baseConfigPath ?? DEFAULT_CONFIG_BASE_PATH,
    logger,
  );

  Object.entries(appsConfig).forEach(([id, config]) => {
    if (!config[config.type]) {
      throw new Error(`App ${id} is of type ${config.type} but config.${config.type} is not set`);
    }
    if (config.attributes) {
      config.attributes.forEach((item) => {
        if (item.type === AttributeType.select && !item.select) {
          throw new Error(`
          App ${id}'s form attributes of name ${item.name} is of type select but select options is not set`);
        }
        // type为select类型时，不支持fixedValue，如果配置也不会生效
        if (item.type === AttributeType.select && item.fixedValue) {
          logger?.warn(`App ${id}'s form attributes of name ${item.name} is of type select, `
            + "the configuration for fixedValue will not take effect.");
        }
        // 如果配置了 fixedValue，值不能为空字符串
        if (item.fixedValue && item.fixedValue.value === "") {
          throw new Error(`
          App ${id}'s form attributes of name ${item.name} needs a fixed value,
          but the value is an empty string`);
        }
        // 先验证是否配有固定值
        if (item.fixedValue && item.type === AttributeType.number && typeof item.fixedValue.value !== "number") {
          throw new Error(`
          App ${id}'s form attributes of name ${item.name} is of type number,
          but the default ${item.fixedValue.value} value is not a number`);
        }
        // 如果没有配置固定值
        if (!item.fixedValue &&
          (item.defaultValue && item.type === AttributeType.number && typeof item.defaultValue !== "number")) {
          throw new Error(`
          App ${id}'s form attributes of name ${item.name} is of type number,
          but the default ${item.defaultValue} value is not a number`);
        }
        // 如果类型是file,验证配置的value需要为绝对路径
        if (item.type === AttributeType.file) {
          const pathToValidate = item.fixedValue?.value ?? item.defaultValue;
          if (pathToValidate && !isAbsolute(pathToValidate.toString())) {
            throw new Error(
              `App ${id}'s form attribute "${item.name}" requires an absolute path, ` +
              `but the value "${pathToValidate}" is not absolute.`,
            );
          }
        }
      });
    }
    // 增加对系统保留APP表单字段值的验证
    if (config.reservedAppAttributes) {

      const isPositiveInteger = (value: string | number | undefined): boolean => {
        // 检查是否为数字类型
        if (!value || typeof value !== "number") {
          return false;
        }
        // 检查是否为整数且大于0
        return Number.isInteger(value) && value > 0;
      };

      config.reservedAppAttributes = Array.from(
        config.reservedAppAttributes.reduce((acc, item) => {
          // 重复配置，后方覆盖前方
          acc.set(item.name, item);

          const config = item.config;

          // 系统保留APP表单字段值不能为空字符串
          if ((config.type === "fixedValue" && config.value === "")
            || (config.type === "select" && (!config.select || config.select.some((option) => option.value === "")))) {
            throw new Error(`
            App ${id}'s form system reserved attributes of name ${item.name} needs a fixed value,
            but the value is an empty string`);
          }

          if (
            (item.name === ReservedAppAttributeName.nodeCount ||
              item.name === ReservedAppAttributeName.coreCount ||
              item.name === ReservedAppAttributeName.gpuCount ||
              item.name === ReservedAppAttributeName.maxTime) &&
            ((config.type === "fixedValue" && !isPositiveInteger(config.value)) ||
            (config.type === "select" && config.select.some((option) => !isPositiveInteger(option.value))) ||
            (config.type === "select" && config.defaultValue && !isPositiveInteger(config.defaultValue)))
          ) {
            throw new Error(`
              App ${id}'s system reserved attributes of name ${item.name} is of type positive integer,
              but the reserved config value or default value is not positive integer`);
          }

          return acc;
        }, new Map<string, ReservedAppAttributeItem>()).values(),
      );

      config.reservedAppAttributes = Array.from(config.reservedAppAttributes.values());
    }

  });

  return appsConfig;
};
