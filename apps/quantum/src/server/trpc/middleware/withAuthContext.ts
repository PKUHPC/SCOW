import { TRPCError } from "@trpc/server";
import { NextApiRequest } from "next";
import { getUserToken } from "src/server/auth/cookie";
import { validateToken } from "src/server/auth/token";
import { middleware } from "src/server/trpc/def";

export async function authenticateNextRequest(req: NextApiRequest) {
  const token = getUserToken(req);

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

  return { ...info, token };
}

/**
 * Checks whether SSRContext is present. Throws an error if is not. Narrows GlobalContext to SSRContext type.
 */
export const withAuthContext = middleware(async ({ ctx, next }) => {
  const user = await authenticateNextRequest(ctx.req);

  return next({
    ctx: {
      ...ctx,
      user,
    },
  });

});
