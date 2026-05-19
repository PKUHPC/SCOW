import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { GetUserInfoResponse, UserServiceClient } from "@scow/protos/build/server/user";
import { UserInfo } from "src/models/user";
import { validateToken as authValidateToken } from "src/utils/auth";
import { AUTH_INTERNAL_URL, USE_MOCK } from "src/utils/processEnv";
import { getScowClient } from "src/utils/scow-client";

import { MOCK_USER_INFO } from "./server";

export async function validateToken(token: string | undefined): Promise<UserInfo | undefined> {
  if (process.env.NODE_ENV === "test" || USE_MOCK) {
    return MOCK_USER_INFO;
  }

  if (!token) {
    return undefined;
  }

  const resp = await authValidateToken(AUTH_INTERNAL_URL, token).catch(() => undefined);

  if (!resp) {
    return undefined;
  }

  const client = getScowClient(UserServiceClient);

  const userInfo: GetUserInfoResponse = await asyncClientCall(client, "getUserInfo", {
    userId: resp.identityId,
  });

  return {
    accountAffiliations: userInfo.affiliations,
    identityId: resp.identityId,
    name: userInfo.name,
    platformRoles: userInfo.platformRoles,
    tenant: userInfo.tenantName,
    tenantRoles: userInfo.tenantRoles,
    email: userInfo.email,
    createTime: userInfo.createTime,
  };
}
