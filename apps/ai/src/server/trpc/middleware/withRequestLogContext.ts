import { runWithLogContext } from "@scow/lib-server";
import { middleware } from "src/server/trpc/def";

export const withRequestLogContext = middleware(({ ctx, next }) => {
  return runWithLogContext(ctx.logContext, () => next({ ctx }));
});
