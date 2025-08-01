import { trpc } from "src/server/trpc/def";
import { auth } from "src/server/trpc/route/auth";
import { backendApiRouter } from "src/server/trpc/route/backend";
import { configRouter } from "src/server/trpc/route/config";
import { jobsRouter } from "src/server/trpc/route/jobs";

export const appRouter = trpc.router({
  auth,
  config: configRouter,
  backend: backendApiRouter,
  jobs: jobsRouter,
});

export type AppRouter = typeof appRouter;

export type Caller = ReturnType<typeof appRouter.createCaller>;
