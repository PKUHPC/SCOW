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

import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { validateToken as authValidateToken } from "@scow/lib-auth";
import { GetUserInfoResponse, UserServiceClient } from "@scow/protos/build/server/user";
import { MOCK_USER_INFO } from "src/apis/api.mock";
import { USE_MOCK } from "src/apis/useMock";
import { UserInfo } from "src/models/User";
import { getClient } from "src/utils/client";
import { runtimeConfig } from "src/utils/config";

export interface AuthUserInfo {
}

export async function validateToken(token: string): Promise<UserInfo | undefined> {

  if (USE_MOCK) {
    return MOCK_USER_INFO;
  }

  const resp = await authValidateToken(runtimeConfig.AUTH_INTERNAL_URL, token).catch(() => undefined);

  if (!resp) {
    return undefined;
  }

  const client = getClient(UserServiceClient);

  let userInfo: GetUserInfoResponse = await asyncClientCall(client, "getUserInfo", {
    userId: resp.identityId,
  });

  if (!userInfo) {
    await asyncClientCall(client, "addUser", {
      name: resp.identityId,
      tenantName: "default",
      email: resp.identityId + "@scow.com",
      identityId: resp.identityId,
    });

    userInfo = await asyncClientCall(client, "getUserInfo", {
      userId: resp.identityId,
    });
  }

  return {
    accountAffiliations: userInfo.affiliations,
    identityId: resp.identityId,
    name: userInfo.name,
    platformRoles: userInfo.platformRoles,
    tenant: userInfo.tenantName,
    tenantRoles: userInfo.tenantRoles,
    email:userInfo.email,
    createTime:userInfo.createTime,
  };

}

