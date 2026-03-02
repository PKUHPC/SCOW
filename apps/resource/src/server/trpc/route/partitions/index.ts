import { router } from "src/server/trpc/def";

import {
  accountsAssignedDetails,
  assignAccountCluster,
  assignAccountPartition, unAssignAccountCluster, unAssignAccountPartition,
} from "./accountClusterPartitions";
import {
  accountDefaultClusters,
  accountDefaultPartitions,
  addToAccountDefaultClusters,
  addToAccountDefaultPartitions,
  assignTenantCluster,
  assignTenantPartition, removeFromAccountDefaultClusters, removeFromAccountDefaultPartitions,
  tenantAssignedClusters,
  tenantAssignedPartitions,
  tenantsAssignedDetails,
  unAssignTenantCluster,
  unAssignTenantPartition,
} from "./tenantClusterPartitions";

export const partitionRouter = router({
  // tenant
  tenantsAssignedDetails,
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
  accountsAssignedDetails,
  // assign
  assignAccountCluster,
  unAssignAccountCluster,
  assignAccountPartition,
  unAssignAccountPartition,

});
