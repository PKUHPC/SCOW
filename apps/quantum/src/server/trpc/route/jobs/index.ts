import { router } from "src/server/trpc/def";

import {
  checkAppConnectivity,
  connectToApp,
  getQuantumConfig,
  listAppSessions } from "./apps";

export const jobsRouter = router({
  listAppSessions,
  getQuantumConfig,
  connectToApp,
  checkAppConnectivity,
});
