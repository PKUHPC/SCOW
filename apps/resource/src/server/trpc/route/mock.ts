import { Cluster } from "@scow/config/build/type";
import { GetClusterConfigFilesResponse } from "@scow/protos/generated/common/config";
import {
  Account_AccountState,
  Account_DisplayedAccountState,
  GetAccountsResponse,
} from "@scow/protos/generated/server/account";
import { AssignmentState, ClusterPartition } from "src/models/partition";
import { PlatformRole, TenantRole } from "src/models/user";
import { USE_MOCK } from "src/utils/processEnv";

import { AllAssignedInfoSchema } from "./partitions/tenantClusterPartitions";

export async function mock<T>(actualFn: () => T, mockFn: () => T) {
  if (USE_MOCK) {
    // await new Promise((res) => setTimeout(res, ));
    return mockFn();
  } else {
    return actualFn();
  }
}

export const MOCK_USER = {
  identityId: "demo_admin",
  name: "demo_admin",
  token: "123",
  platformRoles: [PlatformRole.PLATFORM_ADMIN],
  tenant: "default",
  tenantRoles: [TenantRole.TENANT_ADMIN],
};

export const MOCK_ASSIGNED_PARTITIONS = [
  { clusterId: "hpc01", partition: "normal" },
  { clusterId: "hpc01", partition: "low" },
  { clusterId: "hpc02", partition: "gpu" },
];

export const MOCK_ALL_CLUSTER_PARTITIONS: ClusterPartition[] = [
  { clusterId: "hpc01", partition: "normal" },
  { clusterId: "hpc01", partition: "low" },
  { clusterId: "hpc01", partition: "high" },
  { clusterId: "hpc02", partition: "gpu" },
  { clusterId: "hpc02", partition: "gpu1" },
  { clusterId: "hpc02", partition: "gpu2" },
  { clusterId: "hpc03", partition: "cpu1" },
  { clusterId: "hpc03", partition: "cpu2" },
  { clusterId: "hpc03", partition: "cpu3" },
];

export const MOCK_ACTIVATED_CLUSTER_INFO: Cluster[] = [
  { id: "hpc01", name: "hpc01Name" },
  { id: "hpc02", name: "hpc02Name" },
];

export const MOCK_ALL_ACC_ASSIGNED_PARTITIONS = {
  accountName: "a_account",
  tenantName: "default",
  assignedPartitions: MOCK_ASSIGNED_PARTITIONS,
  assignedTotalCount: 3,
};

export const MOCK_ALL_TEN_ASSIGNED_PARTITIONS = {
  tenantName: "default",
  assignedPartitions: MOCK_ASSIGNED_PARTITIONS,
  assignedTotalCount: 5,
};

export const MOCK_ALL_TEN_ASSIGNED_CLUSTERS = {
  tenantName: "default",
  assignedClusters: ["hpc01", "hpc02"],
  assignedTotalCount: 2,
};

export const CLUSTER_CONFIGS_DATA: GetClusterConfigFilesResponse = {
  clusterConfigs: [
    {
      clusterId: "hpc01",
      displayName: {
        value: { $case: "directString", directString: "集群1" },
      },
      adapterUrl: "111.111.111",
      priority: 0,
      entryPaths: [],
    },
    {
      clusterId: "hpc02",
      displayName: {
        value: { $case: "directString", directString: "集群2" },
      },
      adapterUrl: "111.111.112",
      priority: 0,
      entryPaths: [],
    },
  ],
};

export const ACCOUNTS_DATA: GetAccountsResponse = {
  results: [
    {
      accountName: "a_aa",
      tenantName: "default",
      userCount: 5,
      blocked: false,
      ownerId: "demo_admin",
      ownerName: "demo_admin",
      comment: "a_aa comment",
      state: Account_AccountState.NORMAL,
      displayedState: Account_DisplayedAccountState.DISPLAYED_NORMAL,
      storageQuotas: [],
    },
    {
      accountName: "a_bb",
      tenantName: "default",
      userCount: 1,
      blocked: false,
      ownerId: "demo_admin",
      ownerName: "demo_admin",
      comment: "a_bb comment",
      state: Account_AccountState.NORMAL,
      displayedState: Account_DisplayedAccountState.DISPLAYED_NORMAL,
      storageQuotas: [],
    },
  ],
};

export const ACCOUNT_ASSIGNED_PARTIITON_DETAILS = [
  {
    partition: "computer",
    partitionDetail: {
      name: "compute1",
      qos: ["normal", "low", "high"],
      nodes: 2,
      cores: 4,
      gpus: 0,
      memMb: 2048,
      comment: "",
    },
  },
  {
    partition: "computer2",
    partitionDetail: {
      name: "compute",
      qos: ["normal", "low", "high"],
      nodes: 1,
      cores: 1,
      gpus: 0,
      memMb: 2048,
      comment: "",
    },
  },
];

export const MOCK_ALL_TEN_ASSIGNED_INFO: AllAssignedInfoSchema[] = [
  {
    tenantName: "tenant1",
    assignedInfo: {
      assignedClusters: [
        { clusterId: "hpc01", assignmentState: AssignmentState.ASSIGNED },
        { clusterId: "hpc02", assignmentState: AssignmentState.ASSIGNED },
      ],
      assignedClustersCount: 2,
      assignedPartitions: [
        {
          clusterId: "hpc01",
          partition: "compute",
          assignmentState: AssignmentState.ASSIGNED,
        },
        {
          clusterId: "hpc01",
          partition: "gpu",
          assignmentState: AssignmentState.ASSIGNED,
        },
        {
          clusterId: "hpc02",
          partition: "compute",
          assignmentState: AssignmentState.ASSIGNED,
        },
        {
          clusterId: "hpc02",
          partition: "gpu",
          assignmentState: AssignmentState.ASSIGNED,
        },
      ],
      assignedPartitionsCount: 4,
    },
  },
  {
    tenantName: "tenant2",
    assignedInfo: {
      assignedClusters: [
        { clusterId: "hpc01", assignmentState: AssignmentState.ASSIGNED },
        { clusterId: "hpc02", assignmentState: AssignmentState.ASSIGNED },
      ],
      assignedClustersCount: 2,
      assignedPartitions: [
        {
          clusterId: "hpc01",
          partition: "compute",
          assignmentState: AssignmentState.ASSIGNED,
        },
        {
          clusterId: "hpc01",
          partition: "gpu",
          assignmentState: AssignmentState.UNASSIGNED,
        },
        {
          clusterId: "hpc02",
          partition: "compute",
          assignmentState: AssignmentState.UNASSIGNED,
        },
        {
          clusterId: "hpc02",
          partition: "gpu",
          assignmentState: AssignmentState.UNASSIGNED,
        },
      ],
      assignedPartitionsCount: 1,
    },
  },
];

export const MOCK_ALL_ACCT_ASSIGNED_INFO: AllAssignedInfoSchema[] = [
  {
    accountName: "a_aaa",
    tenantName: "default",
    assignedInfo: {
      assignedClusters: [
        { clusterId: "hpc01", assignmentState: AssignmentState.ASSIGNED },
        { clusterId: "hpc02", assignmentState: AssignmentState.ASSIGNED },
      ],
      assignedClustersCount: 2,
      assignedPartitions: [
        {
          clusterId: "hpc01",
          partition: "compute",
          assignmentState: AssignmentState.ASSIGNED,
        },
        {
          clusterId: "hpc01",
          partition: "gpu",
          assignmentState: AssignmentState.ASSIGNED,
        },
        {
          clusterId: "hpc02",
          partition: "compute",
          assignmentState: AssignmentState.ASSIGNED,
        },
        {
          clusterId: "hpc02",
          partition: "gpu",
          assignmentState: AssignmentState.ASSIGNED,
        },
      ],
      assignedPartitionsCount: 4,
    },
  },
  {
    accountName: "a_bbb",
    tenantName: "default",
    assignedInfo: {
      assignedClusters: [
        { clusterId: "hpc01", assignmentState: AssignmentState.ASSIGNED },
        { clusterId: "hpc02", assignmentState: AssignmentState.ASSIGNED },
      ],
      assignedClustersCount: 2,
      assignedPartitions: [
        {
          clusterId: "hpc01",
          partition: "compute",
          assignmentState: AssignmentState.ASSIGNED,
        },
        {
          clusterId: "hpc01",
          partition: "gpu",
          assignmentState: AssignmentState.UNASSIGNED,
        },
        {
          clusterId: "hpc02",
          partition: "compute",
          assignmentState: AssignmentState.UNASSIGNED,
        },
        {
          clusterId: "hpc02",
          partition: "gpu",
          assignmentState: AssignmentState.UNASSIGNED,
        },
      ],
      assignedPartitionsCount: 1,
    },
  },
];

export const MOCK_TENANT_ACCOUNT_DEFAULT_CLUSTERS = {
  tenantName: "default",
  assignedTotalCount: 3,
  assignedClusters: ["hpc01", "hpc02", "hpc03"],
};

export const MOCK_ACCT_ASSIGNED_CLUSTERS = {
  accountName: "a_aaa",
  tenantName: "default",
  assignedTotalCount: 3,
  assignedClusters: ["hpc01", "hpc02", "hpc03"],
};

export const MOCK_CLUSTER_PARTITIONS_INFO = {
  schedulerName: "slurm-adapter",
  partitions: [
    {
      name: "cpu1",
      memMb: 4048,
      cores: 2,
      gpus: 0,
      nodes: 1,
      qos: ["low", "normal", "high"],
      comment: "",
    },
    {
      name: "cpu2",
      memMb: 4048,
      cores: 2,
      gpus: 0,
      nodes: 1,
      qos: ["low", "normal", "high"],
      comment: "",
    },
  ],
};
