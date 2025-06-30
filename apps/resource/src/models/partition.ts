export enum PartitionOperationType {
  ACCOUNT_OPERATION = "ACCOUNT_OPERATION",
  TENANT_OPERATION = "TENANT_OPERATION",
}

export enum AssignmentType {
  ASSIGN = "ASSIGN",
  UNASSIGN = "UNASSIGN",
}

export enum AssignmentState {
  ASSIGNED = "ASSIGNED",
  UNASSIGNED = "UNASSIGNED",
}

export interface ClusterPartition {
  clusterId: string,
  partition: string,
}


