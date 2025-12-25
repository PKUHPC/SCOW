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
import { SchedulerAdapterClient } from "@scow/lib-scheduler-adapter";
import { ErrorInfo, parseErrorStatus } from "@scow/rich-error-model";
import { OptionalFeatures } from "@scow/scheduler-adapter-protos/build/config";
import { ApiVersion } from "@scow/utils/build/version";
import { Logger } from "ts-log";


/**
 * 判断当前集群下的调度器API版本对比传入的接口是否已过时
 * @param client
 * @param minVersion
 */
export async function checkSchedulerApiVersion(client: SchedulerAdapterClient,
  minVersion: ApiVersion): Promise<void> {

  let scheduleApiVersion: ApiVersion | null;
  try {
    scheduleApiVersion = await asyncClientCall(client.version, "getVersion", {});
  } catch (e) {
    const ex = e as ServiceError;

    const { findDetails } = parseErrorStatus(ex.metadata);
    const errors = findDetails(ErrorInfo);


    if (ex.code === Status.UNIMPLEMENTED) {
      scheduleApiVersion = { major: 1, minor: 0, patch: 0 };
    } else if (errors.find((x) => x.reason === "UNIMPLEMENTED")) {
      scheduleApiVersion = { major: 1, minor: 0, patch: 0 };
    } else if (ex.code === status.CANCELLED) {
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
    const geMinVersion = compareSchedulerApiVersion(scheduleApiVersion,minVersion);

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


export function compareSchedulerApiVersion(scheduleApiVersion: ApiVersion, minVersion: ApiVersion): boolean {
  let geMinVersion: boolean;
  if (scheduleApiVersion.major !== minVersion.major) {
    geMinVersion = (scheduleApiVersion.major > minVersion.major);
  } else if (scheduleApiVersion.minor !== minVersion.minor) {
    geMinVersion = (scheduleApiVersion.minor > minVersion.minor);
  } else {
    geMinVersion = true;
  }

  return geMinVersion;
}

export async function getSchedulerApiVersion(client: SchedulerAdapterClient, logger: Logger): Promise<ApiVersion> {
  let scheduleApiVersion: ApiVersion;
  try {
    scheduleApiVersion = await asyncClientCall(client.version, "getVersion", {});
  } catch (e) {
    // 适配器请求连接失败的处理
    if (((e as any).code === status.CANCELLED)) {
      throw e;
    }

    // 如果找不到获取版本号的接口，指定版本为接口存在前的最新版1.0.0
    scheduleApiVersion = { major: 1, minor: 0, patch: 0 };
    logger.info("The scheduler API version can not be confirmed");
  }

  return scheduleApiVersion;
}


/**
 * 判断当前集群下调度器适配器是否包含可选功能
 */
export async function listSchedulerAdapterOptionalFeatures(client: SchedulerAdapterClient, logger: Logger):
Promise<OptionalFeatures[]> {

  const optionalFeatures: OptionalFeatures[] = [];
  try {
    const reply = await asyncClientCall(client.config, "listImplementedOptionalFeatures", {});
    optionalFeatures.push(...reply.features);
  } catch (e) {
    const ex = e as ServiceError;
    if (ex.code === status.UNIMPLEMENTED) {
      logger.info("The current adapter has not implemented any optional features.");
    } else {
      throw e;
    };
  }
  return optionalFeatures;
};


// 检查当前适配器是否可以使用 资源管理 的可选功能接口
export async function ensureResourceManagementFeatureAvailable(
  client: SchedulerAdapterClient,
  logger: Logger): Promise<void> {

  // 需要满足1.8.0版本适配器及以上
  const minRequiredApiVersion: ApiVersion = { major: 1, minor: 8, patch: 0 };

  await checkSchedulerApiVersion(client, minRequiredApiVersion);

  const optionalFeatures = await listSchedulerAdapterOptionalFeatures(client, logger);

  if (!optionalFeatures.includes(OptionalFeatures.RESOURCE_MANAGEMENT)) {
    throw {
      code: Status.FAILED_PRECONDITION,
      message: "precondition failed",
      details: "Resource management feature is not available in the current adapter v"
      + `${minRequiredApiVersion.major}.${minRequiredApiVersion.minor}.${minRequiredApiVersion.patch} .`,
    } as ServiceError;
  }
}


