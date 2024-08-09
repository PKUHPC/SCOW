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

import { JsonFetchResultPromiseLike } from "@ddadaal/next-typed-api-routes-runtime/lib/client";
import { ClusterActivationStatus } from "@scow/config/build/type";
import type { RunningJob } from "@scow/protos/build/common/job";
import { JobInfo } from "@scow/protos/build/portal/job";
import { type api } from "src/apis/api";
import { TimeUnit } from "src/models/job";
export type MockApi<TApi extends Record<
  string,
  (...args: any[]) => JsonFetchResultPromiseLike<any>>,
> = {[key in keyof TApi]: null | (
    (...args: Parameters<TApi[key]>) =>
    Promise<
      ReturnType<TApi[key]> extends PromiseLike<infer TSuc>
        ? TSuc
        : never
    >)
};

export const runningJob: RunningJob = {
  jobId: "123",
  account: "123",
  cores: "123",
  gpus: "123",
  name: "123",
  nodes: "123",
  nodesOrReason: "!23",
  partition: "123",
  qos: "123",
  runningTime: "123",
  state: "PENDING",
  submissionTime: "2021-12-22T16:16:02",
  user: "!23",
  timeLimit: "NOT_SET",
  workingDir: "/home/ddadaal/Code",
};

export const job: JobInfo = {
  jobId: 123,
  account: "123",
  name: "123",
  partition: "123",
  qos: "123",
  state: "PENDING",
  timeLimit: "NOT_SET",
  workingDirectory: "/home/ddadaal/Code",
  elapsed: "00:00:00",
  reason: "None",
  submitTime: "2022-07-07T09:21:42",
  startTime: "2022-07-07T09:21:42",
  endTime: "2022-07-07T09:21:52",
};

export const mockApi: MockApi<typeof api> = {
  getQuickEntries: async () => ({
    quickEntries: [
      {
        id: "submitJob",
        name: "submitJob",
        entry: {
          $case: "pageLink",
          pageLink: {
            path: "/jobs/submit",
            icon: "PlusCircleOutlined",
          },
        },
      },
      {
        id: "runningJob",
        name: "runningJobs",
        entry: {
          $case: "pageLink",
          pageLink: {
            path: "/jobs/runningJobs",
            icon: "BookOutlined",
          },
        },
      },
      {
        id: "allJobs",
        name: "allJobs",
        entry: {
          $case: "pageLink",
          pageLink: {
            path: "/jobs/allJobs",
            icon: "BookOutlined",
          },
        },
      },
    ],
  }),
  saveQuickEntries: null,
  getClusterInfo: null,
  getClusterRunningInfo: null,
  listAvailableTransferClusters: null,

  checkAppConnectivity: async () => ({
    ok: Math.random() < 0.5,
  }),

  getAllJobs: async () => ({ results: [job]}),

  listAvailableApps: async () => ({
    apps: [
      { id: "vscode", name: "VSCode", logoPath: "/apps/VSCode.svg" },
      { id: "emacs", name: "Emacs" },
      { id: "jupyter", name: "jupyter" },
    ],
  }),

  listFile: null,

  copyFileItem: null,
  createFile: null,
  deleteDir: null,
  deleteFile: null,
  getHomeDirectory: null,
  mkdir: null,
  moveFileItem: null,

  downloadFile: null,
  uploadFile: null,
  fileExist: null,
  getFileType: null,

  createAppSession: async () => ({ jobId: 123, sessionId: "is" }),

  cancelJob: async () => null,

  listAvailableWms: async () => ({
    wms: [{ name: "cinnamon", wm: "Cinnamon" }, { name: "gnome", wm: "GNOME" }],
  }),

  getAppSessions: async () => ({
    sessions: [
      {
        jobId: 100, sessionId: "123", appId: "vscode", appName: "vscode", state: "PENDING", reason: "resource",
        submitTime: new Date().toISOString(), host: "192.168.88.100", port: 1000, dataPath: "/test",
        timeLimit: "01:00:00", runningTime: "",
      },
      {
        jobId: 101, sessionId: "124", appId: "vscode", appName: "vscode", state: "RUNNING",
        submitTime: new Date().toISOString(), dataPath: "/test",
        timeLimit: "1-01:00:00", runningTime: "01:50",
      },
      {
        jobId: 102, sessionId: "125", appId: "vscode", appName: "vscode", state: "RUNNING",
        submitTime: new Date().toISOString(), host: "192.168.88.100", port: 10000, dataPath: "/test",
        timeLimit: "INVALID", runningTime: "01:55",
      },
    ],
  }),

  getAppMetadata: async () => ({
    appName: "test",
    appCustomFormAttributes: [
      {
        type: "NUMBER", label: "版本", name: "version", required: false,
        placeholder: "选择版本", defaultValue: 123, select: [],
      },
      {
        type: "TEXT", label: "文字", name: "text", required: false,
        placeholder: "提示信息", defaultValue: 555, select: [],
      },
      {
        type: "TEXT", label: "其他sbatch参数", name: "sbatchOptions",
        required: true, placeholder: "比如：--gpus gres:2 --time 10", select: [],
      },
      {
        type: "SELECT", label: "选项", name: "option", required: false,
        placeholder: "提示信息", defaultValue: "version2", select: [
          { label: "版本1", value: "version1" },
          { label: "版本2", value: "version2" },
        ],
      },
    ],
  }),

  connectToApp: async ({ body: { sessionId } }) => sessionId === "124"
    ? {
      host: "127.0.0.1", port: 3000, password: "123", type: "web",
      connect: {
        method: "POST",
        path: "/test",
        query: { test: "!23" },
        formData: { test: "123" },
      },
      proxyType: "relative",
      customFormData: { USERNAME: "bob" },
    }
    : {
      host: "127.0.0.1", port: 3000, password: "123", type: "vnc",
    },


  getJobTemplate: async () => ({
    template: {
      account: "123",
      command: "123",
      coreCount: 2,
      jobName: "123",
      maxTime: 123,
      nodeCount: 4,
      partition: "low",
      qos: "low",
      output: "job.%j.out",
      errorOutput: "job.%j.err",
      workingDirectory: "/nfs/jobs/123",
      maxTimeUnit: TimeUnit.MINUTES,
    },
  }),

  listJobTemplates: async () => ({
    results: [{
      id: "123-sample-apple",
      comment: "1234",
      submitTime: new Date().toString(),
      jobName: "sample-apple",
    }],
  }),

  deleteJobTemplate: async () => null,

  renameJobTemplate: async () => null,

  getAccounts: async () => ({ accounts: ["hpc01", "hpc02"]}),

  launchDesktop: async () => ({ host: "login01", password: "123", port: 1234 }),

  listDesktops: async () => ({
    userDesktops: [{
      host: "login01",
      desktops: [
        { displayId: 1, desktopName: "111", wm: "", createTime: "" },
        { displayId: 222, desktopName: "222", wm: "", createTime: "" },
        { displayId: 1, desktopName: "333", wm: "", createTime: "" },
      ],
    }],
  }),

  createDesktop: async () => (
    {
      host: "login01",
      password: "123",
      port: 1234,
    }),

  killDesktop: async () => null,

  logout: async () => null,

  authCallback: async () => undefined as never,

  changePassword: async () => null,

  checkPassword: null,

  validateToken: null,

  getRunningJobs: async () => ({ results: [runningJob]}),

  submitJob: async () => ({ jobId: 10 }),

  submitFileAsJob: async () => ({ jobId: 10 }),

  getAppLastSubmission: async () => ({
    lastSubmissionInfo: {
      userId: "test123",
      cluster: "hpc01",
      appId: "vscode",
      appName: "VSCode",
      account: "a_aaaaaa",
      partition: "compute",
      qos: "high",
      nodeCount: 1,
      coreCount: 2,
      maxTime: 10,
      submitTime: "2021-12-22T16:16:02",
      customAttributes: { selectVersion: "code-server/4.9.0", sbatchOptions: "--time 10" },
    },
  }),

  startFileTransfer: null,
  queryFileTransferProgress: null,
  terminateFileTransfer: null,
  checkTransferKey: null,

  getAvailablePartitionsForCluster: async () => ({ partitions: []}),
  getClusterConfigFiles: async () => ({
    clusterConfigs: {
      hpc01: {
        displayName: "hpc01Name",
        priority: 1,
        adapterUrl: "0.0.0.0:0000",
        proxyGateway: undefined,
        loginNodes: [{ "address": "localhost:22222", "name": "login" }],
        loginDesktop: undefined,
        turboVncPath: undefined,
        crossClusterFileTransfer: undefined,
        hpc: { enabled: true },
        ai: { enabled: false },
        k8s: undefined,
      },
    },
  }),

  mergeFileChunks: null,
  initMultipartUpload: async () => ({
    tempFileDir: "home/user/scow/tempDir",
    chunkSizeByte: 5 * 1024 * 1024,
    filesInfo: [],
  }),
  getClustersRuntimeInfo: async () => ({
    results: [{
      clusterId: "hpc01",
      activationStatus: ClusterActivationStatus.ACTIVATED,
      operatorId: undefined,
      operatorName: undefined,
      comment: "",
    }],
  }),
  getClusterNodesInfo: async () => ({
    nodeInfo: [{
      gpuCount: 1,
      state: 1,
      partitions: ["linux","compute"],
      cpuCoreCount: 1,
      idleGpuCount: 1,
      nodeName: "h1",
      allocCpuCoreCount: 1,
      idleCpuCoreCount: 1,
      totalMemMb: 0.23,
      allocMemMb: 0.32,
      idleMemMb: 0.5,
      allocGpuCount: 0.5,
    }],
  }),
};



