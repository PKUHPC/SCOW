import { router } from "src/server/trpc/def";

import { cancelJob, checkAppConnectivity, connectToApp, getQuantumConfig, listAppSessions } from "./apps";

export const jobsRouter = router({
  listAppSessions,
  getQuantumConfig,
  connectToApp,
  checkAppConnectivity,
  cancelJob,
});
