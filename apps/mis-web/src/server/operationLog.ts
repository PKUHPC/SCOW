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

import { createOperationLogClient, OperationEvent } from "@scow/lib-operation-log";
import { OperationResult } from "@scow/protos/build/operation-log/operation_log";
import { runtimeConfig } from "src/utils/config";

export const createOperationLog = (
  operationTypeName: OperationEvent["$case"],
  // @ts-ignore
  operationTypePayload: (OperationEvent & { $case: OperationEvent["$case"] })[OperationEvent["$case"]]
  &
  {
    operationUserId: string,
    operationIp: string,
    operationResult: OperationResult,
  },
  logger: Console,
) => {

  const { callLog } = createOperationLogClient(runtimeConfig.OPERATION_LOG_CONFIG, console);

  callLog(
    operationTypeName,
    operationTypePayload,
    logger,
  );
};
