import { trpc } from "src/server/trpc/def";

import { accountRouter } from "./route/account";
import { algorithm } from "./route/algorithm";
import { auth } from "./route/auth";
import { config } from "./route/config";
import { dashboard } from "./route/dashboard";
import { dataset } from "./route/dataset";
import { file } from "./route/file";
import { image } from "./route/image";
import { jobsRouter } from "./route/jobs";
import { logo } from "./route/logo";
import { model } from "./route/model";
import { resource } from "./route/resource";

export const appRouter = trpc.router({
  dataset,
  image,
  auth,
  logo,
  config,
  algorithm,
  model,
  file,
  resource,
  account: accountRouter,
  jobs: jobsRouter,
  dashboard,
});

export type AppRouter = typeof appRouter;

export type Caller = ReturnType<typeof appRouter.createCaller>;
