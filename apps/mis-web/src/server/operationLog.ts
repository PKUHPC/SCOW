import {
  createOperationLogClient,
  LogCallParams,
  OperationEvent,
  OperationResult,
} from "@scow/lib-operation-log/build/index";
import { runtimeConfig } from "src/utils/config";

interface PartialLogCallParams<TName extends OperationEvent["$case"]> extends Omit<
  LogCallParams<TName>,
  "operationResult" | "logger"
> {}

export const callLog = async <TName extends OperationEvent["$case"]>(
  { operatorUserId, operatorIp, operationTypeName, operationTypePayload }: PartialLogCallParams<TName>,
  operationResult: OperationResult,
) => {
  const { callLog } = createOperationLogClient(runtimeConfig.AUDIT_CONFIG, console);

  await callLog({
    operatorUserId,
    operatorIp,
    operationTypeName,
    operationTypePayload,
    operationResult,
    logger: console,
  });
};
