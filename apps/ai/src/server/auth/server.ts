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

import { getCommonConfig } from "@scow/config/src/common";
import { validateToken as authValidateToken } from "@scow/lib-auth";
import { libWebChangeEmail } from "@scow/lib-web/build/server/user";
import { IncomingMessage } from "http";
import { NextApiRequest, NextApiResponse, NextPageContext } from "next";
import { NextRequest } from "next/server";
import { deleteUserToken, getUserToken } from "src/server/auth/cookie";
import { config } from "src/server/config/env";
import { ClientUserInfo } from "src/server/trpc/route/auth";
import { AUTH_INTERNAL_URL, USE_MOCK } from "src/utils/processEnv";

import { getUserInfoForUserId, validateUserToken } from "./token";

export const mockUserInfo: ClientUserInfo = {
  identityId: "demo_admin",
  name:"mock-user",
  token: "demo_admin",
};

type RequestType = IncomingMessage | NextApiRequest | NextRequest | NextPageContext["req"];

const xScowUserIdHeaderKey = "x-scow-user-id";

export async function getUserInfo(req: RequestType, res?: NextApiResponse): Promise<ClientUserInfo | undefined> {

  const token = getUserToken(req);
  if (!token) { return undefined; }

  if (USE_MOCK) {
    return mockUserInfo;
  }

  const commonConfig = getCommonConfig();

  if (req?.headers && commonConfig.scowApi?.auth?.token && commonConfig.scowApi.auth.token === token) {
    const userIdHeaderValue = (req instanceof Request)
      ? req.headers.get(xScowUserIdHeaderKey) : req.headers[xScowUserIdHeaderKey];

    const userId = Array.isArray(userIdHeaderValue) ? userIdHeaderValue[0] : userIdHeaderValue;

    if (!userId) { return undefined; }

    const info = await getUserInfoForUserId(userId);
    return { ...info, token };
  }

  const identityId = await validateUserToken(token);

  if (!identityId) {
    deleteUserToken(res);
    return;
  }

  const userInfo = await getUserInfoForUserId(identityId);

  return { ...userInfo, token };

}

export async function changeEmail(req: RequestType, newEmail: string) {

  const token = getUserToken(req);
  if (!token) { return undefined; }

  const resp = await authValidateToken(AUTH_INTERNAL_URL, token).catch(() => undefined);

  if (!resp) {
    return undefined;
  }

  const commonConfig = getCommonConfig();

  return await libWebChangeEmail(resp.identityId, newEmail,
    config.MIS_SERVER_URL, commonConfig.scowApi?.auth?.token);
}

