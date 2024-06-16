/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { GetConfigFn, getDirConfig } from "@scow/lib-config";
import { Static, Type } from "@sinclair/typebox";
import { DEFAULT_CONFIG_BASE_PATH } from "src/constants";
import { createI18nStringSchema } from "src/i18n";


export enum AppType {
  web = "web",
  vnc = "vnc"
}

export const AppConnectPropsSchema = Type.Object({
  method: Type.Enum({ GET: "GET", POST: "POST" }, { description: "连接所使用的HTTP方法" }),
  path: Type.String({ description: "启动的相对路径" }),
  query: Type.Optional(Type.Record(Type.String(), Type.String(), { description: "query参数" })),
  formData: Type.Optional(
    Type.Record(Type.String(), Type.String(), { description: "设置为POST时，需要以form data形式提交的数据" })),
}, { description: "如何连接应用" });

export type AppConnectPropsSchema = Static<typeof AppConnectPropsSchema>;

export const WebAppConfigSchema = Type.Object({
  proxyType:
    Type.Enum(
      { relative: "relative", absolute: "absolute" },
      { description: "proxy 类型", default: "relative" },
    ),
  beforeScript: Type.String({ description: "启动应用之前的准备命令。具体参考文档" }),
  startCommand: Type.String({ description: "指明运行任务的脚本中的启动命令，用户在创建应用页面可以在脚本中替换该命令" }),
  script: Type.String({ description: "启动应用的命令。可以使用beforeScript中定义的变量" }),
  connect: AppConnectPropsSchema,
});

export type WebAppConfigSchema = Static<typeof WebAppConfigSchema>;

export const VncAppConfigSchema = Type.Object({
  beforeScript: Type.Optional(Type.String({ description: "启动应用之前的准备命令。具体参考文档" })),

  xstartup: Type.String({ description: "启动此app的xstartup脚本" }),
});

export type VncAppConfigSchema = Static<typeof VncAppConfigSchema>;

export const AppConfigSchema = Type.Object({
  name: Type.String({ description: "App名" }),
  logoPath: Type.Optional(Type.String({ description: "App应用图标的图片源路径" })),
  image: Type.Object({
    name: Type.String({ description: "App镜像名" }),
    tag: Type.String({ description: "App镜像标签", default: "latest" }),
  }),
  tags:Type.Optional(Type.Array(Type.String(), { description: "应用标签, 一个应用可以打多个标签" })),
  type: Type.Enum(AppType, { description: "应用类型" }),
  web: Type.Optional(WebAppConfigSchema),
  vnc: Type.Optional(VncAppConfigSchema),
  attributes: Type.Optional(Type.Array(
    Type.Object({
      type:  Type.Enum({ number: "number", text: "text", select: "select" }, { description: "表单类型" }),
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
        )),
    }),
  )),
  appComment: Type.Optional(createI18nStringSchema({ description: "应用说明文字" })),

});

export type AppConfigSchema = Static<typeof AppConfigSchema>;

export const APP_CONFIG_BASE_PATH = "ai/apps";

export const getAiAppConfigs: GetConfigFn<Record<string, AppConfigSchema>> = (baseConfigPath, logger) => {

  const aiAppsConfig = getDirConfig(
    AppConfigSchema,
    APP_CONFIG_BASE_PATH,
    baseConfigPath ?? DEFAULT_CONFIG_BASE_PATH,
    logger,
  );

  Object.entries(aiAppsConfig).forEach(([id, config]) => {
    if (!config[config.type]) {
      throw new Error(`App ${id} is of type ${config.type} but config.${config.type} is not set`);
    }
  });

  return aiAppsConfig;
};

