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

import { parseTime } from "@scow/lib-web/build/utils/datetime";
import type { RunningJob } from "@scow/protos/build/common/job";
import dayjs from "dayjs";
import type { Cluster } from "src/utils/config";


export type RunningJobInfo = RunningJob & { cluster: Cluster; runningOrQueueTime: string };

export const RunningJobInfo = {
  fromGrpc: (info: RunningJob, cluster: Cluster): RunningJobInfo => ({
    ...info,
    cluster,
    runningOrQueueTime: calculateRunningOrQueueTime(info),
  }),
};

function pad(num: number) {
  return num >= 10 ? num : "0" + num;
}

function calculateRunningOrQueueTime(r: RunningJob) {
  if (r.state !== "PENDING") {
    return r.runningTime;
  }

  // calculate to format [{days}-][{Hours}:]{MM}:{SS}
  const diffMs = dayjs().diff(r.submissionTime);
  return formatTime(diffMs);
}

export function runningJobId(r: RunningJobInfo) {
  return `${r.cluster.id}:${r.jobId}`;
}

export function compareState(a: string, b: string): -1 | 0 | 1 {
  const endState = "ENDED";
  if (a === b || (a !== endState && b !== endState)) { return 0; }
  if (a === endState) { return -1; }
  return 1;
}

export function calculateAppRemainingTime(runningTime: string, timeLimit: string) {
  if (runningTime.split(/[:-]/).length < 2 || timeLimit.split(/[:-]/).length < 2) {
    // if timeLimit or runningTime is INVALID or UNLIMITED, return timeLimit
    return timeLimit;
  }
  const diffMs = parseTime(timeLimit) - parseTime(runningTime);
  return diffMs < 0 ? "00:00" : formatTime(diffMs);
}

// calculate number of milliseconds to format [{days}-][{Hours}:]{MM}:{SS}
export function formatTime(milliseconds: number) {
  const seconds = milliseconds / 1000;
  const minutes = seconds / 60;
  const hours = minutes / 60;
  const days = hours / 24;

  let text = "";
  text += days >= 1 ? Math.floor(days) + "-" : "";
  const hoursModulo = Math.floor(hours % 24);
  text += hours >= 1 ? pad(hoursModulo) + ":" : "";
  const minModulo = Math.floor(minutes % 60);
  text += pad(minModulo);
  text += ":";
  const secModulo = Math.floor(seconds % 60);
  text += pad(secModulo);

  return text;
}

export enum AccountStatusFilter {
  ALL = 0,
  BLOCKED_ONLY = 1,
  UNBLOCKED_ONLY = 2,
};

