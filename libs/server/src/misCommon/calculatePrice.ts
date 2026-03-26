import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Logger } from "@ddadaal/tsgrpc-server";
import { CalculateJobPriceResponse,JobServiceClient }
  from "@scow/protos/build/server/job";

import { getClientFn } from "../api";

interface JobInfo {
  cluster: string;
  partition: string;
  qos: string;
  account: string;
  cpusAlloc: number;
  gpu: number;
  memMb: number;
  timeSeconds: number;
}

export const libCalculateJobPrice = async (
  logger: Logger,
  jobInfo: JobInfo,
  misServerUrl: string,
  scowApiAuthToken?: string,
): Promise<CalculateJobPriceResponse> => {

  const getMisClient = getClientFn(misServerUrl, scowApiAuthToken);
  const client = getMisClient(JobServiceClient);

  try {
    const reply = await asyncClientCall(client, "calculateJobPrice", {
      ...jobInfo,
    });

    return reply;
  } catch (error) {
    logger.error("calculate job price failed : %s",error);
    throw error;
  }
};
