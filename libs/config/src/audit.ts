import { GetConfigFn, getConfigFromFile } from "@scow/lib-config";
import { Static, Type } from "@sinclair/typebox";
import { DEFAULT_CONFIG_BASE_PATH } from "src/constants";

export const AuditConfigSchema = Type.Object({
  url: Type.String({ description: "Audit Server的URL, 默认为audit-server:5000", default: "audit-server:5000" }),

  db: Type.Object({
    host: Type.String({ description: "数据库地址" }),
    port: Type.Integer({ description: "数据库端口" }),
    user: Type.String({ description: "数据库用户名" }),
    password: Type.Optional(Type.String({ description: "数据库密码" })),
    dbName: Type.String({ description: "数据库数据库名" }),
    debug: Type.Boolean({ description: "打开ORM的debug模式", default: false }),
  }),
});

const AUDIT_CONFIG_NAME = "audit";

export type AuditConfigSchema = Static<typeof AuditConfigSchema>;

export const getAuditConfig: GetConfigFn<AuditConfigSchema> = (baseConfigPath) => {
  const config = getConfigFromFile(AuditConfigSchema, AUDIT_CONFIG_NAME, baseConfigPath ?? DEFAULT_CONFIG_BASE_PATH);

  return config;
};
