import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { SchedulerAdapterClient } from "@scow/lib-scheduler-adapter";
import { GetAppConnectionInfoResponse } from "@scow/scheduler-adapter-protos/build/app";
import { quote } from "shell-quote";
import { Logger } from "ts-log";

export const getAppConnectionInfoFromAdapter = async (
  client: SchedulerAdapterClient,
  jobId: number,
  logger: Logger,
): Promise<GetAppConnectionInfoResponse | undefined> => {
  try {
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
  Object.keys(env)
    .map((x) => `export ${x}=${quote([env[x] ?? ""])}\n`)
    .join("");
