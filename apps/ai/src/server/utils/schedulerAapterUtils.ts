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
import { ServiceError, status } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { GetAppConnectionInfoResponse } from "@scow/ai-scheduler-adapter-protos/build/protos/app";
import { ApiVersion } from "@scow/utils/build/version";
import { Logger } from "ts-log";

import { parseErrorDetails } from "../../../../../libs/rich-error-model/build";
import { SchedulerAdapterClient } from "./clusters";
export const getAppConnectionInfoFromAdapterForAi = async (
  client: SchedulerAdapterClient,
  jobId: number,
  logger: Logger,
): Promise<GetAppConnectionInfoResponse | undefined> => {
  const minRequiredApiVersion: ApiVersion = { major: 1, minor: 3, patch: 0 };
  try {
    await checkSchedulerApiVersionForAi(client, minRequiredApiVersion);
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
 * 判断当前集群下的调度器API版本对比传入的接口是否已过时
 * @param client
 * @param minVersion
 */
export async function checkSchedulerApiVersionForAi(client: SchedulerAdapterClient,
  minVersion: ApiVersion): Promise<void> {
  
  let scheduleApiVersion: ApiVersion | null;
  try {
    scheduleApiVersion = await asyncClientCall(client.version, "getVersion", {});
  } catch (e: any) {
    const ex = e as ServiceError;
    const errors = parseErrorDetails(ex.metadata);
    // 如果找不到获取版本号的接口，指定版本为接口存在前的最新版1.0.0
    if (((e).code === status.UNIMPLEMENTED) ||
      (errors[0] && errors[0].$type === "google.rpc.ErrorInfo" && errors[0].reason === "UNIMPLEMENTED")) {
      scheduleApiVersion = { major: 1, minor: 0, patch: 0 };
      // 适配器请求连接失败的处理
    } else if (((e).code === status.CANCELLED)) {
      throw e;
    } else {
      throw {
        code: Status.UNIMPLEMENTED,
        message: "unimplemented",
        details: "The scheduler API version can not be confirmed."
            + "To use this method, the scheduler adapter must be upgraded to the version "
            + `${minVersion.major}.${minVersion.minor}.${minVersion.patch} `
            + "or higher.",
      } as ServiceError;
    }
  }
  
  if (scheduleApiVersion) {
  
    // 检查调度器接口版本是否大于等于最低要求版本
    let geMinVersion: boolean;
    if (scheduleApiVersion.major !== minVersion.major) {
      geMinVersion = (scheduleApiVersion.major > minVersion.major);
    } else if (scheduleApiVersion.minor !== minVersion.minor) {
      geMinVersion = (scheduleApiVersion.minor > minVersion.minor);
    } else {
      geMinVersion = true;
    }
  
    if (!geMinVersion) {
      throw {
        code: Status.FAILED_PRECONDITION,
        message: "precondition failed",
        details: "The method is not supported with the current scheduler adapter version. "
            + "To use this method, the scheduler adapter must be upgraded to the version "
            + `${minVersion.major}.${minVersion.minor}.${minVersion.patch} `
            + "or higher.",
      } as ServiceError;
    }
  }
  
};
  