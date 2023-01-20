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
  const seconds = diffMs / 1000;
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

export function runningJobId(r: RunningJobInfo) {
  return `${r.cluster.id}:${r.jobId}`;
}

export enum AmountStrategy {
  MAX_CPUSALLOC_MEM = "max-cpusAlloc-mem",
  MAX_GPU_CPUSALLOC = "max-gpu-cpusAlloc",
  GPU = "gpu",
  CPUS_ALLOC = "cpusAlloc"
}

export const AmountStrategyDescribe: Record<AmountStrategy, string> = {
  "max-cpusAlloc-mem": "按最大 CPU|内存 分配量收费",
  "max-gpu-cpusAlloc": "按最大 GPU|CPU|内存 分配量收费",
  "gpu": "按 GPU 分配量收费",
  "cpusAlloc": "按 CPU 分配量收费",
};
export const AmountStrategyAlgorithm: Record<AmountStrategy, string> = {
  "max-cpusAlloc-mem": "max(cpusAlloc, 向上取整(memReq / (分区内存量/分区核心数)))",
  "max-gpu-cpusAlloc": "max(gpu, 向上取整(cpusAlloc / (分区核心数/分区gpu数)))",
  "gpu": "gpu",
  "cpusAlloc": "cpusAlloc",
};
