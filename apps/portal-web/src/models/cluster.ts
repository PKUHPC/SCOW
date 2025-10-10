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

export interface ClusterOverview {
  clusterId: string,
  partitionName: string;
  nodeCount: number,
  runningNodeCount: number,
  idleNodeCount: number,
  notAvailableNodeCount: number,
  cpuCoreCount: number,
  runningCpuCount: number,
  idleCpuCount: number,
  notAvailableCpuCount: number,
  gpuCoreCount: number,
  runningGpuCount: number,
  idleGpuCount: number,
  notAvailableGpuCount: number,
  jobCount: number,
  runningJobCount: number,
  pendingJobCount: number,
  partitionStatus: number,
}

export interface PlatformOverview {
  nodeCount: number,
  runningNodeCount: number,
  idleNodeCount: number,
  notAvailableNodeCount: number,
  cpuCoreCount: number,
  runningCpuCount: number,
  idleCpuCount: number,
  notAvailableCpuCount: number,
  gpuCoreCount: number,
  runningGpuCount: number,
  idleGpuCount: number,
  notAvailableGpuCount: number,
  jobCount: number,
  runningJobCount: number,
  pendingJobCount: number,
  partitionStatus: number,
}
