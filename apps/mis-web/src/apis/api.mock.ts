import { HttpError, JsonFetchResultPromiseLike } from "@ddadaal/next-typed-api-routes-runtime/lib/client";
import { ClusterActivationStatus } from "@scow/config/build/type";
import { numberToMoney } from "@scow/lib-decimal";
import { type Account } from "@scow/protos/build/server/account";
import type { AccountUserInfo, GetUserStatusResponse } from "@scow/protos/build/server/user";
import { type api } from "src/apis/api";
import { ClusterConnectionStatus, NodeStatus } from "src/models/cluster";
import { OperationResult } from "src/models/operationLog";
import { AccountState, ClusterAccountInfo_ImportStatus, DisplayedAccountState, PlatformRole,
  TenantRole, UserInfo, UserRole, UserState,UserStatus } from "src/models/User";
import { JobInfo } from "src/pages/api/job/jobInfo";
import { RunningJob } from "src/pages/api/job/runningJobs";
import { DEFAULT_TENANT_NAME } from "src/utils/constants";

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



const mockJobInfo: JobInfo = {
  "biJobIndex": 3670368,
  "idJob": 5119061,
  "account": "hpc0006167252",
  "user": "1600011702",
  "partition": "C032M0128G",
  "nodelist": "a5u15n01",
  "jobName": "CoW",
  "cluster": "未名一号",
  "timeSubmit": "2020-04-23T22:23:00.000Z",
  "timeStart": "2020-04-23T22:25:12.000Z",
  "timeEnd": "2020-04-23T23:18:02.000Z",
  "gpu": 0,
  "cpusReq": 32,
  "memReq": 124000,
  "nodesReq": 1,
  "cpusAlloc": 32,
  "memAlloc": 124000,
  "nodesAlloc": 1,
  "timelimit": 7200,
  "timeUsed": 3170,
  "timeWait": 132,
  "qos": "normal",
  "recordTime": "2020-04-23T23:49:50.000Z",
  "accountPrice": numberToMoney(10),
  "tenantPrice": numberToMoney(20),
  userName: "demo",
  accountOwnerId: "demo",
  accountOwnerName: "demo",
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
  memReq: 100,
  cpusAlloc: 100,
  memAlloc: 100,
  nodesAlloc: 1,
  gpusAlloc: 0,
  submitTime: "2021-12-22T16:16:02",
};

const mockAccounts: Required<Account>[] = [
  { accountName: "hpc123456", userCount: 3, blocked: true, tenantName: "default",
    ownerId: "123", ownerName: "哈哈", comment: "123",
    state: AccountState.NORMAL, isInWhitelist: false, displayedState: DisplayedAccountState.DISPLAYED_NORMAL,
    balance: numberToMoney(20), blockThresholdAmount: numberToMoney(0), defaultBlockThresholdAmount: numberToMoney(0) },
  { accountName: "hpc1234567", userCount: 10, blocked: false, tenantName: "default",
    ownerId: "123", ownerName: "哈哈哈哈", comment: "123",
    state: AccountState.NORMAL, isInWhitelist: false, displayedState: DisplayedAccountState.DISPLAYED_NORMAL,
    balance: numberToMoney(30), blockThresholdAmount: numberToMoney(0), defaultBlockThresholdAmount: numberToMoney(0) },
];

const mockUsers = [
  {
    tenantName: DEFAULT_TENANT_NAME,
    tenant: DEFAULT_TENANT_NAME,
    userId: "test",
    createTime: "2020-04-23T23:49:50.000Z",
    email: "test@test.com",
    phone: "136363668",
    adminComment: "test mock user",
    organization: "org1",
    name: "testuser",
    id: "123",
    tenantRoles: [TenantRole.TENANT_ADMIN, TenantRole.TENANT_FINANCE],
    platformRoles: [PlatformRole.PLATFORM_FINANCE, PlatformRole.PLATFORM_ADMIN],
    accountAffiliations: [
      { accountName: "hpc2001213077", role: UserRole.ADMIN, accountState:AccountState.NORMAL },
      { accountName: "hpc2001213075", role: UserRole.USER, accountState:AccountState.NORMAL },
    ],
    state:UserState.NORMAL,
  },
];


export const mockApi: MockApi<typeof api> = {
  getMissingDefaultPriceItems: async () => {
    return { items: ["test.test", "test1.test2"]};
  },


  getAllTenants: async () => (
    {
      totalCount: 3,
      platformTenants: [{
        tenantId: 1,
        tenantName: "test1",
        balance: numberToMoney(0.0000),
        userCount: 1,
        accountCount: 1,
        createTime: "2022-10-05T23:49:50.000Z",
      },
      {
        tenantId: 2,
        tenantName: "test2",
        balance: numberToMoney(10.0000),
        userCount: 4,
        accountCount: 2,
        createTime: "2022-10-05T23:49:50.000Z",
      },
      {
        tenantId: 3,
        tenantName: "test3",
        balance: numberToMoney(10.5),
        userCount: 5,
        accountCount: 3,
        createTime: "2022-10-05T23:49:50.000Z",
      },
      ],
    }),

  getAppInitialConfig: null,

  updatePasswordResetFlag: async () => null,

  getAllUsers: async () => ({
    totalCount: 3,
    platformUsers: [
      {
        userId: "123",
        name: "testuser",
        email: "testuser@test.com",
        availableAccounts: ["a_123"],
        tenantName: "tenant1",
        adminComment: "test01",
        phone: "1363636366",
        organization: "org1",
        createTime: "2022-10-05T23:49:50.000Z",
        platformRoles: [PlatformRole.PLATFORM_FINANCE, PlatformRole.PLATFORM_ADMIN],
        state: UserState.NORMAL,
      },
      {
        userId: "test01",
        name: "test01",
        email: "test01@test.com",
        availableAccounts: ["a_test", "a_test01"],
        tenantName: "tenant2",
        adminComment: "test02",
        phone: "1363636367",
        organization: "org2",
        createTime: "2022-10-05T23:49:50.000Z",
        platformRoles: [PlatformRole.PLATFORM_FINANCE, PlatformRole.PLATFORM_ADMIN],
        state: UserState.NORMAL,
      },
      {
        userId: "test02",
        name: "test02",
        email: "test02@test.com",
        availableAccounts: ["a_test", "a_test02"],
        tenantName: "tenant2",
        adminComment: "test03",
        phone: "1363636368",
        organization: "org3",
        createTime: "2022-10-05T23:49:50.000Z",
        platformRoles: [PlatformRole.PLATFORM_FINANCE],
        state: UserState.NORMAL,
      },
      {
        userId: "test03",
        name: "test03",
        email: "test03@test.com",
        availableAccounts: ["a_test", "a_test03"],
        tenantName: "tenant2",
        adminComment: "test04",
        phone: "1363636369",
        organization: "org4",
        createTime: "2022-10-05T23:49:50.000Z",
        platformRoles: [],
        state: UserState.DELETED,
      },
    ],
  }),

  getPlatformUsersCounts: async () => ({
    totalCount: 4,
    totalAdminCount: 2,
    totalFinanceCount: 3,
  }),

  userExists: async () => ({
    existsInScow: false,
    existsInAuth: false,
  }),

  setPlatformRole: async () => ({ executed: true }),

  unsetPlatformRole: async () => ({ executed: false }),

  setTenantRole: async () => ({ executed: true }),

  unsetTenantRole: async () => ({ executed: false }),

  addBillingItem: async () => null,

  getTenants: async () => ({ names: ["DEFAULT", "another"]}),

  getBillingItems: async () => ({
    activeItems: [
      {
        cluster: "hpc01", partition: "compute", qos: "low",
        priceItem: { itemId: "HPC08", price: numberToMoney(0.01), amountStrategy: "max-cpusAlloc-mem" },
      },
      {
        cluster: "hpc01", partition: "compute", qos: "normal",
        priceItem: { itemId: "HPC02", price: numberToMoney(0.06), amountStrategy: "gpu" },
      },
      {
        cluster: "hpc01", partition: "compute", qos: "high",
        priceItem: { itemId: "HPC03", price: numberToMoney(0.08), amountStrategy: "gpu" },
      },
      {
        cluster: "hpc01", partition: "GPU", qos: "low",
        priceItem: { itemId: "HPC04", price: numberToMoney(10.00), amountStrategy: "gpu" },
      },
      {
        cluster: "hpc01", partition: "GPU", qos: "normal",
        priceItem: { itemId: "HPC05", price: numberToMoney(12.00), amountStrategy: "gpu" },
      },
      {
        cluster: "hpc01", partition: "GPU", qos: "high",
        priceItem: { itemId: "HPC06", price: numberToMoney(14.00), amountStrategy: "gpu" },
      },
    ],
    historyItems: [
      {
        cluster: "hpc01", partition: "compute", qos: "low",
        priceItem: { itemId: "HPC01", price: numberToMoney(0.04), amountStrategy: "max-cpusAlloc-mem" },
      },
      {
        cluster: "hpc01", partition: "compute", qos: "low",
        priceItem: { itemId: "HPC07", price: numberToMoney(0.02), amountStrategy: "gpu" },
      },
    ],
    nextId: "1",
  }),

  setAsInitAdmin: async () => null,
  unsetInitAdmin: async () => null,

  initGetAccounts: async () => ({ accounts: mockAccounts }),

  initGetUsers: async () => ({ users: mockUsers }),

  getAvailableBillingTable: null,

  createInitAdmin: async () => ({ createdInAuth: false }),

  importUsers: async () => null,

  getClusterUsers: async () => {
    return ({
      accounts: [
        {
          accountName: "a_user1",
          users: [
            { userId: "user1", userName: "user1", blocked: false },
            { userId: "user2", userName: "user2", blocked: false },
          ],
          owner: "user1",
          importStatus: ClusterAccountInfo_ImportStatus.NOT_EXISTING,
          blocked: false,
        },
        {
          accountName: "account2",
          users: [
            { userId: "user2", userName: "user2", blocked: false },
            { userId: "user3", userName: "user3", blocked: false },
          ],
          importStatus: ClusterAccountInfo_ImportStatus.HAS_NEW_USERS,
          blocked: false,
        },
        {
          accountName: "a_user4",
          users: [{ userId: "user4", userName: "user4", blocked: false }],
          importStatus: ClusterAccountInfo_ImportStatus.EXISTING,
          blocked: false,
        },
      ],
    });
  },

  completeInit: async () => null,

  getFetchJobInfo: async () => ({ fetchStarted: true, schedule: "*", lastFetchTime: new Date().toISOString() }),

  setFetchState: async () => null,
  fetchJobs: async () => ({ newJobsCount: 200 }),

  cancelJobChargeLimit: async () => ({ success: true, results: []}),

  setJobChargeLimit: async () => ({ success: true, results: []}),

  getRunningJobs: async () => ({ results: [runningJob]}),

  getTopSubmitJobUser: async () => ({ results: [{ userId: "test", count: 10 }]}),

  getUsersWithMostJobSubmissions: async () => ({ results: [{ userName: "name1", userId: "test1", count: 10 }]}),

  getNewJobCount: async () => ({ results: [{ date: { year: 2023, month: 12, day: 21 }, count: 10 }]}),

  getTenantUsers: async () => ({ results: mockUsers }),

  logout: async () => null,

  getCharges: async () => ({
    results: [{
      tenantName: "tenant",
      amount: 10,
      comment: "123",
      index: 1,
      time: "123",
      accountName: "123",
      ipAddress: "127.0.0.1",
      operatorId: "123",
      type: "Task",
    }],
  }),

  getChargeRecordsTotalCount: async () => ({
    totalAmount: 10,
    totalCount: 10,
    refreshTime: "2024-11-18T09:10:54.855Z",
  }),

  getPayments: async () => ({
    results: [{
      amount: 10,
      comment: "123",
      index: 1,
      time: "123",
      accountName: "123",
      ipAddress: "127.0.0.1",
      operatorId: "123",
      type: "Task",
    }], totalCount: 1, total: 10,
  }),

  getTenantPayments: async () => ({
    results: [{
      amount: 10,
      comment: "123",
      index: 1,
      time: "123",
      tenantName: "default",
      ipAddress: "127.0.0.1",
      operatorId: "123",
      type: "Task",
    }], totalCount: 1, total: 10,
  }),

  getUsedPayTypes: async () => ({ types: ["Pay", "JobPriceChange"]}),

  changeJobPrice: async () => ({ count: 10 }),

  getJobByBiJobIndex: async () => ({ info: mockJobInfo }),

  getJobInfo: async () => ({ jobs: [mockJobInfo], totalCount: 1, totalPrice: numberToMoney(100) }),
  financePay: async () => ({ balance: 123 }),
  tenantFinancePay: async () => ({ balance: 123 }),
  authCallback: async () => undefined as never,
  getUserStatus: async () => MOCK_USER_STATUS,
  getAccountUsers: async () => ({
    totalCount: 2,
    results: [
      {
        name: "123",
        email: "123@123.com",
        status: UserStatus.BLOCKED,
        storageQuotas: {},
        userId: "123456",
        role: UserRole.ADMIN,
        jobChargeLimit: numberToMoney(20.4),
        usedJobChargeLimit: numberToMoney(10),
      },
      {
        name: "1234",
        email: "1234@123.com",
        status: UserStatus.UNBLOCKED,
        userId: "123456",
        role: UserRole.OWNER,
        storageQuotas: {
          "WM2": 100,
          "WM1": 200,
        },
      },
    ] as AccountUserInfo[],
  }),
  // addUserToAccount: async () => null,
  addUserToAccount: async ({ body }) => {
    if (body.name === "404") {
      throw new HttpError(404, { code: "USER_NOT_FOUND" });
    } else {
      return null;
    }
  },
  blockUserInAccount: async () => ({ success: true }),
  unblockUserInAccount: async () => ({ success: true }),
  blockAccount: async () => ({ executed: true }),
  unblockAccount: async () => ({ executed: true }),
  setBlockThreshold: async () => ({ executed: true }),
  setDefaultAccountBlockThreshold: async () => ({ executed: true }),
  getNewUserCount: async () => ({ results: [{ date: { year: 2023, month: 12, day: 21 }, count: 10 }]}),
  getActiveUserCount: async () => ({ results: [{ date: { year: 2023, month: 12, day: 21 }, count: 10 }]}),
  getTopChargeAccount: async () => ({
    results: [{
      accountName: "test",
      userName: "user1", chargedAmount: numberToMoney(10),
    }],
  }),
  getDailyCharge: async () => ({ results: [{ date: { year: 2023, month: 12, day: 21 }, amount: numberToMoney(10) }]}),
  getTopPayAccount: async () =>
    ({ results: [{ accountName: "test", userName: "user1", payAmount: numberToMoney(10) }]}),
  getDailyPay: async () => ({ results: [{ date: { year: 2023, month: 12, day: 21 }, amount: numberToMoney(10) }]}),
  getPortalUsageCount: async () => ({ results: [{ operationType: "submitJob", count: 10 }]}),
  getMisUsageCount: async () => ({ results: [{ operationType: "createAccount", count: 10 }]}),
  getStatisticInfo: async () => ({
    totalUser: 10, totalAccount: 10, totalTenant: 10, newUser: 10, newAccount: 10,
    newTenant: 10, refreshTime: "2024-11-18T09:10:54.855Z",
  }),
  getJobTotalCount: async () => ({ count: 10, refreshTime: "2024-11-18T09:10:54.855Z" }),
  syncBlockStatus: async () => ({
    blockedFailedAccounts: [],
    unblockedFailedAccounts: [],
    blockedFailedUserAccounts: [],
  }),
  getSyncBlockStatusJobInfo: async () => ({
    syncStarted: false,
    schedule: "0 4 * * *",
  }),
  setSyncBlockStatusState: async () => null,
  removeUserFromAccount: async () => ({ success: true, results: []}),
  setAdmin: async () => ({ executed: true }),
  unsetAdmin: async () => ({ executed: false }),
  queryStorageUsage: async () => ({ result: 10 }),
  changeStorageQuota: async () => ({ currentQuota: 10 }),
  queryStorageQuota: async () => ({ currentQuota: 10 }),
  getAccounts: async () => ({ totalCount: mockAccounts.length, results: mockAccounts }),
  getAllAccounts: async () => ({ totalCount: mockAccounts.length, results: mockAccounts }),
  changeJobTimeLimit: async () => null,
  queryJobTimeLimit: async () => ({ result: 10 }),
  cancelJob: async () => null,
  createAccount: async () => { return {}; },
  deleteAccount: async () => null,
  editUserProfile: async () => null,
  dewhitelistAccount: async () => null,
  whitelistAccount: async () => null,
  getWhitelistedAccounts: async () => ({
    results: [{
      accountName: "123",
      addTime: "2020-04-23T23:49:50.000Z",
      comment: "comment",
      operatorId: "123",
      ownerId: "123",
      ownerName: "123",
      balance: numberToMoney(10.5),
    }], totalCount: 1,
  }),

  changePassword: async () => null,
  changeEmail: async () => null,
  changePasswordAsPlatformAdmin: async () => null,
  changePasswordAsTenantAdmin: async () => null,
  checkPassword: null,
  createUser: async () => (
    {
      id: 1,
      createdInAuth: false,
    }),
  createTenant: async () => ({ createdInAuth: true }),
  createTenantWithExistingUserAsAdmin: async () => null,
  validateToken: async () => MOCK_USER_INFO,
  deleteUser: async () => null,
  getOperationLogs: async () => ({
    results: [{
      operationLogId: 99,
      operatorUserId: "testUser",
      operatorUserName: "testUser",
      operatorIp: "localhost",
      operationResult: OperationResult.SUCCESS,
      operationTime: "2020-04-23T23:49:50.000Z",
      operationEvent: { $case: "login", login: {} },
    }], totalCount: 1,
  }),

  getCustomEventTypes: async () => ({ results: []}),

  getAlarmDbId: async () => ({
    id: 13,
    uid: "kfcfkxq4",
    name: "alertdb",
    type: "mysql",
  }),
  getAlarmLogs: async () => ({
    results: [{
      id: 13,
      status: "resolved",
      severity: "Warning",
      fingerprint: "38cc18aad8e553f6",
      description: "hpc01 partition: normal - CPU usage above 80% (current value: 1)",
      startsAt: 1702886670000,
      endsAt: 1702889670000,
    }],
  }),
  getAlarmLogsCount: async () => ({ totalCount: 1 }),
  changeTenant: async () => null,

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

  getSimpleClustersInfoFromConfigFiles: async () => ({
    clustersInfo: {
      hpc01: {
        displayName: "hpc01Name",
        priority: 1,
        clusterId: "hpc01",
      },
    },
  }),

  getClustersConnectionInfo: async () => ({
    results: [{
      clusterId: "hpc01",
      connectionStatus: ClusterConnectionStatus.AVAILABLE,
      totalMemMb: 4028,
      totalNodeCount: 3,
      totalCpuCoreCount: 2,
      totalGpuCount: 1,
    }],
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

  activateCluster: async () => ({ executed: true }),
  deactivateCluster: async () => ({ executed: true }),

  getClusterMigrateNodesInfo: async () => ({
    nodes: [
      {
        nodeName: "node1",
        nodeStatus: NodeStatus.ACTIVE_MIGRATABLE,
        cluster: "linux1",
        migratableClusterList: [
          {
            cluster: "cluster1",
            partitions: ["queue1", "queue2"],
          },
          {
            cluster:  "cluster2",
            partitions: ["queue1", "queue2"],
          },
        ],
        partitions: ["partition1", "partition2"],
      },
    ],
  }),

  migrateNode: async () => null,
  activateNode: async () => null,
  exportAccount: null,
  exportChargeRecord: null,
  exportPayRecord: null,
  exportJobRecord: null,
  exportUser: null,
  exportOperationLog: null,
  exportBill: null,
  getBills: async () => { return { bills:[], total:0 }; },
  getUserBills: async () => { return { userBills:[]}; },
  getBillTypes: async () => { return { types:[]}; },

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
  getTenantQuota: async () => ({
    totalStorageBytes: 312,
    remainingStorageBytes: 123,
    userDefaultQuotaBytes: 12,
    totalUserCount: 0,
    usersQuotaInfo: [],
  }),
  setTenantUserDefaultQuota: null,
  setTenantUserQuota: null,
  accountThreshold: async () => ({
    isBelowBlockThreshold: true,
  }),
  exportUserBill: async () => ({}),

  syncAccountUserInfo: async () => ({
    sessionId: "sessionId",
  }),

  getSyncAccountUserHistory: async () => ({
    totalCount: 0,
    syncHistory: [],
  }),


  getLockedUsers: null,
  unlockUser: null,
  getTargetAppAuthorizations: async () => ({
    appLists: [
      {
        targetName: "test1",
        appsInfo: [
          {
            appId: "vscode",
            appName: "vscode",
            isDisabled: false,
          },
          {
            appId: "emacs",
            appName: "emacs",
            isDisabled: false,
          },
        ],
        availableAppsCount: 2,
      },
      {
        targetName: "test2",
        appsInfo: [
          {
            appId: "vscode",
            appName: "vscode",
            isDisabled: true,
          },
          {
            appId: "emacs",
            appName: "emacs",
            isDisabled: false,
          },
        ],
        availableAppsCount: 1,
      },
    ],
    totalCount: 2,
  }),
  authorizeApp: null,
  getTenantApps: async () => ({
    tenantApps: [
      {
        id: "vscode",
        name: "vscode",
        isDefault: true,
      },
      {
        id: "emacs",
        name: "emacs",
        isDefault: false,
      },
    ],
  }),
  updateDefaultApp: null,
  getTenantAssignedClustersAndPartitions: async () => ({
    assignedClusterPartitions: {
      "hpc01": { partitionNames: ["partition1", "partition2"]},
      "hpc02": { partitionNames: ["compute", "gpu"]},
    },
  }),
  getStorageSyncInfo: async () => ({
    syncStarted: false,
    schedule: "0 * * * *",
    syncStartTime: "2025-08-22T02:03:38.297Z",
  }),
  batchSetTenantUsersQuota: null,
  syncTenantUsersStorageUsage: null,
  getQuantumJobInfo: async () => ({
    totalCount: 0,
    jobs: [],
  }),
  getClusterConfig: async () => ({
    partitions:[],
  }),
};

export const MOCK_USER_INFO = {
  tenant: "default",
  name: "testuser",
  identityId: "123",
  token: "123",
  email: "tset01@scow.com",
  // accountAffiliations: [],
  // platformRoles: [],
  adminComment: "test01",
  phone: "1363636366",
  organization: "org1",
  tenantRoles: [TenantRole.TENANT_ADMIN, TenantRole.TENANT_FINANCE],
  platformRoles: [PlatformRole.PLATFORM_FINANCE, PlatformRole.PLATFORM_ADMIN],
  accountAffiliations: [
    { accountName: "hpc2001213077", role: UserRole.ADMIN, accountState:AccountState.NORMAL },
    { accountName: "hpc2001213075", role: UserRole.USER , accountState:AccountState.NORMAL },
  ],
  createTime:"2023-08-03T03:47:23.485Z",
} as UserInfo;

export const MOCK_USER_STATUS: GetUserStatusResponse = {
  storageQuotas: {
    "WM2": 100,
    "WM1": 200,
  },
  accountStatuses: {
    "hpc1": { userStatus: UserStatus.BLOCKED, accountBlocked: false, accountState:AccountState.NORMAL },
    "hpc2": { userStatus: UserStatus.BLOCKED, accountBlocked: true, accountState:AccountState.NORMAL,
      jobChargeLimit: numberToMoney(10),
      usedJobCharge: numberToMoney(2),
    },
  },
};

