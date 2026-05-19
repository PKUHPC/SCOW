import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { libWebGetUserInfo } from "@scow/lib-web/build/server/userAccount";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { validateToken } from "src/auth/token";
import { publicConfig, runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";

export const TenantRole = {
  TENANT_ADMIN: 0,
  TENANT_FINANCE: 1,
} as const;

export const PlatformRole = {
  PLATFORM_ADMIN: 0,
  PLATFORM_FINANCE: 1,
} as const;

export const UserInfo = Type.Object({
  phone: Type.Optional(Type.String()),
  email: Type.Optional(Type.String()),
  tenantName: Type.Optional(Type.String()),
  organization: Type.Optional(Type.String()),
  tenantRoles: Type.Optional(
    Type.Array(Type.Union([Type.Literal(TenantRole.TENANT_ADMIN), Type.Literal(TenantRole.TENANT_FINANCE)])),
  ),
  platformRoles: Type.Optional(
    Type.Array(Type.Union([Type.Literal(PlatformRole.PLATFORM_ADMIN), Type.Literal(PlatformRole.PLATFORM_FINANCE)])),
  ),
  createTime: Type.Optional(Type.String()),
});

export type UserInfo = Static<typeof UserInfo>;

export const GetUserInfoSchema = typeboxRouteSchema({
  method: "GET",
  query: Type.Object({
    userId: Type.String(),
    token: Type.Optional(Type.String()),
  }),

  responses: {
    200: Type.Object({
      userInfo: UserInfo,
    }),

    403: Type.Null(),
  },
});

const auth = authenticate(() => true);
export default route(GetUserInfoSchema, async (req, res) => {
  const { userId, token } = req.query;

  const info = token ? await validateToken(token) : await auth(req, res);
  if (!info) {
    return;
  }

  const reply = await libWebGetUserInfo(userId, publicConfig.MIS_SERVER_URL, runtimeConfig.SCOW_API_AUTH_TOKEN);
  const accountNames = reply?.affiliations.map((a) => a.accountName);
  const tenantName = reply?.tenantName;

  if (!accountNames || !tenantName) {
    return { 403: null };
  }

  return {
    200: {
      userInfo: reply,
    },
  };
});
