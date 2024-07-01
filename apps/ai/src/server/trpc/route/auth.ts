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

import { changePassword, checkPassword, deleteToken } from "@scow/lib-auth";
import { OperationType } from "@scow/lib-operation-log";
import { joinWithUrl } from "@scow/utils";
import { TRPCError } from "@trpc/server";
import { join } from "path";
import { OperationResult } from "src/models/operationLog";
import { deleteUserToken, getUserToken, setUserTokenCookie } from "src/server/auth/cookie";
import { getUserInfo } from "src/server/auth/server";
import { validateToken } from "src/server/auth/token";
import { commonConfig } from "src/server/config/common";
import { config } from "src/server/config/env";
import { callLog } from "src/server/setup/operationLog";
import { router } from "src/server/trpc/def";
import { authProcedure, baseProcedure } from "src/server/trpc/procedure/base";
import { ErrorCode } from "src/server/utils/errorCode";
import { parseIp } from "src/utils/parse";
import { BASE_PATH } from "src/utils/processEnv";
import { z } from "zod";

import { booleanQueryParam } from "./utils";


const ClientUserInfoSchema = z.object({
  identityId: z.string(),
  name: z.optional(z.string()),
  token: z.string(),
});

export type ClientUserInfo = z.infer<typeof ClientUserInfoSchema>;

export const auth = router({

  getUserInfo: authProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/auth/userInfo",
        tags: ["auth"],
        summary: "获取用户信息及token",
      },
    })
    .input(z.void())
    .output(z.object({
      user: ClientUserInfoSchema,
    }))
    .query(async ({ ctx: { req, res } }) => {
      const userInfo = await getUserInfo(req, res);
      if (!userInfo) {
        throw new TRPCError({
          message: "User is UNAUTHORIZED",
          code: "UNAUTHORIZED",
        });
      }
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
      fromAuth: booleanQueryParam().optional(),
    }))
    .output(z.void())
    .query(async ({ ctx: { req, res }, input }) => {
      const { token, fromAuth = false } = input;

      const info = await validateToken(token);
      if (info) {
        if (fromAuth) {
          const logInfo = {
            operatorUserId: info.identityId,
            operatorIp: parseIp(req) ?? "",
            operationTypeName: OperationType.login,
          };
          await callLog(logInfo, OperationResult.SUCCESS);
        }
        // set token cache
        setUserTokenCookie(token, res);
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

      const callbackUrl = `${ config.PROTOCOL || "http"}://${req.headers.host}`
       + join(BASE_PATH, "/api/auth/callback");

      const target = joinWithUrl(config.AUTH_EXTERNAL_URL,
        `public/auth?callbackUrl=${encodeURIComponent(callbackUrl)}`);

      res.redirect(target);
    }),

  logout: authProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/auth/logout",
        tags: ["auth"],
        summary: "登出",
      },
    })
    .input(z.void())
    .output(z.void())
    .mutation(async ({ ctx: { req, res } }) => {

      const token = getUserToken(req) || "";
      if (token) {
        const info = await validateToken(token);
        if (info) {
          const logInfo = {
            operatorUserId: info.identityId,
            operatorIp: parseIp(req) ?? "",
            operationTypeName: OperationType.logout,
          };
          await callLog(logInfo, OperationResult.SUCCESS);
        }
      }
      await deleteToken(token, config.AUTH_INTERNAL_URL);
      deleteUserToken(res);

    }),

  changePassword: authProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/auth/changePassword",
        tags: ["auth"],
        summary: "更改密码",
      },
    })
    .input(z.object({
      identityId:z.string(),
      oldPassword:z.string(),
      newPassword:z.string(),
    }))
    .output(z.void())
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

      const passwordPattern = commonConfig.passwordPattern?.regex && new RegExp(commonConfig.passwordPattern?.regex);
      if (passwordPattern && !passwordPattern.test(newPassword)) {
        throw new TRPCError({
          message: "password is not valid",
          code: "BAD_REQUEST",
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
