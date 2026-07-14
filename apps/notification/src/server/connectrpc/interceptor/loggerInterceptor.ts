import { ConnectError, type Interceptor } from "@connectrpc/connect";
import { extractLogContext, runWithLogContext, withLogContext } from "@scow/lib-server";
import { randomUUID } from "crypto";
import { SCOW_COOKIE_KEY } from "src/server/auth/cookie";
import { validateToken } from "src/server/auth/token";
import { authUserInfoContextKey } from "src/utils/auth/auth-context";
import { getCookieValue } from "src/utils/cookie";
import { logger } from "src/utils/logger";

export const loggerInterceptor: Interceptor = (next) => async (req) => {
  const start = Date.now();
  const token = getCookieValue(req.header.get("cookie") ?? "", SCOW_COOKIE_KEY);
  const userInfoPromise = token ? validateToken(token) : undefined;
  if (userInfoPromise) {
    req.contextValues.set(authUserInfoContextKey, userInfoPromise);
  }
  const userInfo = userInfoPromise ? await userInfoPromise.catch(() => undefined) : undefined;

  const logContext = {
    req: randomUUID(),
    path: req.url,
    ...extractLogContext(req.message),
    ...(userInfo ? { userId: userInfo.identityId } : {}),
  };
  const requestLogger = withLogContext(logger, logContext);

  return runWithLogContext(logContext, async () => {
    try {
      const res = await next(req);

      const durationMs = Date.now() - start;
      const output = JSON.stringify(res.message, (_, v) => (typeof v === "bigint" ? v.toString() : v));
      const truncatedOutput = output.length > 300 ? `${output.slice(0, 300)}...` : output;
      const meta = { path: req.url, input: req.message, output: truncatedOutput, durationMs };

      requestLogger.info(meta);

      return res;
    } catch (error) {
      const durationMs = Date.now() - start;

      let errorMeta;
      if (error instanceof ConnectError) {
        errorMeta = { path: req.url, input: req.message, error: error.message, durationMs };
      } else {
        errorMeta = { path: req.url, input: req.message, error: String(error), durationMs };
      }

      requestLogger.error(errorMeta);

      throw error; // 重新抛出错误，以便上层处理
    }
  });
};
