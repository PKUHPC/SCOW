import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ClusterRuntimeInfo, ConfigServiceClient } from "@scow/protos/build/server/config";
import { getClientFn } from "src/utils/api";

export const libGetClustersRuntimeInfo = async (
  misServerUrl?: string,
  scowApiAuthToken?: string,
): Promise<ClusterRuntimeInfo[]> => {
  // if mis is Deployed
  if (!misServerUrl) {
    return [];
  }

  const config = {
    SERVER_URL: misServerUrl,
    SCOW_API_AUTH_TOKEN: scowApiAuthToken,
  };
  const getMisClient = getClientFn(config);
  const client = getMisClient(ConfigServiceClient);
  try {
    const reply = await asyncClientCall(client, "getClustersRuntimeInfo", {});
    return reply.results;
  } catch (e: any) {
    console.error(e.details);
    return [];
  }
};
