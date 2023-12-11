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

import { TRPCError } from "@trpc/server";
import { ClientUserInfo } from "src/server/auth/models";
import { USE_MOCK } from "src/utils/mock.js";

export const checkUserResourceId = async (userId: string, resourceId: number) => {

  if (USE_MOCK) {
    return {
      ok: true,
      platformId: "123",
    };
  }

  // validate the user can operate the identity
  // const client = getClient(PortalServiceClient);

  // return await asyncUnaryCall(client, "canUseResourceIdentity", {
  //   resourceId, userId,
  // });
};



export const checkAuthorization = async () => {

  const resp = {};
  if (!(resp as any).ok) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authorization check for failed.",
    });
  }
};
