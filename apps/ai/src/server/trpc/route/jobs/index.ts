/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { router } from "src/server/trpc/def";

import {
  checkAppConnectivity,
  connectToApp,
  createAppSession,
  getAppMetadata,
  getCreateAppParams,
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
  getCreateAppParams,
  connectToApp,
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
});
