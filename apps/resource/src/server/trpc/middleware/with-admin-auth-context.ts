import { TRPCError } from "@trpc/server";
import { getUserToken } from "src/server/auth/cookie";
import { MOCK_USER_INFO } from "src/server/auth/server";
import { validateToken } from "src/server/auth/token";
import { middleware } from "src/server/trpc/def";
import { isResourceAdmin, UserForbiddenError } from "src/utils/auth/utils";
import { USE_MOCK } from "src/utils/processEnv";

export const withAdminAuthContext = middleware(async ({ ctx, next }) => {
  if (USE_MOCK) {
    return next({
      ctx: {
        ...ctx,
        user: {
          ...MOCK_USER_INFO,
          token: "123",
        },
      },
    });
  }

  const token = getUserToken(ctx.req);

  if (!token) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
    });
  }

  const info = await validateToken(token);

  if (!info) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
    });
  }

  const validatedUser = {
    ...info,
    token,
  };

  if (!isResourceAdmin(validatedUser)) {
    throw new UserForbiddenError(validatedUser.identityId);
  }

  return next({
    ctx: {
      ...ctx,
      user: validatedUser,
    },
  });
});
