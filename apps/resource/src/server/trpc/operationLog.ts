import { createOperationLogClient, LogCallParams, OperationEvent, OperationResult } from "@scow/lib-operation-log";

import { auditConfig } from "../config/audit";

interface PartialLogCallParams<TName extends OperationEvent["$case"]>
  extends Omit<LogCallParams<TName>, "operationResult" | "logger"> {}

export const callLog = async <TName extends OperationEvent["$case"]>(
  {
    operatorUserId,
    operatorIp,
    operationTypeName,
    operationTypePayload,
  }: PartialLogCallParams<TName>,
  operationResult: OperationResult,
) => {

  const { callLog } = createOperationLogClient(auditConfig, console);

  await callLog(
    {
      operatorUserId,
      operatorIp,
      operationTypeName,
      operationTypePayload,
      operationResult,
      logger: console,
    },
  );
};

