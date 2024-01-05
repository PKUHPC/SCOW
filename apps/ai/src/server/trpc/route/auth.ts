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

import { changePassword, checkPassword } from "@scow/lib-auth";
import { joinWithUrl } from "@scow/utils";
import { TRPCError } from "@trpc/server";
import { join } from "path";
import { setUserTokenCookie } from "src/server/auth/cookie";
import { getUserInfo } from "src/server/auth/server";
import { validateToken } from "src/server/auth/token";
import { config } from "src/server/config/env";
import { router } from "src/server/trpc/def";
import { authProcedure, baseProcedure } from "src/server/trpc/procedure/base";
import { ErrorCode } from "src/server/utils/errorCode";
import { BASE_PATH } from "src/utils/processEnv";
import { z } from "zod";

export const auth = router({

  getUserInfo: authProcedure
    .query(async ({ ctx: { req, res } }) => {
      const userInfo = await getUserInfo(req, res);
      return { user: userInfo };
    }),

  callback: baseProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/auth/callback",
        tags: ["auth"],
        summary: "登录后回调，写入cookie",
      },
    })
    .input(z.object({
      token:z.string(),
      fromAuth:z.boolean(),
    }))
    .output(z.void())
    .query(async ({ ctx: { res }, input }) => {
      const { token, fromAuth } = input;
      const info = await validateToken(token);
      if (info) {
        // set token cache
        setUserTokenCookie(token, res);
        // if (fromAuth) {
        //   const logInfo = {
        //     operatorUserId: info.identityId,
        //     operatorIp: parseIp(req) ?? "",
        //     operationTypeName: OperationType.login,
        //   };
        //   await callLog(logInfo, OperationResult.SUCCESS);
        // }
        res.redirect(BASE_PATH);
      } else {
        throw new TRPCError({
          message: "Token has expired",
          code: "FORBIDDEN",
        });
      }
    }),

  login: baseProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/auth",
        tags: ["auth"],
        summary: "登录",
      },
    })
    .input(z.void())
    .output(z.void())
    .query(async ({ ctx: { req, res } }) => {
      console.log("req", req.headers.host);

      const callbackUrl = `${ config.PROTOCOL || "http"}://${req.headers.host}`
       + join(BASE_PATH, "/api/auth/callback");

      const target = joinWithUrl(config.AUTH_EXTERNAL_URL,
        `public/auth?callbackUrl=${encodeURIComponent(callbackUrl)}`);

      res.redirect(target);
    }),

  changePassword: authProcedure
    .input(z.object({
      identityId:z.string(),
      oldPassword:z.string(),
      newPassword:z.string(),

    }))
    .mutation(async ({ input:{ identityId, oldPassword, newPassword } }) => {
      const checkRes = await checkPassword(config.AUTH_INTERNAL_URL, {
        identityId,
        password: oldPassword,
      }, console);

      if (!checkRes || !checkRes.success) {
        throw new TRPCError({
          message: ErrorCode.OLD_PASSWORD_IS_WRONG,
          code: "CONFLICT",
        });
      }

      const changeRes = await changePassword(config.AUTH_INTERNAL_URL, {
        identityId,
        newPassword,
      }, console)
        .catch((e) => e.status);

      if (changeRes) {
        throw new TRPCError({
          message: changeRes,
          code: "BAD_REQUEST",
        });
      }

      return;
    }),
});
