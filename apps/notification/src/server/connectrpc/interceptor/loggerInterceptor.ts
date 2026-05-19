import { ConnectError, type Interceptor } from "@connectrpc/connect";
import { logger } from "src/utils/logger";

export const loggerInterceptor: Interceptor = (next) => async (req) => {
  const start = Date.now();

  try {
    const res = await next(req);

    const durationMs = Date.now() - start;
    const output = JSON.stringify(res.message, (_, v) => (typeof v === "bigint" ? v.toString() : v));
    const truncatedOutput = output.length > 300 ? `${output.slice(0, 300)}...` : output;
    const meta = { path: req.url, input: req.message, output: truncatedOutput, durationMs };

    logger.info(meta);

    return res;
  } catch (error) {
    const durationMs = Date.now() - start;

    let errorMeta;
    if (error instanceof ConnectError) {
      errorMeta = { path: req.url, input: req.message, error: error.message, durationMs };
    } else {
      errorMeta = { path: req.url, input: req.message, error: String(error), durationMs };
    }

    logger.error(errorMeta);

    throw error; // 重新抛出错误，以便上层处理
  }
};
