import { router } from "src/server/trpc/def";
import { app } from "src/server/trpc/route/backend/app";
import { device } from "src/server/trpc/route/backend/device";
import { my } from "src/server/trpc/route/backend/my";
import { task } from "src/server/trpc/route/backend/task";
import { tokenRouter } from "src/server/trpc/route/backend/token";
import { transpile } from "src/server/trpc/route/backend/transpile";

export const backendApiRouter = router({
  task,
  device,
  app,
  my,
  transpile,
  token: tokenRouter,
});
