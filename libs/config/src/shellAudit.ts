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
import { DEFAULT_CONFIG_BASE_PATH } from "src/constants";


export const AuditServiceConfigSchema = Type.Object({
  auditService: Type.Object({
    shellAudit: Type.Optional(Type.Object({
      enabled: Type.Optional(Type.Boolean({ description: "是否开启shell审计", default: false })),
    })),
    appAudit: Type.Optional(Type.Object({
      enabled: Type.Optional(Type.Boolean({ description: "是否开启app审计", default: false })),
    })),
    remoteDesktopAudit: Type.Optional(Type.Object({
      enabled: Type.Optional(Type.Boolean({ description: "是否开启远程桌面审计", default: false })),
    })),
  }),

  auditServiceUrl: Type.String({
    description: "Shell Audit Server的URL, 默认为0.0.0.0:50051", default: "0.0.0.0:50051",
  }),

});

const SHELL_AUDIT_CONFIG_NAME = "auditService";

export type AuditServiceConfigSchema = Static<typeof AuditServiceConfigSchema>;

export const getAuditServiceConfig: GetConfigFn<AuditServiceConfigSchema> = (baseConfigPath) => {
  const config =
    getConfigFromFile(AuditServiceConfigSchema, SHELL_AUDIT_CONFIG_NAME, baseConfigPath ?? DEFAULT_CONFIG_BASE_PATH);

  return config;

};
