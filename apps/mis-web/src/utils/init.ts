import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { InitServiceClient } from "@scow/protos/build/server/init";
import { USE_MOCK } from "src/apis/useMock";
import { getClient } from "src/utils/client";

export async function queryIfInitialized() {
  if (USE_MOCK) {
    return false;
  }

  const client = getClient(InitServiceClient);

  const { initialized } = await asyncClientCall(client, "querySystemInitialized", {});

  return initialized;
}
