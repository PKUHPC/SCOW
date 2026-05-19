import { TRPCError } from "@trpc/server";
import { PlatformRole, TenantRole } from "src/models/user";
import { getUserInfo } from "src/server/auth/server";
import { USE_MOCK } from "src/utils/processEnv";
import { z } from "zod";

import { procedure, router } from "../def";
import { MOCK_USER } from "./mock";

export const ClientUserInfoSchema = z.object({
  identityId: z.string(),
  name: z.optional(z.string()),
  token: z.string(),
  platformRoles: z.array(z.nativeEnum(PlatformRole)),
  tenant: z.string(),
  tenantRoles: z.array(z.nativeEnum(TenantRole)),
});
export type ClientUserInfo = z.infer<typeof ClientUserInfoSchema>;

export const auth = router({
  getUserInfo: procedure
    .meta({
      openapi: {
        method: "GET",
        path: "/auth/userInfo",
        tags: ["auth"],
        summary: "获取用户信息及token",
      },
    })
    .input(z.void())
    .output(
      z.object({
        user: ClientUserInfoSchema,
      }),
    )
    .query(async ({ ctx: { req, res } }) => {
      if (process.env.NODE_ENV === "test" || USE_MOCK) {
        return { user: MOCK_USER };
      }

      const userInfo = await getUserInfo(req, res);
      if (!userInfo) {
        throw new TRPCError({
          message: "User is UNAUTHORIZED",
          code: "UNAUTHORIZED",
        });
      }
      return { user: userInfo };
    }),
});
