import { router } from "src/server/trpc/def";

import {
  allAccountsAssignedClustersPartitions,
  assignAccountCluster,
  assignAccountPartition, unAssignAccountCluster, unAssignAccountPartition,
} from "./accountClusterPartitions";
import {
  accountDefaultClusters,
  accountDefaultPartitions,
  addToAccountDefaultClusters,
  addToAccountDefaultPartitions,
  allTenantAssignedClustersPartitions,
  assignTenantCluster,
  assignTenantPartition, removeFromAccountDefaultClusters, removeFromAccountDefaultPartitions,
  tenantAssignedClusters,
  tenantAssignedPartitions,
  unAssignTenantCluster,
  unAssignTenantPartition,
} from "./tenantClusterPartitions";

export const partitionRouter = router({
  // tenant
  allTenantAssignedClustersPartitions,
  tenantAssignedPartitions,
  tenantAssignedClusters,
  // assign Tenant
  assignTenantCluster,
  unAssignTenantCluster,
  assignTenantPartition,
  unAssignTenantPartition,
  // account default set
  accountDefaultClusters,
  addToAccountDefaultClusters,
  removeFromAccountDefaultClusters,
  accountDefaultPartitions,
  addToAccountDefaultPartitions,
  removeFromAccountDefaultPartitions,

  // account
  allAccountsAssignedClustersPartitions,
  // assign
  assignAccountCluster,
  unAssignAccountCluster,
  assignAccountPartition,
  unAssignAccountPartition,

});
