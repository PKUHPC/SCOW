/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { ChannelCredentials } from "@grpc/grpc-js";
import { AuditServiceConfigSchema } from "@scow/config/build/shellAudit";
import { AuditServiceClient, CreateSessionRequest, CreateSessionResponse,
  SessionEndRequest, SessionEndResponse,
  WriteAppProxyRequest, WriteAppProxyResponse } from "@scow/protos/build/audit/shell";
import { Logger } from "ts-log";

export const createAuditClient = (
  config: AuditServiceConfigSchema | undefined,
  logger: Logger | Console,
) => {
  const client = config && config.auditServiceUrl
    ? new AuditServiceClient(config.auditServiceUrl, ChannelCredentials.createInsecure())
    : undefined;
  if (!config || !client) {
    logger.debug("Audit Server disabled");
  }
  return {
    createShellSession: async (request: CreateSessionRequest): Promise<CreateSessionResponse> => {
      if (config?.auditService.shellAudit?.enabled !== true) {
        logger.debug("Shell audit service disabled");
        return { sessionId: "" };
      }
      if (!client) {
        logger.debug("Attempt to audit with %o", request);
        return { sessionId: "" };
      }
      return await asyncUnaryCall(client, "createSession", request);
    },

    sessionEnd: async (request: SessionEndRequest): Promise<SessionEndResponse> => {
      if (config?.auditService.shellAudit?.enabled !== true) {
        logger.debug("Shell audit service disabled");
        return {};
      }
      if (!client) {
        logger.debug("Attempt to audit with %o", request);
        return {};
      }
      return await asyncUnaryCall(client, "sessionEnd", request);
    },

    writeAppProxy: async (request: WriteAppProxyRequest): Promise<WriteAppProxyResponse> => {
      if (config?.auditService.appAudit?.enabled !== true) {
        logger.debug("App audit service disabled");
        return {};
      }
      if (!client) {
        logger.debug("Attempt to audit with %o", request);
        return {};
      }
      return await asyncUnaryCall(client, "writeAppProxy", request);
    },
  };
};


export const getAuditClient = (
  config: AuditServiceConfigSchema | undefined,
  logger: Logger | Console,
): AuditServiceClient | undefined => {
  if (config?.auditService.shellAudit?.enabled !== true) {
    logger.debug("Shell audit service disabled");
    return undefined;
  }
  if (!config || !config.auditServiceUrl) {
    logger.debug("Audit Server configuration is missing or incomplete.");
    throw new Error("Audit Server configuration is missing or incomplete.");
  }

  const client = new AuditServiceClient(config.auditServiceUrl, ChannelCredentials.createInsecure());
  return client;
};
