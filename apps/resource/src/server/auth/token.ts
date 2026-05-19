import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { GetUserInfoResponse, UserServiceClient } from "@scow/protos/build/server/user";
import { validateToken as authValidateToken } from "src/utils/auth";
import { AUTH_INTERNAL_URL, USE_MOCK } from "src/utils/processEnv";
import { getScowClient } from "src/utils/scowClient";

import { ClientUserInfo } from "../trpc/route/auth";
import { MOCK_USER_INFO } from "./server";

export async function validateToken(token: string | undefined): Promise<ClientUserInfo | undefined> {
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
    identityId: resp.identityId,
    name: userInfo.name,
    platformRoles: userInfo.platformRoles,
    tenant: userInfo.tenantName,
    tenantRoles: userInfo.tenantRoles,
    token,
  };
}
