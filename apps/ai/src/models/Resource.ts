export interface AccountAssignedResourceDetail {
  accountName: string;
  assignedClusterPartitions: Record<string, string[]>;
}

export enum AccountStatusFilter {
  ALL = "ALL",
  BLOCKED_ONLY = "BLOCKED_ONLY",
  UNBLOCKED_ONLY = "UNBLOCKED_ONLY",
}
