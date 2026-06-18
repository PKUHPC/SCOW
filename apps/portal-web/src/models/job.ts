import type { RunningJob } from "@scow/protos/build/common/job";
import type { Cluster } from "src/utils/cluster";

import { parseTime } from "@scow/lib-web/build/utils/datetime";
import dayjs from "dayjs";

export type RunningJobInfo = RunningJob & {
  cluster: Cluster;
  runningOrQueueTime: string;
  elapsed?: string;
  submitTime: string;
};

export const RunningJobInfo = {
  fromGrpc: (info: RunningJob, cluster: Cluster): RunningJobInfo => ({
    ...info,
    cluster,
    runningOrQueueTime: calculateRunningOrQueueTime(info),
    submitTime: info.submissionTime,
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
  if (a === b || (a !== endState && b !== endState)) {
    return 0;
  }
  if (a === endState) {
    return -1;
  }
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
}

export enum TimeUnit {
  MINUTES = 0,
  HOURS = 1,
  DAYS = 2,
}

export enum ReservedAppAttributeName {
  APP_JOB_NAME = "APP_JOB_NAME",
  ACCOUNT = "ACCOUNT",
  PARTITION = "PARTITION",
  QOS = "QOS",
  NODE_COUNT = "NODE_COUNT",
  CORE_COUNT = "CORE_COUNT",
  GPU_COUNT = "GPU_COUNT",
  MAX_TIME = "MAX_TIME",
}

export const statusColors: Record<string, string> = {
  RUNNING: "#46B600",
  PENDING: "#B0B600",
  COMPLETED: "#3584D9",
  FAILED: "#D93566",
  CANCELED: "#A1A1A1",
  TIMEOUT: "#5FBDEC",
  ENDED: "#6A6A6A",
};

export enum AccountUnavailableReason {
  ACCOUNT_UNAVAILABLE_REASON_UNSPECIFIED = 0,
  USER_BLOCKED = 1,
  ACCOUNT_FROZEN = 2,
  ACCOUNT_BLOCKED = 3,
  ACCOUNT_DEBT = 4,
  USER_QUOTA_EXCEEDED = 5,
}
