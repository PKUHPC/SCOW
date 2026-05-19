import { ServiceError } from "@ddadaal/tsgrpc-common";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { FilterQuery } from "@mikro-orm/core";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import {
  CreateOperationLogRequest,
  OperationLog,
  OperationLogFilter,
  operationResultFromJSON,
  operationResultToJSON,
} from "@scow/protos/build/audit/operation_log";
import { OperationLog as OperationLogEntity } from "src/entities/OperationLog";

export type OperationEvent = CreateOperationLogRequest["operationEvent"];

export async function filterOperationLogs({
  operatorUserIds,
  operationResult,
  startTime,
  endTime,
  operationType,
  operationTargetAccountName,
  operationDetail,
  customEventType,
}: OperationLogFilter) {
  const sqlFilter: FilterQuery<OperationLogEntity> = {
    ...(operatorUserIds.length > 0 ? { operatorUserId: { $in: operatorUserIds } } : {}),
    $and: [
      ...(startTime ? [{ operationTime: { $gte: startTime } }] : []),
      ...(endTime ? [{ operationTime: { $lte: endTime } }] : []),
      ...(operationType ? [{ metaData: { $case: operationType } as OperationEvent }] : []),
      ...(operationTargetAccountName ? [{ metaData: { targetAccountName: operationTargetAccountName } }] : []),
      ...(operationDetail ? [{ metaData: { $like: `%${operationDetail}%` } }] : []),
      ...(customEventType ? [{ customEventType }] : []),
    ],
    ...(operationResult ? { operation_result: operationResultToJSON(operationResult) } : {}),
  };
  return sqlFilter;
}

export function toGrpcOperationLog(x: OperationLogEntity): OperationLog {
  const grpcOperationLog = {
    operationLogId: x.id,
    operatorUserId: x.operatorUserId,
    operatorIp: x.operatorIp,
    operationTime: x.operationTime?.toISOString(),
    operationResult: operationResultFromJSON(x.operationResult),
    operationEvent:
      x.metaData?.$case === "customEvent"
        ? {
            ...x.metaData,
            customEvent: {
              ...x.metaData.customEvent,
              type: x.customEventType || "",
            },
          }
        : x.metaData,
  };
  return grpcOperationLog;
}

/**
 * @param operationEvent
 * @returns targetAccountName
 * @description
 * 如果是导出消费记录或者导出充值记录且target是accountOfTenant，返回accountName
 * 如果是导出操作日志且source是account，返回accountName
 */
export const getTargetAccountName = (operationEvent: OperationEvent): string | undefined => {
  const operationType = operationEvent?.$case;
  if (operationType === "exportChargeRecord" || operationType === "exportPayRecord") {
    switch (operationEvent[operationType].target.$case) {
      case "accountOfTenant":
        return operationEvent[operationType].target.accountOfTenant.accountName;
      case "accountsOfTenant":
        return operationEvent[operationType].target.accountsOfTenant.accountNames;
      case "accountsOfAllTenants":
        return operationEvent[operationType].target.accountsOfAllTenants.accountNames;
      default:
        return;
    }
  } else if (operationType === "exportOperationLog") {
    const source = operationEvent[operationType].source;
    if (source && source.$case === "account") {
      return source.account.accountName;
    }
  } else if (operationType === "exportJobRecord") {
    switch (operationEvent[operationType].target?.$case) {
      case "jobsOfAccountAndUser":
        return operationEvent[operationType].target.jobsOfAccountAndUser.accountName;
      case "jobsOfAccount":
        return operationEvent[operationType].target.jobsOfAccount.accountName;
      case "jobsOfJobIdAndAccount":
        return operationEvent[operationType].target.jobsOfJobIdAndAccount.accountName;
      default:
        return undefined;
    }
  } else {
    return operationEvent && operationType ? operationEvent[operationType].accountName : undefined;
  }
};

/**
 *
 * @param em
 * @param operationEvent
 * @returns
 * @description
 * 如果是自定义操作类型，检查是否存在相同类型的自定义操作，且其国际化名称对象是否一致
 */
export const checkCustomEventType = async (em: SqlEntityManager<MySqlDriver>, operationEvent: OperationEvent) => {
  if (operationEvent?.$case !== "customEvent") {
    return;
  }

  const customEvent = operationEvent.customEvent;
  const customEventType = customEvent.type;
  const nameI18n = customEvent.name?.i18n;

  const existTypeLog = await em.findOne(OperationLogEntity, {
    metaData: { $case: "customEvent" },
    customEventType,
  });

  if (
    !existTypeLog ||
    !existTypeLog.metaData ||
    !existTypeLog.metaData.$case ||
    existTypeLog.metaData.$case !== "customEvent" ||
    !existTypeLog.metaData.customEvent?.name?.i18n
  ) {
    return;
  }

  const existNameI18n = existTypeLog.metaData.customEvent.name.i18n;

  const isNameMatch =
    existNameI18n.default === nameI18n?.default &&
    existNameI18n.en === nameI18n?.en &&
    existNameI18n.zhCn === nameI18n?.zhCn;

  if (!isNameMatch) {
    throw new ServiceError({
      code: Status.INVALID_ARGUMENT,
      message: "Custom event type name not match with exist type name.",
    });
  }
};

/**
 * @param operationEvent
 * @returns targetAccountName
 * @description
 * 如果是导出消费记录或者导出充值记录且target是accountOfTenant，返回accountName
 * 如果是导出操作日志且source是account，返回accountName
 */
export const addOperationLogAccountNames = (operationLog: OperationLog): OperationLog => {
  const operationType = operationLog.operationEvent?.$case;
  if (operationType !== "exportChargeRecord" && operationType !== "exportPayRecord") {
    return operationLog;
  }
  const targetObject = operationLog.operationEvent[operationType].target;
  const targetCase = targetObject.$case;
  const caseObject = targetObject[targetCase];
  const addLogAccountNames = () => {
    const logCopy = JSON.parse(JSON.stringify(operationLog));
    logCopy.operationEvent[operationType].target[targetCase].accountNames = [];
    return logCopy;
  };
  switch (targetCase) {
    case "accountsOfTenant":
    case "accountsOfAllTenants":
      return caseObject.accountNames ? operationLog : addLogAccountNames();
    default:
      return operationLog;
  }
};
