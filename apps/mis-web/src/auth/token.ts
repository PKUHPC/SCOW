import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { validateToken as authValidateToken } from "@scow/lib-auth";
import { GetUserInfoResponse, UserServiceClient } from "@scow/protos/build/server/user";
import { MOCK_USER_INFO } from "src/apis/api.mock";
import { USE_MOCK } from "src/apis/useMock";
import { AccountState, UserInfo } from "src/models/User";
import { getClient } from "src/utils/client";
import { runtimeConfig } from "src/utils/config";

export interface AuthUserInfo {}

export async function validateToken(token: string): Promise<UserInfo | undefined> {
  if (USE_MOCK) {
    return MOCK_USER_INFO;
  }

  const resp = await authValidateToken(runtimeConfig.AUTH_INTERNAL_URL, token).catch(() => undefined);

  if (!resp) {
    return undefined;
  }

  return await getUserInfoByUserId(resp.identityId);

}

export async function getUserInfoByUserId(userId: string): Promise<UserInfo | undefined> {

  if (USE_MOCK) {
    return MOCK_USER_INFO;
  }

  const client = getClient(UserServiceClient);

  const userInfo: GetUserInfoResponse | undefined = await asyncClientCall(client, "getUserInfo", {
    userId,
  }).catch(() => undefined);

  if (!userInfo) {
    return undefined;
  }

  return {
    accountAffiliations: userInfo.affiliations.filter((x) => x.accountState !== AccountState.DELETED),
    identityId: userId,
    name: userInfo.name,
    platformRoles: userInfo.platformRoles,
    tenant: userInfo.tenantName,
    tenantRoles: userInfo.tenantRoles,
    email: userInfo.email,
    phone: userInfo.phone,
    organization: userInfo.organization,
    createTime: userInfo.createTime,
  };
}
