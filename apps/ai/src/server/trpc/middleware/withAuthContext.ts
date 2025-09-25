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
import { getUserInfo } from "src/server/auth/server";
import { middleware } from "src/server/trpc/def";

/**
 * Checks whether SSRContext is present. Throws an error if is not. Narrows GlobalContext to SSRContext type.
 */
export const withAuthContext = middleware(async ({ ctx, next }) => {

  const userInfo = await getUserInfo(ctx.req);

  if (!userInfo) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
    });
  }


  return next({
    ctx: {
      ...ctx,
      user: {
        ...userInfo,
      },
    },
  });

});
