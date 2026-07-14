import { runWithLogContext } from "@scow/lib-server";
import { middleware } from "src/server/trpc/def";

export const withLoggerContext = middleware(async (opts) => {
  return runWithLogContext(opts.ctx.logContext, async () => {
    const start = Date.now();

    const result = await opts.next();

    const durationMs = Date.now() - start;
    const meta = {
      path: opts.path,
      type: opts.type,
      input: opts.input ?? opts.getRawInput(),
      output: result,
      durationMs,
    };

    if (result.ok) {
      opts.ctx.logger.info(meta, "OK request timing");
    } else {
      opts.ctx.logger.error(meta, "Non-OK request timing");
    }

    return result;
  });
});
