import { Static, Type } from "@sinclair/typebox";
import { ValueOf } from "next/dist/shared/lib/constants";

import { TransType } from "./job";

export const Partition = Type.Object({
  name: Type.String(),
  memMb: Type.Number(),
  cores: Type.Number(),
  gpus: Type.Number(),
  nodes: Type.Number(),
  qos: Type.Optional(Type.Array(Type.String())),
  comment: Type.Optional(Type.String()),
});
export type Partition = Static<typeof Partition>;

export const ClusterConnectionStatus = {
  AVAILABLE: 0,
  ERROR: 1,
} as const;

export type ClusterConnectionStatus = ValueOf<typeof ClusterConnectionStatus>;

export const ClusterConnectionInfoSchema = Type.Object({
  clusterId: Type.String(),
  connectionStatus: Type.Enum(ClusterConnectionStatus),
  totalMemMb: Type.Number(),
  totalNodeCount: Type.Number(),
  totalCpuCoreCount: Type.Number(),
  totalGpuCount: Type.Number(),
});

export type ClusterConnectionInfo = Static<typeof ClusterConnectionInfoSchema>;

export const PartitionNames = Type.Object({
  partitionNames: Type.Array(Type.String()),
});
export type PartitionNames = Static<typeof PartitionNames>;

export const AssignedClusterPartitionsSchema = Type.Object({
  assignedClusterPartitions: Type.Record(Type.String(), PartitionNames),
});
export type AssignedClusterPartitions = Static<typeof AssignedClusterPartitionsSchema>;

export const NodeStatus = {
  ACTIVE_MIGRATABLE: 0, // 当前集群在线且可迁移
  OCCUPIED_BY_JOBS: 1, // 当前集群在线但存在运行中作业（不可迁移）
  LOCKED_BY_OTHER_CLUSTER: 2, // 该节点已在其他集群上线（跨集群互斥）, 预留暂不用
  OFFLINE_RECOVERABLE: 3, // 当前集群已下线且可重新上线
} as const;

// 返回的可迁移节点信息
export const MigrateNodeInfoSchema = Type.Object({
  nodeName: Type.String(),
  cluster: Type.String(),
  nodeStatus: Type.Enum(NodeStatus),
  partitions: Type.Array(Type.String()),
  migratableClusterList: Type.Array(
    Type.Object({
      cluster: Type.String(),
      partitions: Type.Array(Type.String()),
    }),
  ),
});

export type MigrateNodeInfo = Static<typeof MigrateNodeInfoSchema>;

export const getDisplayedNodeStatusI18nTexts = (t: TransType) => {
  // LOCKED_BY_OTHER_CLUSTER暂时未实现
  return {
    [NodeStatus.ACTIVE_MIGRATABLE]: t("page.admin.resourceManagement.nodeMigrationPage.table.idle"),
    [NodeStatus.OCCUPIED_BY_JOBS]: t("page.admin.resourceManagement.nodeMigrationPage.table.running"),
    [NodeStatus.OFFLINE_RECOVERABLE]: t("page.admin.resourceManagement.nodeMigrationPage.table.offline"),
  };
};
