import { JsonFetchResultPromiseLike } from "@ddadaal/next-typed-api-routes-runtime/lib/client";
import { ClusterActivationStatus } from "@scow/config/build/type";
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

export const runningJob = {
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
  memReq: 100,
  cpusAlloc: 1,
  nodesAlloc: 1,
  gpusAlloc: 0,
  memAlloc: 100,
  submitTime: "2021-12-22T16:16:02",
};

export const job = {
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
  nodes: 1,
  cores: 1,
  gpus: 0,
  memReq: 100,
  cpusAlloc: 1,
  memAlloc: 100,
  nodesAlloc: 1,
  gpusAlloc: 0,
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

  getUserAvailableClusterApps: null,
  getAppInitialConfig: null,

  checkAppConnectivity: async () => ({
    ok: Math.random() < 0.5,
  }),

  checkShadowDeskConnectivity: async () => ({
    ok: Math.random() < 0.5,
  }),

  getAllJobs: async () => ({ results: [job]}),

  getAllClustersAvailableApps: async () => ({
    results: [{
      clusterId: "hpc01",
      apps: [
        { id: "vscode", name: "VSCode", logoPath: "/apps/VSCode.svg" },
        { id: "emacs", name: "Emacs" },
        { id: "jupyter", name: "jupyter" },
      ],
    }],
  }),
  listAvailableApps: async () => ({
    apps: [
      { id: "vscode", name: "VSCode", logoPath: "/apps/VSCode.svg" },
      { id: "emacs", name: "Emacs" },
      { id: "jupyter", name: "jupyter" },
    ],
  }),

  listFile: null,

  copyFileItem: null,
  compressFiles: null,
  createFile: null,
  deleteDir: null,
  deleteFile: null,
  getHomeDirectory: null,
  mkdir: null,
  moveFileItem: null,

  downloadFile: null,
  compressAndDownloadFile: null,
  uploadFile: null,
  fileExist: null,
  getFileType: null,
  getFileMetadata: null,

  createAppSession: async () => ({ jobId: 123, sessionId: "is" }),

  cancelJob: async () => null,

  listAvailableWms: async () => ({
    wms: [{ name: "cinnamon", wm: "Cinnamon" }, { name: "gnome", wm: "GNOME" }],
  }),

  getAppSessions: async () => ({
    sessions: [
      {
        jobId: 100, jobName: "123", sessionId: "123", appId: "vscode", appName: "vscode", state: "PENDING",
        reason: "resource",submitTime: new Date().toISOString(), host: "192.168.88.100", port: 1000,
        dataPath: "/test", timeLimit: "01:00:00", runningTime: "",
      },
      {
        jobId: 101, jobName: "124", sessionId: "124", appId: "vscode", appName: "vscode", state: "RUNNING",
        submitTime: new Date().toISOString(), dataPath: "/test",
        timeLimit: "1-01:00:00", runningTime: "01:50",
      },
      {
        jobId: 102, jobName: "125", sessionId: "125", appId: "vscode", appName: "vscode", state: "RUNNING",
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
    reservedAppAttributes: [],
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

  launchDesktop: async () => ({ type: "vnc", host: "login01", password: "123", port: 1234 }),

  listDesktops: async () => ({
    userDesktops: [{
      host: "login01",
      desktops: [
        { type : "vnc", vnc: { displayId: 1, desktopName: "111", wm: "", createTime: "" } },
        { type : "vnc", vnc: { displayId: 222, desktopName: "222", wm: "", createTime: "" } },
        { type : "vnc", vnc: { displayId: 1, desktopName: "333", wm: "", createTime: "" } },
      ],
    }],
  }),

  createDesktop: async () => (
    {
      type: "vnc",
      host: "login01",
      password: "123",
      port: 1234,
    }),

  killDesktop: async () => null,

  logout: async () => null,

  authCallback: async () => undefined as never,

  changePassword: async () => null,

  changeEmail: async () => null,

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
        description: undefined,
      },
    },
  }),

  getUserAssociatedClusterIds: async () => ({
    clusterIds: ["hpc00", "hpc01", "hpc02"],
  }),

  getUserInfo: async () => ({
    userInfo: {
      phone: "123123123",
      email: "123@qq.com",
      tenantName: "default",
      organization: "1211",
      tenantRoles: [0, 1],
      platformRoles: [0],
      createTime: "2024-12-05T02:05:05.105Z",
    },
  }),

  mergeFileChunks: null,
  initMultipartUpload: async () => ({
    tempFileDir: "home/user/scow/tempDir",
    chunkSizeByte: 5 * 1024 * 1024,
    filesInfo: [],
  }),

  markMessageRead: null,
  getUnreadMessages: async () => ({
    results: {
      totalCount: 2,
      messages: [{
        "id": 20,
        "messageType": {
          "type": "SystemNotification",
          "titleTemplate": {
            "default": "系统公告",
            "en": "System Notification",
            "zhCn": "系统公告",
            "de": "Systembenachrichtigung",
            "es": "Notificación del sistema",
            "fr": "Notification système",
            "ja": "システム通知",
            "ko": "시스템 알림",
            "pt": "Notificação do sistema",
            "ru": "Системное уведомление",
          },
          "category": "Admin",
          "categoryTemplate": {
            "default": "Admin Messages",
            "en": "Admin Messages",
            "zhCn": "管理员消息",
            "de": "Admin-Nachrichten",
            "es": "Mensajes de administrador",
            "fr": "Messages d'administrateur",
            "ja": "管理者メッセージ",
            "ko": "관리자 메시지",
            "pt": "Mensagens de administrador",
            "ru": "Сообщения администратора",
          },
        },
        "metadata": {
          "title": "测试2",
          "content": "测试2测试2测试2测试2测试2测试2测试2测试2测试2",
        },
        "isRead": false,
        "createdAt": "2024-08-22T02:03:38.297Z",
        "updatedAt": "2024-08-22T02:03:38.297Z",
      },
      {
        "id": 19,
        "messageType": {
          "type": "SystemNotification",
          "titleTemplate": {
            "default": "系统公告",
            "en": "System Notification",
            "zhCn": "系统公告",
            "de": "Systembenachrichtigung",
            "es": "Notificación del sistema",
            "fr": "Notification système",
            "ja": "システム通知",
            "ko": "시스템 알림",
            "pt": "Notificação do sistema",
            "ru": "Системное уведомление",
          },
          "category": "Admin",
          "categoryTemplate": {
            "default": "Admin Messages",
            "en": "Admin Messages",
            "zhCn": "管理员消息",
            "de": "Admin-Nachrichten",
            "es": "Mensajes de administrador",
            "fr": "Messages d'administrateur",
            "ja": "管理者メッセージ",
            "ko": "관리자 메시지",
            "pt": "Mensagens de administrador",
            "ru": "Сообщения администратора",
          },
        },
        "metadata": {
          "title": "测试1",
          "content": "测试1测试1测试1测试1测试1测试1测试1",
        },
        "isRead": true,
        "createdAt": "2024-08-21T09:34:43.200Z",
        "updatedAt": "2024-08-21T09:34:43.200Z",
      }],
    },
  }),
  getAllClustersInfo: async () => ({
    results: [{
      clusterId: "aaa",
      clusterInfo: {
        clusterId: "aaa",
        nodeCount: 4,
        runningNodeCount: 1,
        idleNodeCount: 3,
        notAvailableNodeCount: 0,
        cpuCoreCount: 8,
        runningCpuCount: 4,
        idleCpuCount: 3,
        notAvailableCpuCount: 1,
        gpuCoreCount: 6,
        runningGpuCount: 3,
        idleGpuCount: 2,
        notAvailableGpuCount: 1,
        jobCount: 14,
        runningJobCount: 4,
        pendingJobCount: 10,
        partitions: [],
      },
    }],
  }),

  getAllSummaryClustersInfo: async () => ({
    results: [
      {
        clusterId: "dev-k8s-c",
        nodeCount: 3,
        runningNodeCount: 2,
        idleNodeCount: 1,
        notAvailableNodeCount: 0,
        cpuCoreCount: 24,
        runningCpuCount: 0,
        idleCpuCount: 24,
        notAvailableCpuCount: 0,
        gpuCoreCount: 1,
        runningGpuCount: 0,
        idleGpuCount: 1,
        notAvailableGpuCount: 0,
        jobCount: 0,
        runningJobCount: 2,
        pendingJobCount: 0,
        nodeUsage: 10.00,
        cpuUsage: 10.00,
        gpuUsage: 10.00,
        partitions: [
          {
            partitionName: "CPU8C14G",
            nodeCount: 2,
            nodeUsage: 20.00,
            cpuCoreCount: 2,
            cpuUsage: 20.00,
            gpuCoreCount: 2,
            gpuUsage: 20.00,
            pendingJobCount: 0,
            partitionStatus: 1,
          },
        ],
      },
    ],
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
  getAllClusterNodesInfo: async () => ({
    results: [{
      clusterId: "abc",
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

  getUserAssociatedClusterPartitions: async () => ({
    clusterPartitions: {
      "hpc01": ["normal", "high", "low"],
      "hpc02": ["gpu"],
    },
  }),

  decompressFile: null,

  getUserStorageInfo: async () => ({
    storageInfos: [{
      path: "/data/home",
      quotaBytes: 321321321,
      usedStorageBytes: 123123123,
    }],
  }),

  getIsUserEnabledRootShell: async () => ({
    result: true,
  }),

};



