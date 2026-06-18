import { router } from "src/server/trpc/def";

import { createDevHost, getCreateDevParams } from "./devHost";

export const devHost = router({
  createDevHost,
  getCreateDevParams,
});
