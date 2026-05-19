import { GetConfigFn, getConfigFromFile } from "@scow/lib-config";
import { Static, Type } from "@sinclair/typebox";
import { DEFAULT_CONFIG_BASE_PATH } from "src/constants";

export const AuthPpolicyConfigSchema = Type.Object({
  defaultOlcPPolicyDn: Type.Optional(Type.String({ description: "密码策略条目DN" })),
  pwdMaxFailures: Type.Optional(Type.Number({ description: "允许用户连续输入错误密码的最大次数" })),
});

const AUTH_CONFIG_NAME = "auth";

export type AuthPpolicyConfigSchema = Static<typeof AuthPpolicyConfigSchema>;

export const getAuthConfig: GetConfigFn<AuthPpolicyConfigSchema> = (baseConfigPath) => {
  const config = getConfigFromFile(
    AuthPpolicyConfigSchema,
    AUTH_CONFIG_NAME,
    baseConfigPath ?? DEFAULT_CONFIG_BASE_PATH,
  );
  return config;
};
