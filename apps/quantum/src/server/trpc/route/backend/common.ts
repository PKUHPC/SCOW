import { TRPCError } from "@trpc/server";
import { getUserInfo } from "src/server/auth/server";
import { validateUserToken } from "src/server/auth/token";
import { quantumConfig } from "src/server/config/quantum";
import { UserToken } from "src/server/entities/UserToken";
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

    // 检查这个token是不是某个用户的token
    if (token) {
      //  这里是执行量子命令的token
      const tokenModel = await ctx.orm.em.fork().findOne(UserToken, {
        token,
      });

      if (tokenModel) {
        return next({ ctx: { ...ctx, user: { identityId: tokenModel.userId } } });
      }

      // 来自其他系统的带token请求
      const identityId = await validateUserToken(token);

      if (identityId) {
        return next({ ctx: { ...ctx, user: { identityId } } });
      }
    }

    // 否则就和其他的API一样验证
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
