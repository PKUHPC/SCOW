import { Code, ConnectError, type Interceptor } from "@connectrpc/connect";
import { commonConfig } from "src/server/config/common";
import { logger } from "src/utils/logger";

// 统一包装资源管理服务返回给客户端的ConnectError
function wrapResourceConnectError(errMessage: string, code: number): ConnectError {
  return new ConnectError(`Resource Service Error. ${errMessage}`, code);
}

export const loggerInterceptor: Interceptor = (next) => async (req) => {
  const start = Date.now();

  // 在处理请求前检查功能是否开启
  if (!commonConfig.scowResource?.enabled) {
    const durationMs = Date.now() - start;
    const errorMeta = {
      path: req.url,
      input: req.message,
      error: "Resource management feature is disabled",
      connectCode: Code.Unimplemented,
      durationMs,
    };

    logger.error(errorMeta);
    throw wrapResourceConnectError("Resource management feature is currently disabled", Code.Unimplemented);
  }

  // 处理请求
  try {
    const res = await next(req);
    const durationMs = Date.now() - start;
    const meta = { path: req.url, input: req.message, output: res.message, durationMs };
    logger.info(meta);
    return res;
  } catch (error) {
    const durationMs = Date.now() - start;
    let finalError: ConnectError;
    let errorMeta: any;

    // 本身为ConnectError时直接抛出
    if (error instanceof ConnectError) {
      errorMeta = {
        path: req.url,
        input: req.message,
        error: error.message,
        errorCode: error.code,
        durationMs,
      };
      finalError = wrapResourceConnectError(error.message, error.code);

      // 兜底报错
    } else {
      const err = error as any;
      finalError = wrapResourceConnectError(
        "Error occurred. Please confirm the details in resource log.",
        Code.Internal,
      );

      errorMeta = {
        path: req.url,
        input: req.message,
        error: finalError.message,
        originalType: err.constructor?.name,
        connectCode: finalError.code,
        metadata: {
          "error-source": "unknown",
          "error-type": err.constructor?.name || "Unknown",
          "original-error": err.message || String(err),
          "error-code": String(err.code || "unknown"),
          "error-name": err.name || "",
        },
        durationMs,
      };
    }

    logger.error(errorMeta);
    throw finalError;
  }
};
