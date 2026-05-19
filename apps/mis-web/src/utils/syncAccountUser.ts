import {
  ListAccountUserSynchronizationsResponse_AccountOperationResult as AccountOperationResultProto,
  ListAccountUserSynchronizationsResponse_ClusterSyncResults as ClusterSyncResultsProto,
  ListAccountUserSynchronizationsResponse_ClusterTotalSyncResult as ClusterTotalSyncResultProto,
  ListAccountUserSynchronizationsResponse_SyncDetailsSummary as SyncDetailsSummaryProto,
  ListAccountUserSynchronizationsResponse_SyncExceptionType as SyncExceptionTypeProto,
  ListAccountUserSynchronizationsResponse_UserAccountOperationResult as UserAccountOperationResultProto,
  ListAccountUserSynchronizationsResponse_UserOperationResult as UserOperationResultProto,
} from "@scow/protos/build/server/admin";
import { Lang } from "react-typed-i18n";
import { prefix } from "src/i18n";
import en from "src/i18n/en";
import { SyncAccountUserOperationType, SyncExceptionType } from "src/models/synchronization";

type TransType = (id: Lang<typeof en>, args?: React.ReactNode[]) => string;

const p = prefix("page.admin.systemDebug.syncClusterAccountUser.syncDetailsContent.");

interface SyncResultDetail {
  i18nSyncFailedResult?: Record<string, string>;
  i18nSyncSucceedResult?: Record<string, string>;
  i18nSyncFailedResultWithMsg?: Record<string, string>;
}

export interface DisplayedSyncDetail {
  clusterId: string;
  totalSyncCount: number;
  totalSuccessfulCount: number;
  totalFailedCount: number;
  exceptionHappened?: boolean;
  i18nExceptionMessage?: string;
  i18nSyncDetails?: SyncResultDetail;
}

export function getSyncDetails(
  t: TransType,
  syncResults: ClusterSyncResultsProto,
  clusterSortedIdList: string[],
): DisplayedSyncDetail[] | undefined {
  const operationFailedMessages: Record<string, string> = {
    [SyncAccountUserOperationType.CREATE_ACCOUNT]: t(p("createAccountFailure")),
    [SyncAccountUserOperationType.BLOCK_ACCOUNT]: t(p("blockAccountFailure")),
    [SyncAccountUserOperationType.UNBLOCK_ACCOUNT]: t(p("unblockAccountFailure")),
    [SyncAccountUserOperationType.ADD_USER_TO_ACCOUNT]: t(p("addUserToAccountFailure")),
    [SyncAccountUserOperationType.BLOCK_USER_IN_ACCOUNT]: t(p("blockUserInAccountFailure")),
    [SyncAccountUserOperationType.UNBLOCK_USER_IN_ACCOUNT]: t(p("unblockUserInAccountFailure")),
    [SyncAccountUserOperationType.REMOVE_USER_FROM_ACCOUNT]: t(p("removeUserFromAccountFailure")),
  };

  const operationSucceedMessages: Record<string, string> = {
    [SyncAccountUserOperationType.CREATE_ACCOUNT]: t(p("createAccountSuccess")),
    [SyncAccountUserOperationType.BLOCK_ACCOUNT]: t(p("blockAccountSuccess")),
    [SyncAccountUserOperationType.UNBLOCK_ACCOUNT]: t(p("unblockAccountSuccess")),
    [SyncAccountUserOperationType.ADD_USER_TO_ACCOUNT]: t(p("addUserToAccountSuccess")),
    [SyncAccountUserOperationType.BLOCK_USER_IN_ACCOUNT]: t(p("blockUserInAccountSuccess")),
    [SyncAccountUserOperationType.UNBLOCK_USER_IN_ACCOUNT]: t(p("unblockUserInAccountSuccess")),
    [SyncAccountUserOperationType.REMOVE_USER_FROM_ACCOUNT]: t(p("removeUserFromAccountSuccess")),
  };

  const operationFailedDetailMessages: Record<string, string> = {
    [SyncAccountUserOperationType.CREATE_ACCOUNT]: t(p("createAccountFailureDetail")),
    [SyncAccountUserOperationType.BLOCK_ACCOUNT]: t(p("blockAccountFailureDetail")),
    [SyncAccountUserOperationType.UNBLOCK_ACCOUNT]: t(p("unblockAccountFailureDetail")),
    [SyncAccountUserOperationType.ADD_USER_TO_ACCOUNT]: t(p("addUserToAccountFailureDetail")),
    [SyncAccountUserOperationType.BLOCK_USER_IN_ACCOUNT]: t(p("blockUserInAccountFailureDetail")),
    [SyncAccountUserOperationType.UNBLOCK_USER_IN_ACCOUNT]: t(p("unblockUserInAccountFailureDetail")),
    [SyncAccountUserOperationType.REMOVE_USER_FROM_ACCOUNT]: t(p("removeUserFromAccountFailureDetail")),
  };

  const getExceptionMessage = (exceptionType: SyncExceptionType | SyncExceptionTypeProto): string => {
    switch (exceptionType) {
      case SyncExceptionType.MAX_EXECUTION_TIME_EXCEEDED:
        return t(p("timeoutException"));
      case SyncExceptionType.ASSIGNED_PARTITIONS_FETCH_FAILED:
        return t(p("partitionsException"));
      case SyncExceptionType.CHUNK_FAILED:
        return t(p("chunkFailedException"));
      case SyncExceptionType.CLUSTER_UNEXECUTED:
        return t(p("clusterUnexecutedException"));
      case SyncExceptionType.NO_EXCEPTION:
        return t(p("noException"));
      case SyncExceptionType.UNKNOWN:
      default:
        return t(p("unknownException"));
    }
  };

  if (!syncResults) {
    return undefined;
  }

  let i18nSyncDetails: SyncResultDetail = {};

  const result: DisplayedSyncDetail[] = syncResults.results
    .sort((a, b) => {
      const aIndex = clusterSortedIdList.indexOf(a.clusterId);
      const bIndex = clusterSortedIdList.indexOf(b.clusterId);
      return aIndex - bIndex;
    })
    .map((clusterResult: ClusterTotalSyncResultProto) => {
      const {
        clusterId,
        completedTotalSyncCount,
        successfulTotalSyncCount,
        clusterSyncExceptions,
        clusterSyncDetails,
      } = clusterResult;

      let i18nExceptionMessage: string = "";

      // 如果有异常情况,展示异常详情，相同类别只展示一次
      if (clusterSyncExceptions?.length > 0) {
        const displayedExceptionTypes = new Set<SyncExceptionTypeProto>();
        clusterSyncExceptions.forEach((exception) => {
          if (displayedExceptionTypes.has(exception.exceptionType)) {
            return;
          }
          displayedExceptionTypes.add(exception.exceptionType);
          const exceptionText = getExceptionMessage(exception.exceptionType);
          i18nExceptionMessage += `${exceptionText}；`;
        });
      }
      // 无论是否发生异常，都封装已经同步数据的详细信息
      if (clusterSyncDetails) {
        i18nSyncDetails = getSyncDetailsDisplayedMessage(
          clusterSyncDetails,
          operationFailedMessages,
          operationSucceedMessages,
          operationFailedDetailMessages,
        );
      }

      return {
        clusterId,
        totalSyncCount: completedTotalSyncCount,
        totalSuccessfulCount: successfulTotalSyncCount,
        totalFailedCount: completedTotalSyncCount - successfulTotalSyncCount,
        exceptionHappened: clusterSyncExceptions?.length > 0,
        i18nExceptionMessage,
        i18nSyncDetails,
      };
    });

  return result ?? undefined;
}

/**
 * 汇总同步操作记录详情前端展示信息
 * @param syncDetails
 * @param operationFailedMessages
 * @returns
 */
function getSyncDetailsDisplayedMessage(
  syncDetails: SyncDetailsSummaryProto,
  operationFailedMessages: Record<string, string>,
  operationSucceedMessages: Record<string, string>,
  operationFailedDetailMessages: Record<string, string>,
): SyncResultDetail {
  const i18nSyncFailedResult: Record<string, string> = {};
  const i18nSyncSucceedResult: Record<string, string> = {};
  const i18nSyncFailedResultWithMsg: Record<string, string> = {};

  const mappedSyncDetails = transformSyncDetails(syncDetails);

  Object.entries(mappedSyncDetails).forEach(([operationType, operationData]) => {
    if (!operationData.length) return;

    const displayedData =
      operationType === SyncAccountUserOperationType.CREATE_ACCOUNT ||
      operationType === SyncAccountUserOperationType.BLOCK_ACCOUNT ||
      operationType === SyncAccountUserOperationType.UNBLOCK_ACCOUNT
        ? filterFailedAccounts(operationData as AccountOperationResultProto[])
        : formatAccountUserDetails(operationData as UserAccountOperationResultProto[]);

    if (operationFailedMessages[operationType] && displayedData) {
      const failedTypeString = operationFailedMessages[operationType];
      const succeedTypeString = operationSucceedMessages[operationType];
      const failedWithMsgTypeString = operationFailedDetailMessages[operationType];

      if (displayedData.failedNames) i18nSyncFailedResult[failedTypeString] = displayedData.failedNames;
      if (displayedData.succeedNames) i18nSyncSucceedResult[succeedTypeString] = displayedData.succeedNames;
      if (displayedData.failedNamesWithMsg) {
        i18nSyncFailedResultWithMsg[failedWithMsgTypeString] = displayedData.failedNamesWithMsg;
      }
    }
  });

  return {
    i18nSyncFailedResult,
    i18nSyncSucceedResult,
    i18nSyncFailedResultWithMsg,
  };
}

interface FilteredResult {
  failedNames: string;
  succeedNames: string;
  failedNamesWithMsg: string;
}
// 筛选账户操作失败的数据
function filterFailedAccounts(data: AccountOperationResultProto[]): FilteredResult {
  const failedNamesArr: string[] = [];
  const succeedNamesArr: string[] = [];
  const failedNamesWithMsgArr: string[] = [];

  data.forEach((op) => {
    if (!op.success) {
      failedNamesArr.push(op.accountName);
      // 没有接到的错误的时候显示 unknown error 兜底
      failedNamesWithMsgArr.push(`${op.accountName}, FailureMessage: ${op.failureMessage ?? "unknown error."}`);
    } else {
      succeedNamesArr.push(op.accountName);
    }
  });

  return {
    failedNames: failedNamesArr.join("，"),
    succeedNames: succeedNamesArr.join("，"),
    failedNamesWithMsg: failedNamesWithMsgArr.join("\n\n"),
  };
}

// 筛选账户用户操作失败的数据
function formatAccountUserDetails(data: UserAccountOperationResultProto[]): FilteredResult {
  const failedAccountUserMap: Record<string, Set<string>> = {};
  const succeedAccountUserMap: Record<string, Set<string>> = {};
  const failedNamesWithMsgArr: string[] = [];

  data.forEach((op) => {
    const { accountName, userId, success, failureMessage } = op;

    if (success) {
      if (!succeedAccountUserMap[accountName]) {
        succeedAccountUserMap[accountName] = new Set();
      }
      // 成功数据聚合信息
      succeedAccountUserMap[accountName].add(userId);
    } else {
      if (!failedAccountUserMap[accountName]) {
        failedAccountUserMap[accountName] = new Set();
      }
      // 失败数据聚合信息
      failedAccountUserMap[accountName].add(userId);
      // 带有失败信息详情的数组
      failedNamesWithMsgArr.push(`${accountName}: ${userId}, FailureMessage: ${failureMessage ?? "unknown error."}`);
    }
  });

  const failedNames = Object.entries(failedAccountUserMap)
    .map(([accountName, users]) => `${accountName}：${Array.from(users).join("，")}`)
    .join("；\n ");
  const succeedNames = Object.entries(succeedAccountUserMap)
    .map(([accountName, users]) => `${accountName}：${Array.from(users).join("，")}`)
    .join("；\n ");
  const failedNamesWithMsg = failedNamesWithMsgArr.join("\n\n");

  return {
    failedNames,
    succeedNames,
    failedNamesWithMsg,
  };
}

function transformSyncDetails(
  syncDetails: SyncDetailsSummaryProto,
): Record<string, AccountOperationResultProto[] | UserAccountOperationResultProto[] | UserOperationResultProto[]> {
  const transformedDetails: Record<
    string,
    AccountOperationResultProto[] | UserAccountOperationResultProto[] | UserOperationResultProto[]
  > = {};
  Object.entries(syncDetails).forEach(([key, value]) => {
    if (!value) return;
    if (value.results) {
      transformedDetails[key] = value.results;
    }
  });

  return transformedDetails;
}
