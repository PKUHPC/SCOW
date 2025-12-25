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

import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { SchedulerAdapterClient } from "@scow/lib-scheduler-adapter";
import { GetAppConnectionInfoResponse } from "@scow/scheduler-adapter-protos/build/app";
import { ApiVersion } from "@scow/utils/build/version";
import { quote } from "shell-quote";
import { Logger } from "ts-log";

import { checkSchedulerApiVersion } from "./scheduleAdapter";

export const getAppConnectionInfoFromAdapter = async (
  client: SchedulerAdapterClient,
  jobId: number,
  logger: Logger,
): Promise<GetAppConnectionInfoResponse | undefined> => {
  const minRequiredApiVersion: ApiVersion = { major: 1, minor: 3, patch: 0 };
  try {
    await checkSchedulerApiVersion(client, minRequiredApiVersion);
    // get connection info
    // for apps running in containers, it can provide real ip and port info
    const connectionInfo = await asyncClientCall(client.app, "getAppConnectionInfo", {
      jobId: jobId,
    });
    return connectionInfo;
  } catch (e: any) {
    if (e.code === Status.UNIMPLEMENTED || e.code === Status.FAILED_PRECONDITION) {
      logger.warn(e.details);
    } else {
      throw e;
    }
  }
};

/**
 *
 * @param env env
 * @returns env variables
 */
export const getEnvVariables = (env: Record<string, string>) =>
  Object.keys(env).map((x) => `export ${x}=${quote([env[x] ?? ""])}\n`).join("");
