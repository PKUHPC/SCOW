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

export const AlertmanagerRoleSchema = Type.Union([
  Type.Literal("PLATFORM_ADMIN"),
  Type.Literal("PLATFORM_FINANCE"),
  Type.Literal("TENANT_ADMIN"),
  Type.Literal("TENANT_FINANCE"),
  Type.Literal("ACCOUNT_ADMIN"),
  Type.Literal("ACCOUNT_OWNER"),
]);
export type AlertmanagerRole = Static<typeof AlertmanagerRoleSchema>;

export const NotificationConfigSchema = Type.Object({
  db: Type.Object({
    host: Type.String({ description: "数据库地址" }),
    port: Type.Integer({ description: "数据库端口" }),
    user: Type.String({ description: "数据库用户名" }),
    password: Type.Optional(Type.String({ description: "数据库密码" })),
    dbName: Type.String({ description: "数据库数据库名" }),
    debug: Type.Boolean({ description: "打开ORM的debug模式", default: false }),
    pool: Type.Optional(Type.Object({
      min: Type.Number({ description: "连接池连接数最小值" }),
      max: Type.Number({ description: "连接池连接数最大值" }),
      acquireTimeoutMillis: Type.Number({ description: "连接获取超时毫秒数" }),
    }, { description: "mikro orm 使用的连接池大小" })),
  }),

  redis: Type.Optional(Type.Object({
    enabled: Type.Boolean({ description: "是否启用 redis" }),
    host: Type.String({ description: "Redis 地址" }),
    port: Type.Integer({ description: "Redis 端口" }),
    password: Type.Optional(Type.String({ description: "Redis 密码" })),
  })),

  scow: Type.Object({
    misServerUrl: Type.String({ description: "scow mis-server 地址", default: "mis-server:5000" }),
  }),

  noticeType: Type.Object({
    siteMessage: Type.Object({
      enabled: Type.Boolean({ description: "是否启用站内消息", default: true }),
    }),
    SMS: Type.Optional(Type.Object({
      enabled: Type.Boolean({ description: "是否启用短信", default: false }),
    })),
    email: Type.Optional(Type.Object({
      enabled: Type.Boolean({ description: "是否启用邮件", default: false }),
    })),
    officialAccount: Type.Optional(Type.Object({
      enabled: Type.Boolean({ description: "是否启用公众号", default: false }),
    })),
    weCom: Type.Optional(Type.Object({
      enabled: Type.Boolean({ description: "是否启用企业微信", default: false }),
    })),
    dingTalk: Type.Optional(Type.Object({
      enabled: Type.Boolean({ description: "是否启用钉钉", default: false }),
    })),
    lark: Type.Optional(Type.Object({
      enabled: Type.Boolean({ description: "是否启用飞书", default: false }),
    })),
  }),

  messageBridge: Type.Optional(Type.Object({
    address: Type.String({ description: "地址", default: "http://message-bridge:3000" }),
  }, { description: "第三方消息发送组件" })),

  deleteExpiredMessages: Type.Object({
    // 默认每天凌晨 3 点执行一次
    cron: Type.String({ description: "删除消息的周期的cron表达式", default: "0 3 * * *" }),
  }),

  alertmanager: Type.Optional(Type.Object({
    enabled: Type.Boolean({ description: "是否启用 Alertmanager Webhook 集成", default: true }),
    receiverMappings: Type.Array(Type.Object({
      alertIds: Type.Array(Type.String(), { description: "alertname 标签值列表，用于匹配告警" }),
      users: Type.Optional(Type.Array(Type.String(), {
        description: "直接指定的接收用户 ID 列表",
      })),
      roles: Type.Optional(Type.Array(
        AlertmanagerRoleSchema,
        { description: "接收该告警的 SCOW 角色列表，运行时自动查询对应用户" },
      )),
    }), { description: "告警 ID 到接收者的映射配置" }),
  }, { description: "Alertmanager Webhook 集成配置" })),
});

const NOTIFICATION_CONFIG_NAME = "notification/config";

export type NotificationConfigSchema = Static<typeof NotificationConfigSchema>;

export const getNotificationConfig: GetConfigFn<NotificationConfigSchema> = (baseConfigPath) => {
  const config =
    getConfigFromFile(NotificationConfigSchema, NOTIFICATION_CONFIG_NAME, baseConfigPath ?? DEFAULT_CONFIG_BASE_PATH);

  return config;
};
