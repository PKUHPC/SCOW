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
import { GetUserInfoResponse, UserServiceClient } from "@scow/protos/build/server/user";
import { getClientFn } from "src/utils/api";

export const libWebGetUserInfo = async (
  userId: string,
  misServerUrl?: string,
  scowApiAuthToken?: string,
): Promise<GetUserInfoResponse | undefined> => {

  // if mis is Deployed
  if (!misServerUrl) {
    console.log("Mis is not deployed, can not get userInfo from mis.");
    return undefined;
  }

  const config = {
    SERVER_URL: misServerUrl,
    SCOW_API_AUTH_TOKEN: scowApiAuthToken,
  };
  const getMisClient = getClientFn(config);
  const client = getMisClient(UserServiceClient);

  try {
    const reply = await asyncClientCall(client, "getUserInfo", { userId });
    return reply;
  } catch (e: any) {
    console.error(e.details);
    return undefined;
  }
};