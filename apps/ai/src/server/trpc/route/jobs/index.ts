import { router } from "src/server/trpc/def";

import {
  checkAppConnectivity,
  checkDevHostAppConnectivity,
  connectToApp,
  connectToDevHostApp,
  createAppSession,
  getAppMetadata,
  getCreateAppParams,
  getJobDetails,
  listApps,
  listAppSessions,
  listAvailableApps,
  listClusters,
  listTags,
  saveImage,
} from "./apps";
import { getSubmitInferenceParams,submitInferJob } from "./infer";
import { cancelJob, downloadPodLog, getJobSchedulingAndStartupLogs,
  getPodLogs, getPodMonitorInfo, getPodsByJobId, getSubmitTrainParams,
  trainJob } from "./jobs";

export const jobsRouter = router({
  listAvailableApps,
  getAppMetadata,
  createAppSession,
  listAppSessions,
  checkAppConnectivity,
  checkDevHostAppConnectivity,
  getCreateAppParams,
  connectToApp,
  connectToDevHostApp,
  listApps,
  listTags,
  listClusters,
  cancelJob,
  saveImage,
  trainJob,
  getSubmitTrainParams,
  submitInferJob,
  getSubmitInferenceParams,
  getJobSchedulingAndStartupLogs,
  getPodsByJobId,
  getPodLogs,
  downloadPodLog,
  getPodMonitorInfo,
  getJobDetails,
});
