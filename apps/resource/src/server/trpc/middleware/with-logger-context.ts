import { middleware } from "src/server/trpc/def";

export const withLoggerContext = middleware(async (opts) => {
  const start = Date.now();

  const result = await opts.next();

  const durationMs = Date.now() - start;
  const meta = { path: opts.path, type: opts.type,
    input: opts.input ?? opts.getRawInput(), output: result, durationMs };

  if (result.ok) {
    console.log("OK request timing:", meta);
  } else {
    console.error("Non-OK request timing", meta);
  }

  return result;
});
