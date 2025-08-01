import { TRPCError } from "@trpc/server";
import { quantumConfig } from "src/server/config/quantum";
import { UserToken } from "src/server/entities/UserToken";
import { authenticateNextRequest } from "src/server/trpc/middleware/withAuthContext";
import withOrmContext from "src/server/trpc/middleware/withOrmContext";
import { baseProcedure } from "src/server/trpc/procedure/base";
import { USE_MOCK } from "src/utils/processEnv";

export const backendApiProcedure = baseProcedure
  .use(withOrmContext)
  .use(async ({ ctx, next }) => {

    if (USE_MOCK) {
      // 如果是mock环境，直接返回一个空对象
      return next({
        ctx: {
          ...ctx,
          user: { identityId: "mock-user-id" }, // 模拟用户ID
        },
      });
    }

    // 检查authorization token是否存在
    const token = ctx.req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      // 如果没有带authorization token，就和其他API一样验证cookie

      const user = await authenticateNextRequest(ctx.req);

      return next({
        ctx: {
          ...ctx,
          user,
        },
      });
    }

    const tokenModel = await ctx.orm.em.fork().findOne(UserToken, {
      token,
    });

    if (!tokenModel) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid authorization bearer token",
      });
    }

    return next({ ctx: { ...ctx, user: { identityId: tokenModel.userId } } });
  });

export async function callBackendApi(path: string, init: RequestInit) {
  const resp = await fetch(quantumConfig.backend.apiBase + path, {
    headers: {
      "Content-Type": "application/json",
    },
    ...init,
  });

  const body = await resp.json();

  if (body.err) {
    throw new Error(`Backend API returned error response: ${body.err}`);
  }

  if (!resp.ok) {
    throw new Error(`Backend API call failed: ${resp.status} ${resp.statusText} - ${JSON.stringify(body)}`);
  }

  return body as unknown;
}
