import { asyncReplyStreamCall, asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { ChannelCredentials, ClientReadableStream } from "@grpc/grpc-js";
import { AuditConfigSchema } from "@scow/config/build/audit";
import {
  CreateOperationLogRequest,
  ExportOperationLogRequest,
  ExportOperationLogResponse,
  GetCustomEventTypesResponse,
  GetOperationLogsRequest,
  GetOperationLogsResponse,
  OperationLogServiceClient,
} from "@scow/protos/build/audit/operation_log";
import { Logger } from "ts-log";

import { OperationResult } from "./constant";

export type OperationEvent = Exclude<CreateOperationLogRequest["operationEvent"], undefined>;

export interface LogCallParams<TName extends OperationEvent["$case"]> {
  operatorUserId: string;
  operatorIp: string;
  operationTypeName: TName;
  // @ts-ignore
  operationTypePayload?: (OperationEvent & { $case: TName })[TName];
  operationResult: OperationResult;
  logger: Logger;
}

export const createOperationLogClient = (config: AuditConfigSchema | undefined, logger: Logger | Console) => {
  const client = config?.url
    ? new OperationLogServiceClient(config.url, ChannelCredentials.createInsecure())
    : undefined;

  if (!config || !client) {
    logger.debug("Operation Log Server disabled");
  }

  return {
    getLog: async (request: GetOperationLogsRequest): Promise<GetOperationLogsResponse> => {
      if (!client) {
        logger.debug("Attempt to get Log with %o", request);
        return { results: [], totalCount: 0 };
      }

      return await asyncUnaryCall(client, "getOperationLogs", request);
    },
    getCustomEventTypes: async (): Promise<GetCustomEventTypesResponse> => {
      if (!client) {
        return { customEventTypes: [] };
      }

      return await asyncUnaryCall(client, "getCustomEventTypes", {});
    },
    exportLog: async (
      request: ExportOperationLogRequest,
    ): Promise<ClientReadableStream<ExportOperationLogResponse>> => {
      if (!client) {
        logger.debug("Attempt to export Log with %o", request);
        return Promise.reject(new Error("Client is not initialized"));
      }

      return asyncReplyStreamCall(client, "exportOperationLog", request);
    },
    callLog: async <TName extends OperationEvent["$case"]>({
      operatorUserId,
      operatorIp,
      operationTypeName,
      operationTypePayload,
      operationResult,
      logger,
    }: LogCallParams<TName>) => {
      if (!client) {
        logger.debug("Attempt to call Log %s with %o", operationTypeName, operationTypePayload);
        return;
      }

      return await asyncUnaryCall(client, "createOperationLog", {
        operatorUserId,
        operatorIp,
        operationResult,
        // @ts-ignore
        operationEvent: { $case: operationTypeName, [operationTypeName]: { ...operationTypePayload } },
      }).catch((e) => {
        logger.error(e, "Error when calling Operation Log");
      });
    },
  };
};

export * from "./constant";
