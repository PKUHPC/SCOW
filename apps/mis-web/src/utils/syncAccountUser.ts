import { ListAccountUserSynchronizationsResponse_AccountOperationResult as AccountOperationResultProto,
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

export interface DisplayedSyncDetail {
  clusterId: string,
  totalSyncCount: number,
  totalSuccessfulCount: number,
  totalFailedCount: number,
  exceptionHappened?: boolean,
  i18nExceptionMessage?: string,
  i18nSyncDetails?: Record<string, string>,
}

export function getSyncDetails(
  t: TransType,
  syncResults: ClusterSyncResultsProto,
  clusterSortedIdList: string[],
): DisplayedSyncDetail[] | undefined {

  const operationMessages: Record<string, string> = {
    [SyncAccountUserOperationType.CREATE_ACCOUNT]: t(p("createAccountFailure")),
    [SyncAccountUserOperationType.BLOCK_ACCOUNT]:  t(p("blockAccountFailure")),
    [SyncAccountUserOperationType.UNBLOCK_ACCOUNT]:  t(p("unblockAccountFailure")),
    [SyncAccountUserOperationType.ADD_USER_TO_ACCOUNT]:  t(p("addUserToAccountFailure")),
    [SyncAccountUserOperationType.BLOCK_USER_IN_ACCOUNT]:  t(p("blockUserInAccountFailure")),
    [SyncAccountUserOperationType.UNBLOCK_USER_IN_ACCOUNT]:  t(p("unblockUserInAccountFailure")),
    [SyncAccountUserOperationType.REMOVE_USER_FROM_ACCOUNT]:  t(p("removeUserFromAccountFailure")),
  };

  const getExceptionMessage =
  (exceptionType: SyncExceptionType | SyncExceptionTypeProto, totalSuccessfulCount: number): string => {

    switch (exceptionType) {
      case SyncExceptionType.MAX_EXECUTION_TIME_EXCEEDED:
        return `${t(p("timeoutException"))}${t(p("syncDetailsWhenTimeout"), [totalSuccessfulCount.toString()])}`;
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

  let i18nSyncDetails: Record<string, string> = {};

  const result: DisplayedSyncDetail[] = syncResults.results.sort((a, b) => {
    const aIndex = clusterSortedIdList.indexOf(a.clusterId);
    const bIndex = clusterSortedIdList.indexOf(b.clusterId);
    return aIndex - bIndex;
  }).map((clusterResult: ClusterTotalSyncResultProto) => {

    const { clusterId, completedTotalSyncCount,
      successfulTotalSyncCount, clusterSyncExceptions, clusterSyncDetails } = clusterResult;

    let i18nExceptionMessage: string = "";

    // 如果有异常情况,展示异常详情，相同类别只展示一次
    if (clusterSyncExceptions?.length > 0) {
      const displayedExceptionTypes = new Set<SyncExceptionTypeProto>();
      clusterSyncExceptions.forEach((exception) => {

        if (displayedExceptionTypes.has(exception.exceptionType)) {
          return;
        }
        displayedExceptionTypes.add(exception.exceptionType);
        const exceptionText = getExceptionMessage(exception.exceptionType, successfulTotalSyncCount);
        i18nExceptionMessage += `${exceptionText} ； `;

      });
    } else {
      if (clusterSyncDetails) {
        i18nSyncDetails = getSyncDetailsDisplayedMessage(clusterSyncDetails, operationMessages);
      }
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
 * @param operationMessages
 * @returns
 */
function getSyncDetailsDisplayedMessage(
  syncDetails: SyncDetailsSummaryProto,
  operationMessages: Record<string, string>,
): Record<string, string> {
  const detailsMessage: Record<string, string> = {};

  const mappedSyncDetails = transformSyncDetails(syncDetails);
  Object.entries(mappedSyncDetails).forEach(([operationType, operationData]) => {
    if (!operationData.length) return;

    const displayedData =
      operationType === SyncAccountUserOperationType.CREATE_ACCOUNT ||
      operationType === SyncAccountUserOperationType.BLOCK_ACCOUNT ||
      operationType === SyncAccountUserOperationType.UNBLOCK_ACCOUNT ?
        filterFailedAccounts(operationData as AccountOperationResultProto[]) :
        formatAccountUserDetails(operationData as UserAccountOperationResultProto[]);

    if (operationMessages[operationType] && displayedData) {
      const typeString = operationMessages[operationType];
      detailsMessage[typeString] = displayedData;
    }
  });

  return detailsMessage;
}

// 筛选账户操作失败的数据
function filterFailedAccounts(data: AccountOperationResultProto[]): string {
  return data.filter((op) => !op.success).map((op) => op.accountName).join("，");
}

// 筛选账户用户操作失败的数据
function formatAccountUserDetails(data: UserAccountOperationResultProto[]): string {
  const accountUserMap: Record<string, Set<string>> = {};

  data.filter((op) => !op.success).forEach(({ accountName, userId }) => {
    if (!accountUserMap[accountName]) {
      accountUserMap[accountName] = new Set();
    }
    accountUserMap[accountName].add(userId);
  });

  return Object.entries(accountUserMap)
    .map(([accountName, users]) => `${accountName}：${Array.from(users).join("，")}`)
    .join("；\n ");
}

function transformSyncDetails(syncDetails: SyncDetailsSummaryProto):
Record<string,
  AccountOperationResultProto[] |
  UserAccountOperationResultProto[] |
  UserOperationResultProto[]
> {

  const transformedDetails: Record<string,
    AccountOperationResultProto[] |
    UserAccountOperationResultProto[] |
    UserOperationResultProto[]
  > = {};
  Object.entries(syncDetails).forEach(([key, value]) => {
    if (!value) return;
    if (value.results) {
      transformedDetails[key] = value.results;
    }
  });

  return transformedDetails;
}
