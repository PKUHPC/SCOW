import { IncomingMessage } from "http";
import { NextApiRequest, NextApiResponse, NextPageContext } from "next";
import { NextRequest } from "next/server";
import { PlatformRole, TenantRole } from "src/models/user";
import { deleteUserToken, getUserToken } from "src/server/auth/cookie";
import { validateToken } from "src/server/auth/token";
import { ClientUserInfo } from "src/server/trpc/route/auth";
import { USE_MOCK } from "src/utils/processEnv";

export const MOCK_USER_INFO: ClientUserInfo = {
  tenant: "default",
  name: "demo_admin",
  identityId: "demo_admin",
  token: "demo_admin",
  tenantRoles: [TenantRole.TENANT_ADMIN],
  platformRoles: [PlatformRole.PLATFORM_ADMIN],
};

type RequestType = IncomingMessage | NextApiRequest | NextRequest | NextPageContext["req"];

export async function getUserInfo(req: RequestType, res?: NextApiResponse): Promise<ClientUserInfo | undefined> {
  if (USE_MOCK) {
    return MOCK_USER_INFO;
  }

  const token = getUserToken(req);
  if (!token) {
    return undefined;
  }

  const result = await validateToken(token);

  if (!result?.identityId) {
    deleteUserToken(res);
    return;
  }

  return { ...result, token };
}
