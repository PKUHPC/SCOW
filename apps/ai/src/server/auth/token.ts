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
import { libWebGetUserInfo } from "@scow/lib-web/build/server/userAccount";
import { UserInfo } from "src/models/User";
import { config } from "src/server/config/env";
import { AUTH_INTERNAL_URL, USE_MOCK } from "src/utils/processEnv";

import { mockUserInfo } from "./server";

export async function validateToken(token: string | undefined): Promise<UserInfo | undefined> {

  if (process.env.NODE_ENV === "test" || USE_MOCK) {
    return mockUserInfo;
  }

  if (!token) { return undefined; }

  const resp = await authValidateToken(AUTH_INTERNAL_URL, token).catch(() => undefined);

  if (!resp) {
    return undefined;
  }

  const commonConfig = getCommonConfig();

  const userInfo = await libWebGetUserInfo(resp.identityId, config.MIS_SERVER_URL, commonConfig.scowApi?.auth?.token);

  return {
    identityId: resp.identityId,
    ...userInfo,
  };
}

