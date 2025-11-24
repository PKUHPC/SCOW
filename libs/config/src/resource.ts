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

import { GetConfigFn, getConfigFromFile } from "@scow/lib-config";
import { Static, Type } from "@sinclair/typebox";

import { DEFAULT_CONFIG_BASE_PATH } from "./constants";

export const ResourceConfigSchema = Type.Object({
  db: Type.Object({
    host: Type.String({ description: "数据库地址" }),
    port: Type.Integer({ description: "数据库端口" }),
    user: Type.String({ description: "数据库用户名" }),
    password: Type.Optional(Type.String({ description: "数据库密码" })),
    dbName: Type.String({ description: "数据库数据库名" }),
    debug: Type.Boolean({ description: "打开ORM的debug模式", default: false }),
  }),

  scow: Type.Object({
    misServerUrl: Type.String({ description: "scow mis-server 地址", default: "mis-server:5000" }),
  }),

  log: Type.Object({
    level: Type.String({ description: "日志等级", default: "info" }),
    pretty: Type.Boolean({ description: "以可读的方式输出 log", default: false }),
  }),
});

const RESOURCE_CONFIG_NAME = "resource/config";

export type ResourceConfigSchema = Static<typeof ResourceConfigSchema>;

export const getResourceConfig: GetConfigFn<ResourceConfigSchema> = (baseConfigPath) => {
  const config =
    getConfigFromFile(ResourceConfigSchema, RESOURCE_CONFIG_NAME, baseConfigPath ?? DEFAULT_CONFIG_BASE_PATH);

  return config;
};
