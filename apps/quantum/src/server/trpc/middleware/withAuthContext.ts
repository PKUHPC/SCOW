import { TRPCError } from "@trpc/server";
import { getUserInfo } from "src/server/auth/server";
import { middleware } from "src/server/trpc/def";

/**
 * Checks whether SSRContext is present. Throws an error if is not. Narrows GlobalContext to SSRContext type.
 */
export const withAuthContext = middleware(async ({ ctx, next }) => {
  const user = await getUserInfo(ctx.req);

  if (!user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
    });

  }

  return next({
    ctx: {
      ...ctx,
      user,
    },
  });

});
