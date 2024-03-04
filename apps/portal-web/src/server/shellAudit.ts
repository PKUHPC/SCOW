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
import { ShellAuditConfigSchema } from "@scow/config/build/shellAudit";
import { AuditServiceClient, CreateSessionRequest, CreateSessionResponse, WriteAppProxyRequest, WriteAppProxyResponse,
  WriteTerminalMsgRequest, WriteTerminalMsgResponse } from "@scow/protos/build/audit/shell";
import { Logger } from "ts-log";

export const createAuditClient = (
  config: ShellAuditConfigSchema | undefined,
  logger: Logger | Console,
) => {
  const client = config && config.url
    ? new AuditServiceClient(config.url, ChannelCredentials.createInsecure())
    : undefined;
  if (!config || !client) {
    logger.debug("Audit Server disabled");
  }
  return {
    createShellSession: async (request: CreateSessionRequest): Promise<CreateSessionResponse> => {
      if (!client) {
        logger.debug("Attempt to audit with %o", request);
        return {};
      }
      return await asyncUnaryCall(client, "createSession", request);
    },

    writeShellMsg: async (request: WriteTerminalMsgRequest): Promise<WriteTerminalMsgResponse> => {
      if (!client) {
        logger.debug("Attempt to audit with %o", request);
        return {};
      }
      return await asyncUnaryCall(client, "writeTerminalMsg", request);
    },

    writeAppProxy: async (request: WriteAppProxyRequest): Promise<WriteAppProxyResponse> => {
      if (!client) {
        logger.debug("Attempt to audit with %o", request);
        return {};
      }
      return await asyncUnaryCall(client, "writeAppProxy", request);
    },
  };
};

