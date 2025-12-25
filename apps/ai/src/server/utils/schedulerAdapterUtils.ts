import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ServiceError, status } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { ErrorInfo, parseErrorStatus } from "@scow/rich-error-model/build";
import { AppType, GetAppConnectionInfoResponse } from "@scow/scheduler-adapter-protos/build/app";
import { ApiVersion } from "@scow/utils/build/version";
import { Logger } from "ts-log";

import { SchedulerAdapterClient } from "./clusters";
export const getAppConnectionInfoFromAdapterForAi = async (
  client: SchedulerAdapterClient,
  jobId: number,
  logger: Logger,
  appType?: AppType,
): Promise<GetAppConnectionInfoResponse | undefined> => {
  const minRequiredApiVersion: ApiVersion = { major: 1, minor: 3, patch: 0 };
  try {
    await checkSchedulerApiVersionForAi(client, minRequiredApiVersion);
    // get connection info
    // for apps running in containers, it can provide real ip and port info
    const connectionInfo = await asyncClientCall(client.app, "getAppConnectionInfo", { jobId, appType });
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

    const { findDetails } = parseErrorStatus(ex.metadata);

    const errorInfos = findDetails(ErrorInfo);

    // 如果找不到获取版本号的接口，指定版本为接口存在前的最新版1.0.0
    if ((ex.code === status.UNIMPLEMENTED) || errorInfos.find((x) => x.reason === "UNIMPLEMENTED")) {
      scheduleApiVersion = { major: 1, minor: 0, patch: 0 };
      // 适配器请求连接失败的处理
    } else if ((ex.code === status.CANCELLED)) {
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
