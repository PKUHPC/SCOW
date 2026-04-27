import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { AppType, GetAppConnectionInfoResponse } from "@scow/scheduler-adapter-protos/build/app";
import { Logger } from "ts-log";

import { SchedulerAdapterClient } from "./clusters";
export const getAppConnectionInfoFromAdapterForAi = async (
  client: SchedulerAdapterClient,
  jobId: number,
  logger: Logger,
  appType?: AppType,
): Promise<GetAppConnectionInfoResponse | undefined> => {
  try {
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
