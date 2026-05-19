import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { AdminServiceClient, CheckAccountUserSynchronizationRunningResponse } from "@scow/protos/build/server/admin";
import { USE_MOCK } from "src/utils/processEnv";
import { getScowClient } from "src/utils/scowClient";

// 检查当前是否有正在进行的账户用户数据同步
export async function checkSyncAccountUserRunning(): Promise<CheckAccountUserSynchronizationRunningResponse> {
  if (process.env.NODE_ENV === "test" || USE_MOCK) {
    return { isRunning: false };
  }

  const serverAdminClient = getScowClient(AdminServiceClient);
  const isRunning = await asyncClientCall(serverAdminClient, "checkAccountUserSynchronizationRunning", {});

  return isRunning;
}
