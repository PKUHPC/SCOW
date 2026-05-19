import { ValueOf } from "next/dist/shared/lib/constants";

export const SyncAccountUserStatus = {
  STATUS_UNKNOWN: 0,
  RUNNING: 1,
  COMPLETED: 2,
  UNEXECUTED: 3,
} as const;
export type SyncAccountUserStatus = ValueOf<typeof SyncAccountUserStatus>;

export const SyncAccountUserResult = {
  RESULT_UNKNOWN: 0,
  SUCCESS: 1,
  FAILED: 2,
} as const;
export type SyncAccountUserResult = ValueOf<typeof SyncAccountUserResult>;

export enum SyncAccountUserOperationType {
  CREATE_ACCOUNT = "createAccount",
  BLOCK_ACCOUNT = "blockAccount",
  UNBLOCK_ACCOUNT = "unblockAccount",
  ADD_USER_TO_ACCOUNT = "addUserToAccount",
  BLOCK_USER_IN_ACCOUNT = "blockUserInAccount",
  REMOVE_USER_FROM_ACCOUNT = "removeUserFromAccount",
  UNBLOCK_USER_IN_ACCOUNT = "unblockUserInAccount",
  // 暂未使用
  // DELETE_ACCOUNT = "deleteAccount",
  // DELETE_USER = "deleteUser",
}

export enum SyncExceptionType {
  UNKNOWN = 0,
  NO_EXCEPTION = 1,
  CHUNK_FAILED = 2,
  ASSIGNED_PARTITIONS_FETCH_FAILED = 3,
  CLUSTER_UNEXECUTED = 4,
  MAX_EXECUTION_TIME_EXCEEDED = 5,
}
